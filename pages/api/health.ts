import type { NextApiRequest, NextApiResponse } from "next";
import { getBoard } from "@/lib/board";
import { methodGuard, noStore } from "@/lib/http";
import { getStore } from "@/lib/store";

const STARTED_AT = new Date().toISOString();

/**
 * GET /api/health - public, no secrets. Says which storage is live and whether it
 * actually round-trips, plus when this server process started (a restart on file
 * storage is what wipes the board).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, "GET")) return;
  noStore(res);
  const raw = process.env.REDIS_URL;
  const storage = raw ? "redis" : "file";
  let roundtrip: string;
  try {
    const store = getStore();
    const token = new Date().toISOString();
    await store.set("hunt:health", token);
    roundtrip = (await store.get<string>("hunt:health")) === token ? "ok" : "mismatch";
  } catch (err) {
    roundtrip = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  const board = await getBoard().catch(() => null);
  res.status(200).json({
    storage,
    // "set but blank" happens when a ${{Service.VAR}} reference names the wrong service
    redis_url_var: raw === undefined ? "missing" : raw === "" ? "blank" : "set",
    roundtrip,
    process_started_at: STARTED_AT,
    board_version: board?.version ?? null,
    board_epoch: board?.epoch ?? null,
  });
}
