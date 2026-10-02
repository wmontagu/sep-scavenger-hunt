# Build log — SEP Scavenger Hunt app

Built autonomously from `README (1).md` + `sep-scavenger-hunt-answer-key.md`.
Newest entries at the bottom. **No paid API calls were made at any point**: no
`ANTHROPIC_API_KEY` / `JEV_*` in the environment, and every dry run forces
`IMAGE_VERIFIER=manual` or `mock-*`.

---

## Iteration 1 — scaffold, core logic, tests

### Deviations from the README (and why)
| README said | Built | Why |
|---|---|---|
| Vercel + Vercel KV | **Railway** + Redis (`REDIS_URL`) with a JSON-file fallback | You said you'll deploy on Railway. Railway's Redis plugin sets `REDIS_URL`; with no `REDIS_URL` it uses `.data/hunt.json` (fine locally, but **lost on redeploy**, so add Redis for the event). |
| JEV for the photo | Pluggable: `IMAGE_VERIFIER=claude \| jev \| manual` (default `auto`) | You said you probably won't use JEV. `claude` uses your Anthropic key (model `claude-opus-5`, override with `CLAUDE_VISION_MODEL`). `manual` costs nothing: photos go to the exec console for a tap-to-approve. Any error/rate-limit/refusal falls back to manual. JEV adapter is a guess at the API shape (single function to adjust). |
| No outdoor gate in the schema | Added `outdoor_open` flag (exec button) | The answer key says the outdoor board "opens ~9:45" after a time-boxed indoor round. Without a gate, pledges could start WQED during the indoor round. |
| Shares returned "exactly once" | Kept, plus recovery | Only the first solving request gets the share. If that phone dies, execs can read both shares on `/exec`. Solving devices also keep the share on screen (saved in the browser). |
| Answers in `/content/answers.json` | Same, plus optional `HUNT_ANSWERS_JSON` env override | Lets you keep real answers out of git and change them from the Railway dashboard. |

### What exists
- `lib/store.ts`: Redis / file / memory stores. Atomic read-modify-write (Redis `WATCH/MULTI` retries, in-process mutex otherwise), so two phones solving at the same second can't both get the share.
- `lib/stage-config.ts`: loads `content/*.json` at runtime. Matching ignores case, spaces and punctuation (`" Mc Ginnis!"` → `MCGINNIS`). `null` answers = not filled in yet, so that stage rejects everything.
- `lib/board.ts`: the state machine, the public projection (the only thing `/api/state` returns), the manual photo-review queue and advisor pings.
- `lib/verify-image.ts`: `verifyImage(stageId, image)`.
- API routes: `GET /api/state`, `POST /api/verify`, `GET /api/review-status`, `POST /api/advisor-request`, `POST /api/complete` (exec), `GET /api/exec/state`, `POST /api/exec/action` (exec).
- Exec auth: `EXEC_PASSCODE` env var, sent as the `x-exec-passcode` header. Unset means exec routes are off. Wrong passcode returns 404 so the routes don't reveal they exist.
- Rate limiting: 30 guesses/min per IP per stage (to stop brute-forcing the Gates code) and 10 photos/min per IP.
- Tests: 68 passing (`npm test`).

### Content I did NOT invent (left as TODO / null)
- Stage 2 and 3 keywords, and the Gates code / step count / $X / $Y.
- `clues.json → stages.6_gates.physical_hint`: the answer key doesn't say how the local thread finds the Fence.
- `clues.json → stages.8_convergence.reveal`: the answer key says to explain what MCGINNIS means ("a building"). I wrote a neutral line; replace it with yours.

### Found in `wqed.jpg` (your photo of the marker)
The real marker reads: *"Television station, located here, opened April 1954, as first community-sponsored educational television station in America. In 1955 it was the first to telecast classes to elementary schools."*
That differs from the answer key: there's no "in" before April, and no comma after 1955. **All 6 LAUNCH letter positions are still valid** (Te**l**evision, **A**pril, comm**u**nity, commu**n**ity, **c**ommunity, **h**ere).

### Frontend
- `/` pledge board (mobile-first, dark). Polls `/api/state` every 5s and again when the tab regains focus.
  - Indoor stages 1–3 are listed first until the outdoor board opens.
  - Outdoor board: "Co-founders must split" plus two strategy tabs (remembered per device). Local = Gates code; Global = WQED clue + overlay → LAUNCH → 7b riddle appears inline → selfie upload (front camera).
  - Photos are downscaled in the browser to ≤1280px JPEG (~300KB) before upload.
  - Share card: big 4-letter code + the "find whoever took the other path" copy. It is kept in the device's browser so a refresh doesn't lose it.
  - If a photo goes to manual review, the device polls for the exec's decision and shows the share when approved.
  - Convergence card appears once either thread has its half. The ransom note shows on every phone at the next poll. The complete screen shows once an exec marks it.
  - Wrong answer: "Not quite." with a shake, and the guess is auto-selected so you can retype. No hints.
  - "Ask an advisor" only on 6 / 7a / 7b, limited to one ping per stage per device every 2 min.
- `/exec` exec console (passcode): status (storage / photo mode / webhook), open/close outdoor, mark complete, photo approve/reject queue, advisor pings, per-stage force solve / unsolve, the answer key and both shares, and a Reset that requires typing RESET.

### WQED overlay
- `scripts/build_overlay.py` builds `public/assets/wqed-overlay.png` from `wqed.jpg`: a transparent PNG with 6 numbered circles on L-A-U-N-C-H plus a faint sign silhouette for alignment, and **none of the sign's text**. Tap it to enlarge.
- `docs/wqed-overlay-preview.jpg` is the overlay composited on the photo so you can check placement. It is not in `/public`, so pledges can't load it.

### Scripts
- `npm run check-content [-- --strict]`: TODOs, Gates-math and share-interleave checks, and the A1Z26 numbers for your term-sheet keyword.
- `npm run check-bundle`: scans built client JS/HTML for any answer, share, image prompt or gated clue text.
- `npm run dry-run -- --base <url>`: full HTTP walkthrough of README step 5 (see docs/SETUP.md).
- `npm run reset`, `npm run verify` (typecheck + tests + build + bundle scan).

### Deploy
- `railway.json` (nixpacks, `npm start`, health check `/api/state`, 1 replica), `.env.example`, `docs/SETUP.md` (local run, content fill-in, Railway steps, event-day runbook).

### Verified (iteration 1)
- `tsc` clean, 68/68 unit tests, production build OK, bundle scan clean (0 secrets across 17 files).
- `npm run dry-run` against the production build with the **real** content: ALL CHECKS PASSED. Unfilled stages 2, 3 and 6 were force-solved via the exec override.
- Headless Chrome at iPhone size, with the fixture content, drove the whole UI: wrong/right answers, outdoor opening via polling, Gates share (survives reload), LAUNCH → 7b inline, real photo upload (307KB after downscale) → exec approve → CINS on device, MCGINNIS → ransom note, exec complete → finale, exec login. **0 console errors.**

### Fixes made along the way
- TypeScript 7 isn't supported by Next 15, so it's pinned to TS 6.
- The parent folder has its own `package-lock.json`, so `outputFileTracingRoot` is pinned to this folder.
- `start` script: `next start` (it reads `$PORT`; the `${PORT:-3000}` syntax broke on Windows).
- Retyping after a wrong answer appended to the old guess, so the guess is now auto-selected.

---

## Iteration 2 — hardening

### Bugs fixed
- **Stale shares after a reset.** Phones keep their share and any pending-photo id in the browser, so after a practice run and Reset, those phones would still show `MGNI`/`CINS` on event day. The board now has an `epoch` that changes on every reset. Each phone compares it on every poll and wipes its `hunt:*` data (except the exec passcode) and reloads once. Tested, including no reload loop.
- **Claude verdict schema.** The SDK's zod helper turns a string `enum` into a plain description hint, so "yes"/"no" wasn't actually enforced. It now asks for `{ matches: boolean }`, which is enforced. Found by the new mocked-SDK test.
- **Convergence gate.** The API accepted `MCGINNIS` before either thread had a share, even though the UI hid the card. The API now uses the same rule as the UI: outdoor open **and** (Gates solved or Cathedral solved).
- **Exec console data usage.** `/api/exec/state` was re-sending every photo (about 300KB each) every 4 seconds. Only **pending** photos carry the image now.
- **Unclear photo message.** A photo cleared by a reset was reported as "didn't pass review". It now says it's no longer in the queue.

### Protecting your credits
- `IMAGE_MAX_AI_CALLS` (default **40**) is a hard, atomic cap on paid classifier calls (claude/jev) per hunt run. Once it's hit, photos go to manual review on `/exec`. Reset refills it, and `/exec` shows used/cap. Setting it to `0` turns off paid calls entirely.
- A photo for an already-solved stage never reaches the classifier.

### New tests (82 passing + 4 skipped)
- `tests/claude-classifier.test.ts`: the Claude provider with **`@anthropic-ai/sdk` mocked (no network, no credits)**. Covers:
  - the request shape: image block, prompt, model, effort, boolean schema
  - the `CLAUDE_VISION_MODEL` override
  - refusal → manual, API error → manual
  - the budget cap, including under 20 concurrent requests
- `tests/epoch.test.ts`: epoch stability and rotation, budget refill on reset, and the client-side clearing of stale data.
- `tests/redis.integration.test.ts`: runs against a **real** Redis only when `REDIS_TEST_URL` is set (skipped otherwise). I couldn't run it here: there's no local Redis, and I didn't start Docker because the machine was low on memory. Run it once Railway Redis exists, or with `docker run -p 6379:6379 redis:7`.

### Copy I wrote (not from your docs), all editable in `content/clues.json`
- The board title and tagline, the "outdoor board opens…" message, and the one-line prompts for stages 1, 2, 3 and 6.
- The thread tab subtitles: "Local thread — the hyperlocal-moat play" and "Global thread — the blitzscaling play".
- The convergence prompt, which says **"Interleave them — local first"**. That gives away the mechanic; cut it if you want them to work it out.
- The overlay caption, the upload label, and the complete message ("You made it…").
- Everything else (Fence/Hunt text, the WQED and Cathedral clues, the ransom note, the share message, the advisor line) is verbatim from the answer key.

### Environment note
- During the idle gap, Claude Code killed the local test server because the machine ran low on memory. That wasn't an app problem, and I didn't restart it. This iteration was verified with typecheck, unit tests, the production build and the bundle scan, which don't need a running server.

### Verified (iteration 2)
- `tsc` clean · 82/82 tests (+4 Redis tests skipped) · build OK · bundle scan clean.

---

## Iteration 3 — your answers + stage documents (2026-09-27)

### Answers set (`content/answers.json`)
- Stage 1: `BRAVE` (unchanged).
- Stage 2: `FUNDED`. Checked against the term sheet: the visible numbers in reading order are 6% discount (F), 21% option pool (U), 14x liq pref (N), 4 board seats (D), 5-month vesting cliff (E), 4-month runway (D). ✔
- Stage 3: `SM81`. A `?` now means "character not known yet": the stage rejects everything, including the literal `?M81`, and `check-content` lists it as a TODO. When you learn stop 1's letter, replace the `?` and that's it.

### ⚠ Security fixes (your documents were web-served)
You put the originals in `public/assets/`, and everything in `public/` is downloadable by anyone with the URL:
- **The term-sheet PDF's redactions were fake.** The black boxes sit on top of live text, and the PDF's text layer still contains every hidden value ($750,000 / $6,000,000 / $1.20 / $8,000,000 / 48 months / 12-month cliff / 150% / 1-2-1 board / 1 observer / 20% / $45,000 / $10,000 / Oct 10 2026). Anyone could copy them.
- **The pitch-deck PPTX has "WILL-ONLY NOTES"** in its speaker notes naming all four stops: Welcome Center, Swartz Center, Millie's, TEP 2701.
- The same PDF also contained all three stages together.

Fix:
- **Moved both originals to `source-docs/`**, which isn't served.
- `scripts/build_docs.py` (`npm run build-docs`) renders the pages to flat PNGs in `public/assets/docs/`, so the black boxes are baked into the pixels (I checked the images).
- The pitch slide is rendered from the PDF, not the PPTX, so no speaker notes are included.
- `npm run check-bundle` and a unit test now **fail if any PDF/Office file is ever in `public/`**.

### Web app
- Stage cards 1–3 now show their document (the cap table; term sheet pages 1–2; the pitch deck). Tap to open full size.

### ⚠ Needs your decision
- **The cap table doesn't spell BRAVE.** The new cap table ranks Benjamin 29%, Koza 18%, Rithul 17%, Angel 15%, Evan 11%, Riya 7%, Vedansh 3%. The first letters in ownership order are **B K R A E R V**. The answer key's version (Benjamin 32, Riya 24, Angela 19, Vedansh 15, Evan 10) spelled BRAVE. If Koza and Rithul are meant as decoys, the other five in order give **B A E R V**, which still isn't BRAVE. I left the answer as `BRAVE` as you said, but either the table or the answer needs to change. I didn't edit your document.
- **The pitch slide is hard to read on a phone.** The clue text is small grey-blue on navy. It's readable when tapped open full size, but you may want to raise the contrast in the source.

### Verified (iteration 3)
- `tsc` clean · 88/88 tests (+4 Redis tests skipped) · build OK · bundle scan clean (12 secrets, plus the source-document guard).
- Not re-checked in a browser: the machine had only 0.5 GB of RAM free.

---

## Iteration 4 — stage 3 locked (2026-09-28)

- Stage 3 answer set to `SM81` (S = Welcome Center top-left wooden badge, M = Swartz Center wall words, 8 = Millie's classic price, 1 = TEP 2701). The stage is live now — `SM81` / `s m 8 1` solve it.
- `clues.json → 6_gates.physical_hint` filled: "Start at the Fence. Look for what's posted nearby." (still not the answer key's copy — edit if you want different wording).
- `clues.json → 8_convergence.reveal` filled: identifies McGinnis as McGinnis Hall, per the answer key's "no dead moment" requirement.
- **Removed `public/assets/docs/pitch-deck-stage3.pptx`** — it was web-served again (with speaker notes). `build_docs.py` only writes the rendered PNGs, so it must have been copied manually; keep the source PPTX in `source-docs/` only.
- Tests updated: stage-3 placeholder assertions replaced with SM81 checks; the `?` semantics still covered via an overridden answers object.
- **Physical cards**: `npm run build-cards` → `print/hunt-cards.pdf` (letter, one card per page, dashed cut line). Page 1 = Fence card ("5:30 / in white / - SEP" in big red); page 2 = Hunt vestibule card (the verbatim OUR PITCH riddle → footbridge → Gates); page 3 = Gates floor-5 card. The Gates card reads `burn_rate_k` / `cash_on_hand_k` straight out of `answers.json` — while they're null it prints red `$___K` placeholders plus a "FILL IN" warning on the card itself. Stages 4 and 5 stay physical-only by design (answer key: "No submission"); the app only needs the stage-6 code entry, which is why they don't appear as app stages.
- Gotcha found: pymupdf base-14 fonts are Latin-1, so em-dashes render as `?` — card copy uses hyphens. And `insert_textbox` silently drops text that doesn't fit its rect, so there's now a `box()` wrapper that warns on overflow.

### Still needs you (can't be done from the code)
- **Stage 6 Gates content**: count the real steps down the spiral, then set `step_count`, `burn_rate_k`, `cash_on_hand_k` (= burn × steps), and `code` (what you chalk on the pillar) in `answers.json`. `npm run check-content -- --strict` will block until it's done.
- **Cap table vs BRAVE**: the flagged mismatch from iteration 3 (table spells B-K-R-A-E-R-V, not BRAVE) still needs a decision — either edit the table or change the stage 1 answer.

### Verified (iteration 4)
- `check-content`: 0 errors, 2 todos (both the Gates scouting numbers) · 88/88 tests (+4 Redis skipped).

---

## Iteration 5 — stage 6 locked (2026-09-29)

- `answers.json → 6_gates` filled: `step_count` 42, `burn_rate_k` 20, `cash_on_hand_k` 840 (840 ÷ 20 = 42), `code` `X7G0`.
- New optional `6_gates.also_accept` list: `["X7GO"]`, so the letter O is accepted for the chalked zero. Alternates only count once the primary `code` is set, and they go through the same normalization (case/space/punctuation-insensitive). Implemented in `checkTextAnswer` in `lib/stage-config.ts`.
- `print/hunt-cards.pdf` (and `stage6-gates.pdf`) rebuilt: the Gates card now reads "Cash in hand: $840K / Burn rate: $20K/month", with no FILL IN warning.
- Tests: the stage-6 placeholder test now uses a cloned answers object with `code: null`. The test that listed TODOs in the real content now asserts the real content has none. New test covers X7G0 / x7go / "x 7 g 0" being accepted, X7G / X7GQ / 42 being rejected, and the 42-step math.

- Pillar at step 42 is chalked **X7G0** (done on site).
- **Cap table resolved (not a mismatch):** the intended mechanic is to take the ownership %s ending in 9, 7, 5, 3, 1, in that order: 29% Benjamin, 17%/7% Rithul/Riya (both R), 15% Angel, 3% Vedansh, 11% Evan → **BRAVE**. Koza (18%) is the decoy. The answer stays `BRAVE`; the answer key and the `answers.json` note now describe this mechanic.

### Verified (iteration 5)
- `tsc` clean · 89/89 tests (+4 Redis skipped) · `check-content --strict`: 0 errors, 0 todos.

---

## Iteration 6 — no Hunt card; the Fence answer goes in the app (2026-09-29)

- New text stage **`4_fence`**, the first card in the local thread. It carries the thread's title/subtitle and the "Start at the Fence" hint. Answer `HUNT` (`also_accept: ["HUNT LIBRARY"]`). It's an advisor stage too.
- Solving it returns the OUR PITCH riddle inline and reveals the Gates stage below it. The riddle now lives in `clues.json → stages.6_gates.clue`, and `/api/state` only serves it once `4_fence` is solved. `6_gates` is locked (`stageOpen`) until then, the same way 7b waits for 7a.
- `also_accept` now works for any text stage, not just Gates.
- Print: the Hunt vestibule card is gone. `print/hunt-cards.pdf` is now 2 pages (Fence, Gates) and `print/stage5-hunt.pdf` was deleted.
- Exec console stage list, dry-run script (fence → pitch → Gates), answer key, and test fixtures updated. New board test covers: Gates hidden and locked before HUNT, `HUNTER` rejected, `Hunt Library` accepted, riddle returned inline and then shown in state.

### Verified (iteration 6)
- `tsc` clean · 90/90 tests (+4 Redis skipped) · `check-content --strict`: 0 errors, 0 todos · cards rebuilt.

---

## Iteration 7 — nothing printed; every clue is on screen (2026-09-30)

- `4_fence` now shows the riddle **"5:30 in white — SEP"** as its on-screen clue (was a printed card at the Fence). `physical_hint` removed from the content schema, the board projection and `StageCard`.
- `6_gates`: new `clues.json → stages.6_gates.spiral_clue` ("Once you've crossed: we started spiraling… Cash in hand: $840K. Burn rate: $20K/month…"). After HUNT is solved, the app shows the pitch riddle and the spiral riddle together, both inline and in state. Neither is served before HUNT.
- `check-content` errors if the spiral riddle's `$…K` figures don't match `answers.json → 6_gates`.
- Deleted `scripts/build_cards.py`, the `build-cards` npm script and `print/`. SETUP.md, the answer key and the answers.json notes were updated to match.
- The only physical thing left is the code chalked on the pillar at step 42.

### Verified (iteration 7)
- `tsc` clean · 90/90 tests (+4 Redis skipped) · `check-content --strict`: 0 errors, 0 todos · dev server serves `/` (200).
- The production `next build` wasn't re-run cleanly: it collided with the running dev server's `.next` on OneDrive (EINVAL readlink). Re-run `npm run verify` with the dev server stopped.

---

## Iteration 8 — outdoor opens by itself, three screens, live banners (2026-09-30)

- **Auto-open:** `outdoorOpen(board)` in `lib/board.ts` is true once `1_cap_table`, `2_term_sheet` and `3_pitch_deck` are all solved, or if an exec force-opens it early. Both the board projection and `stageOpen` use it. The exec console shows why the board is open. The close button is hidden once the indoor round is solved, since closing would have no effect.
- **Pledge page = three screens:** (1) the indoor board plus "Solve all three indoor stages to unlock the outdoor board"; (2) once open, a full-width strategy picker ("Co-founders must split"); (3) only the chosen strategy's stages, with a "Switch strategy" button. The choice is remembered per device. The indoor stages disappear after the switch. The convergence card, ransom note and completion screen still show above everything.
- **Live updates:** polling every 2s (was 5s), plus on tab focus. When a poll shows something new, every phone gets a banner (and a short vibration where supported): "✓ Global thread solved 'Go wide before you go deep'", "🔓 Indoor round done — the outdoor board is open!", the intercepted note, and hunt complete. Banners clear after 6s.
- Tests: new auto-open test (2 of 3 indoor stages → still closed; the 3rd → both threads visible). The dry run now checks auto-open instead of calling `open_outdoor`.

### Verified (iteration 8)
- `tsc` clean · 91/91 tests (+4 Redis skipped) · `check-content --strict` clean. Not checked in a browser: the dev server was stopped for low memory.

---

## Iteration 9 — the Fence is found on site again (2026-09-30)

- "5:30 in white — SEP" is **written on the bench by the Fence** and is no longer shown on screen. A test asserts "5:30" never appears in `/api/state`.
- `4_fence` now opens with a new on-screen marketing hint pointing to the Fence (draft wording; nothing earlier in the repo had one): *"Every startup lives or dies by its marketing. On this campus, when you want everyone to see your message, there's one place you paint it — and it's been repainted more than almost anything on Earth. We left our ad right beside it. Find what we wrote."*
- Answer key, SETUP.md and the answers.json note updated. 91/91 tests · check-content clean · live on the dev server.

---

## Iteration 10 — "The OG guerrilla marketing stunt" (2026-09-30)

- `4_fence` is now titled **The OG guerrilla marketing stunt**. The screen shows only the riddle (the Fence: painted overnight, guarded till dawn, painted over, thousands of coats) plus "You'll find your answer there — look for something scrawled in black Sharpie. Where is it sending you?" The note on the picnic table ("5:30 in white — SEP") is still never on screen.
- Strategy-picker labels now come from `clues.json → board.threads` (local: "Stay close, dig deep", global: "Go wide before you go deep"), so they're independent of stage titles. `4_fence.subtitle` was removed.
- Answer key updated (black Sharpie, picnic table, founder's note). 91/91 tests · typecheck · check-content clean · live on the dev server.

---

## Iteration 11 — WQED stage uses layout.png, shown inline (2026-09-30)

- The WQED stage now shows **`public/layout.png`** (your hand-drawn sign outline with six unnumbered red circles) directly on the card, at full width on a white panel, with no tap-to-open link. The old `/assets/wqed-overlay.png` it pointed to no longer existed, so the image had been broken.
- Caption no longer mentions numbers: "When you find it, hold this up against what's written there. The circled letters, read in order, are your answer."
- Removed the numbered-overlay generator (`scripts/build_overlay.py`, `npm run build-overlay`) so nobody regenerates a numbered version. SETUP.md updated. `docs/wqed-overlay-preview.jpg` (old numbered preview, not served) is left in place.
- 91/91 tests · typecheck clean · `/layout.png` served 200 by the dev server. Not screenshotted: the Chrome extension wasn't connected.

---

## Iteration 12 — photo check model (2026-10-01)

- Default vision model changed from `claude-opus-5` to `claude-opus-5-5` (current Opus, $4/$20 per MTok vs $5/$25, same structured-output call). Override with `CLAUDE_VISION_MODEL`. `.env.example`, SETUP.md and the classifier test updated; 16/16 image tests pass.
- Status: **no `ANTHROPIC_API_KEY` is set** (no `.env.local`, nothing in the environment), so `auto` resolves to `manual`, and every 7b selfie waits for an exec on `/exec`. `/exec` needs `EXEC_PASSCODE`, which is also unset, so **right now nobody can approve the 7b photo**. Set at least one of the two before the hunt.
- No live API call made; the classifier is covered by mocked-SDK tests only.

---

## Iteration 13 — settings come from .env.example (2026-10-01)

- `next.config.mjs` now loads `.env.example` at startup. Blank values are skipped, and variables already set in the environment (e.g. Railway) take precedence.
- `.env.example` added to `.gitignore` (it was untracked; this keeps keys out of future commits). Its header comment now says it's the real settings file.
- `IMAGE_VERIFIER` changed from `manual` to `auto` in it: `manual` would ignore an API key. With `auto`, adding `ANTHROPIC_API_KEY` turns the Claude photo check on, and while it's blank photos still go to manual review.
- Verified the loader picks up values. `EXEC_PASSCODE` and `ANTHROPIC_API_KEY` are still blank.
