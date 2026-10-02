/**
 * verifyImage(stageId, image) — SERVER-ONLY.
 *
 * Returns:
 *   "approved" — classifier said yes
 *   "rejected" — classifier said no
 *   "manual"   — no classifier configured, it errored / was rate limited / refused,
 *                or IMAGE_NO_GOES_TO_MANUAL is on and it said no. The caller
 *                queues the photo for an exec to approve on /exec.
 *
 * Provider is picked by IMAGE_VERIFIER:
 *   claude  — Claude vision via @anthropic-ai/sdk (needs ANTHROPIC_API_KEY)
 *   jev     — JEV HTTP API (needs JEV_API_URL + JEV_API_KEY)
 *   manual  — always send to exec review (costs nothing)
 *   mock-yes / mock-no — for local dry runs and tests only
 *   auto (default) — claude if ANTHROPIC_API_KEY is set, else jev if JEV_* is set, else manual
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnswers, type StageId } from "./stage-config";
import { getStore, type Store } from "./store";

/** Store key counting paid classifier calls this run (cleared by reset). */
export const AI_CALLS_KEY = "hunt:ai_calls";
const PAID = new Set(["claude", "jev"]);

/** Max paid classifier calls per hunt run (IMAGE_MAX_AI_CALLS, default 40). After that, photos go to manual review. */
export function aiCallCap(): number {
  const n = Number(process.env.IMAGE_MAX_AI_CALLS);
  return Number.isFinite(n) && n >= 0 ? n : 40;
}

/** Atomically reserve one paid call; false once the cap is reached. */
export async function reserveAiCall(store: Store = getStore()): Promise<boolean> {
  const cap = aiCallCap();
  return store.update<number, boolean>(AI_CALLS_KEY, (cur) => {
    const used = cur ?? 0;
    if (used >= cap) return { result: false };
    return { next: used + 1, result: true };
  });
}

export type ImageOutcome = "approved" | "rejected" | "manual";
export type Verdict = "yes" | "no";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}

export interface VerifyImageResult {
  outcome: ImageOutcome;
  provider: string;
  detail?: string;
}

export type Classifier = (prompt: string, image: ImageInput) => Promise<Verdict>;

// ---- providers ------------------------------------------------------------

// A boolean is enforced by structured outputs as-is (the SDK helper downgrades
// string enums to a description hint), so ask for `matches: true/false`.
const VerdictSchema = z.object({ matches: z.boolean() });

export const claudeClassifier: Classifier = async (prompt, image) => {
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: process.env.CLAUDE_VISION_MODEL || "claude-opus-5-5",
    max_tokens: 2048,
    output_config: { effort: "low", format: zodOutputFormat(VerdictSchema) },
    system:
      "You check photos for a college scavenger hunt. Judge only what is visible. " +
      "Be reasonably lenient about framing, lighting and selfie angles; answer no only when the photo clearly does not match.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
          { type: "text", text: `${prompt}

Set "matches" to true for yes, false for no.` },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`claude returned no verdict (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output.matches ? "yes" : "no";
};

/**
 * JEV adapter. The JEV API shape isn't documented in the repo, so this assumes a
 * simple JSON POST and looks for a yes/no anywhere in the response. Adjust the
 * body/parse here if the real API differs — nothing else needs to change.
 */
export const jevClassifier: Classifier = async (prompt, image) => {
  const url = process.env.JEV_API_URL;
  const key = process.env.JEV_API_KEY;
  if (!url || !key) throw new Error("JEV_API_URL / JEV_API_KEY not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ prompt, image: `data:${image.mediaType};base64,${image.base64}` }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`JEV HTTP ${res.status}`);
  const text = (await res.text()).toLowerCase();
  const m = text.match(/\b(yes|no)\b/);
  if (!m) throw new Error("JEV response had no yes/no");
  return m[1] as Verdict;
};

const mock = (v: Verdict): Classifier => async () => v;

// ---- selection ------------------------------------------------------------

let override: Classifier | null | undefined; // test hook: null = force manual

export function setClassifierOverride(c: Classifier | null | undefined): void {
  override = c;
}

export function selectClassifier(env: Record<string, string | undefined> = process.env): { name: string; fn: Classifier | null } {
  const choice = (env.IMAGE_VERIFIER || "auto").toLowerCase();
  switch (choice) {
    case "claude":
      return { name: "claude", fn: claudeClassifier };
    case "jev":
      return { name: "jev", fn: jevClassifier };
    case "manual":
      return { name: "manual", fn: null };
    case "mock-yes":
      return { name: "mock-yes", fn: mock("yes") };
    case "mock-no":
      return { name: "mock-no", fn: mock("no") };
    default:
      if (env.ANTHROPIC_API_KEY) return { name: "claude", fn: claudeClassifier };
      if (env.JEV_API_URL && env.JEV_API_KEY) return { name: "jev", fn: jevClassifier };
      return { name: "manual", fn: null };
  }
}

export async function verifyImage(stageId: StageId, image: ImageInput): Promise<VerifyImageResult> {
  const prompt = (getAnswers()[stageId as "7b_cathedral"] as { image_prompt?: string } | undefined)?.image_prompt;
  if (!prompt) return { outcome: "manual", provider: "none", detail: `no image_prompt for ${stageId}` };

  const selected =
    override !== undefined ? { name: "override", fn: override } : selectClassifier();
  if (!selected.fn) return { outcome: "manual", provider: selected.name };
  if (PAID.has(selected.name) && !(await reserveAiCall())) {
    return { outcome: "manual", provider: selected.name, detail: `AI budget used up (${aiCallCap()} calls)` };
  }

  try {
    const verdict = await selected.fn(prompt, image);
    if (verdict === "yes") return { outcome: "approved", provider: selected.name };
    if (process.env.IMAGE_NO_GOES_TO_MANUAL === "true") {
      return { outcome: "manual", provider: selected.name, detail: "classifier said no; sent to exec review" };
    }
    return { outcome: "rejected", provider: selected.name };
  } catch (err) {
    // Rate limit, outage, refusal, bad key... never hard-fail the stage.
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[verifyImage] ${selected.name} failed, falling back to manual review:`, detail);
    return { outcome: "manual", provider: selected.name, detail };
  }
}

// ---- data URL parsing -----------------------------------------------------

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function parseDataUrl(dataUrl: unknown): ImageInput | null {
  if (typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || !ALLOWED.has(m[1])) return null;
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes === 0 || bytes > MAX_IMAGE_BYTES) return null;
  return { mediaType: m[1] as ImageInput["mediaType"], base64: m[2] };
}
