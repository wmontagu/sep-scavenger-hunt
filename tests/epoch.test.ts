import { beforeEach, describe, expect, it } from "vitest";
import { getBoard, publicState, resetBoard } from "@/lib/board";
import { reserveAiCall } from "@/lib/verify-image";
import { syncEpoch } from "@/components/client-utils";
import { freshEnv } from "./helpers";

class FakeStorage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

beforeEach(() => {
  freshEnv();
});

describe("board epoch", () => {
  it("is stable until a reset, then changes every reset", async () => {
    const a = (await getBoard()).epoch;
    expect((await getBoard()).epoch).toBe(a);
    const b = (await resetBoard()).epoch;
    expect(b).not.toBe(a);
    expect((await getBoard()).epoch).toBe(b);
    expect((await resetBoard()).epoch).not.toBe(b);
  });

  it("is exposed in public state", async () => {
    const b = await resetBoard();
    expect(publicState(await getBoard()).epoch).toBe(b.epoch);
  });

  it("reset also refills the AI call budget", async () => {
    process.env.IMAGE_MAX_AI_CALLS = "1";
    try {
      expect(await reserveAiCall()).toBe(true);
      expect(await reserveAiCall()).toBe(false);
      await resetBoard();
      expect(await reserveAiCall()).toBe(true);
    } finally {
      delete process.env.IMAGE_MAX_AI_CALLS;
    }
  });
});

describe("syncEpoch (client)", () => {
  it("first visit: records the epoch, nothing to reload", () => {
    const s = new FakeStorage();
    expect(syncEpoch("e1", s)).toBe(false);
    expect(s.getItem("hunt:epoch")).toBe("e1");
  });

  it("same epoch: keeps the device's share", () => {
    const s = new FakeStorage();
    s.setItem("hunt:epoch", "e1");
    s.setItem("hunt:share:6_gates", "MGNI");
    expect(syncEpoch("e1", s)).toBe(false);
    expect(s.getItem("hunt:share:6_gates")).toBe("MGNI");
  });

  it("after a reset: drops stale shares / photo ids / thread, keeps exec passcode and other apps' keys", () => {
    const s = new FakeStorage();
    s.setItem("hunt:epoch", "dry-run");
    s.setItem("hunt:share:6_gates", "MGNI");
    s.setItem("hunt:review:7b_cathedral", "abc");
    s.setItem("hunt:thread", "local");
    s.setItem("hunt:exec-pass", "secret");
    s.setItem("unrelated", "x");
    expect(syncEpoch("event-day", s)).toBe(true);
    expect(s.getItem("hunt:share:6_gates")).toBeNull();
    expect(s.getItem("hunt:review:7b_cathedral")).toBeNull();
    expect(s.getItem("hunt:thread")).toBeNull();
    expect(s.getItem("hunt:exec-pass")).toBe("secret");
    expect(s.getItem("unrelated")).toBe("x");
    expect(s.getItem("hunt:epoch")).toBe("event-day");
    // and no reload loop on the next poll
    expect(syncEpoch("event-day", s)).toBe(false);
  });

  it("no storage available → no-op", () => {
    expect(syncEpoch("e", null)).toBe(false);
  });
});
