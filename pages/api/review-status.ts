import type { NextApiRequest, NextApiResponse } from "next";
import { claimReview } from "@/lib/board";
import { methodGuard, noStore } from "@/lib/http";

/** GET /api/review-status?id=<review id> — polled by the device that uploaded the photo. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "GET")) return;
  noStore(res);
  const id = req.query.id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: "bad id" });
  res.status(200).json(await claimReview(id));
}
