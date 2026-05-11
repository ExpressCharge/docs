#!/usr/bin/env tsx
/**
 * check-frontmatter — zod-validate frontmatter on every MDX page.
 *
 * Advisory: prints findings, returns exit 0 even on issues, so CI
 * stays informational (per the docs site's posture: minimal resistance
 * to merging).
 */
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CONTENT_DIR = join(REPO_ROOT, "src/content/docs");

const FrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    template: z.enum(["doc", "splash"]).optional(),
    sidebar: z
      .object({
        label: z.string().optional(),
        order: z.number().optional(),
      })
      .optional(),
    persona: z
      .enum(["Driver", "Operator", "Selfhoster", "Developer", "All"])
      .optional(),
    surface: z.enum(["web", "ios", "selfhost", "n/a"]).optional(),
    tier: z.enum(["P0", "P1", "P2"]).optional(),
    code_refs: z.array(z.string()).optional(),
    code_refs_sha: z.record(z.string(), z.string()).optional(),
    last_authored: z.string().optional(),
    last_reviewed: z.string().optional(),
    prompt_template: z.string().optional(),
    hero: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

async function findMdxFiles(): Promise<string[]> {
  const out: string[] = [];
  const iter = glob("**/*.mdx", { cwd: CONTENT_DIR });
  for await (const entry of iter) out.push(entry);
  return out;
}

function extractFrontmatter(body: string): string | null {
  const match = body.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

async function main() {
  const files = await findMdxFiles();
  let issues = 0;

  for (const rel of files) {
    const path = join(CONTENT_DIR, rel);
    const body = await readFile(path, "utf-8");
    const fmRaw = extractFrontmatter(body);
    if (!fmRaw) {
      console.warn(`[FM] ${rel}: no frontmatter block`);
      issues++;
      continue;
    }

    let fm: unknown;
    try {
      fm = parseYaml(fmRaw);
    } catch (err) {
      console.warn(`[FM] ${rel}: invalid YAML — ${(err as Error).message}`);
      issues++;
      continue;
    }

    const result = FrontmatterSchema.safeParse(fm);
    if (!result.success) {
      console.warn(`[FM] ${rel}:`);
      for (const issue of result.error.issues) {
        console.warn(
          `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`
        );
      }
      issues++;
    }
  }

  console.log(
    issues === 0
      ? `Frontmatter OK across ${files.length} files`
      : `Frontmatter issues in ${issues}/${files.length} files (advisory)`
  );
}

main().catch((err) => {
  console.error(err);
  // Still exit 0 — this check is advisory.
});
