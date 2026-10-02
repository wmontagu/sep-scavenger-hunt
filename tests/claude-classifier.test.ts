/**
 * The Claude provider, with @anthropic-ai/sdk mocked out - no network, no credits.
 * Checks the request shape and the fallback / budget behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();
const ctorOpts: unknown[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = { parse };
    constructor(opts: unknown) {
      ctorOpts.push(opts);
    }
  }
  return { default: FakeAnthropic };
});

import { parseDataUrl, reserveAiCall, setClassifierOverride, verifyImage } from "@/lib/verify-image";
import { freshEnv, TINY_PNG } from "./helpers";

const img = parseDataUrl(TINY_PNG)!;

beforeEach(() => {
  freshEnv();
  setClassifierOverride(undefined); // use real provider selection
  process.env.IMAGE_VERIFIER = "claude";
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  parse.mockReset();
  ctorOpts.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  delete process.env.IMAGE_VERIFIER;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.IMAGE_MAX_AI_CALLS;
  delete process.env.CLAUDE_VISION_MODEL;
});

describe("claude classifier (mocked SDK)", () => {
  it("sends the image + configured prompt with a structured yes/no schema", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { matches: true } });
    const r = await verifyImage("7b_cathedral", img);
    expect(r).toMatchObject({ outcome: "approved", provider: "claude" });

    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.output_config.effort).toBe("low");
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req.output_config.format.schema.properties.matches.type).toBe("boolean");
    expect(req.output_config.format.schema.required).toEqual(["matches"]);
    const [imageBlock, textBlock] = req.messages[0].content;
    expect(imageBlock).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: img.base64 } });
    expect(textBlock.text).toContain("3 people standing in front of a tall Gothic stone building");
    expect(ctorOpts[0]).toMatchObject({ maxRetries: 1 });
  });

  it("CLAUDE_VISION_MODEL overrides the model", async () => {
    process.env.CLAUDE_VISION_MODEL = "claude-haiku-4-5";
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { matches: false } });
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("rejected");
    expect(parse.mock.calls[0][0].model).toBe("claude-haiku-4-5");
  });

  it("refusal / unparsed output → manual review", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("manual");
  });

  it("API errors (e.g. rate limit) → manual review", async () => {
    parse.mockRejectedValue(new Error("429 rate_limit_error"));
    const r = await verifyImage("7b_cathedral", img);
    expect(r.outcome).toBe("manual");
    expect(r.detail).toContain("429");
  });

  it("stops calling the API once the per-run budget is spent", async () => {
    process.env.IMAGE_MAX_AI_CALLS = "2";
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { matches: false } });
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("rejected");
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("rejected");
    const third = await verifyImage("7b_cathedral", img);
    expect(third.outcome).toBe("manual");
    expect(third.detail).toContain("budget");
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("budget of 0 disables paid calls entirely", async () => {
    process.env.IMAGE_MAX_AI_CALLS = "0";
    expect(await reserveAiCall()).toBe(false);
    expect((await verifyImage("7b_cathedral", img)).outcome).toBe("manual");
    expect(parse).not.toHaveBeenCalled();
  });

  it("concurrent reservations never exceed the cap", async () => {
    process.env.IMAGE_MAX_AI_CALLS = "5";
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveAiCall()));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});
