import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBoard, publicState } from "@/lib/board";
import { freshEnv, REAL_CONTENT } from "./helpers";

const PUBLIC = path.join(__dirname, "..", "public");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

describe("public/ (everything here is downloadable by anyone)", () => {
  it("contains no source documents (PDF text layers / PPTX speaker notes leak answers)", () => {
    const bad = walk(PUBLIC).filter((f) => /\.(pdf|pptx?|docx?|xlsx?|key)$/i.test(f));
    expect(bad).toEqual([]);
  });

  it("every document referenced by clues.json exists", async () => {
    freshEnv();
    process.env.HUNT_CONTENT_DIR = REAL_CONTENT;
    const ps = publicState(await getBoard());
    const docs = ps.indoor.flatMap((s) => s.documents ?? []);
    expect(docs.map((d) => d.src)).toEqual([
      "/assets/docs/stage1-cap-table.png",
      "/assets/docs/stage2-term-sheet-1.png",
      "/assets/docs/stage2-term-sheet-2.png",
      "/assets/docs/stage3-pitch-deck.png",
    ]);
    for (const d of docs) expect(fs.existsSync(path.join(PUBLIC, d.src))).toBe(true);
  });
});
