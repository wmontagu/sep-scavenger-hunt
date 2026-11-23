# Deployment guide

The app is a standard Next.js server. It needs:
- **Node 20+** (the host handles this),
- **a Redis database** (`REDIS_URL`) so progress isn't lost on restarts,
- the env vars in [`.env.example`](../.env.example). `EXEC_PASSCODE` is required.

Always test the deployed site before the event:
```bash
EXEC_PASSCODE=yourpasscode npm run dry-run -- --base https://your-site-url
```
Then press **Reset** on `/exec`.

> Using Claude Code or Cursor? Paste: "Follow docs/DEPLOYMENT.md to deploy this to Railway and tell me exactly what to click."

---

## Option A: Railway (recommended)

Railway is a company that runs your site for you. It costs a few dollars a month after the free trial; one event usually costs very little (delete the project afterward to stop charges).

Railway keeps one always-on server, which matches how the hunt works (one shared state, polling every few seconds).

1. Click **Fork** on this repo's GitHub page to make your own copy (needs a free GitHub account). Edit your content in that copy first.
2. [railway.com](https://railway.com) > **New Project** > **Deploy from GitHub repo** > pick it. `railway.json` already sets the build, start and health check.
3. In the project, **+ New** > **Database** > **Add Redis**.
4. Click your app service > **Variables** (these are the settings from `.env.example`; each has a name and a value) and add:
   - `EXEC_PASSCODE` = your passcode
   - `REDIS_URL` = `${{Redis.REDIS_URL}}` (Railway fills this in from the Redis service)
   - After saving, Railway redeploys automatically; wait for a green check.
   - optional: `IMAGE_VERIFIER`, `ANTHROPIC_API_KEY`, `EXEC_WEBHOOK_URL`, `HUNT_ANSWERS_JSON`
5. **Settings > Networking > Generate Domain**. Open it; you have a live hunt.
6. Keep **1 replica** (already set in `railway.json`).

## Option B: Vercel

Works, with two differences: there is no local disk, so **Redis is mandatory**, and the guess rate-limiter is per-serverless-instance
(so it is softer than on Railway). Fine for a friendly pledge event.

1. Get a free Redis URL from [Upstash](https://upstash.com) (create database > copy the `rediss://...` connection string, not the REST URL).
2. Push the repo to GitHub. [vercel.com](https://vercel.com) > **Add New Project** > import it. The framework is detected automatically.
3. Under **Environment Variables** add `EXEC_PASSCODE` and `REDIS_URL` (plus any optionals) and deploy.
4. If a function times out on photo checks, set `IMAGE_VERIFIER=manual`.

Note: Vercel has not been test-deployed for this repo; the config is set up for it (content files are bundled), but do a dry run first.

## Option C: Cloudflare

The app uses a normal Redis connection and Node features, so it is not set up to run *on* Cloudflare Workers/Pages. Use Cloudflare for
what it is great at: **your domain and DNS**. Host the app on Railway or Vercel (above) and point a Cloudflare DNS record at it (next section).
If you really want the app itself on Cloudflare, ask Claude Code/Cursor to port it with `@opennextjs/cloudflare`; expect to replace
`ioredis` with an HTTP Redis client (e.g. Upstash REST) in `lib/store.ts`.

## Use your own domain, or a subdomain of an existing site (for example the cmusep one)

Recommended: a **subdomain** like `hunt.yourdomain.org`. It does not touch the main site.

1. In your host: Railway **Settings > Networking > Custom Domain**, or Vercel **Settings > Domains**. Enter `hunt.yourdomain.org`.
   The host shows a **CNAME target** (something like `xxxx.up.railway.app` or `cname.vercel-dns.com`).
2. In whoever manages the domain's DNS (Cloudflare, Squarespace, GoDaddy, Namecheap, ...) add a record:
   - Type **CNAME**, Name **hunt**, Target = the value from step 1.
   - On Cloudflare, set the record to **DNS only** (grey cloud) until the host says the domain is verified, then you may turn the proxy back on.
3. Wait a few minutes. HTTPS is issued automatically.

No DNS access? Ask whoever runs the club website to add that one CNAME record (send them the two values). Nothing else is needed.

**Want it under a path like `yourdomain.org/hunt` instead?** Only possible if the main site can proxy or rewrite that path to the hunt URL
(e.g. a Cloudflare Worker route, or a `rewrites` entry in a Next.js/Vercel main site). A subdomain is far simpler; use it unless there is a strong reason.

## Troubleshooting

- **Progress disappears after redeploy:** `REDIS_URL` isn't set or is wrong. Check `https://your-site/api/health`; it reports which storage is live and does a Redis round-trip.
- **`/exec` says wrong passcode:** `EXEC_PASSCODE` on the host differs from what you typed; redeploy after changing variables.
- **Every guess is rejected:** a stage still has a `null` answer or a `?` in `content/answers.json`. Run `npm run check-content`.
- **Local env changes ignored:** put them in `.env.local` (not `.env.example`) and restart `npm run dev`.
