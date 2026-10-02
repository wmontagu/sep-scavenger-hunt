/**
 * Tiny key/value store abstraction.
 *
 *  - RedisStore  — used when REDIS_URL is set (Railway Redis plugin, Upstash, etc.).
 *                  Atomic updates via WATCH/MULTI optimistic retries.
 *  - FileStore   — local dev fallback: one JSON file under .data/, serialized by an
 *                  in-process lock. Fine for a single Railway instance too, but data
 *                  is lost on redeploy, so use Redis for the real event.
 *  - MemoryStore — unit tests.
 */
import fs from "node:fs";
import path from "node:path";

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  /**
   * Atomically read-modify-write a key. `fn` receives the current value and returns
   * the next value (or `undefined` to leave it untouched) plus a result to hand back.
   * `fn` may be called more than once under contention, so it must be pure.
   */
  update<T, R>(key: string, fn: (current: T | null) => { next?: T; result: R }): Promise<R>;
  /** Append to a capped list (newest first). */
  push<T>(key: string, value: T, max?: number): Promise<void>;
  list<T>(key: string, limit?: number): Promise<T[]>;
}

/** Simple promise-chain mutex so in-process updates never interleave. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<R>(fn: () => Promise<R> | R): Promise<R> {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

const clone = <T>(v: T): T => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

export class MemoryStore implements Store {
  protected data: Record<string, unknown> = {};
  protected lock = new Mutex();

  protected async load(): Promise<void> {}
  protected async persist(): Promise<void> {}

  async get<T>(key: string): Promise<T | null> {
    return this.lock.run(async () => {
      await this.load();
      return key in this.data ? clone(this.data[key] as T) : null;
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.lock.run(async () => {
      await this.load();
      this.data[key] = clone(value);
      await this.persist();
    });
  }

  async del(key: string): Promise<void> {
    await this.lock.run(async () => {
      await this.load();
      delete this.data[key];
      await this.persist();
    });
  }

  async update<T, R>(key: string, fn: (current: T | null) => { next?: T; result: R }): Promise<R> {
    return this.lock.run(async () => {
      await this.load();
      const current = key in this.data ? clone(this.data[key] as T) : null;
      const { next, result } = fn(current);
      if (next !== undefined) {
        this.data[key] = clone(next);
        await this.persist();
      }
      return result;
    });
  }

  async push<T>(key: string, value: T, max = 200): Promise<void> {
    await this.lock.run(async () => {
      await this.load();
      const arr = (this.data[key] as T[] | undefined) ?? [];
      arr.unshift(clone(value));
      this.data[key] = arr.slice(0, max);
      await this.persist();
    });
  }

  async list<T>(key: string, limit = 200): Promise<T[]> {
    return this.lock.run(async () => {
      await this.load();
      return clone(((this.data[key] as T[] | undefined) ?? []).slice(0, limit));
    });
  }
}

export class FileStore extends MemoryStore {
  constructor(private file: string) {
    super();
  }

  protected async load(): Promise<void> {
    try {
      this.data = JSON.parse(await fs.promises.readFile(this.file, "utf8"));
    } catch {
      this.data = {};
    }
  }

  protected async persist(): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(this.data, null, 2));
    await fs.promises.rename(tmp, this.file);
  }
}

// Minimal structural type for the ioredis client we use, so tests can fake it.
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  watch(key: string): Promise<unknown>;
  unwatch(): Promise<unknown>;
  multi(): { set(key: string, value: string): unknown; exec(): Promise<unknown[] | null> };
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  duplicate(): RedisLike;
  quit(): Promise<unknown>;
}

export class RedisStore implements Store {
  constructor(private redis: RedisLike) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.redis.set(key, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async update<T, R>(key: string, fn: (current: T | null) => { next?: T; result: R }): Promise<R> {
    // WATCH is per-connection, so use a dedicated connection per update to avoid
    // concurrent requests clobbering each other's WATCH state.
    const conn = this.redis.duplicate();
    try {
      for (let attempt = 0; attempt < 25; attempt++) {
        await conn.watch(key);
        const raw = await conn.get(key);
        const current = raw === null ? null : (JSON.parse(raw) as T);
        const { next, result } = fn(current);
        if (next === undefined) {
          await conn.unwatch();
          return result;
        }
        const tx = conn.multi();
        tx.set(key, JSON.stringify(next));
        const res = await tx.exec();
        if (res !== null) return result; // committed
        // null => key changed under us; retry with fresh value
      }
      throw new Error(`RedisStore.update: too much contention on ${key}`);
    } finally {
      conn.quit().catch(() => undefined);
    }
  }

  async push<T>(key: string, value: T, max = 200): Promise<void> {
    await this.redis.lpush(key, JSON.stringify(value));
    await this.redis.ltrim(key, 0, max - 1);
  }

  async list<T>(key: string, limit = 200): Promise<T[]> {
    const raw = await this.redis.lrange(key, 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as T);
  }
}

// ---- singleton wiring -------------------------------------------------------

const g = globalThis as unknown as { __huntStore?: Store };

export function getStore(): Store {
  if (g.__huntStore) return g.__huntStore;
  if (process.env.REDIS_URL) {
    // Lazy require so the file/memory paths never need a Redis connection.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis");
    const Redis = IORedis.default ?? IORedis;
    // Railway's private networking is IPv6-only; family 0 lets ioredis use either.
    g.__huntStore = new RedisStore(new Redis(process.env.REDIS_URL, { family: 0, maxRetriesPerRequest: 3 }));
  } else {
    const file = process.env.HUNT_DATA_FILE ?? path.join(process.cwd(), ".data", "hunt.json");
    g.__huntStore = new FileStore(file);
  }
  return g.__huntStore!;
}

/** Test hook. */
export function setStore(store: Store | undefined): void {
  g.__huntStore = store;
}
