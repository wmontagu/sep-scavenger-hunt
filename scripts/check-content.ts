/**
 * npm run check-content - validate content/answers.json + clues.json.
 * Prints TODOs (unfilled placeholders) and errors (inconsistent values), plus the
 * A1Z26 numbers for the term-sheet keyword. Exit code 1 on errors, or on TODOs
 * with --strict (use that right before the event).
 */
import { a1z26, checkContent, getAnswers } from "../lib/stage-config";

const strict = process.argv.includes("--strict");
const problems = checkContent();
for (const p of problems) console.log(`${p.level === "error" ? "ERROR" : "TODO "}  ${p.message}`);

const a = getAnswers();
const kw = a["2_term_sheet"].answer;
if (kw) console.log(`\nTerm sheet numbers for ${kw.toUpperCase()}: ${a1z26(kw).join(", ")}`);
const g = a["6_gates"];
if (g.burn_rate_k && g.step_count) {
  console.log(`Gates riddle: cash $${g.burn_rate_k * g.step_count}K / burn $${g.burn_rate_k}K per month = ${g.step_count} steps`);
}

const errors = problems.filter((p) => p.level === "error").length;
const todos = problems.length - errors;
console.log(`\n${errors} error(s), ${todos} todo(s)`);
if (errors || (strict && todos)) process.exit(1);
