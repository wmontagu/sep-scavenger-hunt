# What the hunt is: the full range

A ~2 to 3 hour, phone-based scavenger hunt for a group of about 14 people. It is themed as a startup: the group is one company,
every solve counts for everyone (no teams, no accounts), and the final goal is to "rescue" the kidnapped pledges.
This page describes the **original CMU SEP event** (Pittsburgh, Oct 3). Every location and answer below can be replaced; see
[CUSTOMIZING.md](CUSTOMIZING.md).

## The shape of the event

```
 INDOOR BOARD (45 min, three puzzles in parallel, no hints)
   Stage 1 Cap Table      Stage 2 Term Sheet      Stage 3 Pitch Deck
                      \          |          /
                     all three solved (or timer) = outdoor board unlocks
                                 |
        "Co-founders must split": group divides into two threads
              /                                  \
   LOCAL thread (walk nearby)            GLOBAL thread (walk farther)
   4 Fence -> 5 Pitch riddle -> 6 Gates   7a WQED marker -> 7b Cathedral selfie
   gives half of a secret code            gives the other half of the code
              \                                  /
        8 CONVERGENCE: the two halves find each other, interleave
           the letters, and type the full word
                                 |
        9 RANSOM NOTE (shown to everyone): where to go next
                                 |
        10 FINALE: group walks to the rescue spot; an exec presses
           "Mark hunt complete" and every screen shows the win message
```

## Stage by stage

| # | Stage | Where | What players do | Answer in the original |
|---|---|---|---|---|
| 1 | The Cap Table | Indoors, on phone | A table of mock founders ranked by ownership %. Take the ones whose % ends in 9, 7, 5, 3, 1 in that order and read their first initials. One founder is a decoy. | `BRAVE` |
| 2 | The Redacted Term Sheet | Indoors, on phone | A term sheet that is mostly blacked out. The surviving numbers map to letters (1=A, 2=B, ...). | `FUNDED` |
| 3 | The Pitch Deck | Indoors, phone + the building | A one-slide pitch with blanks. Each blank is answered by a real fact found around the building (a plaque, a price, a room number). | `SM81` |
| 4 | The Fence | Outdoors (local) | An on-screen riddle about an iconic campus landmark. A handwritten note planted nearby ("5:30 in white - SEP") points to the next place. | `HUNT` |
| 5 | The pitch riddle | In the app only | Appears automatically after stage 4. A riddle that names a landmark (a footbridge) without saying it. | no answer, leads to stage 6 |
| 6 | The Spiral | Outdoors (local, needs building access) | A riddle gives cash and burn rate. Cash / burn = number of steps down a staircase. A code is chalked on the pillar at that step. | `X7G0` |
| 7a | The marker | Outdoors (global) | A riddle points to a historical marker. The app shows a transparent overlay with six circled letters to hold against the sign. | `LAUNCH` |
| 7b | The tallest building | Outdoors (global) | Riddle points to the tallest nearby building. Players upload a selfie of 3 people there. A Claude vision check (or an exec, one tap) approves it. | photo |
| 8 | Convergence | Anywhere | Finishing each thread gives a private 4-letter piece to that thread's phones only. The two groups must contact each other and interleave pieces (local 1st, global 1st, local 2nd...) to spell the word. | `MCGINNIS` |
| 9 | Ransom note | In the app | Appears for everyone: a cryptic message that points to the final location. | n/a |
| 10 | Finale | Final location | The group finds the "kidnapped" pledges. An exec presses **Mark hunt complete** on `/exec`. | n/a |

Design choices worth keeping when you adapt it:
- **Indoor stages have no hints.** They do not gate anything downstream.
- **Outdoor stages have an "advisor" button** (pings the execs). Since everything is gated, one stalled thread stalls the event.
- **Anti-cheat:** stage text only reaches phones once the stage is reached, answers never ship to the browser, and guesses are rate limited.
- **The finale is an exec action,** not a puzzle, so it cannot be triggered early.

## What execs do (the `/exec` console)

Open `/exec` on a phone and enter the passcode. It shows live progress, advisor pings, photos waiting for approval (approve or
reject in one tap, with a log and revoke), **Open outdoor board**, **Force solve** (if a physical clue breaks), **Reset**, and
**Mark hunt complete**. See the runbook in [SETUP.md](SETUP.md).

## What has to exist in the real world

Only these physical items are needed. Everything else is on the phone.
1. A handwritten note near the stage-4 landmark (the original used a marker note on a picnic table).
2. A code chalked on a pillar at the right step count (stage 6).
3. Optionally, people hidden at the finale spot.

## Rough timing

Indoor 45 min, local thread 12 to 30 min, global thread 22 to 45 min, convergence 2 to 8 min, walk to finale 20 to 35 min.
Total roughly 1h45m to 2h45m. Shorten it by dropping a thread or the walk; lengthen it with harder indoor puzzles.
The original planning notes are in [../sep-scavenger-hunt-answer-key.md](../sep-scavenger-hunt-answer-key.md).
