#!/usr/bin/env tsx
/**
 * author-article — dispatch the technical-writer agent for one or
 * more articles from content/backlog.yaml.
 *
 * Usage:
 *   tsx scripts/author-article.ts --slug user.web.sessions.start-a-charge
 *   tsx scripts/author-article.ts --tier P0
 *   tsx scripts/author-article.ts --tier P0 --concurrency 4
 *   tsx scripts/author-article.ts --slug ... --dry-run
 *
 * Requires ANTHROPIC_API_KEY in env (set as repo secret in CI;
 * developers set in their shell for local runs).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import Anthropic from "@anthropic-ai/sdk";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MONOREPO_ROOT = resolve(REPO_ROOT, "..");
const CONTENT_DIR = join(REPO_ROOT, "src/content/docs");
const BACKLOG_PATH = join(REPO_ROOT, "content/backlog.yaml");
const GLOSSARY_PATH = join(REPO_ROOT, "content/glossary.yaml");

interface BacklogEntry {
  slug: string;
  title: string;
  tier: "P0" | "P1" | "P2";
  section: string;
  surface: string;
  persona: string;
  prompt: string;
  code_refs: string[];
  screenshots: string[];
  status: string;
  last_authored: string | null;
  code_refs_sha?: Record<string, string>;
}

const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    tier: { type: "string" },
    concurrency: { type: "string", default: "1" },
    "dry-run": { type: "boolean", default: false },
  },
});

const dryRun = values["dry-run"] ?? false;
const concurrency = Math.max(1, parseInt(values.concurrency ?? "1", 10));

async function main() {
  const backlog = parseYaml(await readFile(BACKLOG_PATH, "utf-8")) as BacklogEntry[];

  let targets: BacklogEntry[] = [];
  if (values.slug) {
    const entry = backlog.find((e) => e.slug === values.slug);
    if (!entry) {
      console.error(`No backlog entry with slug ${values.slug}`);
      process.exit(1);
    }
    targets = [entry];
  } else if (values.tier) {
    targets = backlog.filter((e) => e.tier === values.tier);
  } else {
    console.error("Provide --slug or --tier");
    process.exit(1);
  }

  console.log(`Authoring ${targets.length} article(s)${dryRun ? " (DRY RUN)" : ""}`);

  if (dryRun) {
    for (const entry of targets) {
      console.log(`  - ${entry.slug} -> ${slugToPath(entry.slug)}`);
    }
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  // maxRetries handles 408/429/5xx + overloaded_error with exponential
  // backoff. Default is 2; bump it because tier P0 dispatches ~95
  // requests and a transient overload is common.
  const client = new Anthropic({ apiKey, maxRetries: 6 });

  const glossaryText = await readFile(GLOSSARY_PATH, "utf-8");

  // Concurrency loop with a simple semaphore. Default = 1 (sequential)
  // to avoid surprise token burns; CI can opt into 4 explicitly.
  const chunks: BacklogEntry[][] = [];
  for (let i = 0; i < targets.length; i += concurrency) {
    chunks.push(targets.slice(i, i + concurrency));
  }

  let succeeded = 0;
  let failed = 0;
  const failures: { slug: string; error: string }[] = [];
  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((entry) => authorOne(client, entry, glossaryText, backlog))
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        succeeded++;
      } else {
        failed++;
        const slug = chunk[i].slug;
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        failures.push({ slug, error: msg });
        console.error(`[${slug}] FAILED: ${msg}`);
      }
    }
  }

  await writeFile(BACKLOG_PATH, stringifyYaml(backlog, { lineWidth: 0 }), "utf-8");

  console.log(
    `Done. ${succeeded} succeeded, ${failed} failed (out of ${targets.length}).`
  );
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f.slug}: ${f.error}`);
    // Exit 0: failures are advisory. PR opens with whatever succeeded.
  }
}

async function authorOne(
  client: Anthropic,
  entry: BacklogEntry,
  glossaryText: string,
  backlog: BacklogEntry[]
) {
  console.log(`[${entry.slug}] authoring...`);

  const promptTemplate = await readFile(
    join(REPO_ROOT, "prompts", `${entry.prompt}.md`),
    "utf-8"
  );

  // Resolve code_refs — relative paths resolve against the monorepo root
  // (the docs/ submodule's siblings are web/, ios/, steve/, email-worker/).
  const codeRefContents: string[] = [];
  const codeRefSha: Record<string, string> = {};
  for (const ref of entry.code_refs) {
    const abs = resolve(MONOREPO_ROOT, ref);
    if (!existsSync(abs)) {
      console.warn(`[${entry.slug}] code_ref missing: ${ref}`);
      continue;
    }
    try {
      const content = await readFile(abs, "utf-8");
      const snippet = content.slice(0, 24_000);
      codeRefContents.push(`--- ${ref} ---\n${snippet}`);
      const sha = readBlobSha(ref);
      if (sha) codeRefSha[ref] = sha;
    } catch (err) {
      console.warn(`[${entry.slug}] failed to read ${ref}:`, err);
    }
  }

  const userPrompt = `# Backlog entry

\`\`\`yaml
slug: ${entry.slug}
title: ${entry.title}
tier: ${entry.tier}
section: ${entry.section}
surface: ${entry.surface}
persona: ${entry.persona}
code_refs:
${entry.code_refs.map((r) => `  - ${r}`).join("\n")}
\`\`\`

# Glossary (canonical terms)

\`\`\`yaml
${glossaryText}
\`\`\`

# Code references (verbatim source files)

${codeRefContents.join("\n\n")}

# Your task

Write the MDX file body following the prompt template above. Do not
include any code fences around the output. Start with the frontmatter
opening \`---\` line.`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    system: promptTemplate,
    messages: [{ role: "user", content: userPrompt }],
  });

  const body = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const outPath = join(CONTENT_DIR, slugToPath(entry.slug));
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, body, "utf-8");

  const idx = backlog.findIndex((e) => e.slug === entry.slug);
  if (idx >= 0) {
    backlog[idx].status = "review";
    backlog[idx].last_authored = new Date().toISOString().slice(0, 10);
    backlog[idx].code_refs_sha = codeRefSha;
  }

  console.log(`[${entry.slug}] -> ${outPath}`);
}

function slugToPath(slug: string): string {
  // user.web.sessions.start-a-charge -> user/web/sessions/start-a-charge.mdx
  return `${slug.replace(/\./g, "/")}.mdx`;
}

function readBlobSha(ref: string): string | null {
  // Use execFileSync with argv array — no shell interpolation.
  try {
    const out = execFileSync(
      "git",
      ["-C", MONOREPO_ROOT, "ls-files", "-s", "--", ref],
      { encoding: "utf-8" }
    );
    // Output format: "<mode> <sha> <stage>\t<path>"
    const line = out.split("\n").find((l) => l.trim().length > 0);
    if (!line) return null;
    const parts = line.split(/\s+/);
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
