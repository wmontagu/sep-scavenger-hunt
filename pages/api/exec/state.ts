import type { NextApiRequest, NextApiResponse } from "next";
import { getBoard, listAdvisorPings, listReviews } from "@/lib/board";
import { checkContent, getAnswers } from "@/lib/stage-config";
import { AI_CALLS_KEY, aiCallCap, selectClassifier } from "@/lib/verify-image";
import { getStore } from "@/lib/store";
import { isExec } from "@/lib/exec-auth";
import { methodGuard, noStore } from "@/lib/http";

/** GET /api/exec/state - everything, for the exec console. Passcode required. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "GET")) return;
  noStore(res);
  if (!isExec(req)) return res.status(404).json({ error: "not found" });
  const [board, reviews, advisor, aiCalls] = await Promise.all([
    getBoard(),
    listReviews(),
    listAdvisorPings(),
    getStore().get<number>(AI_CALLS_KEY),
  ]);
  res.status(200).json({
    board,
    // Only pending photos carry the image (this is polled every few seconds on a phone).
    reviews: reviews.map((r) => (r.status === "pending" ? r : { ...r, image: "" })),
    advisor,
    answers: getAnswers(),
    content_problems: checkContent(),
    image_verifier: selectClassifier().name,
    ai_calls: { used: aiCalls ?? 0, cap: aiCallCap() },
    storage: process.env.REDIS_URL ? "redis" : "file",
    webhook: Boolean(process.env.EXEC_WEBHOOK_URL),
  });
}
