import type { NextApiRequest, NextApiResponse } from "next";
import { advisorAllowed, logAdvisorPing } from "@/lib/board";
import { isStageId } from "@/lib/stage-config";
import { clientIp, methodGuard, noStore } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { notifyExecs } from "@/lib/notify";

/** POST /api/advisor-request { stage, message? } - "we're stuck" ping. Outdoor stages only. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "POST")) return;
  noStore(res);
  const { stage, message } = (req.body ?? {}) as { stage?: unknown; message?: unknown };
  if (!isStageId(stage) || !advisorAllowed(stage)) return res.status(400).json({ error: "no advisor for this stage" });
  const note = typeof message === "string" ? message.slice(0, 280).trim() : "";
  // One ping per stage per device-IP per 2 minutes is plenty.
  if (!rateLimit(`advisor:${stage}:${clientIp(req)}`, 1, 120_000)) {
    return res.status(200).json({ ok: true, deduped: true });
  }
  await logAdvisorPing({ stage, message: note, at: new Date().toISOString() });
  const delivered = await notifyExecs(`🆘 Advisor requested on ${stage}${note ? `: "${note}"` : ""}`);
  res.status(200).json({ ok: true, delivered });
}
