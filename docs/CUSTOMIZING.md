# Customizing the hunt for your group

Everything specific to the original CMU SEP event lives in text and image files, not code. Work top to bottom.
First read [HUNT-OVERVIEW.md](HUNT-OVERVIEW.md) so you know what each stage is.

> With Claude Code or Cursor, paste: "Read docs/CUSTOMIZING.md and docs/HUNT-OVERVIEW.md. Interview me about my event (group size, names, city, locations, theme), then make every change in the checklist."

After any change run `npm run check-content`. It catches mismatches (for example the Gates math, or the two shares not matching the final word).
Run `npm run dry-run` to play the whole hunt automatically.

## Checklist

### 1. The people (names)
Real first names of pledges appear in:
- **Stage 1 cap table image** (`public/assets/docs/stage1-cap-table.png`, made from `source-docs/Scavenger Hunt October 3rd.pdf` page 2). Replace the names, titles and percentages.
- `content/answers.json`: the `_note` text under `1_cap_table`.
- `sep-scavenger-hunt-answer-key.md`: the table in Stage 1.

Rule if you keep the cap-table mechanic: the answer is the initials of the founders whose % ends in 9, 7, 5, 3, 1, in descending order. Add one decoy. Change `1_cap_table.answer` to match.

### 2. The org, theme and tone
- `content/clues.json` > `board`: `title`, `tagline` ("Fourteen founders" should match your head count), the split announcement, and the two thread names.
- `clues.json` > `complete_message` ("Welcome to SEP") and `advisor_blurb`.
- Page title in `pages/index.tsx` (`<title>SEP Pledge Hunt</title>`), the favicon `public/favicon.svg`, and colors in `styles/globals.css`.
- `pages/exec.tsx`: the button label "Mark hunt complete (61C)" mentions the original finale spot. Edit it to yours.
- `package.json` `name`.

### 3. Indoor puzzles (stages 1 to 3)
Hardest to retarget because they are images. The pipeline: edit `source-docs/Scavenger Hunt October 3rd.pdf` (or rebuild it in any tool), then run `npm run build-docs` (needs `pip install pymupdf pillow`) to flatten the pages into `public/assets/docs/*.png`. Flattening matters: the PDF's black boxes sit over live text, so never serve the PDF itself. If you skip the pipeline, just drop in your own PNGs with the same names (or point `documents[].src` in `clues.json` at new names).

| Stage | Change |
|---|---|
| 2 Term sheet | Pick a keyword. Each visible number is the letter's alphabet position. `npm run check-content` prints the numbers for your keyword. Set `2_term_sheet.answer`. |
| 3 Pitch deck | Pick a keyword (or code). Each blank must be answerable from something physically in your building. **You must scout and plant these.** The originals (a badge, a wall, a menu price, a course number) are specific to the CMU Tepper building, so they will not work elsewhere. Set `3_pitch_deck.answer`. |

### 4. Outdoor locations and hints (stages 4 to 8)
The riddles in `content/clues.json` point at real Pittsburgh landmarks. Rewrite each to point at places near **your** event, and update the answers.

| Stage | Original | What to change |
|---|---|---|
| 4 Fence | CMU's painted Fence, answer `HUNT` (Hunt Library) | Rewrite `4_fence.clue` and `.prompt` for your landmark. Plant a handwritten note near it that names the next place. Set `4_fence.answer` (and `also_accept` for alternate spellings). |
| 5/6 Pitch + Spiral | A footbridge into Gates-Hillman, then a spiral staircase | Rewrite `6_gates.clue` (the "pitch" riddle) and `spiral_clue`. Count the real steps, pick a burn rate that divides evenly, and set `step_count`, `burn_rate_k`, `cash_on_hand_k` (= burn x steps), and the `code` you chalk. The `spiral_clue` text must contain the same dollar figures or check-content errors. If your route has no stairs, any countable thing works. |
| 7a Marker | A historical marker outside a TV station, answer `LAUNCH` | Choose a sign or marker with text. Choose six letters that spell your answer, photograph the sign straight on, and redraw `public/layout.png` with six circles on those letters (same filename). Set `7a_wqed.answer`. |
| 7b Photo | The tallest building nearby, "3 of you" selfie | Rewrite `7b_cathedral.clue`. Change `image_prompt` in `answers.json` to describe your building (it is what the Claude check asks). Or use `IMAGE_VERIFIER=manual` and let execs approve. |
| 8 Convergence | Word `MCGINNIS`, with a short reveal explaining it | Pick an 8-letter word. Set `8_convergence.answer`, and `shares`: `local` is letters 1, 3, 5, 7 and `global` is letters 2, 4, 6, 8. Update `8_convergence.reveal` in `clues.json`. check-content verifies the interleave. |
| 9 Ransom note | Mentions "$61M", "Series C", "1,993 LOIs", a bus | Rewrite `ransom_note` to point at your finale spot. (The original puzzle: searching "61C 1993" finds the 61C bus route.) |
| 10 Finale | The 61C bus stop | Choose a spot. Nothing in code depends on it. |

Thread names and the "stay close" and "go wide" framing are in `clues.json` > `board.threads`. Local thread players should be able to enter the building you choose (the original used a pair with weekend card access).

### 5. Hints
- **Advisor button:** `advisor_blurb` in `clues.json` is the text. Execs see pings on `/exec`. If you want actual hints, send them by hand; there is no automatic hint ladder.
- **Indoor hints:** none by default. If you want some, add a line to each stage's `prompt` in `clues.json`.
- **Making it easier or harder:** shorten riddles to be more direct, add `also_accept` spellings, or lengthen the threads. To skip a broken stage on the day, use **Force solve** on `/exec`.

### 6. Secrets and spoilers
- Anyone who reads the repo can read `answers.json`. Once you have your own answers, either keep a private fork or put the whole answers JSON in the `HUNT_ANSWERS_JSON` environment variable on your host and commit placeholder values.
- Do not put the original PDF or PPTX in `public/`. The PPTX contains speaker notes.
- Delete or rewrite `sep-scavenger-hunt-answer-key.md`, `CHANGES.md` and `docs/ORIGINAL-PLAN.md` if they would give away your answers or you do not want the old event's history.

### 7. Before the event
```bash
npm run check-content -- --strict     # no TODOs left
npm run verify                        # typecheck, tests, build, leak scan
npm run dry-run -- --base https://your-site   # full playthrough against the deployed site
```
Then press **Reset** on `/exec`. The event-day runbook is in [SETUP.md](SETUP.md).
