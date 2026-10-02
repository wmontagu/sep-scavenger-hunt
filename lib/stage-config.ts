/**
 * SERVER-ONLY. Reads /content/answers.json and /content/clues.json at runtime
 * (never hardcodes answers) - import this only from API routes / scripts.
 *
 * Answers can also be supplied via the HUNT_ANSWERS_JSON env var (whole JSON
 * object), which wins over the file. That lets you keep real answers out of git
 * and change them from the Railway dashboard.
 */
import fs from "node:fs";
import path from "node:path";

export const STAGE_IDS = [
  "1_cap_table",
  "2_term_sheet",
  "3_pitch_deck",
  "4_fence",
  "6_gates",
  "7a_wqed",
  "7b_cathedral",
  "8_convergence",
] as const;
export type StageId = (typeof STAGE_IDS)[number];

export const TEXT_STAGES: StageId[] = [
  "1_cap_table",
  "2_term_sheet",
  "3_pitch_deck",
  "4_fence",
  "6_gates",
  "7a_wqed",
  "8_convergence",
];
export const IMAGE_STAGES: StageId[] = ["7b_cathedral"];
export const INDOOR_STAGES: StageId[] = ["1_cap_table", "2_term_sheet", "3_pitch_deck"];
export const OUTDOOR_STAGES: StageId[] = ["4_fence", "6_gates", "7a_wqed", "7b_cathedral", "8_convergence"];
/** Stages where the "Ask an advisor" button exists (outdoor threads only). */
export const ADVISOR_STAGES: StageId[] = ["4_fence", "6_gates", "7a_wqed", "7b_cathedral"];

export function isStageId(s: unknown): s is StageId {
  return typeof s === "string" && (STAGE_IDS as readonly string[]).includes(s);
}

export interface Answers {
  "1_cap_table": { answer: string | null };
  "2_term_sheet": { answer: string | null };
  "3_pitch_deck": { answer: string | null };
  /** Where the Fence card points (HUNT). `also_accept`: extra spellings that also solve a stage. */
  "4_fence": { answer: string | null; also_accept?: string[] };
  "6_gates": {
    code: string | null;
    also_accept?: string[];
    burn_rate_k: number | null;
    cash_on_hand_k: number | null;
    step_count: number | null;
  };
  "7a_wqed": { answer: string | null };
  "7b_cathedral": { image_prompt: string };
  "8_convergence": { answer: string | null };
  shares: { local: string; global: string };
}

export interface StageDocument {
  src: string;
  alt: string;
}

export interface Clues {
  board: {
    title: string;
    tagline: string;
    outdoor_locked: string;
    split_announcement: string;
    /** Strategy-picker labels (independent of the stage titles). */
    threads: Record<"local" | "global", { title: string; subtitle: string }>;
  };
  stages: {
    "1_cap_table": { title: string; prompt: string; documents?: StageDocument[] };
    "2_term_sheet": { title: string; prompt: string; documents?: StageDocument[] };
    "3_pitch_deck": { title: string; prompt: string; documents?: StageDocument[] };
    "4_fence": { title: string; clue: string; prompt: string };
    /** `clue` (footbridge -> Gates) + `spiral_clue` (burn-rate math -> step count), revealed once 4_fence is solved. */
    "6_gates": { title: string; clue: string; spiral_clue: string; prompt: string };
    "7a_wqed": { title: string; subtitle: string; clue: string; overlay_caption: string };
    "7b_cathedral": { title: string; clue: string; upload_label: string };
    "8_convergence": { title: string; prompt: string; reveal: string };
  };
  share_message: string;
  advisor_blurb: string;
  ransom_note: string;
  complete_message: string;
}

const contentDir = () => process.env.HUNT_CONTENT_DIR ?? path.join(process.cwd(), "content");

// Re-read the files when they change on disk (mtime), so edits during a local dry
// run take effect without restarting the server.
const cache = new Map<string, { mtimeMs: number; value: unknown }>();
function readJson<T>(file: string): T {
  const full = path.join(contentDir(), file);
  const { mtimeMs } = fs.statSync(full);
  const hit = cache.get(full);
  if (hit && hit.mtimeMs === mtimeMs) return hit.value as T;
  const value = JSON.parse(fs.readFileSync(full, "utf8")) as T;
  cache.set(full, { mtimeMs, value });
  return value;
}

export function getAnswers(): Answers {
  const env = process.env.HUNT_ANSWERS_JSON;
  if (env && env.trim()) return JSON.parse(env) as Answers;
  return readJson<Answers>("answers.json");
}

export function getClues(): Clues {
  return readJson<Clues>("clues.json");
}

/** Case-insensitive, trimmed, and forgiving about spaces/punctuation ("Mc Ginnis!" == "MCGINNIS"). */
export function normalize(s: string): string {
  return s.normalize("NFKD").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Expected (normalized) answer for a text stage, or null if not configured yet. */
export function expectedAnswer(stage: StageId, answers: Answers = getAnswers()): string | null {
  let raw: string | null | undefined;
  switch (stage) {
    case "6_gates":
      raw = answers["6_gates"].code;
      break;
    case "7b_cathedral":
      return null;
    default:
      raw = (answers[stage] as { answer: string | null }).answer;
  }
  if (raw === null || raw === undefined) return null;
  // "?" marks a character that isn't known yet (e.g. "?M81") - treat as unset.
  if (String(raw).includes("?")) return null;
  const n = normalize(String(raw));
  return n.length ? n : null;
}

export function checkTextAnswer(stage: StageId, submission: string, answers: Answers = getAnswers()): boolean {
  const expected = expectedAnswer(stage, answers);
  if (!expected) return false;
  const got = normalize(submission);
  if (got === expected) return true;
  // Alternates only count once the primary answer is set.
  const extra = (answers[stage] as { also_accept?: string[] } | undefined)?.also_accept ?? [];
  return extra.some((alt) => !String(alt).includes("?") && normalize(String(alt)) === got && got.length > 0);
}

/** Interleave local/global shares: L1 G1 L2 G2 ... */
export function interleave(local: string, global: string): string {
  let out = "";
  for (let i = 0; i < Math.max(local.length, global.length); i++) out += (local[i] ?? "") + (global[i] ?? "");
  return out;
}

export interface ContentProblem {
  level: "todo" | "error";
  message: string;
}

/** Validate content files; used by `npm run check-content` and tests. */
export function checkContent(answers: Answers = getAnswers(), clues: Clues = getClues()): ContentProblem[] {
  const problems: ContentProblem[] = [];
  for (const stage of TEXT_STAGES) {
    if (!expectedAnswer(stage, answers)) {
      const raw = stage === "6_gates" ? answers["6_gates"].code : (answers[stage] as { answer: string | null }).answer;
      const why = raw && String(raw).includes("?") ? `still has unknown characters: ${raw}` : "answer/code not set";
      problems.push({ level: "todo", message: `${stage}: ${why}` });
    }
  }
  const g = answers["6_gates"];
  if (g.burn_rate_k == null || g.cash_on_hand_k == null || g.step_count == null) {
    problems.push({ level: "todo", message: "6_gates: burn_rate_k / cash_on_hand_k / step_count not all set" });
  } else if (g.burn_rate_k * g.step_count !== g.cash_on_hand_k) {
    problems.push({
      level: "error",
      message: `6_gates: cash_on_hand_k (${g.cash_on_hand_k}) != burn_rate_k (${g.burn_rate_k}) x step_count (${g.step_count})`,
    });
  } else {
    const spiral = clues.stages["6_gates"]?.spiral_clue ?? "";
    for (const want of [`$${g.cash_on_hand_k}K`, `$${g.burn_rate_k}K`]) {
      if (!spiral.includes(want)) {
        problems.push({ level: "error", message: `clues.json: stages.6_gates.spiral_clue should mention ${want} (from answers.json)` });
      }
    }
  }
  const { local, global } = answers.shares;
  const final = expectedAnswer("8_convergence", answers);
  if (final && normalize(interleave(local, global)) !== final) {
    problems.push({
      level: "error",
      message: `shares: interleave(${local}, ${global}) = ${interleave(local, global)} but 8_convergence answer is ${final}`,
    });
  }
  if (!answers["7b_cathedral"].image_prompt?.trim()) {
    problems.push({ level: "error", message: "7b_cathedral: image_prompt is empty" });
  }
  for (const stage of STAGE_IDS) {
    if (!clues.stages[stage]?.title) problems.push({ level: "error", message: `clues.json: stages.${stage}.title missing` });
  }
  if (!clues.ransom_note?.trim()) problems.push({ level: "error", message: "clues.json: ransom_note missing" });
  return problems;
}

/** A1Z26 numbers for a keyword - handy when writing the term sheet. */
export function a1z26(word: string): number[] {
  return normalize(word)
    .replace(/[0-9]/g, "")
    .split("")
    .map((c) => c.charCodeAt(0) - 64);
}
