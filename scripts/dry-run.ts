/**
 * npm run dry-run -- [--base http://localhost:3000] [--keep] [--allow-paid]
 *
 * README step 5: drive the whole chain over HTTP against a running server
 * (local or deployed): reset → indoor 1-3 → open outdoor → HUNT → Gates share →
 * LAUNCH unlocks 7b → photo → shares combine into MCGINNIS → ransom note →
 * exec /api/complete → reset again (unless --keep).
 *
 * Needs EXEC_PASSCODE in the env (same value as the server). Stages whose answer
 * is still null in answers.json are force-solved through the exec override so
 * the rest of the chain can still be tested.
 *
 * The photo step never calls a paid classifier unless you pass --allow-paid; if the
 * server is set to claude/jev it force-solves 7b instead.
 */
import { expectedAnswer, getAnswers, interleave, type StageId } from "../lib/stage-config";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
const BASE = (opt("--base") ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PASS = process.env.EXEC_PASSCODE;
if (!PASS) {
  console.error("Set EXEC_PASSCODE (same as the server's).");
  process.exit(2);
}

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

let failures = 0;
const stateBodies: string[] = [];

function check(cond: unknown, msg: string) {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) failures++;
}

async function http(method: string, path: string, body?: unknown, exec = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(exec ? { "x-exec-passcode": PASS! } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (path === "/api/state") stateBodies.push(text);
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const state = () => http("GET", "/api/state").then((r) => r.json);
const verify = (stage: StageId, submission: string) => http("POST", "/api/verify", { stage, submission }).then((r) => r.json);
const exec = (body: object) => http("POST", "/api/exec/action", body, true);
const execState = () => http("GET", "/api/exec/state", undefined, true).then((r) => r.json);

async function solveText(stage: StageId, answer: string | null) {
  if (!answer) {
    console.log(`  … ${stage}: answer not set yet - force-solving via exec override`);
    await exec({ action: "set_stage", stage, solved: true });
    return null;
  }
  const wrong = await verify(stage, answer + "X");
  check(JSON.stringify(wrong) === '{"success":false}', `${stage}: wrong answer → exactly {success:false}`);
  const r = await verify(stage, `  ${answer.toLowerCase()} `);
  check(r.success === true, `${stage}: correct (lower-case, padded) answer accepted`);
  return r;
}

async function main() {
  console.log(`Dry run against ${BASE}\n`);
  const answers = getAnswers();

  console.log("Setup");
  check((await http("GET", "/api/exec/state")).status === 404, "exec state hidden without passcode");
  const es0 = await execState();
  check(es0.board, "exec passcode accepted");
  console.log(`  … server: storage=${es0.storage}, photo check=${es0.image_verifier}, webhook=${es0.webhook}`);
  check((await exec({ action: "reset", confirm: "RESET" })).status === 200, "reset");

  let s = await state();
  check(s.indoor.length === 3 && s.local.length === 0 && s.global.length === 0, "only the indoor board is visible");

  console.log("\nIndoor board");
  await solveText("1_cap_table", expectedAnswer("1_cap_table"));
  await solveText("2_term_sheet", expectedAnswer("2_term_sheet"));
  check((await verify("7a_wqed", "LAUNCH")).success === false, "outdoor stage locked while indoor is unfinished");
  check((await state()).outdoor_open === false, "outdoor board still closed after 2 of 3 indoor stages");
  await solveText("3_pitch_deck", expectedAnswer("3_pitch_deck"));

  console.log("\nOutdoor board (opens by itself once 1-3 are solved)");
  s = await state();
  check(s.outdoor_open, "outdoor board opened automatically");
  check(s.local[0]?.id === "4_fence" && s.global[0]?.id === "7a_wqed", "both threads visible");
  check(s.local.length === 1, "Gates hidden before the Fence is solved");
  check(s.global.length === 1, "7b hidden before LAUNCH");

  // Local thread
  const fence = await solveText("4_fence", expectedAnswer("4_fence"));
  if (fence) check(typeof fence.next_clue === "string", "HUNT returned the pitch riddle inline");
  s = await state();
  check(s.local.length === 2 && s.local[1].id === "6_gates", "Gates stage now visible");
  let localShare: string | undefined;
  const gatesCode = expectedAnswer("6_gates");
  if (gatesCode) {
    const r = await solveText("6_gates", gatesCode);
    localShare = r?.share;
    check(localShare === answers.shares.local, `Gates returned local share ${localShare}`);
    check((await verify("6_gates", gatesCode)).share === undefined, "share not handed out twice");
  } else {
    await solveText("6_gates", null);
    localShare = (await execState()).board.local_share;
    console.log(`  … read local share from exec console: ${localShare}`);
  }

  // Global thread
  const r7a = await verify("7a_wqed", answers["7a_wqed"].answer ?? "LAUNCH");
  check(r7a.success && typeof r7a.next_clue === "string", "LAUNCH accepted and returned the 7b clue inline");
  s = await state();
  check(s.global.length === 2 && s.global[1].input === "image", "7b photo stage now visible");

  let globalShare: string | undefined;
  const verifier = (await execState()).image_verifier as string;
  if ((verifier === "claude" || verifier === "jev") && !flag("--allow-paid")) {
    console.log(`  … server uses ${verifier} (paid) - force-solving 7b instead (pass --allow-paid to really call it)`);
    await exec({ action: "set_stage", stage: "7b_cathedral", solved: true });
    globalShare = (await execState()).board.global_share;
  } else {
    const r = await verify("7b_cathedral", TINY_PNG);
    if (r.success) {
      globalShare = r.share;
      check(true, `photo approved automatically (${verifier})`);
    } else if (r.pending_review) {
      check(typeof r.review_id === "string", "photo queued for exec review");
      const pending = (await execState()).reviews.find((x: any) => x.id === r.review_id);
      check(pending?.status === "pending", "review visible on exec console");
      await exec({ action: "review", id: r.review_id, approve: true });
      const claim = (await http("GET", `/api/review-status?id=${r.review_id}`)).json;
      globalShare = claim.share;
      check(claim.status === "approved", "device sees approval");
      const again = (await http("GET", `/api/review-status?id=${r.review_id}`)).json;
      check(again.share === undefined, "share claimed only once");
    } else {
      check(false, `photo rejected by ${verifier} (a 1x1 test PNG - expected with a real classifier)`);
      await exec({ action: "set_stage", stage: "7b_cathedral", solved: true });
      globalShare = (await execState()).board.global_share;
    }
  }
  check(globalShare === answers.shares.global, `global share ${globalShare}`);

  console.log("\nConvergence");
  s = await state();
  check(s.ransom_note === null, "ransom note hidden before MCGINNIS");
  const combined = interleave(localShare ?? "", globalShare ?? "");
  check(combined === answers["8_convergence"].answer, `shares interleave to ${combined}`);
  const r8 = await verify("8_convergence", combined.toLowerCase());
  check(r8.success && r8.reveal, "MCGINNIS accepted with reveal text");
  s = await state();
  check(typeof s.ransom_note === "string" && s.ransom_note.includes("61"), "ransom note broadcast via /api/state");
  check(s.complete === false, "not complete yet");

  console.log("\nFinale");
  check((await http("POST", "/api/complete", {})).status === 404, "/api/complete refuses without passcode");
  const c = await http("POST", "/api/complete", {}, true);
  check(c.json.complete === true, "exec marked complete");
  s = await state();
  check(s.complete === true && s.complete_message, "board shows 'you made it'");

  console.log("\nAnti-cheat");
  const everything = stateBodies.join("\n");
  const secrets = [answers.shares.local, answers.shares.global, answers["7b_cathedral"].image_prompt];
  for (const [id, v] of Object.entries(answers)) {
    if (id === "8_convergence" || id.startsWith("_") || typeof v !== "object") continue;
    const val = (v as any).answer ?? (v as any).code;
    if (typeof val === "string") secrets.push(val);
  }
  const leaked = secrets.filter((x) => x && everything.includes(x));
  check(leaked.length === 0, `no answers/shares/prompts in any /api/state response (${stateBodies.length} polled)${leaked.length ? ": " + leaked.join(", ") : ""}`);

  if (!flag("--keep")) {
    await exec({ action: "reset", confirm: "RESET" });
    console.log("\n(reset back to initial state - pass --keep to leave the finished board up)");
  }
  console.log(`\n${failures ? `${failures} FAILURE(S)` : "ALL CHECKS PASSED"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
