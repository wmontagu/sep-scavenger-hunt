/**
 * The hunt state machine. SERVER-ONLY.
 *
 * All persistent state lives in one JSON object at KV key `hunt:board`, plus a
 * handful of manual-review records for the photo stage and an advisor-ping log.
 */
import crypto from "node:crypto";
import { getStore, type Store } from "./store";
import { AI_CALLS_KEY } from "./verify-image";
import {
  ADVISOR_STAGES,
  STAGE_IDS,
  checkTextAnswer,
  getAnswers,
  getClues,
  type Clues,
  type StageId,
} from "./stage-config";

export const BOARD_KEY = "hunt:board";
export const REVIEW_INDEX_KEY = "hunt:reviews";
export const reviewKey = (id: string) => `hunt:review:${id}`;
export const ADVISOR_LOG_KEY = "hunt:advisor";

export interface Board {
  stages: Record<StageId, { solved: boolean; solved_at?: string }>;
  local_share: string | null;
  global_share: string | null;
  ransom_note_visible: boolean;
  complete: boolean;
  /** Exec override. The outdoor board also opens by itself once stages 1-3 are solved (see outdoorOpen). */
  outdoor_open: boolean;
  version: number;
  /**
   * Changes on every reset. Phones keep shares / pending photo ids in their browser;
   * when the epoch changes (e.g. after a dry run) they throw that stale data away.
   */
  epoch: string;
}

export function initialBoard(): Board {
  const stages = {} as Board["stages"];
  for (const id of STAGE_IDS) stages[id] = { solved: false };
  return {
    stages,
    local_share: null,
    global_share: null,
    ransom_note_visible: false,
    complete: false,
    outdoor_open: false,
    version: 0,
    epoch: "initial",
  };
}

export const INDOOR_STAGES = ["1_cap_table", "2_term_sheet", "3_pitch_deck"] as const;

/** Outdoor threads open automatically when the indoor round is done, or early if an exec forces it. */
export function outdoorOpen(b: Board): boolean {
  return b.outdoor_open || INDOOR_STAGES.every((id) => b.stages[id].solved);
}

/** Fill in any fields missing from an older/hand-edited board. */
function hydrate(b: Board | null): Board {
  const base = initialBoard();
  if (!b) return base;
  return { ...base, ...b, stages: { ...base.stages, ...(b.stages ?? {}) } };
}

export async function getBoard(store: Store = getStore()): Promise<Board> {
  return hydrate(await store.get<Board>(BOARD_KEY));
}

export async function resetBoard(store: Store = getStore()): Promise<Board> {
  const b = { ...initialBoard(), epoch: crypto.randomUUID() };
  await store.set(BOARD_KEY, b);
  await store.del(AI_CALLS_KEY);
  const ids = await store.list<string>(REVIEW_INDEX_KEY, 1000);
  for (const id of ids) await store.del(reviewKey(id));
  await store.del(REVIEW_INDEX_KEY);
  await store.del(ADVISOR_LOG_KEY);
  return b;
}

// ---------------------------------------------------------------------------
// Public projection - this is the ONLY thing /api/state returns.
// Never includes shares, answers, or prompts; clue text only once reached.
// ---------------------------------------------------------------------------

export interface PublicStage {
  id: StageId;
  title: string;
  subtitle?: string;
  prompt?: string;
  clue?: string;
  solved: boolean;
  /** Whether the input for this stage should be shown right now. */
  available: boolean;
  input: "text" | "image";
  advisor: boolean;
  overlay?: string;
  overlay_caption?: string;
  /** Flattened document images for the indoor puzzles. */
  documents?: { src: string; alt: string }[];
  reveal?: string;
}

export interface PublicState {
  title: string;
  tagline: string;
  outdoor_open: boolean;
  outdoor_locked_message: string;
  split_announcement: string;
  threads: Clues["board"]["threads"];
  indoor: PublicStage[];
  local: PublicStage[];
  global: PublicStage[];
  convergence: PublicStage | null;
  share_message: string;
  advisor_blurb: string;
  ransom_note: string | null;
  complete: boolean;
  complete_message: string | null;
  version: number;
  epoch: string;
}

/** Both local-thread riddles after the Fence: footbridge -> Gates, then the spiral math. */
function gatesClue(): string {
  const g = getClues().stages["6_gates"];
  return `${g.clue}

${g.spiral_clue}`;
}

export function publicState(board: Board): PublicState {
  const c = getClues();
  const s = c.stages;
  const solved = (id: StageId) => board.stages[id].solved;
  const open = outdoorOpen(board);

  const indoor: PublicStage[] = INDOOR_STAGES.map((id) => ({
    id,
    title: s[id].title,
    prompt: s[id].prompt,
    documents: s[id].documents,
    solved: solved(id),
    available: !solved(id),
    input: "text",
    advisor: false,
  }));

  const local: PublicStage[] = [];
  if (open) {
    local.push({
      id: "4_fence",
      title: s["4_fence"].title,
      clue: s["4_fence"].clue,
      prompt: s["4_fence"].prompt,
      solved: solved("4_fence"),
      available: !solved("4_fence"),
      input: "text",
      advisor: true,
    });
    // The pitch + spiral riddles stay server-side until the Fence is solved.
    if (solved("4_fence")) {
      local.push({
        id: "6_gates",
        title: s["6_gates"].title,
        clue: gatesClue(),
        prompt: s["6_gates"].prompt,
        solved: solved("6_gates"),
        available: !solved("6_gates"),
        input: "text",
        advisor: true,
      });
    }
  }

  const global: PublicStage[] = [];
  if (open) {
    global.push({
      id: "7a_wqed",
      title: s["7a_wqed"].title,
      subtitle: s["7a_wqed"].subtitle,
      clue: s["7a_wqed"].clue,
      overlay: "/layout.png",
      overlay_caption: s["7a_wqed"].overlay_caption,
      solved: solved("7a_wqed"),
      available: !solved("7a_wqed"),
      input: "text",
      advisor: true,
    });
    if (solved("7a_wqed")) {
      global.push({
        id: "7b_cathedral",
        title: s["7b_cathedral"].title,
        clue: s["7b_cathedral"].clue,
        prompt: s["7b_cathedral"].upload_label,
        solved: solved("7b_cathedral"),
        available: !solved("7b_cathedral"),
        input: "image",
        advisor: true,
      });
    }
  }

  // Convergence appears only once BOTH threads have produced their half.
  const convergence: PublicStage | null =
    open && ((solved("6_gates") && solved("7b_cathedral")) || solved("8_convergence"))
      ? {
          id: "8_convergence",
          title: s["8_convergence"].title,
          prompt: s["8_convergence"].prompt,
          reveal: solved("8_convergence") ? s["8_convergence"].reveal : undefined,
          solved: solved("8_convergence"),
          available: !solved("8_convergence"),
          input: "text",
          advisor: false,
        }
      : null;

  return {
    title: c.board.title,
    tagline: c.board.tagline,
    outdoor_open: open,
    outdoor_locked_message: c.board.outdoor_locked,
    split_announcement: c.board.split_announcement,
    threads: c.board.threads,
    indoor,
    local,
    global,
    convergence,
    share_message: c.share_message,
    advisor_blurb: c.advisor_blurb,
    ransom_note: board.ransom_note_visible ? c.ransom_note : null,
    complete: board.complete,
    complete_message: board.complete ? c.complete_message : null,
    version: board.version,
    epoch: board.epoch,
  };
}

// ---------------------------------------------------------------------------
// Solving
// ---------------------------------------------------------------------------

export interface VerifyResult {
  success: boolean;
  already_solved?: boolean;
  /** 4-char thread share - only on the request that first solved 6_gates / 7b_cathedral. */
  share?: string;
  share_message?: string;
  /** 4_fence / 7a success: the next riddle, inline. */
  next_clue?: string;
  /** 8 success: what MCGINNIS means. */
  reveal?: string;
  /** 7b: photo queued for a human (AI unavailable / unsure). */
  pending_review?: boolean;
  review_id?: string;
}

/** Can this stage be submitted right now given the board? (No hints either way.) */
export function stageOpen(board: Board, stage: StageId): boolean {
  if (board.stages[stage].solved) return true; // re-submits just report already_solved
  switch (stage) {
    case "1_cap_table":
    case "2_term_sheet":
    case "3_pitch_deck":
      return true;
    case "4_fence":
    case "7a_wqed":
      return outdoorOpen(board);
    case "6_gates":
      return outdoorOpen(board) && board.stages["4_fence"].solved;
    case "8_convergence":
      // same rule as the UI: open only once both threads have produced their half
      return outdoorOpen(board) && board.stages["6_gates"].solved && board.stages["7b_cathedral"].solved;
    case "7b_cathedral":
      return outdoorOpen(board) && board.stages["7a_wqed"].solved;
  }
}

/**
 * Atomically mark `stage` solved and compute the success payload. Only the request
 * that flips solved false→true receives the share.
 */
export async function markSolved(stage: StageId, store: Store = getStore()): Promise<VerifyResult> {
  const answers = getAnswers();
  const clues = getClues();
  const now = new Date().toISOString();

  const first = await store.update<Board, boolean>(BOARD_KEY, (cur) => {
    const b = hydrate(cur);
    if (b.stages[stage].solved) return { result: false };
    b.stages[stage] = { solved: true, solved_at: now };
    if (stage === "6_gates") b.local_share = answers.shares.local;
    if (stage === "7b_cathedral") b.global_share = answers.shares.global;
    if (stage === "8_convergence") b.ransom_note_visible = true;
    b.version += 1;
    return { next: b, result: true };
  });

  const res: VerifyResult = { success: true };
  if (!first) res.already_solved = true;
  if (first && stage === "6_gates") {
    res.share = answers.shares.local;
    res.share_message = clues.share_message;
  }
  if (first && stage === "7b_cathedral") {
    res.share = answers.shares.global;
    res.share_message = clues.share_message;
  }
  if (stage === "4_fence") res.next_clue = gatesClue();
  if (stage === "7a_wqed") res.next_clue = clues.stages["7b_cathedral"].clue;
  if (stage === "8_convergence") res.reveal = clues.stages["8_convergence"].reveal;
  return res;
}

export async function verifyText(stage: StageId, submission: string, store: Store = getStore()): Promise<VerifyResult> {
  const board = await getBoard(store);
  if (!stageOpen(board, stage)) return { success: false };
  if (!checkTextAnswer(stage, submission)) return { success: false };
  return markSolved(stage, store);
}

export async function setFlag(
  flag: "outdoor_open" | "complete",
  value: boolean,
  store: Store = getStore(),
): Promise<Board> {
  return store.update<Board, Board>(BOARD_KEY, (cur) => {
    const b = hydrate(cur);
    b[flag] = value;
    b.version += 1;
    return { next: b, result: b };
  });
}

/** Exec override: force a stage solved/unsolved (e.g. a stuck physical clue). */
export async function setStageSolved(stage: StageId, solved: boolean, store: Store = getStore()): Promise<Board> {
  const answers = getAnswers();
  return store.update<Board, Board>(BOARD_KEY, (cur) => {
    const b = hydrate(cur);
    b.stages[stage] = solved ? { solved: true, solved_at: new Date().toISOString() } : { solved: false };
    if (stage === "6_gates") b.local_share = solved ? answers.shares.local : null;
    if (stage === "7b_cathedral") b.global_share = solved ? answers.shares.global : null;
    if (stage === "8_convergence") b.ransom_note_visible = solved;
    b.version += 1;
    return { next: b, result: b };
  });
}

// ---------------------------------------------------------------------------
// Manual photo review (fallback when the vision model is unavailable/unsure)
// ---------------------------------------------------------------------------

export interface Review {
  id: string;
  stage: StageId;
  image: string; // data URL
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at?: string;
  note?: string;
  /** Set on approval if this approval is what first solved the stage. */
  share_pending?: boolean;
  share_claimed?: boolean;
}

export async function createReview(stage: StageId, image: string, note: string, store: Store = getStore()): Promise<Review> {
  const review: Review = {
    id: crypto.randomUUID(),
    stage,
    image,
    status: "pending",
    created_at: new Date().toISOString(),
    note,
  };
  await store.set(reviewKey(review.id), review);
  await store.push(REVIEW_INDEX_KEY, review.id, 500);
  return review;
}

export async function listReviews(store: Store = getStore(), limit = 50): Promise<Review[]> {
  const ids = await store.list<string>(REVIEW_INDEX_KEY, limit);
  const out: Review[] = [];
  for (const id of ids) {
    const r = await store.get<Review>(reviewKey(id));
    if (r) out.push(r);
  }
  return out;
}

export async function decideReview(
  id: string,
  approve: boolean,
  store: Store = getStore(),
): Promise<Review | null> {
  const existing = await store.get<Review>(reviewKey(id));
  if (!existing) return null;
  if (existing.status !== "pending") return existing;
  let sharePending = false;
  if (approve) {
    const res = await markSolved(existing.stage, store);
    sharePending = !res.already_solved;
  }
  return store.update<Review, Review | null>(reviewKey(id), (cur) => {
    if (!cur) return { result: null };
    if (cur.status !== "pending") return { result: cur };
    const next: Review = {
      ...cur,
      status: approve ? "approved" : "rejected",
      decided_at: new Date().toISOString(),
      share_pending: sharePending,
    };
    return { next, result: next };
  });
}

export interface ReviewStatus {
  status: Review["status"] | "unknown";
  share?: string;
  share_message?: string;
}

/**
 * Polled by the device that submitted the photo. The review id (random UUID) is
 * the capability - only that device knows it. The share is handed out once.
 */
export async function claimReview(id: string, store: Store = getStore()): Promise<ReviewStatus> {
  const answers = getAnswers();
  const clues = getClues();
  return store.update<Review, ReviewStatus>(reviewKey(id), (cur) => {
    if (!cur) return { result: { status: "unknown" } };
    if (cur.status === "approved" && cur.share_pending && !cur.share_claimed) {
      return {
        next: { ...cur, share_claimed: true },
        result: {
          status: "approved",
          share: cur.stage === "7b_cathedral" ? answers.shares.global : undefined,
          share_message: clues.share_message,
        },
      };
    }
    return { result: { status: cur.status } };
  });
}

// ---------------------------------------------------------------------------
// Advisor pings
// ---------------------------------------------------------------------------

export interface AdvisorPing {
  stage: StageId;
  message: string;
  at: string;
}

export function advisorAllowed(stage: StageId): boolean {
  return ADVISOR_STAGES.includes(stage);
}

export async function logAdvisorPing(ping: AdvisorPing, store: Store = getStore()): Promise<void> {
  await store.push(ADVISOR_LOG_KEY, ping, 200);
}

export async function listAdvisorPings(store: Store = getStore()): Promise<AdvisorPing[]> {
  return store.list<AdvisorPing>(ADVISOR_LOG_KEY, 50);
}
