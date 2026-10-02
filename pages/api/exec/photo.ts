import type { NextApiRequest, NextApiResponse } from "next";
import { reviewKey, type Review } from "@/lib/board";
import { getStore } from "@/lib/store";
import { isExec } from "@/lib/exec-auth";
import { methodGuard, noStore } from "@/lib/http";

/** GET /api/exec/photo?id=<review id> - one submitted photo, for the exec photo log. Passcode required. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "GET")) return;
  noStore(res);
  if (!isExec(req)) return res.status(404).json({ error: "not found" });
  const id = typeof req.query.id === "string" ? req.query.id : "";
  const review = id ? await getStore().get<Review>(reviewKey(id)) : null;
  if (!review) return res.status(404).json({ error: "no such photo" });
  res.status(200).json({ image: review.image });
}
