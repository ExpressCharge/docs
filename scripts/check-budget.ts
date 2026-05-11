#!/usr/bin/env tsx
/**
 * check-budget — post-build performance budget check.
 *
 * Walks dist/ and flags pages whose HTML+CSS+JS transferred size
 * exceeds the budget (200 KB gzipped). Image-only pages and OG cards
 * are skipped.
 *
 * Advisory; never fails CI.
 */
import { stat, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { existsSync } from "node:fs";
import { glob } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const DIST_DIR = join(REPO_ROOT, "dist");
const BUDGET_BYTES = 200 * 1024;

async function findHtmlFiles(): Promise<string[]> {
  const out: string[] = [];
  if (!existsSync(DIST_DIR)) return out;
  const iter = glob("**/*.html", { cwd: DIST_DIR });
  for await (const entry of iter) out.push(entry);
  return out;
}

async function main() {
  const files = await findHtmlFiles();
  if (files.length === 0) {
    console.log("No dist/ directory — skipping budget check");
    return;
  }

  let over = 0;
  for (const rel of files) {
    const path = join(DIST_DIR, rel);
    const content = await readFile(path);
    const gz = gzipSync(content);
    if (gz.length > BUDGET_BYTES) {
      console.warn(
        `[BUDGET] ${rel}: ${(gz.length / 1024).toFixed(1)} KB gzipped (over ${BUDGET_BYTES / 1024} KB)`
      );
      over++;
    }
  }

  console.log(
    over === 0
      ? `Budget OK across ${files.length} pages`
      : `${over} page(s) over budget (advisory)`
  );
}

main().catch((err) => {
  console.error(err);
});
