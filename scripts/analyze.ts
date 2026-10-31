// Resume + JDs -> LLM extraction -> deterministic gap scoring -> analysis JSON.
// Run with: npm run analyze -- <resume.(txt|md|pdf|docx)> <jd1.txt> [jd2.txt ...] [--out out/analysis.json]
// Then build the Excel/PDF with: npm run report -- out/analysis.json
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MODEL_FALLBACK, MODEL_PRIMARY } from "../src/lib/ai/client";
import { analyzeGap } from "../src/lib/analysis/analyze";
import { docKind, extractText } from "../src/lib/analysis/extract-text";

async function readText(file: string): Promise<string> {
  return extractText(await readFile(file), docKind(file) ?? "text");
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : "out/analysis.json";
  const [resumeFile, ...jdFiles] = args;
  if (!resumeFile || jdFiles.length === 0) {
    throw new Error("Usage: npm run analyze -- <resume> <jd1> [jd2 ...] [--out file.json]");
  }

  const resume = await readText(resumeFile);
  const jds = await Promise.all(jdFiles.map(readText));

  console.log(`Analyzing with ${MODEL_PRIMARY} (fallback ${MODEL_FALLBACK})...`);
  const result = await analyzeGap(resume, jds);
  const analysis = {
    ...result,
    sources: { resume: path.basename(resumeFile), jobDescriptions: jdFiles.map((f) => path.basename(f)) },
  };

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(analysis, null, 2));
  console.log(`Match score ${(result.matchScore * 100).toFixed(0)}% across ${result.gaps.length} skills -> ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
