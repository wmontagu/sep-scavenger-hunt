import type { NextApiRequest, NextApiResponse } from "next";
import { setFlag } from "@/lib/board";
import { isExec } from "@/lib/exec-auth";
import { methodGuard, noStore } from "@/lib/http";

/**
 * POST /api/complete (exec-only, header x-exec-passcode) { complete?: boolean }
 * Will confirms the rescue in person at 61C, then flips this.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "POST")) return;
  noStore(res);
  if (!isExec(req)) return res.status(404).json({ error: "not found" });
  const value = (req.body ?? {}).complete !== false;
  const board = await setFlag("complete", value);
  res.status(200).json({ ok: true, complete: board.complete });
}
