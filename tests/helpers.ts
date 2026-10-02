import path from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import { MemoryStore, setStore } from "@/lib/store";
import { setClassifierOverride } from "@/lib/verify-image";
import { resetRateLimits } from "@/lib/rate-limit";

export const FIXTURE_CONTENT = path.join(__dirname, "fixtures", "content");
export const REAL_CONTENT = path.join(__dirname, "..", "content");

/** Fresh in-memory store + fixture content + no real image classifier. */
export function freshEnv(): MemoryStore {
  process.env.HUNT_CONTENT_DIR = FIXTURE_CONTENT;
  delete process.env.HUNT_ANSWERS_JSON;
  delete process.env.IMAGE_NO_GOES_TO_MANUAL;
  process.env.EXEC_PASSCODE = "test-pass";
  const store = new MemoryStore();
  setStore(store);
  setClassifierOverride(null); // force manual unless a test overrides
  resetRateLimits();
  return store;
}

export interface MockRes {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
}

export async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  opts: { method?: string; body?: unknown; query?: Record<string, string>; headers?: Record<string, string> } = {},
): Promise<MockRes> {
  const out: MockRes = { statusCode: 200, body: undefined, headers: {} };
  const req = {
    method: opts.method ?? "GET",
    body: opts.body,
    query: opts.query ?? {},
    headers: { "x-forwarded-for": "10.0.0.1", ...(opts.headers ?? {}) },
    socket: { remoteAddress: "10.0.0.1" },
  } as unknown as NextApiRequest;
  const res = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
  } as unknown as NextApiResponse;
  await handler(req, res);
  return out;
}

export const EXEC = { "x-exec-passcode": "test-pass" };

/** 1x1 transparent PNG as a data URL. */
export const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
