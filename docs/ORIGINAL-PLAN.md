# SEP Pledge Scavenger Hunt — README / Dev Plan

## Overview

A live, browser-based scavenger hunt for ~14 pledges, running Oct 3, starting
~9:30. No accounts, no per-user tracking. State is **shared and global** — the
whole group is one pool, not teams. Two physical threads run in parallel after the
indoor board, gated by a "co-founders must split" framing (pledges self-organize
into pairs; CS-major pairs take the local/Gates thread since they have weekend
card access there).

Core principle: the server is close to stateless. The only persistent state is one
JSON object tracking which stages are solved, two secret 4-character share strings,
and the ransom-note/completion flags. No database schema beyond that, no auth.

## Stack

- **Frontend + API**: Next.js, single Vercel deploy
- **Shared state**: Vercel KV (Upstash Redis) — one JSON blob
- **Image classification**: JEV API (external vision classifier, binary yes/no),
  called server-side only
- **Deployment**: Vercel

## File structure — built for drop-in content

Build this from day one, even while values are still placeholders. Nothing in this
list should ever require touching application logic to update later.

```
/content/answers.json       — server-only. Holds every stage's answer/keyword as
                                plain editable fields: 2_term_sheet, 3_pitch_deck,
                                6_gates (code + the $X/$Y numbers), 7a_wqed (fixed
                                at "LAUNCH"), 8_convergence (fixed at "MCGINNIS").
                                stage-config.ts reads from this file rather than
                                hardcoding values, so swapping a keyword or the
                                Gates numbers later is a one-line JSON edit, no
                                code redeploy needed.
/content/clues.json          — server-safe static text: the Fence/Hunt/WQED/
                                Cathedral/ransom-note copy. Editable the same way.
/public/assets/wqed-overlay.png
                              — placeholder file at this exact path from day one
                                (a blank/dummy PNG is fine as a stand-in). When
                                the real WQED photo is taken and the overlay is
                                built, it replaces this file directly — no
                                frontend code change needed, since the img tag
                                just points at this fixed path.
/lib/stage-config.ts         — imports /content/answers.json and /content/clues.json,
                                never hardcodes the placeholder values inline.
/pages/api/state.ts          — GET /api/state
/pages/api/verify.ts         — POST /api/verify
/pages/api/complete.ts       — POST /api/complete (exec-only)
/pages/api/advisor-request.ts — POST /api/advisor-request
/pages/index.tsx             — the single pledge-facing board page
```

## Data model

Single KV key `hunt:board`:

```json
{
  "stages": {
    "1_cap_table": { "solved": false },
    "2_term_sheet": { "solved": false },
    "3_pitch_deck": { "solved": false },
    "6_gates": { "solved": false },
    "7a_wqed": { "solved": false },
    "7b_cathedral": { "solved": false },
    "8_convergence": { "solved": false }
  },
  "local_share": null,
  "global_share": null,
  "ransom_note_visible": false,
  "complete": false
}
```

Stages 4 ("The Fence") and 5 (Hunt vestibule) are pure physical pointers with no
app submission — they don't appear in this schema at all, since there's nothing to
validate. They exist only as printed/written physical clues.

`local_share` and `global_share` are written to KV on success but **never
returned by `/api/state`** — only returned once, directly, in the response to the
specific request that solved that stage. This siloing is what forces the two
groups to actually communicate to reconstruct MCGINNIS.

## Answer keys / JEV prompts

**Never ship any of this to the client** — all of it lives in a server-only config
module, imported only by API routes, sourced from `/content/answers.json`.

```
/lib/stage-config.ts (server-only, reads /content/answers.json)

1_cap_table:    answer = "BRAVE"

2_term_sheet:   answer = <PLACEHOLDER_KEYWORD> — plug-in template, not yet chosen.
                  Pick any keyword, then set each visible number to that letter's
                  A1Z26 position. Swap the keyword and numbers freely later.

3_pitch_deck:   answer = <PLACEHOLDER_KEYWORD> — plug-in template, not yet chosen.
                  Pick any keyword, write one blank per letter, resolve each blank
                  with a real Tepper-specific fact (room number, plaque, etc.).

6_gates:        answer = <PLACEHOLDER_CODE> — the code posted on the pillar at the
                  calculated step. Formula to regenerate: pick a clean burn rate
                  $[X]K, set cash-on-hand $[Y]K = $[X]K × (real step count down the
                  spiral, not yet measured). The step count is the one hard
                  dependency here — everything else is freely swappable once known.
                 on success: returns local_share = "MGNI"
                  (positions 1,3,5,7 of "MCGINNIS")

7a_wqed:        answer = "LAUNCH" — locked, not a placeholder.
                 on success: unlocks and returns the 7b clue text (see below)

7b_cathedral:   image submission -> JEV prompt:
                  "Does this photo show 3 people standing in front of a tall
                   Gothic stone building? yes/no"
                 on success: returns global_share = "CINS"
                  (positions 2,4,6,8 of "MCGINNIS")

8_convergence:  answer = "MCGINNIS" (case-insensitive, trimmed)
                 on success: sets ransom_note_visible = true

finale:         NOT a pledge-facing verify stage — no JEV call, no submission.
                 Will is physically present at 61C with the two "kidnapped"
                 pledges, so completion is confirmed in person. See
                 POST /api/complete below.
```

MCGINNIS split: local thread holds odd positions (`M G N I`), global thread holds
even positions (`C I N S`).

## Clue / hint content (static, safe to ship to client)

Shown in the UI once the relevant stage is reached, sourced from
`/content/clues.json`. Full exact wording lives in the companion answer-key
document — pull the text from there verbatim when populating this file.

- **Stage 4 (Fence, physical only):** "5:30 in white — SEP"
- **Stage 5 (Hunt, physical only):** the Pausch-bridge pitch
- **Stage 7a opening:** the "go wide before you go deep... old broadcast empires"
  clue pointing to WQED
- **Stage 7b (revealed after 7a solved):** the "tallest building within a mile"
  clue pointing to the Cathedral of Learning
- **Stage 9 ransom note (revealed after stage 8):** the $61M/Series C/"take a bus"
  text

## API routes

### `GET /api/state`
Returns the public board: which stages are solved, the currently-unlocked clue
text for reached stages, the ransom note (only once stage 8 is solved), and
`complete`. Never returns `local_share`, `global_share`, or any answer/JEV prompt.

### `POST /api/verify`
Body: `{ stage: string, submission: string | File }`

- Text stages: case-insensitive, trimmed match against the server-side answer.
- Image stage (7b only): forward image to JEV with the stage's fixed prompt,
  parse yes/no.
- On success: flip that stage's `solved` flag in KV. For 6_gates and 7b_cathedral,
  return that thread's 4-char share **only in this response**, never written
  anywhere `/api/state` exposes. For 7a_wqed, return the unlocked 7b clue text.
  For 8_convergence, also set `ransom_note_visible = true`.
- On failure: `{ success: false }` — no partial credit, no hints in the response
  body (hints are a separate flow, see below).

Use Vercel KV's atomic ops (or read-modify-write with a version check) to avoid a
race if two submissions land on the same stage within seconds of each other.

### `POST /api/complete` (exec-only)
No pledge-facing UI calls this. Triggered manually by Will/an exec once the group
actually arrives at 61C and finds the "kidnapped" pledges in person — no photo, no
JEV, since Will can just confirm it himself. Sets `complete: true` in KV. Should be
behind something a pledge can't trigger by accident or by guessing a URL — a simple
shared exec passcode or a route not linked anywhere in the pledge-facing UI is
enough given the stakes here (a live one-shot event, not a public product).

### `POST /api/advisor-request`
Simple notification endpoint — no validation logic, just logs/forwards a
"we're stuck on stage X" ping to execs (e.g. via a Slack webhook or SMS gateway).
Available only for stages 6, 7a, and 7b (the outdoor threads) — not for stages
1–3, which run with zero hints by design since they're time-boxed and don't gate
anything downstream.

## Frontend

- Single board page, no login. Poll `/api/state` every 5–10s.
- Indoor stages (1–3): text input + submit, no advisor button.
- Outdoor stages: clue text shown once reached; text input for 6/7a/8, photo
  upload (mobile camera capture) for 7b only; an "Ask an advisor" button that hits
  `/api/advisor-request`.
- On a 6_gates or 7b_cathedral success, prominently display the returned 4-char
  share on that device only, with explicit copy: "You've got part of a code —
  find whoever took the other path and combine what you've each got."
- Stage 7a success reveals stage 7b's clue inline (no separate page load needed).
- Ransom note renders as soon as `/api/state` reflects it — broadcasts to everyone
  polling at once. Completion (`complete: true`) is set by the exec-only action
  above, not by any pledge submission — the app just needs to render a "you made
  it" state once `/api/state` shows `complete`.

## JEV integration

- Wrap the JEV call behind `verifyImage(stageId, file) -> Promise<boolean>` so
  swapping keys or adding a manual-review fallback is a one-line change.
- **Fallback plan:** if JEV is unavailable or the borrowed key hits a rate limit,
  `verifyImage` should be able to fall back to logging the image (Slack webhook or
  email) for manual exec approval rather than hard-failing the stage.
- Env var: `JEV_API_KEY`.

## Anti-cheat checklist

- [ ] No answer key, JEV prompt, or WQED letter-position mapping ever appears in
      client-side JS.
- [ ] `/api/state` never includes `local_share`, `global_share`, or any unsolved
      stage's answer.
- [ ] The two shares are returned exactly once, only to the solving request.
- [ ] `/api/verify` gives no partial-match or "warm/cold" feedback on wrong
      answers.

## Deployment steps

1. Next.js + Vercel project, connect Vercel KV.
2. Env vars: `JEV_API_KEY`, KV connection vars (auto-set by the Vercel KV
   integration).
3. Seed `hunt:board` in KV with the initial state object before the event.
4. Populate `/content/answers.json` and `/content/clues.json` with real values as
   they're finalized; drop the real WQED overlay into
   `/public/assets/wqed-overlay.png` once built.
5. Dry run: manually hit `/api/verify` for every stage to confirm the full chain
   (including 7a unlocking 7b, both shares combining into MCGINNIS, and MCGINNIS
   unlocking the ransom note) works end-to-end, then manually hit `/api/complete`
   to confirm the finale render, before Oct 3.
6. Reset script/route to restore `hunt:board` to initial state for a second dry
   run if needed.

## Content still needed before this is build-ready

- [ ] Stage 2 (term sheet): pick a keyword + numbers (template is ready to fill)
- [ ] Stage 3 (pitch deck): pick a keyword + Tepper facts (template is ready to
      fill)
- [x] Stage 6 (Gates): real step count down the spiral → back-solve $X/$Y so the
      math divides cleanly (formula is ready, just needs the real count)
- [ ] Stage 7a (WQED): confirm exact on-site marker wording, then build the
      overlay PNG from a real photo (LAUNCH itself is locked)

## Testing checklist before Oct 3

- [ ] Full dry run of the state machine (all stages, both threads, convergence,
      ransom note, and manual `/api/complete`) against the deployed API
- [ ] JEV prompt tested against real sample photos (pass and fail cases) for 7b
- [ ] "61C 1993" search tested live, cold, on a phone, close to the date
- [ ] Confirm mobile data/wifi coverage across the full physical route (Tepper →
      Fence → Hunt → Gates, and separately WQED → Cathedral of Learning → 61C)
- [ ] Confirm laminated materials are actually weatherproof
- [ ] Confirm the CS-major co-founder pairs assigned to the local thread actually
      have working weekend Gates access
