#!/usr/bin/env tsx
/**
 * check-links — placeholder. The heavy lifting is done by
 * starlight-links-validator at build time. This script exists so the
 * `npm run check:links` target works locally even before astro runs.
 *
 * Iterates MDX files, collects markdown links pointing to /-prefixed
 * docs paths, and flags any that don't resolve to an MDX file under
 * src/content/docs/.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { glob } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CONTENT_DIR = join(REPO_ROOT, "src/content/docs");

async function findMdxFiles(): Promise<string[]> {
  const out: string[] = [];
  const iter = glob("**/*.mdx", { cwd: CONTENT_DIR });
  for await (const entry of iter) out.push(entry);
  return out;
}

function resolveTarget(href: string): string {
  // Strip query and hash
  const clean = href.split("#")[0].split("?")[0].replace(/\/$/, "");
  // /user/web/sessions/start-a-charge -> src/content/docs/user/web/sessions/start-a-charge.mdx
  const candidate = join(CONTENT_DIR, clean.replace(/^\//, "") + ".mdx");
  // Also try the index form
  const indexCandidate = join(CONTENT_DIR, clean.replace(/^\//, ""), "index.mdx");
  if (existsSync(candidate)) return candidate;
  if (existsSync(indexCandidate)) return indexCandidate;
  return "";
}

async function main() {
  const files = await findMdxFiles();
  const linkPattern = /href=["'](\/[^"'#?]+)/g;
  const markdownLinkPattern = /\]\((\/[^)]+)\)/g;
  let issues = 0;

  for (const rel of files) {
    const body = await readFile(join(CONTENT_DIR, rel), "utf-8");
    const found = new Set<string>();
    for (const m of body.matchAll(linkPattern)) found.add(m[1]);
    for (const m of body.matchAll(markdownLinkPattern)) found.add(m[1]);

    for (const href of found) {
      if (href.startsWith("//") || href.startsWith("/http")) continue;
      if (!resolveTarget(href)) {
        console.warn(`[LINK] ${rel}: unresolved ${href}`);
        issues++;
      }
    }
  }

  console.log(
    issues === 0
      ? `Links OK across ${files.length} files`
      : `${issues} unresolved link(s) (advisory)`
  );
}

main().catch((err) => {
  console.error(err);
});
