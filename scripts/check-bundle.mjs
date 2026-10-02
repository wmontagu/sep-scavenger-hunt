/**
 * npm run check-bundle (after `npm run build`) - anti-cheat: make sure no answer,
 * share, image prompt, or not-yet-unlocked clue text is in anything the browser
 * can download (.next/static JS/CSS and prerendered HTML).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const answers = JSON.parse(fs.readFileSync(path.join(root, "content/answers.json"), "utf8"));
const clues = JSON.parse(fs.readFileSync(path.join(root, "content/clues.json"), "utf8"));

const needles = new Set();
const add = (v) => typeof v === "string" && v.trim().length >= 4 && needles.add(v.trim());
for (const [k, v] of Object.entries(answers)) {
  if (k.startsWith("_") || typeof v !== "object") continue;
  for (const [f, val] of Object.entries(v)) if (!f.startsWith("_")) add(String(val ?? ""));
}
// Unlock-gated clue text: check a distinctive slice of each.
for (const text of [clues.stages["7b_cathedral"].clue, clues.ransom_note, clues.stages["7a_wqed"].clue, clues.stages["8_convergence"].reveal]) {
  add(text.slice(0, 40));
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|css|html|json)$/.test(e.name)) yield p;
  }
}

function* walk2(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk2(p);
    else yield p;
  }
}

const targets = [...walk(path.join(root, ".next/static")), ...[...walk(path.join(root, ".next/server/pages"))].filter((p) => p.endsWith(".html"))];
if (!targets.length) {
  console.error("No build output found - run `npm run build` first.");
  process.exit(2);
}
let leaks = 0;
// Source documents must never be web-served: PDFs keep "redacted" text in their text
// layer and PPTX files carry speaker notes. Only flattened images belong in public/.
for (const file of walk2(path.join(root, "public"))) {
  if (/\.(pdf|pptx?|docx?|xlsx?|key|pages|numbers)$/i.test(file)) {
    console.error(`LEAK: source document is web-served: ${path.relative(root, file)} (move it to source-docs/)`);
    leaks++;
  }
}
for (const file of targets) {
  const body = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (body.includes(n)) {
      console.error(`LEAK: "${n}" found in ${path.relative(root, file)}`);
      leaks++;
    }
  }
}
console.log(`Scanned ${targets.length} files for ${needles.size} secrets: ${leaks ? `${leaks} LEAK(S)` : "clean"}`);
process.exit(leaks ? 1 : 0);
