import { beforeEach, describe, expect, it } from "vitest";
import {
  claimReview,
  createReview,
  decideReview,
  getBoard,
  initialBoard,
  markSolved,
  publicState,
  resetBoard,
  setFlag,
  setStageSolved,
  verifyText,
} from "@/lib/board";
import type { MemoryStore } from "@/lib/store";
import { freshEnv, TINY_PNG } from "./helpers";

let store: MemoryStore;
beforeEach(() => {
  store = freshEnv();
});

/** Everything that must never show up in /api/state before it's earned. */
const SECRETS = ["MGNI", "CINS", "BRAVE", "SEED", "PITCH", "X7Q2", "LAUNCH", "MCGINNIS", "Gothic"];

function leaks(obj: unknown, allowed: string[] = []): string[] {
  const s = JSON.stringify(obj);
  return SECRETS.filter((x) => !allowed.includes(x) && s.includes(x));
}

describe("initial state", () => {
  it("matches the README data model", () => {
    const b = initialBoard();
    expect(Object.keys(b.stages)).toEqual([
      "1_cap_table",
      "2_term_sheet",
      "3_pitch_deck",
      "4_fence",
      "6_gates",
      "7a_wqed",
      "7b_cathedral",
      "8_convergence",
    ]);
    expect(b.local_share).toBeNull();
    expect(b.global_share).toBeNull();
    expect(b.ransom_note_visible).toBe(false);
    expect(b.complete).toBe(false);
  });

  it("public state shows only the indoor board until the outdoor board opens", async () => {
    const ps = publicState(await getBoard());
    expect(ps.indoor.map((s) => s.id)).toEqual(["1_cap_table", "2_term_sheet", "3_pitch_deck"]);
    expect(ps.local).toEqual([]);
    expect(ps.global).toEqual([]);
    expect(ps.convergence).toBeNull();
    expect(ps.ransom_note).toBeNull();
    expect(JSON.stringify(ps)).not.toContain("broadcast");
    expect(leaks(ps)).toEqual([]);
  });
});

describe("indoor stages", () => {
  it("wrong answers return exactly { success: false }", async () => {
    expect(await verifyText("1_cap_table", "BRAV")).toEqual({ success: false });
  });

  it("correct answers solve and re-submits report already_solved", async () => {
    expect(await verifyText("1_cap_table", "brave")).toEqual({ success: true });
    expect(await verifyText("1_cap_table", "brave")).toEqual({ success: true, already_solved: true });
    expect((await getBoard()).stages["1_cap_table"].solved).toBe(true);
  });

  it("indoor stages are independent (no ordering)", async () => {
    expect((await verifyText("3_pitch_deck", "pitch")).success).toBe(true);
    expect((await verifyText("2_term_sheet", "seed")).success).toBe(true);
  });
});

describe("outdoor gating", () => {
  it("outdoor stages reject even correct answers until the board opens", async () => {
    expect(await verifyText("4_fence", "HUNT")).toEqual({ success: false });
    expect(await verifyText("6_gates", "X7Q2")).toEqual({ success: false });
    expect(await verifyText("7a_wqed", "LAUNCH")).toEqual({ success: false });
    expect(await verifyText("8_convergence", "MCGINNIS")).toEqual({ success: false });
    expect((await getBoard()).stages["6_gates"].solved).toBe(false);
  });

  it("the outdoor board opens by itself once all three indoor stages are solved", async () => {
    await verifyText("1_cap_table", "BRAVE");
    await verifyText("2_term_sheet", "SEED");
    expect(publicState(await getBoard()).outdoor_open).toBe(false);
    expect(await verifyText("4_fence", "HUNT")).toEqual({ success: false });

    await verifyText("3_pitch_deck", "PITCH");
    const ps = publicState(await getBoard());
    expect(ps.outdoor_open).toBe(true);
    expect(ps.local.map((s) => s.id)).toEqual(["4_fence"]);
    expect(ps.global.map((s) => s.id)).toEqual(["7a_wqed"]);
    expect((await verifyText("4_fence", "HUNT")).success).toBe(true);
  });

  it("7b is hidden and locked until 7a is solved", async () => {
    await setFlag("outdoor_open", true);
    let ps = publicState(await getBoard());
    expect(ps.global.map((s) => s.id)).toEqual(["7a_wqed"]);
    expect(JSON.stringify(ps)).not.toContain("tallest");
    expect(ps.global[0].clue).toContain("broadcast empires");
    expect(ps.global[0].overlay).toBe("/layout.png");

    const r = await verifyText("7a_wqed", "launch");
    expect(r.success).toBe(true);
    expect(r.next_clue).toContain("tallest building within a mile");

    ps = publicState(await getBoard());
    expect(ps.global.map((s) => s.id)).toEqual(["7a_wqed", "7b_cathedral"]);
    expect(ps.global[1].input).toBe("image");
    expect(ps.global[1].clue).toContain("tallest");
  });

  it("Gates is hidden and locked until the Fence (HUNT) is solved", async () => {
    await setFlag("outdoor_open", true);
    let ps = publicState(await getBoard());
    expect(ps.local.map((s) => s.id)).toEqual(["4_fence"]);
    expect(ps.local[0].clue).toContain("guerrilla marketing");
    expect(ps.threads.local.title).toBe("Stay close, dig deep");
    expect(JSON.stringify(ps)).not.toContain("5:30"); // written on the bench, never on screen
    expect(JSON.stringify(ps)).not.toContain("childhood dreams");
    expect(JSON.stringify(ps)).not.toContain("spiraling");
    expect(leaks(ps)).toEqual([]);
    expect(JSON.stringify(ps)).not.toContain("HUNT");
    expect(await verifyText("6_gates", "X7Q2")).toEqual({ success: false });

    expect(await verifyText("4_fence", "HUNTER")).toEqual({ success: false });
    const r = await verifyText("4_fence", "Hunt Library");
    expect(r.success).toBe(true);
    expect(r.next_clue).toContain("childhood dreams");
    expect(r.next_clue).toContain("$280K");
    expect((await verifyText("4_fence", "hunt")).already_solved).toBe(true);

    ps = publicState(await getBoard());
    expect(ps.local.map((s) => s.id)).toEqual(["4_fence", "6_gates"]);
    expect(ps.local[1].clue).toContain("childhood dreams");
    expect(ps.local[1].clue).toContain("Burn rate: $20K/month");
    expect((await verifyText("6_gates", "X7Q2")).success).toBe(true);
  });
});

describe("shares", () => {
  beforeEach(async () => {
    await setFlag("outdoor_open", true);
    await verifyText("4_fence", "HUNT");
  });

  it("6_gates returns MGNI only to the solving request and never via state", async () => {
    const r = await verifyText("6_gates", "x7q2");
    expect(r).toMatchObject({ success: true, share: "MGNI" });
    expect(r.share_message).toContain("find whoever took the other path");
    const again = await verifyText("6_gates", "x7q2");
    expect(again.share).toBeUndefined();
    expect(again.already_solved).toBe(true);
    const board = await getBoard();
    expect(board.local_share).toBe("MGNI"); // written to KV...
    expect(leaks(publicState(board))).toEqual([]); // ...but not exposed
  });

  it("concurrent correct submissions: exactly one gets the share", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => verifyText("6_gates", "X7Q2")));
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.filter((r) => r.share === "MGNI")).toHaveLength(1);
  });

  it("7b approval via markSolved returns CINS once", async () => {
    await verifyText("7a_wqed", "LAUNCH");
    const r = await markSolved("7b_cathedral");
    expect(r.share).toBe("CINS");
    expect((await markSolved("7b_cathedral")).share).toBeUndefined();
    expect(leaks(publicState(await getBoard()))).toEqual([]);
  });
});

describe("convergence → ransom note → complete", () => {
  it("full happy path", async () => {
    for (const [s, a] of [
      ["1_cap_table", "BRAVE"],
      ["2_term_sheet", "SEED"],
      ["3_pitch_deck", "PITCH"],
    ] as const) {
      expect((await verifyText(s, a)).success).toBe(true);
    }
    await setFlag("outdoor_open", true);

    expect((await verifyText("4_fence", "HUNT")).success).toBe(true);
    const local = await verifyText("6_gates", "X7Q2");
    expect(publicState(await getBoard()).convergence).toBeNull();
    await verifyText("7a_wqed", "LAUNCH");
    const global = await markSolved("7b_cathedral");
    expect(publicState(await getBoard()).convergence?.id).toBe("8_convergence");
    expect(publicState(await getBoard()).convergence?.prompt).not.toMatch(/interleave|local first/i);

    // interleave local-first
    let combined = "";
    for (let i = 0; i < 4; i++) combined += local.share![i] + global.share![i];
    expect(combined).toBe("MCGINNIS");

    expect(publicState(await getBoard()).ransom_note).toBeNull();
    const r8 = await verifyText("8_convergence", combined.toLowerCase());
    expect(r8.success).toBe(true);
    expect(r8.reveal).toBeTruthy();

    const ps = publicState(await getBoard());
    expect(ps.ransom_note).toContain("$61M");
    expect(ps.ransom_note).toContain("Take a bus");
    expect(ps.complete).toBe(false);
    expect(ps.complete_message).toBeNull();
    expect(leaks(ps, ["MCGINNIS"])).toEqual([]);

    await setFlag("complete", true);
    const done = publicState(await getBoard());
    expect(done.complete).toBe(true);
    expect(done.complete_message).toBeTruthy();
  });

  it("convergence stays hidden AND locked until BOTH threads have a share", async () => {
    await setFlag("outdoor_open", true);
    expect(publicState(await getBoard()).convergence).toBeNull();
    expect(await verifyText("8_convergence", "MCGINNIS")).toEqual({ success: false });
    await verifyText("4_fence", "HUNT");
    await verifyText("6_gates", "X7Q2");
    expect(publicState(await getBoard()).convergence).toBeNull();
    expect(await verifyText("8_convergence", "MCGINNIS")).toEqual({ success: false });
    await verifyText("7a_wqed", "LAUNCH");
    await markSolved("7b_cathedral");
    expect(publicState(await getBoard()).convergence?.id).toBe("8_convergence");
    expect((await verifyText("8_convergence", "MCGINNIS")).success).toBe(true);
  });

  it("convergence also waits when only the global thread is done", async () => {
    await setFlag("outdoor_open", true);
    await verifyText("7a_wqed", "LAUNCH");
    await markSolved("7b_cathedral");
    expect(publicState(await getBoard()).convergence).toBeNull();
    expect(await verifyText("8_convergence", "MCGINNIS")).toEqual({ success: false });
  });
});

describe("manual photo review", () => {
  beforeEach(async () => {
    await setFlag("outdoor_open", true);
    await verifyText("7a_wqed", "LAUNCH");
  });

  it("approve → device claims CINS exactly once", async () => {
    const review = await createReview("7b_cathedral", TINY_PNG, "manual");
    expect(await claimReview(review.id)).toEqual({ status: "pending" });
    const decided = await decideReview(review.id, true);
    expect(decided?.status).toBe("approved");
    expect((await getBoard()).stages["7b_cathedral"].solved).toBe(true);
    const claim = await claimReview(review.id);
    expect(claim.status).toBe("approved");
    expect(claim.share).toBe("CINS");
    expect((await claimReview(review.id)).share).toBeUndefined();
  });

  it("reject leaves the stage unsolved", async () => {
    const review = await createReview("7b_cathedral", TINY_PNG, "manual");
    await decideReview(review.id, false);
    expect(await claimReview(review.id)).toEqual({ status: "rejected" });
    expect((await getBoard()).stages["7b_cathedral"].solved).toBe(false);
  });

  it("decisions are final", async () => {
    const review = await createReview("7b_cathedral", TINY_PNG, "manual");
    await decideReview(review.id, false);
    const again = await decideReview(review.id, true);
    expect(again?.status).toBe("rejected");
  });

  it("approving a second photo after the stage is solved hands out no share", async () => {
    const a = await createReview("7b_cathedral", TINY_PNG, "manual");
    const b = await createReview("7b_cathedral", TINY_PNG, "manual");
    await decideReview(a.id, true);
    await decideReview(b.id, true);
    expect((await claimReview(a.id)).share).toBe("CINS");
    expect((await claimReview(b.id)).share).toBeUndefined();
  });

  it("unknown review id", async () => {
    expect(await claimReview("00000000-0000-0000-0000-000000000000")).toEqual({ status: "unknown" });
    expect(await decideReview("nope", true)).toBeNull();
  });
});

describe("exec overrides and reset", () => {
  it("setStageSolved toggles side effects", async () => {
    await setStageSolved("8_convergence", true);
    expect((await getBoard()).ransom_note_visible).toBe(true);
    await setStageSolved("8_convergence", false);
    expect((await getBoard()).ransom_note_visible).toBe(false);
    await setStageSolved("6_gates", true);
    expect((await getBoard()).local_share).toBe("MGNI");
  });

  it("reset wipes board, reviews and advisor log", async () => {
    await setFlag("outdoor_open", true);
    await verifyText("1_cap_table", "BRAVE");
    await createReview("7b_cathedral", TINY_PNG, "manual");
    const b = await resetBoard();
    expect(b).toEqual({ ...initialBoard(), epoch: b.epoch });
    expect(await store.list("hunt:reviews")).toEqual([]);
  });

  it("version increments on every change (lets clients detect updates)", async () => {
    const v0 = (await getBoard()).version;
    await verifyText("1_cap_table", "BRAVE");
    expect((await getBoard()).version).toBe(v0 + 1);
  });

  it("hydrates a partial/hand-edited board", async () => {
    await store.set("hunt:board", { stages: { "1_cap_table": { solved: true } } });
    const b = await getBoard();
    expect(b.stages["1_cap_table"].solved).toBe(true);
    expect(b.stages["8_convergence"].solved).toBe(false);
    expect(b.outdoor_open).toBe(false);
  });
});
