# SEP Scavenger Hunt

A live, phone-based scavenger hunt for a group of pledges (built for ~14 people, one shared board, no accounts).
Pledges open a web page on their phones and solve stages together. Execs run the event from a hidden `/exec` page.
Free to reuse and change (MIT license).

**You do not need to be a programmer.** Everything you would change (answers, clues, images) is a plain text or image file.
If you have ever finished 15-110 or 15-112, you know more than enough. And Claude Code or Cursor can do the typing for you.

**Time needed:** about 30 minutes to see it running, a few hours to rewrite the content for your event, about 20 minutes to put it online.

---

## Pick your path

| Path | You need | Best for |
|---|---|---|
| **A. Browser only** | A free GitHub account and a free Railway account | People who do not want to install anything |
| **B. Cursor** (recommended) | Free [Cursor](https://cursor.com) + [Node.js](https://nodejs.org) | Editing content with an AI helper, testing on your laptop |
| **C. Claude Code** | Claude Code + Node.js | Same as B, but in a terminal |

### Path A: browser only (no installs)
1. Make a free account at [github.com](https://github.com). Open this repository's page and click **Fork** (top right). You now have your own copy.
2. In your copy, click the files in `content/` (`answers.json`, `clues.json`), click the pencil icon, edit the text, and click **Commit changes**. To swap an image, open `public/assets/docs/`, click **Add file > Upload files**, and upload a picture with the same filename.
3. Follow **Option A (Railway)** in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to put your copy online. Railway rebuilds the site every time you commit.

Downside: you cannot test locally, so use the dry run described in the deployment guide.

### Path B: Cursor (easiest way to test on your laptop)
1. Install **Node.js** (download the "LTS" version from [nodejs.org](https://nodejs.org), click through the installer) and **Cursor**.
2. Get the code. Easiest: on this repo's GitHub page click the green **Code** button > **Download ZIP**, then unzip it (right-click > Extract All).
   (If you have git: `git clone https://github.com/wmontagu/sep-scavenger-hunt.git`.)
3. In Cursor: **File > Open Folder** and choose the unzipped folder.
4. Open Cursor's chat (the chat icon, or Ctrl+L / Cmd+L) and paste this:

   > Read README.md, docs/HUNT-OVERVIEW.md, docs/CUSTOMIZING.md, docs/SETUP.md and docs/DEPLOYMENT.md. I am not a programmer. Set this project up for me: install dependencies, create .env.local with a passcode I choose, and run it locally so I can see it in my browser. Then interview me about my event and rewrite content/answers.json and content/clues.json. When I'm ready, walk me through putting it online with Railway, click by click.

5. Approve the commands it asks to run. When it says the site is running, open <http://localhost:3000> in your browser.

### Path C: Claude Code
1. Install Node.js (as above), then open a terminal (Windows: search "PowerShell"; Mac: search "Terminal") and install Claude Code by following [claude.com/claude-code](https://claude.com/claude-code).
2. In the terminal: `cd` into the unzipped or cloned folder (for example `cd Downloads/sep-scavenger-hunt-main`), then type `claude`.
3. Paste the same prompt as in Path B step 4.

---

## Do it by hand (optional, if you want to see what the AI is doing)

Open a terminal **inside the project folder** (in Cursor: Terminal > New Terminal) and run these one at a time:

```bash
npm install                       # downloads the libraries the project needs (takes a minute)
cp .env.example .env.local        # makes your private settings file. In Windows PowerShell this also works.
```
Now open `.env.local` in any text editor and change `EXEC_PASSCODE=change-me` to a passcode only execs know. Save it, then:
```bash
npm run dev                       # starts the site on your computer. Leave this window open.
```
- Pledge page: <http://localhost:3000>
- Exec page: <http://localhost:3000/exec> (not linked anywhere; asks for your passcode)
- Stop it with Ctrl+C. Progress is saved in `.data/hunt.json`; `npm run reset` wipes it.

If something fails: `npm: command not found` means Node.js isn't installed (or reopen the terminal after installing). `Port 3000 in use` means another copy is running; close it.

### Words you will see

| Word | Plain meaning |
|---|---|
| Terminal | A window where you type commands instead of clicking |
| Repo / repository | The project folder and its history, hosted on GitHub |
| Fork / clone | Make your own copy of the repo (online / on your computer) |
| Environment variable ("env var") | A named setting, like `EXEC_PASSCODE=hunt123`. Kept out of the code so secrets stay secret |
| Redis | A small online database. Here it only remembers which stages are solved, so a restart doesn't erase the game |
| Deploy / host | Put the site on a server so anyone can open it with a link |
| Railway, Vercel | Companies that host sites for you (Railway has a small monthly cost after a trial) |
| DNS / CNAME | The "address book" for a website name, and the one entry you add so `hunt.yourclub.org` points at your site |
| JSON | A text file format with `"name": "value"` pairs. Keep the quotes and commas exactly; the AI or `npm run check-content` will tell you if you break one |

---

## What the hunt is

Ten stages: three indoor puzzles on phones, then the group splits into two outdoor threads (one local, one farther away) that each earn half of a secret word, then the halves meet, solve it, and walk to a finale where an exec marks the hunt complete. Full stage-by-stage breakdown, a flow diagram and timing: **[docs/HUNT-OVERVIEW.md](docs/HUNT-OVERVIEW.md)**.

## Make it your own hunt

A checklist of everything you should probably change (names, locations, riddles, hints, org branding) is in **[docs/CUSTOMIZING.md](docs/CUSTOMIZING.md)**.

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

**Heads up:** the answers, names and locations in this repo are from the original CMU SEP event (Pittsburgh landmarks and pledge first names). Replace them for your event; anyone who clones the repo can read the answers. To keep yours out of git, paste your answers JSON into the `HUNT_ANSWERS_JSON` environment variable on your host.

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

- [docs/HUNT-OVERVIEW.md](docs/HUNT-OVERVIEW.md): what every stage is and how the event flows
- [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md): what to change for your own group
- [docs/SETUP.md](docs/SETUP.md): local run, checks, content, runbook
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Railway, Vercel, Cloudflare, custom domains
- [docs/ORIGINAL-PLAN.md](docs/ORIGINAL-PLAN.md): original design plan (some details, like Vercel KV and JEV, were later replaced by Redis and Claude; `CHANGES.md` has the real history)
- [CHANGES.md](CHANGES.md): build log of every iteration and why
- [sep-scavenger-hunt-answer-key.md](sep-scavenger-hunt-answer-key.md): the original event's full answer key
