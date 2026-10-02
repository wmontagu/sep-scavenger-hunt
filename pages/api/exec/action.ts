import type { NextApiRequest, NextApiResponse } from "next";
import { decideReview, getBoard, resetBoard, setFlag, setStageSolved } from "@/lib/board";
import { isStageId } from "@/lib/stage-config";
import { isExec } from "@/lib/exec-auth";
import { methodGuard, noStore } from "@/lib/http";

/**
 * POST /api/exec/action — passcode required.
 *   { action: "open_outdoor" | "close_outdoor" }
 *   { action: "complete", value: boolean }
 *   { action: "set_stage", stage, solved: boolean }       manual override
 *   { action: "review", id, approve: boolean }             photo fallback queue
 *   { action: "reset", confirm: "RESET" }                  wipe to initial state
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "POST")) return;
  noStore(res);
  if (!isExec(req)) return res.status(404).json({ error: "not found" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  switch (body.action) {
    case "open_outdoor":
      return res.status(200).json({ ok: true, board: await setFlag("outdoor_open", true) });
    case "close_outdoor":
      return res.status(200).json({ ok: true, board: await setFlag("outdoor_open", false) });
    case "complete":
      return res.status(200).json({ ok: true, board: await setFlag("complete", body.value !== false) });
    case "set_stage":
      if (!isStageId(body.stage) || typeof body.solved !== "boolean") return res.status(400).json({ error: "bad args" });
      return res.status(200).json({ ok: true, board: await setStageSolved(body.stage, body.solved) });
    case "review": {
      if (typeof body.id !== "string" || typeof body.approve !== "boolean") return res.status(400).json({ error: "bad args" });
      const review = await decideReview(body.id, body.approve);
      if (!review) return res.status(404).json({ error: "no such review" });
      const { image: _image, ...rest } = review;
      return res.status(200).json({ ok: true, review: rest, board: await getBoard() });
    }
    case "reset":
      if (body.confirm !== "RESET") return res.status(400).json({ error: 'send confirm: "RESET"' });
      return res.status(200).json({ ok: true, board: await resetBoard() });
    default:
      return res.status(400).json({ error: "unknown action" });
  }
}
