import { beforeEach, describe, expect, it, vi } from "vitest";
import stateHandler from "@/pages/api/state";
import verifyHandler from "@/pages/api/verify";
import reviewStatusHandler from "@/pages/api/review-status";
import advisorHandler from "@/pages/api/advisor-request";
import completeHandler from "@/pages/api/complete";
import execStateHandler from "@/pages/api/exec/state";
import execActionHandler from "@/pages/api/exec/action";
import { setClassifierOverride } from "@/lib/verify-image";
import { call, EXEC, freshEnv, TINY_PNG } from "./helpers";

beforeEach(() => {
  freshEnv();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const verify = (stage: string, submission: unknown, ip = "10.0.0.1") =>
  call(verifyHandler, { method: "POST", body: { stage, submission }, headers: { "x-forwarded-for": ip } });
const action = (body: object) => call(execActionHandler, { method: "POST", body, headers: EXEC });

describe("GET /api/state", () => {
  it("returns public state, no-store", async () => {
    const r = await call(stateHandler);
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toContain("no-store");
    expect(r.body.indoor).toHaveLength(3);
    expect(r.body).not.toHaveProperty("local_share");
    expect(r.body).not.toHaveProperty("global_share");
  });

  it("rejects other methods", async () => {
    expect((await call(stateHandler, { method: "POST" })).statusCode).toBe(405);
  });
});

describe("POST /api/verify", () => {
  it("validates input", async () => {
    expect((await verify("9_nope", "x")).statusCode).toBe(400);
    expect((await verify("1_cap_table", 42)).statusCode).toBe(400);
    expect((await verify("1_cap_table", "x".repeat(201))).statusCode).toBe(400);
    expect((await call(verifyHandler)).statusCode).toBe(405);
  });

  it("wrong answer body is exactly { success: false }", async () => {
    const r = await verify("1_cap_table", "BRAVO");
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ success: false });
  });

  it("rate limits brute force per IP per stage", async () => {
    for (let i = 0; i < 30; i++) expect((await verify("1_cap_table", `x${i}`)).statusCode).toBe(200);
    expect((await verify("1_cap_table", "BRAVE")).statusCode).toBe(429);
    expect((await verify("1_cap_table", "BRAVE", "10.0.0.2")).body.success).toBe(true);
  });

  describe("image stage (7b)", () => {
    beforeEach(async () => {
      await action({ action: "open_outdoor" });
    });

    it("locked until 7a solved", async () => {
      setClassifierOverride(async () => "yes");
      expect((await verify("7b_cathedral", TINY_PNG)).body).toEqual({ success: false });
    });

    it("rejects non-image payloads", async () => {
      await verify("7a_wqed", "LAUNCH");
      expect((await verify("7b_cathedral", "hello")).statusCode).toBe(400);
      expect((await verify("7b_cathedral", "data:text/html;base64,PGgxPg==")).statusCode).toBe(400);
    });

    it("classifier yes → solved + CINS", async () => {
      await verify("7a_wqed", "LAUNCH");
      setClassifierOverride(async () => "yes");
      const r = await verify("7b_cathedral", TINY_PNG);
      expect(r.body).toMatchObject({ success: true, share: "CINS" });
      expect((await verify("7b_cathedral", TINY_PNG)).body).toEqual({ success: true, already_solved: true });
    });

    it("classifier no → { success: false }", async () => {
      await verify("7a_wqed", "LAUNCH");
      setClassifierOverride(async () => "no");
      expect((await verify("7b_cathedral", TINY_PNG)).body).toEqual({ success: false });
    });

    it("classifier error → queued for exec review, exec approves, device claims share", async () => {
      await verify("7a_wqed", "LAUNCH");
      setClassifierOverride(async () => {
        throw new Error("429 rate limited");
      });
      const r = await verify("7b_cathedral", TINY_PNG);
      expect(r.body).toMatchObject({ success: false, pending_review: true });
      const id = r.body.review_id as string;

      expect((await call(reviewStatusHandler, { query: { id } })).body).toEqual({ status: "pending" });

      const ex = await call(execStateHandler, { headers: EXEC });
      expect(ex.body.reviews[0]).toMatchObject({ id, status: "pending" });
      expect(ex.body.reviews[0].note).toContain("429");

      expect((await action({ action: "review", id, approve: true })).body.review.status).toBe("approved");
      const claim = await call(reviewStatusHandler, { query: { id } });
      expect(claim.body).toMatchObject({ status: "approved", share: "CINS" });
      expect((await call(reviewStatusHandler, { query: { id } })).body.share).toBeUndefined();

      // decided photos are no longer re-sent to the exec phone on every poll
      const after = await call(execStateHandler, { headers: EXEC });
      expect(after.body.reviews[0]).toMatchObject({ id, status: "approved", image: "" });
      expect(after.body.ai_calls).toEqual({ used: 0, cap: 40 });
    });

    it("no classifier configured (manual mode) → pending review", async () => {
      await verify("7a_wqed", "LAUNCH");
      setClassifierOverride(null);
      expect((await verify("7b_cathedral", TINY_PNG)).body.pending_review).toBe(true);
    });
  });
});

describe("GET /api/review-status", () => {
  it("validates id", async () => {
    expect((await call(reviewStatusHandler, { query: { id: "../../etc" } })).statusCode).toBe(400);
    expect(
      (await call(reviewStatusHandler, { query: { id: "00000000-0000-0000-0000-000000000000" } })).body,
    ).toEqual({ status: "unknown" });
  });
});

describe("POST /api/advisor-request", () => {
  const ping = (stage: string, message?: string, ip = "10.0.0.1") =>
    call(advisorHandler, { method: "POST", body: { stage, message }, headers: { "x-forwarded-for": ip } });

  it("only outdoor thread stages (4, 6, 7a, 7b)", async () => {
    for (const s of ["1_cap_table", "2_term_sheet", "3_pitch_deck", "8_convergence", "bogus"]) {
      expect((await ping(s)).statusCode).toBe(400);
    }
    for (const s of ["4_fence", "6_gates", "7a_wqed", "7b_cathedral"]) {
      expect((await ping(s, "help")).body.ok).toBe(true);
    }
  });

  it("logs pings for the exec console and dedupes spam", async () => {
    await ping("6_gates", "stuck on the stairs");
    const dup = await ping("6_gates", "again");
    expect(dup.body.deduped).toBe(true);
    const ex = await call(execStateHandler, { headers: EXEC });
    expect(ex.body.advisor).toHaveLength(1);
    expect(ex.body.advisor[0]).toMatchObject({ stage: "6_gates", message: "stuck on the stairs" });
  });

  it("forwards to EXEC_WEBHOOK_URL when set", async () => {
    process.env.EXEC_WEBHOOK_URL = "https://hooks.example/test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    try {
      const r = await ping("7a_wqed", "where is it");
      expect(r.body.delivered).toBe(true);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://hooks.example/test");
      expect(JSON.parse((init as RequestInit).body as string).text).toContain("7a_wqed");
    } finally {
      delete process.env.EXEC_WEBHOOK_URL;
      fetchSpy.mockRestore();
    }
  });
});

describe("exec-only routes", () => {
  it("404 without the passcode (don't even admit they exist)", async () => {
    expect((await call(completeHandler, { method: "POST" })).statusCode).toBe(404);
    expect((await call(completeHandler, { method: "POST", headers: { "x-exec-passcode": "guess" } })).statusCode).toBe(404);
    expect((await call(execStateHandler)).statusCode).toBe(404);
    expect((await call(execActionHandler, { method: "POST", body: { action: "reset", confirm: "RESET" } })).statusCode).toBe(404);
  });

  it("disabled entirely when EXEC_PASSCODE is unset", async () => {
    delete process.env.EXEC_PASSCODE;
    expect((await call(completeHandler, { method: "POST", headers: { "x-exec-passcode": "" } })).statusCode).toBe(404);
  });

  it("POST /api/complete flips complete for everyone", async () => {
    const r = await call(completeHandler, { method: "POST", headers: EXEC, body: {} });
    expect(r.body).toEqual({ ok: true, complete: true });
    expect((await call(stateHandler)).body.complete).toBe(true);
    await call(completeHandler, { method: "POST", headers: EXEC, body: { complete: false } });
    expect((await call(stateHandler)).body.complete).toBe(false);
  });

  it("exec state exposes shares/answers for recovery", async () => {
    await action({ action: "open_outdoor" });
    await verify("4_fence", "HUNT");
    await verify("6_gates", "X7Q2");
    const ex = await call(execStateHandler, { headers: EXEC });
    expect(ex.body.board.local_share).toBe("MGNI");
    expect(ex.body.answers.shares.global).toBe("CINS");
    expect(ex.body.content_problems).toEqual([]);
  });

  it("actions: validation, set_stage, reset requires confirm", async () => {
    expect((await action({ action: "wat" })).statusCode).toBe(400);
    expect((await action({ action: "set_stage", stage: "nope", solved: true })).statusCode).toBe(400);
    expect((await action({ action: "reset" })).statusCode).toBe(400);
    expect((await action({ action: "set_stage", stage: "3_pitch_deck", solved: true })).body.board.stages["3_pitch_deck"].solved).toBe(true);
    expect((await action({ action: "reset", confirm: "RESET" })).body.board.stages["3_pitch_deck"].solved).toBe(false);
    expect((await action({ action: "review", id: "missing", approve: true })).statusCode).toBe(404);
  });
});
