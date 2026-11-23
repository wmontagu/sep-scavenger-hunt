# SEP Scavenger Hunt

A live, browser-based scavenger hunt for a group of pledges (built for ~14 people, one shared board, no accounts).
Pledges open a web page on their phones and solve stages together. Execs run the event from a hidden `/exec` console.
Built with Next.js. Free to reuse and change (MIT license).

**You do not need to be an engineer to reuse this.** Everything you'd change (answers, clues, images) is a text or image file,
and Claude Code or Cursor can do the editing for you.

---

## Fastest start: let Claude Code or Cursor do it

1. Install [Node.js](https://nodejs.org) (LTS) and [Claude Code](https://claude.com/claude-code) or [Cursor](https://cursor.com).
2. Open a terminal and run:
   ```bash
   git clone https://github.com/wmontagu/sep-scavenger-hunt.git my-hunt
   cd my-hunt
   ```
   (No git? Use the green **Code > Download ZIP** button on GitHub, unzip it, and open that folder.)
3. Open the `my-hunt` folder in Cursor, or type `claude` in the terminal to start Claude Code, then paste:

   > Read README.md, docs/SETUP.md and docs/DEPLOYMENT.md. Set this project up for me: install dependencies, create .env.local with a passcode I choose, and run it locally so I can see it. Then help me rewrite content/answers.json and content/clues.json for my own event (I'll tell you the stages, answers and locations). When I'm ready, walk me through deploying it to Railway (or Vercel) and putting it on my own domain.

That's it. The sections below are the same steps by hand.

---

## Run it on your computer (5 minutes)

```bash
npm install
cp .env.example .env.local        # Windows PowerShell: Copy-Item .env.example .env.local
# open .env.local and change EXEC_PASSCODE to something only execs know
npm run dev
```

- Pledge board: <http://localhost:3000>
- Exec console: <http://localhost:3000/exec> (not linked anywhere; asks for your passcode)
- Progress is saved in `.data/hunt.json`. `npm run reset` wipes it.

## Make it your own hunt

You never need to touch code. Everything lives in `content/` and `public/`:

| File | What it is |
|---|---|
| `content/answers.json` | **Secret.** Every stage's correct answer. Server-only, never sent to phones before a solve. |
| `content/clues.json` | Everything pledges read: titles, prompts, riddles, finale text. |
| `public/assets/docs/*.png` | The puzzle images (cap table, term sheets, pitch deck). Replace with same filenames, or change the paths in `clues.json`. |
| `public/layout.png` | The WQED sign overlay image. |
| `source-docs/` | Original source files for the puzzle images (PDF, PPTX). Reference only, not served. |
| `sep-scavenger-hunt-answer-key.md` | The organizer's answer key for the original event. |

After editing, run `npm run check-content` (lists anything unfilled) and `npm run dry-run` (plays the whole hunt automatically).
Details and the stage-by-stage mechanics are in [docs/SETUP.md](docs/SETUP.md) and [docs/ORIGINAL-PLAN.md](docs/ORIGINAL-PLAN.md).

**Heads up:** the answers, names and locations in this repo are from the original CMU SEP event (Pittsburgh landmarks and real
pledge first names). If you reuse the hunt, replace them, or anyone who clones the repo can read your answers. To keep your real
answers out of git entirely, paste your answers JSON into the `HUNT_ANSWERS_JSON` environment variable on your host.

## Put it on the internet

The app needs a **Redis** database so progress survives restarts. Pick one host:

| Host | Difficulty | Notes |
|---|---|---|
| **Railway** (recommended) | Easiest | One click for the app, one click to add Redis. |
| **Vercel** | Easy | Works, but you must bring a free Redis URL (Upstash). |
| **Cloudflare** | Use for your domain only | Great for DNS and the custom domain; the app itself runs on Railway/Vercel. |

Step-by-step for each, plus how to use a subdomain of an existing site like `hunt.yourdomain.org`, is in
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Settings

All settings are environment variables, listed with comments in [`.env.example`](.env.example).
Only `EXEC_PASSCODE` is required. `REDIS_URL` is required for a real event. Photo checking
(`IMAGE_VERIFIER`, `ANTHROPIC_API_KEY`) is optional: the default `manual` mode just shows photos to an exec for one-tap approval, for free.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Run locally |
| `npm run check-content` | List unfilled answers/clues |
| `npm run dry-run` | Play every stage automatically to test |
| `npm test` | Run the automated tests |
| `npm run verify` | Typecheck + tests + build + leak scan (run before the event) |
| `npm run reset` | Wipe progress |

## Event day

Short runbook (when to open the outdoor board, what `/exec` does, force-solve, finale) is at the bottom of [docs/SETUP.md](docs/SETUP.md).

## Docs index

- [docs/SETUP.md](docs/SETUP.md): local run, checks, content, runbook
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Railway, Vercel, Cloudflare, custom domains
- [docs/ORIGINAL-PLAN.md](docs/ORIGINAL-PLAN.md): original design plan (some details, like Vercel KV and JEV, were later replaced by Redis and Claude; `CHANGES.md` has the real history)
- [CHANGES.md](CHANGES.md): build log of every iteration and why
- [sep-scavenger-hunt-answer-key.md](sep-scavenger-hunt-answer-key.md): the original event's full answer key
