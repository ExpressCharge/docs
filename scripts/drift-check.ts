#!/usr/bin/env tsx
/**
 * drift-check — for every article with frontmatter `code_refs_sha`,
 * compare the recorded blob SHAs against the current git index of the
 * monorepo (where the submodule pointers live).
 *
 * Articles whose refs have moved are listed. CI consumes the output to
 * open or update a tracking issue per article.
 *
 * Advisory; never fails CI.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { glob } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MONOREPO_ROOT = resolve(REPO_ROOT, "..");
const CONTENT_DIR = join(REPO_ROOT, "src/content/docs");

interface Frontmatter {
  title?: string;
  code_refs?: string[];
  code_refs_sha?: Record<string, string>;
}

async function findMdxFiles(): Promise<string[]> {
  const out: string[] = [];
  const iter = glob("**/*.mdx", { cwd: CONTENT_DIR });
  for await (const entry of iter) out.push(entry);
  return out;
}

function extractFrontmatter(body: string): Frontmatter | null {
  const match = body.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    return parseYaml(match[1]) as Frontmatter;
  } catch {
    return null;
  }
}

function currentBlobSha(ref: string): string | null {
  try {
    const out = execFileSync(
      "git",
      ["-C", MONOREPO_ROOT, "ls-files", "-s", "--", ref],
      { encoding: "utf-8" }
    );
    const line = out.split("\n").find((l) => l.trim().length > 0);
    if (!line) return null;
    const parts = line.split(/\s+/);
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const files = await findMdxFiles();
  const drifted: {
    file: string;
    title: string;
    refs: { ref: string; recorded: string; current: string | null }[];
  }[] = [];

  for (const rel of files) {
    const body = await readFile(join(CONTENT_DIR, rel), "utf-8");
    const fm = extractFrontmatter(body);
    if (!fm?.code_refs_sha) continue;

    const refs: typeof drifted[number]["refs"] = [];
    for (const [ref, recordedSha] of Object.entries(fm.code_refs_sha)) {
      if (!existsSync(resolve(MONOREPO_ROOT, ref))) {
        refs.push({ ref, recorded: recordedSha, current: null });
        continue;
      }
      const currentSha = currentBlobSha(ref);
      if (currentSha && currentSha !== recordedSha) {
        refs.push({ ref, recorded: recordedSha, current: currentSha });
      }
    }

    if (refs.length > 0) {
      drifted.push({ file: rel, title: fm.title ?? rel, refs });
    }
  }

  if (drifted.length === 0) {
    console.log(`No drift across ${files.length} files`);
    return;
  }

  console.log(`Drift detected in ${drifted.length} article(s):\n`);
  for (const d of drifted) {
    console.log(`- ${d.file} (${d.title})`);
    for (const r of d.refs) {
      console.log(
        `  - ${r.ref}: ${r.recorded.slice(0, 7)} -> ${r.current ? r.current.slice(0, 7) : "MISSING"}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
});
