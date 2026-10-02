import { beforeEach, describe, expect, it } from "vitest";
import {
  a1z26,
  checkContent,
  checkTextAnswer,
  expectedAnswer,
  getAnswers,
  interleave,
  normalize,
} from "@/lib/stage-config";
import { FIXTURE_CONTENT, REAL_CONTENT } from "./helpers";

beforeEach(() => {
  process.env.HUNT_CONTENT_DIR = FIXTURE_CONTENT;
  delete process.env.HUNT_ANSWERS_JSON;
});

describe("normalize / matching", () => {
  it("is case-insensitive, trimmed, and ignores spaces/punctuation", () => {
    expect(normalize("  mc Ginnis! ")).toBe("MCGINNIS");
    expect(checkTextAnswer("8_convergence", "mcginnis")).toBe(true);
    expect(checkTextAnswer("8_convergence", " McGinnis\n")).toBe(true);
    expect(checkTextAnswer("1_cap_table", "b-r-a-v-e")).toBe(true);
    expect(checkTextAnswer("7a_wqed", "Launch")).toBe(true);
    expect(checkTextAnswer("6_gates", "x7q2")).toBe(true);
  });

  it("rejects wrong, partial, and empty answers", () => {
    expect(checkTextAnswer("1_cap_table", "BRAV")).toBe(false);
    expect(checkTextAnswer("1_cap_table", "BRAVER")).toBe(false);
    expect(checkTextAnswer("1_cap_table", "")).toBe(false);
    expect(checkTextAnswer("8_convergence", "MGNICINS")).toBe(false);
  });

  it("image stage has no text answer", () => {
    expect(expectedAnswer("7b_cathedral")).toBeNull();
    expect(checkTextAnswer("7b_cathedral", "anything")).toBe(false);
  });
});

describe("placeholders", () => {
  it("unfilled (null) answers reject everything, including 'null' and ''", () => {
    const a = structuredClone(getAnswers());
    a["6_gates"] = { ...a["6_gates"], code: null, also_accept: ["X7Q2"] };
    expect(expectedAnswer("6_gates", a)).toBeNull();
    expect(checkTextAnswer("6_gates", "null", a)).toBe(false);
    expect(checkTextAnswer("6_gates", "", a)).toBe(false);
    // an alternate never solves the stage while the primary code is unset
    expect(checkTextAnswer("6_gates", "X7Q2", a)).toBe(false);
  });

  it("the real content is fully filled in", () => {
    process.env.HUNT_CONTENT_DIR = REAL_CONTENT;
    expect(checkContent()).toEqual([]);
  });

  it("the fully-filled fixture has no problems", () => {
    expect(checkContent()).toEqual([]);
  });
});

describe("real answers", () => {
  it("stage 1 BRAVE and stage 2 FUNDED are live", () => {
    process.env.HUNT_CONTENT_DIR = REAL_CONTENT;
    expect(checkTextAnswer("1_cap_table", "brave")).toBe(true);
    expect(checkTextAnswer("2_term_sheet", "Funded")).toBe(true);
  });

  it("FUNDED matches the visible term-sheet numbers (6%, 21%, 14x, 4 seats, 5-mo cliff, 4-mo runway)", () => {
    expect(a1z26("FUNDED")).toEqual([6, 21, 14, 4, 5, 4]);
  });

  it("stage 3 SM81 is live (case/space-insensitive)", () => {
    process.env.HUNT_CONTENT_DIR = REAL_CONTENT;
    expect(expectedAnswer("3_pitch_deck")).toBe("SM81");
    expect(checkTextAnswer("3_pitch_deck", "s m 8 1")).toBe(true);
    expect(checkTextAnswer("3_pitch_deck", "sm81")).toBe(true);
    expect(checkTextAnswer("3_pitch_deck", "SM82")).toBe(false);
    expect(checkTextAnswer("3_pitch_deck", "M81")).toBe(false);
  });

  it("stage 6 accepts X7G0 and X7GO, and the card math gives 42 steps", () => {
    process.env.HUNT_CONTENT_DIR = REAL_CONTENT;
    expect(checkTextAnswer("6_gates", "X7G0")).toBe(true);
    expect(checkTextAnswer("6_gates", "x7go")).toBe(true);
    expect(checkTextAnswer("6_gates", "x 7 g 0")).toBe(true);
    expect(checkTextAnswer("6_gates", "X7G")).toBe(false);
    expect(checkTextAnswer("6_gates", "X7GQ")).toBe(false);
    expect(checkTextAnswer("6_gates", "42")).toBe(false);
    const g = getAnswers()["6_gates"];
    expect(g.step_count).toBe(42);
    expect(g.cash_on_hand_k! / g.burn_rate_k!).toBe(42);
  });

  it("a '?' in an answer means not-known-yet: nothing matches, not even the literal", () => {
    const a = getAnswers();
    a["3_pitch_deck"].answer = "?M81";
    expect(expectedAnswer("3_pitch_deck", a)).toBeNull();
    expect(checkTextAnswer("3_pitch_deck", "?M81", a)).toBe(false);
    expect(checkTextAnswer("3_pitch_deck", "AM81", a)).toBe(false);
  });
});

describe("content consistency checks", () => {
  it("flags Gates math that does not divide cleanly", () => {
    const a = getAnswers();
    a["6_gates"] = { ...a["6_gates"], cash_on_hand_k: 300 };
    expect(checkContent(a).some((p) => p.level === "error" && p.message.includes("6_gates"))).toBe(true);
  });

  it("flags shares that do not interleave into the final answer", () => {
    const a = getAnswers();
    a.shares = { local: "MGNX", global: "CINS" };
    expect(checkContent(a).some((p) => p.message.includes("shares"))).toBe(true);
  });

  it("MGNI + CINS interleave to MCGINNIS", () => {
    expect(interleave("MGNI", "CINS")).toBe("MCGINNIS");
  });

  it("a1z26 helper for the term sheet", () => {
    expect(a1z26("seed")).toEqual([19, 5, 5, 4]);
  });
});

describe("HUNT_ANSWERS_JSON env override", () => {
  it("wins over the file", () => {
    const a = getAnswers();
    a["1_cap_table"].answer = "OTHER";
    process.env.HUNT_ANSWERS_JSON = JSON.stringify(a);
    expect(checkTextAnswer("1_cap_table", "other")).toBe(true);
    expect(checkTextAnswer("1_cap_table", "brave")).toBe(false);
  });
});
