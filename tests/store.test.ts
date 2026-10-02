import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileStore, MemoryStore, RedisStore, type Store } from "@/lib/store";

async function hammer(store: Store, n = 100) {
  await Promise.all(
    Array.from({ length: n }, () =>
      store.update<number, void>("n", (cur) => ({ next: (cur ?? 0) + 1, result: undefined })),
    ),
  );
}

describe("MemoryStore", () => {
  it("serializes concurrent updates", async () => {
    const s = new MemoryStore();
    await hammer(s);
    expect(await s.get<number>("n")).toBe(100);
  });

  it("returns copies, not live references", async () => {
    const s = new MemoryStore();
    await s.set("k", { a: 1 });
    const v = (await s.get<{ a: number }>("k"))!;
    v.a = 2;
    expect((await s.get<{ a: number }>("k"))!.a).toBe(1);
  });

  it("update with no `next` leaves the value alone", async () => {
    const s = new MemoryStore();
    await s.set("k", 1);
    expect(await s.update<number, string>("k", () => ({ result: "x" }))).toBe("x");
    expect(await s.get("k")).toBe(1);
  });

  it("capped lists are newest-first", async () => {
    const s = new MemoryStore();
    for (let i = 0; i < 5; i++) await s.push("l", i, 3);
    expect(await s.list("l")).toEqual([4, 3, 2]);
  });
});

describe("FileStore", () => {
  it("persists across instances and handles concurrency", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hunt-")), "db.json");
    const a = new FileStore(file);
    await hammer(a);
    const b = new FileStore(file);
    expect(await b.get<number>("n")).toBe(100);
  });
});

/** In-memory fake of the ioredis subset RedisStore uses, with real WATCH semantics. */
class FakeRedis {
  data = new Map<string, string>();
  lists = new Map<string, string[]>();
  versions = new Map<string, number>();
  private watched: { key: string; version: number } | null = null;
  constructor(private shared?: FakeRedis) {}
  private root(): FakeRedis {
    return this.shared ?? this;
  }
  private bump(k: string) {
    const r = this.root();
    r.versions.set(k, (r.versions.get(k) ?? 0) + 1);
  }
  async get(k: string) {
    // yield so concurrent updates genuinely interleave
    await new Promise((r) => setTimeout(r, Math.random() * 2));
    return this.root().data.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.root().data.set(k, v);
    this.bump(k);
    return "OK";
  }
  async del(k: string) {
    this.root().data.delete(k);
    this.bump(k);
    return 1;
  }
  async watch(k: string) {
    this.watched = { key: k, version: this.root().versions.get(k) ?? 0 };
    return "OK";
  }
  async unwatch() {
    this.watched = null;
    return "OK";
  }
  multi() {
    const ops: [string, string][] = [];
    return {
      set: (k: string, v: string) => ops.push([k, v]),
      exec: async () => {
        const w = this.watched;
        this.watched = null;
        if (w && (this.root().versions.get(w.key) ?? 0) !== w.version) return null;
        for (const [k, v] of ops) await this.set(k, v);
        return ops.map(() => [null, "OK"]);
      },
    };
  }
  async lpush(k: string, v: string) {
    const l = this.root().lists.get(k) ?? [];
    l.unshift(v);
    this.root().lists.set(k, l);
    return l.length;
  }
  async ltrim(k: string, a: number, b: number) {
    this.root().lists.set(k, (this.root().lists.get(k) ?? []).slice(a, b + 1));
    return "OK";
  }
  async lrange(k: string, a: number, b: number) {
    return (this.root().lists.get(k) ?? []).slice(a, b + 1);
  }
  duplicate() {
    return new FakeRedis(this.root());
  }
  async quit() {
    return "OK";
  }
}

describe("RedisStore (fake redis with WATCH/MULTI)", () => {
  it("retries on conflict so no update is lost", async () => {
    const s = new RedisStore(new FakeRedis() as never);
    await hammer(s, 20);
    expect(await s.get<number>("n")).toBe(20);
  });

  it("round-trips JSON and lists", async () => {
    const s = new RedisStore(new FakeRedis() as never);
    await s.set("k", { a: [1, 2] });
    expect(await s.get("k")).toEqual({ a: [1, 2] });
    await s.push("l", { x: 1 }, 2);
    await s.push("l", { x: 2 }, 2);
    await s.push("l", { x: 3 }, 2);
    expect(await s.list("l")).toEqual([{ x: 3 }, { x: 2 }]);
    await s.del("k");
    expect(await s.get("k")).toBeNull();
  });
});
