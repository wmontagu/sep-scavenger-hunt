import type { NextApiRequest, NextApiResponse } from "next";

export function clientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "unknown";
}

export function methodGuard(req: NextApiRequest, res: NextApiResponse, method: string): boolean {
  if (req.method !== method) {
    res.setHeader("Allow", method);
    res.status(405).json({ error: "method not allowed" });
    return false;
  }
  return true;
}

export function noStore(res: NextApiResponse): void {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}
