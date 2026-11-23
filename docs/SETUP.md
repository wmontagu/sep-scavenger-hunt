# Setup, deploy, and event-day runbook

## Run locally
```bash
npm install
EXEC_PASSCODE=pick-something IMAGE_VERIFIER=manual npm run dev   # http://localhost:3000
```
- Pledge board: `/` · Exec console: `/exec` (not linked anywhere; needs the passcode)
- State is saved to `.data/hunt.json` locally. `npm run reset` wipes it.
- Settings: `cp .env.example .env.local` and edit `.env.local` (git-ignored), or pass env vars inline as below.

## Checks
```bash
npm test               # 70+ unit tests (state machine, API routes, stores, image verifier)
npm run check-content  # lists unfilled TODOs; --strict fails on any TODO (run before the event)
npm run verify         # typecheck + tests + production build + client-bundle leak scan
REDIS_TEST_URL=redis://localhost:6379 npm test   # also runs the real-Redis integration test
```
End-to-end dry run against a running server (local or Railway). This is README step 5:
```bash
EXEC_PASSCODE=... npm run dry-run -- --base https://your-app.up.railway.app
```
It resets the board, plays every stage over HTTP, checks the anti-cheat rules, then
resets again (`--keep` leaves the finished board up). It never calls a paid image
classifier unless you pass `--allow-paid`.

## Fill in content (no code changes)
All in `content/answers.json` (server-only) and `content/clues.json` (pledge copy).
Stages 1–3 are already set (BRAVE / FUNDED / SM81). Only one thing is left:
1. `6_gates`: set `step_count` (real stair count), `burn_rate_k`, and `cash_on_hand_k` = burn × steps (the checker verifies the math), plus the `code` you chalk on the pillar.

To keep real answers out of git, paste the whole answers JSON into the `HUNT_ANSWERS_JSON`
env var on Railway instead. It overrides the file.

## No printed cards
Nothing is printed. The local thread opens with an on-screen marketing hint that points to the
Fence; "5:30 in white — SEP" is written on the bench beside it. Solving that (HUNT) reveals the pitch riddle plus the
Gates spiral math in `clues.json → stages.6_gates.clue` / `spiral_clue`. `check-content`
fails if the spiral riddle's $ figures don't match `answers.json → 6_gates`.
The only thing on site is the code chalked on the pillar at the step count.

## WQED overlay
The WQED stage shows `public/layout.png` inline: a hand-drawn outline of the sign with six
unnumbered red circles. Read in order, the circled letters spell LAUNCH. To change it, replace
that file (same name); nothing is generated.

## Deploy on Railway
1. New project → deploy from this repo/folder. `railway.json` sets build = `npm run build`,
   start = `npm start` (Next reads `$PORT`), and health check = `/api/state`.
2. **Add the Redis plugin** and set `REDIS_URL` to reference it (`${{Redis.REDIS_URL}}`). Without it,
   progress is lost on every redeploy/restart.
3. Env vars: `EXEC_PASSCODE` (required). Then choose one image option:
   - `IMAGE_VERIFIER=manual`: free. Every selfie shows up on `/exec` for one-tap approve.
   - `IMAGE_VERIFIER=claude` + `ANTHROPIC_API_KEY`: auto-checks selfies (roughly a cent or two each on
     `claude-opus-5-5`). Errors and rate limits fall back to manual review automatically.
     `IMAGE_MAX_AI_CALLS` (default 40) caps paid calls per run. Past the cap, photos go to `/exec`,
     so spammed uploads can't run up your bill. `/exec` shows used/cap.
4. Optional: `EXEC_WEBHOOK_URL` (a Slack or Discord incoming webhook) for advisor pings and
   photos waiting for review.
5. Keep 1 replica. The guess rate-limiter is in-memory; the state itself is safe with more replicas.

## Event-day runbook
- **Before:** `npm run check-content -- --strict` passes; run the dry run against the deployed
  URL; press Reset on `/exec`. Reset also clears shares left on phones from any practice run:
  each phone notices the new run on its next poll and drops its old data. Open `/exec` on an exec phone and leave it open.
- **~9:30:** share the board URL. The indoor board (stages 1–3) is live.
- **~9:45:** press **Open outdoor board** on `/exec`. Everyone's phone updates within about 5s.
- **During:** watch `/exec` for advisor pings and photos. If a phone that got a share dies,
  both shares are shown on `/exec`. **Force solve** is there if a physical clue breaks.
- **At 61C:** press **Mark hunt complete** and every screen shows the finale.
