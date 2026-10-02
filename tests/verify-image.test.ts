import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDataUrl, selectClassifier, setClassifierOverride, verifyImage, type ImageInput } from "@/lib/verify-image";
import { freshEnv, TINY_PNG } from "./helpers";

const img = parseDataUrl(TINY_PNG)!;

beforeEach(() => {
  freshEnv();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.IMAGE_NO_GOES_TO_MANUAL;
});

describe("selectClassifier", () => {
  it("auto: claude if ANTHROPIC_API_KEY, else jev if configured, else manual", () => {
    expect(selectClassifier({}).name).toBe("manual");
    expect(selectClassifier({ ANTHROPIC_API_KEY: "k" }).name).toBe("claude");
    expect(selectClassifier({ JEV_API_KEY: "k", JEV_API_URL: "https://x" }).name).toBe("jev");
    expect(selectClassifier({ JEV_API_KEY: "k" }).name).toBe("manual");
  });

  it("explicit choice wins (manual never spends credits even with a key present)", () => {
    expect(selectClassifier({ IMAGE_VERIFIER: "manual", ANTHROPIC_API_KEY: "k" }).name).toBe("manual");
    expect(selectClassifier({ IMAGE_VERIFIER: "jev" }).name).toBe("jev");
    expect(selectClassifier({ IMAGE_VERIFIER: "mock-yes" }).name).toBe("mock-yes");
  });
});

describe("verifyImage", () => {
  it("passes the stage's configured prompt to the classifier", async () => {
    const fn = vi.fn(async (_prompt: string, _image: ImageInput) => "yes" as const);
    setClassifierOverride(fn);
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("approved");
    expect(fn.mock.calls[0][0]).toContain("3 people standing in front of a tall Gothic stone building");
    expect(fn.mock.calls[0][1]).toEqual(img);
  });

  it("no → rejected, or manual when IMAGE_NO_GOES_TO_MANUAL=true", async () => {
    setClassifierOverride(async () => "no");
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("rejected");
    process.env.IMAGE_NO_GOES_TO_MANUAL = "true";
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("manual");
  });

  it("errors fall back to manual review instead of hard-failing", async () => {
    setClassifierOverride(async () => {
      throw new Error("boom");
    });
    const r = await verifyImage("7b_cathedral", img);
    expect(r).toMatchObject({ outcome: "manual", detail: "boom" });
  });

  it("no classifier → manual", async () => {
    setClassifierOverride(null);
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("manual");
  });

  it("jev adapter parses yes/no from the HTTP response", async () => {
    setClassifierOverride(undefined);
    process.env.IMAGE_VERIFIER = "jev";
    process.env.JEV_API_URL = "https://jev.example/classify";
    process.env.JEV_API_KEY = "secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ answer: "Yes" })));
    try {
      expect((await verifyImage("7b_cathedral", img)).outcome).toBe("approved");
      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
      fetchSpy.mockResolvedValue(new Response("", { status: 429 }));
      expect((await verifyImage("7b_cathedral", img)).outcome).toBe("manual");
    } finally {
      fetchSpy.mockRestore();
      delete process.env.IMAGE_VERIFIER;
      delete process.env.JEV_API_URL;
      delete process.env.JEV_API_KEY;
    }
  });
});

describe("parseDataUrl", () => {
  it("accepts common image types", () => {
    expect(parseDataUrl(TINY_PNG)?.mediaType).toBe("image/png");
    expect(parseDataUrl("data:image/jpeg;base64,/9j/4AAQ")?.mediaType).toBe("image/jpeg");
  });

  it("rejects everything else", () => {
    expect(parseDataUrl(undefined)).toBeNull();
    expect(parseDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(parseDataUrl("data:text/plain;base64,aGk=")).toBeNull();
    expect(parseDataUrl("data:image/png;base64,")).toBeNull();
    expect(parseDataUrl("data:image/png;base64," + "A".repeat(8 * 1024 * 1024))).toBeNull();
  });
});
