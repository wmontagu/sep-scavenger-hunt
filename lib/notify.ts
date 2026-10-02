/**
 * Ping the execs. Posts to EXEC_WEBHOOK_URL if set - the body carries both `text`
 * (Slack incoming webhooks) and `content` (Discord webhooks), so either works.
 * Everything is also logged and visible on /exec, so a webhook is optional.
 */
export async function notifyExecs(text: string): Promise<boolean> {
  console.log(`[exec-notify] ${text}`);
  const url = process.env.EXEC_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch (err) {
    console.error("[exec-notify] webhook failed:", err);
    return false;
  }
}
