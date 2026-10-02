import type { NextApiRequest, NextApiResponse } from "next";
import { createReview, getBoard, markSolved, stageOpen, verifyText, type VerifyResult } from "@/lib/board";
import { IMAGE_STAGES, TEXT_STAGES, isStageId } from "@/lib/stage-config";
import { parseDataUrl, verifyImage } from "@/lib/verify-image";
import { clientIp, methodGuard, noStore } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { notifyExecs } from "@/lib/notify";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

/**
 * POST /api/verify  { stage, submission }
 *   text stages:  submission = the answer string
 *   7b_cathedral: submission = image data URL (client downsizes before upload)
 * Failure is always exactly { success: false } - no hints.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<VerifyResult | { error: string }>) {
  if (!methodGuard(req, res, "POST")) return;
  noStore(res);
  const { stage, submission } = (req.body ?? {}) as { stage?: unknown; submission?: unknown };
  if (!isStageId(stage)) return res.status(400).json({ error: "unknown stage" });

  const ip = clientIp(req);
  if (TEXT_STAGES.includes(stage)) {
    if (typeof submission !== "string" || submission.length > 200) return res.status(400).json({ error: "bad submission" });
    if (!rateLimit(`verify:${stage}:${ip}`, 30, 60_000)) return res.status(429).json({ error: "slow down" });
    return res.status(200).json(await verifyText(stage, submission));
  }

  if (IMAGE_STAGES.includes(stage)) {
    if (!rateLimit(`verify-img:${ip}`, 10, 60_000)) return res.status(429).json({ error: "slow down" });
    const image = parseDataUrl(submission);
    if (!image) return res.status(400).json({ error: "bad image" });
    const board = await getBoard();
    if (!stageOpen(board, stage)) return res.status(200).json({ success: false });
    if (board.stages[stage].solved) return res.status(200).json({ success: true, already_solved: true });

    const result = await verifyImage(stage, image);
    const aiNote = `AI (${result.provider})${result.detail ? `: ${result.detail}` : ""}`;
    if (result.outcome === "approved") {
      await createReview(stage, submission as string, `${aiNote} said yes`, undefined, "approved");
      void notifyExecs(`📸 AI approved a photo for ${stage}. Check it on /exec (photo log).`);
      return res.status(200).json(await markSolved(stage));
    }
    if (result.outcome === "rejected") {
      await createReview(stage, submission as string, `${aiNote} said no`, undefined, "rejected");
      return res.status(200).json({ success: false });
    }

    const review = await createReview(stage, submission as string, `${result.provider}${result.detail ? `: ${result.detail}` : ""}`);
    void notifyExecs(`📸 Photo for ${stage} needs manual approval on /exec (${result.provider}${result.detail ? `: ${result.detail}` : ""})`);
    return res.status(200).json({ success: false, pending_review: true, review_id: review.id });
  }

  return res.status(400).json({ error: "stage has no submission" });
}
