/**
 * Real-Redis integration test. Skipped unless REDIS_TEST_URL is set, e.g.
 *   docker run --rm -p 6379:6379 redis:7
 *   REDIS_TEST_URL=redis://localhost:6379 npm test
 * or point it at the Railway Redis (public URL). Uses its own key prefix and cleans up.
 */
import { afterAll, describe, expect, it } from "vitest";
import IORedis from "ioredis";
import { RedisStore } from "@/lib/store";

const url = process.env.REDIS_TEST_URL;
const prefix = `hunt-test:${Date.now()}:`;

describe.skipIf(!url)("RedisStore against a real Redis", () => {
  const redis = url ? new IORedis(url, { family: 0, maxRetriesPerRequest: 3 }) : (null as never);
  const store = url ? new RedisStore(redis as never) : (null as never);

  afterAll(async () => {
    if (!url) return;
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  it("set/get/del round-trip", async () => {
    await store.set(`${prefix}k`, { a: 1 });
    expect(await store.get(`${prefix}k`)).toEqual({ a: 1 });
    await store.del(`${prefix}k`);
    expect(await store.get(`${prefix}k`)).toBeNull();
  });

  it("WATCH/MULTI update loses nothing under contention", async () => {
    await Promise.all(
      Array.from({ length: 25 }, () =>
        store.update<number, void>(`${prefix}n`, (cur) => ({ next: (cur ?? 0) + 1, result: undefined })),
      ),
    );
    expect(await store.get(`${prefix}n`)).toBe(25);
  }, 30_000);

  it("only one concurrent updater wins a first-solve race", async () => {
    const wins = await Promise.all(
      Array.from({ length: 10 }, () =>
        store.update<{ solved: boolean }, boolean>(`${prefix}race`, (cur) =>
          cur?.solved ? { result: false } : { next: { solved: true }, result: true },
        ),
      ),
    );
    expect(wins.filter(Boolean)).toHaveLength(1);
  }, 30_000);

  it("capped lists", async () => {
    for (let i = 0; i < 5; i++) await store.push(`${prefix}l`, i, 3);
    expect(await store.list(`${prefix}l`)).toEqual([4, 3, 2]);
  });
});
