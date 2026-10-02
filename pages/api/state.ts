import type { NextApiRequest, NextApiResponse } from "next";
import { getBoard, publicState } from "@/lib/board";
import { methodGuard, noStore } from "@/lib/http";

/** GET /api/state - the public board. Never includes shares or answers. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "GET")) return;
  noStore(res);
  const board = await getBoard();
  res.status(200).json(publicState(board));
}
