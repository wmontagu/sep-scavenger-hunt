# SEP Scavenger Hunt — Full Answer Key (v2)

Everything below reflects what's locked as of now. Items marked **[TODO]** still need
real content before this is usable.

**Hint policy:** Zero hints on the indoor board (stages 1–3) — time-boxed to 45 min
regardless of solve status, no safety net needed since it doesn't gate anything
downstream. On the outdoor threads (4–6 and the WQED→Cathy chain), an "advisor"
(exec) is available throughout — framed in-universe as "even real founders bring in
advisors when they're stuck," not as hand-holding. This isn't optional: since the
whole event is gated behind both threads finishing, a stall anywhere in either chain
stalls everyone, so the outdoor threads need a safety net even if the indoor board
doesn't.

---

## Indoor board (Tepper) — first 45 min, parallel, zero hints

### Stage 1 — The Cap Table
**Mechanic:** 7 pledges cast as mock "founders," ranked by ownership %. Take the
founders whose ownership ends in 9, 7, 5, 3, 1 (descending) and read their first
letters in that order: **BRAVE**.

| Rank | Title | Name | Ownership | Used for |
|---|---|---|---|---|
| 1 | CEO | Benjamin | 29% | 9 → **B** |
| 2 | CTO | Koza | 18% | decoy |
| 3 | CMO | Rithul | 17% | 7 → **R** |
| 4 | COO | Angel | 15% | 5 → **A** |
| 5 | COO | Evan | 11% | 1 → **E** |
| 6 | Founding Engineer | Riya | 7% | 7 → **R** (same letter as Rithul) |
| 7 | Founding Engineer | Vedansh | 3% | 3 → **V** |

**Answer:** `BRAVE` — confirmed.

### Stage 2 — The Redacted Term Sheet
**Mechanic:** Mock term sheet, mostly blacked out, with a few numbers visible.
Numbers map to letters via A1Z26 (1=A, 2=B...) to spell a keyword.

**Plug-in template** — pick any keyword, then fill each row's number so A1Z26
produces that letter (number = letter's position in the alphabet):

| Field on the term sheet | Visible number | → Letter |
|---|---|---|
| [Field 1] | [NN] | [letter 1] |
| [Field 2] | [NN] | [letter 2] |
| [Field 3] | [NN] | [letter 3] |
| [Field 4] | [NN] | [letter 4] |
| [Field 5] | [NN] | [letter 5] |
| [Field 6, if needed] | [NN] | [letter 6] |

**Answer:** `[KEYWORD]` — placeholder, swap in whatever you land on.

### Stage 3 — The Pitch Deck
**Mechanic:** One-slide pitch deck with blanks. Each blank is answerable only from
something findable elsewhere in Tepper (room number, office number, printed course
code). First letters of the answers spell the keyword.

**Plug-in template** — pick any keyword, then write one blank per letter, each
resolved by a real Tepper-specific fact you plant/scout:

| Blank in the pitch | Resolved by (real Tepper fact) | → First letter |
|---|---|---|
| "Our [blank 1]..." | [e.g. a room number, plaque, door] | [letter 1] |
| "...[blank 2]..." | [fact] | [letter 2] |
| "...[blank 3]..." | [fact] | [letter 3] |
| "...[blank 4]..." | [fact] | [letter 4] |
| "...[blank 5]..." | [fact] | [letter 5] |

**Answer:** `[KEYWORD]` — placeholder, swap in whatever you land on.

---

## Outdoor board — opens ~9:45, two parallel threads

**Framing announcement:** "Co-founders must split — at least 3 people in each group." Pledges are pre-paired as
co-founder duos; the pairs assigned to the local thread are specifically CS majors,
since CS majors have weekend card access to Gates-Hillman — this solves the
building-access problem directly, no exec needs to be stationed at the door.

Presented as two startup strategies, not as locations:
- **"Stay close, dig deep"** — hyperlocal-moat play (local thread, CS-major pairs)
- **"Go wide before you go deep"** — expansion/blitzscaling play (global thread)

### Local thread — Stage 4: The Fence
**On-screen (the only thing the local thread sees first), titled "The OG guerrilla marketing stunt":**
> "Before feeds, before flyers, this campus had one billboard nobody owned. Claim it after
> midnight, paint your message, guard it until dawn — and for a day, everyone sees you.
> Then someone paints right over you. Thousands of coats deep, it's the original guerrilla
> marketing stunt. Go there. A founder was out late too, and left a note close by."
>
> "You'll find your answer there — look for something scrawled in black Sharpie. Where is
> it sending you?"

**Physical placement:** Black Sharpie on the picnic table next to the Fence, styled as a
founder's late-night scrawled note (the note itself is the cipher):
> "5:30 in white — SEP"

Bid-day callback that points to Hunt Library.

**Submission (app, stage `4_fence`):** `HUNT` (also accepts `Hunt Library`).

### Local thread — Stage 5: the pitch (in-app, no card)
Nobody has to go to Hunt. Solving the Fence stage shows this riddle in the app,
and it unlocks the Gates code entry:
> "OUR PITCH: We don't believe great work stays in one lane. We built the connective
> infrastructure that lets ideas cross — straight from the arts into computers, no
> detour required. Named for the professor who told us to take our childhood dreams
> seriously. Cross it to see what we're building."

Pointer only — resolves to the Randy Pausch Memorial Footbridge → Gates-Hillman,
without naming either.

### Local thread — Stage 6: Gates-Hillman spiral
**Placement:** Riddle shown in the app with the pitch riddle once HUNT is solved. Code written on a
pillar (chalk marker) at the step number the math produces, down the spiral.
Access: the assigned CS-major co-founder pair swipes the group in — no exec staffing
needed for entry.

**On-screen text:**
> "Once you've crossed: we started spiraling the moment the term sheet fell through. Cash in hand:
> $[Y]K. Burn rate: $[X]K/month. That's how many months we have left — and how many
> steps separate us from the truth."

**Plug-in template:** pick a clean monthly burn rate for $[X]K (e.g. 10, 20, 25 —
whatever divides evenly), then set $[Y]K = $[X]K × (real step count down the
spiral). Example shape only, not real numbers: if the real count is 14 and you pick
$[X]=20K burn, then $[Y]=280K cash, since 280 ÷ 20 = 14.

**Submission:** the code written on the pillar at that step (not the runway number).

**On success:** returns `local_share` = **M G N I** (positions 1, 3, 5, 7 of
MCGINNIS) + prompt to find the other thread's people.

---

### Global thread — Stage 7a: WQED
**Opening clue (shown in-app the moment this path is picked):**
> "Some companies win by owning their block. We're playing a different game — go
> wide before you go deep. Our expansion play started by studying how the old
> broadcast empires scaled a message to millions before the internet ever existed.
> Find where that history is written down."

Points to WQED (4802 Fifth Ave) without naming it — resolves via the "broadcast
empires... history written down" framing pointing to a historical marker.

**On arrival:** a real, permanent historical marker outside WQED reads:
> "Television station, located here, opened in April 1954, as first
> community-sponsored educational television station in America. In 1955, it was
> the first to telecast classes to elementary schools."

**[TODO]** Confirm exact on-site wording (the text above assumes "Television" and
"elementary" are spelled correctly — worth double-checking against the real marker,
since a spelling difference shifts the letter positions below).

**Mechanic:** the app shows an overlay (transparent image with 6 numbered circles)
positioned over specific letters on the marker. Read in numbered order, they spell
**LAUNCH**:

| # | Letter | Word | Position in word |
|---|---|---|---|
| 1 | L | "Television" | 3rd letter |
| 2 | A | "April" | 1st letter |
| 3 | U | "community-sponsored" | 5th letter |
| 4 | N | "community-sponsored" | 6th letter |
| 5 | C | "community-sponsored" | 1st letter |
| 6 | H | "here," | 1st letter |

**[TODO]** Build the actual overlay PNG once a straight-on photo of the real poster
is available, so the 6 circles are positioned accurately over the real letters.

**Submission:** `LAUNCH`

**On success:** reveals the Stage 7b riddle below.

### Global thread — Stage 7b: Cathedral of Learning
**Posted text (revealed after LAUNCH is submitted):**
> "Growth-stage companies don't stay small — they scale until they're the tallest
> thing in the market. Find the tallest building within a mile of CMU. That's where
> this round closes. Selfie, 3 of you, once you're there."

**Submission:** photo. **JEV prompt:**
> "Does this photo show 3 people standing in front of a tall Gothic stone building?
> yes/no"

**On success:** returns `global_share` = **C I N S** (positions 2, 4, 6, 8 of
MCGINNIS) + prompt to find the other thread's people.

---

## Convergence

### Stage 8 — McGinnis
Each thread's device shows only its own 4-character share, silently, to that device
alone. Reconstructing requires the two groups to call/text and interleave:
local's 1st, global's 1st, local's 2nd, global's 2nd...

M(local) C(global) G(local) I(global) N(local) N(global) I(local) S(global)
→ **MCGINNIS**

**Answer (case-insensitive, trimmed):** `MCGINNIS`

**On success:** flips the ransom note visible for everyone simultaneously, and the
app should confirm on-screen what MCGINNIS means (the McGinnis Venture Competition at CMU, not a building) so there's no dead
moment once it's typed in.

### Stage 9 — Ransom Note
Broadcasts to the whole group at once. No submission — just the pointer to 61C.

**Text:**
> "Word from our sources: they've secured $61M to close a Series C, locking down
> 1,993 more LOIs. Take a bus to the place of the meeting."

Resolves via searching "61C 1993" (confirmed working) — "take a bus" doubles as a
nod to 61C being named for its bus route.

---

## Finale — Stage 10: Rescue at 61C
Two "kidnapped" pledges are actually at 61C with the PMs, doing homework/startup
work. Will is physically there too. No JEV check — a generic vision classifier
trying to recognize two *specific* named pledges in a candid photo is unreliable,
and it's unnecessary anyway since Will can just confirm in person.

**Mechanic:** once the group actually arrives and finds Will/the pledges, an
exec-only "mark complete" action is triggered manually (not exposed anywhere in the
pledge-facing app, so it can't be guessed or triggered early). This flips the hunt
to complete for everyone.

---

## Timing estimate (as of the WQED-first reorder)

Rough, reasoned estimate — not a routed simulation. Given the shared/global state
design, the realistic time leans toward the fast end, since ~14 people splitting
into ad hoc subgroups means someone likely solves each stage quickly just from
parallel attempts.

| Segment | Fastest | Slowest |
|---|---|---|
| Indoor board (fixed window) | 45 min | 45 min |
| Local thread (4→5→6) | ~12 min | ~30 min |
| Global thread (WQED→Cathy) | ~22 min | ~45 min |
| Convergence (find each other, combine, submit) | ~2 min | ~8 min |
| Walk to 61C | ~20 min | ~35 min |
| Finale | ~2 min | ~5 min |
| **Total** | **~1h43m** | **~2h48m** |

As currently scoped, this likely finishes with well over 50-60% probability inside
2.5 hrs — if hitting that specific completion-rate target still matters, additional
friction (the Gates classroom-search idea floated earlier, or harder term
sheet/pitch deck content) is still on the table.

---

## Full open items

- [ ] Stage 2: pick a keyword + numbers (plug-in template above is ready)
- [ ] Stage 3: pick a keyword + Tepper facts (plug-in template above is ready)
- [x] Stage 6: real step count down the Gates spiral → back-solve $X/$Y (formula
      above is ready, just needs the real count)
- [ ] Stage 7a: confirm exact WQED marker wording before finalizing letter positions
- [ ] Stage 7a: build the overlay PNG once a straight-on poster photo exists
- [ ] Decide whether additional friction (Gates classroom leg, harder indoor
      puzzles) is needed to hit the 50-60%-completion-in-2.5-hrs target
- [ ] Exact vs. fuzzy (case-insensitive/trimmed) matching — recommended fuzzy for
      all text-submission stages
