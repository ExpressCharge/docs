#!/usr/bin/env tsx
/**
 * check-screenshots — for every <Screenshot src="..." /> with a non-empty
 * src, verify the file exists under public/screenshots/.
 *
 * Missing src is fine — that renders the placeholder. We only flag a
 * src that's set but points to a nonexistent file.
 *
 * Advisory; never fails CI.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { glob } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CONTENT_DIR = join(REPO_ROOT, "src/content/docs");
const SCREENSHOTS_DIR = join(REPO_ROOT, "public/screenshots");

async function findMdxFiles(): Promise<string[]> {
  const out: string[] = [];
  const iter = glob("**/*.mdx", { cwd: CONTENT_DIR });
  for await (const entry of iter) out.push(entry);
  return out;
}

async function main() {
  const files = await findMdxFiles();
  const pattern = /<Screenshot\s+[^>]*src=\{?["']([^"'}]+)["']/g;
  let issues = 0;

  for (const rel of files) {
    const body = await readFile(join(CONTENT_DIR, rel), "utf-8");
    for (const match of body.matchAll(pattern)) {
      const src = match[1];
      const candidate = src.startsWith("/")
        ? join(REPO_ROOT, "public", src.replace(/^\//, ""))
        : join(SCREENSHOTS_DIR, src);
      if (!existsSync(candidate)) {
        console.warn(`[SCR] ${rel}: missing ${src}`);
        issues++;
      }
    }
  }

  console.log(
    issues === 0
      ? `Screenshot refs OK across ${files.length} files`
      : `${issues} missing screenshot file(s) (advisory)`
  );
}

main().catch((err) => {
  console.error(err);
});
