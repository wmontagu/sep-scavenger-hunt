import crypto from "node:crypto";
import type { NextApiRequest } from "next";

/**
 * Exec-only routes require the EXEC_PASSCODE env var, sent as the
 * `x-exec-passcode` header. If EXEC_PASSCODE is unset, exec routes are disabled.
 */
export function isExec(req: Pick<NextApiRequest, "headers">): boolean {
  const expected = process.env.EXEC_PASSCODE;
  if (!expected) return false;
  const got = req.headers["x-exec-passcode"];
  if (typeof got !== "string") return false;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
