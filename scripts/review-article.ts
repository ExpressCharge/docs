#!/usr/bin/env tsx
/**
 * review-article — dispatch the reviewer agent for one or more
 * articles. Posts a JSON verdict to stdout (CI consumes this and turns
 * it into a PR comment).
 *
 * Advisory only — does not modify the article and does not fail CI.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import Anthropic from "@anthropic-ai/sdk";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MONOREPO_ROOT = resolve(REPO_ROOT, "..");
const CONTENT_DIR = join(REPO_ROOT, "src/content/docs");
const BACKLOG_PATH = join(REPO_ROOT, "content/backlog.yaml");
const GLOSSARY_PATH = join(REPO_ROOT, "content/glossary.yaml");

interface BacklogEntry {
  slug: string;
  title: string;
  prompt: string;
  code_refs: string[];
}

const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    file: { type: "string" },
    out: { type: "string" },
  },
});

async function main() {
  if (!values.slug && !values.file) {
    console.error("Provide --slug or --file");
    process.exit(1);
  }

  const backlog = parseYaml(
    await readFile(BACKLOG_PATH, "utf-8")
  ) as BacklogEntry[];

  const slug = values.slug ?? deriveSlugFromFile(values.file!);
  const entry = backlog.find((e) => e.slug === slug);
  if (!entry) {
    console.error(`No backlog entry for slug ${slug}`);
    process.exit(1);
  }

  const articlePath = values.file
    ? resolve(values.file)
    : join(CONTENT_DIR, `${slug.replace(/\./g, "/")}.mdx`);

  if (!existsSync(articlePath)) {
    console.error(`Article not found: ${articlePath}`);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  const promptTemplate = await readFile(
    join(REPO_ROOT, "prompts", "reviewer.md"),
    "utf-8"
  );
  const articleBody = await readFile(articlePath, "utf-8");
  const glossaryText = await readFile(GLOSSARY_PATH, "utf-8");

  const codeRefContents: string[] = [];
  for (const ref of entry.code_refs) {
    const abs = resolve(MONOREPO_ROOT, ref);
    if (!existsSync(abs)) continue;
    try {
      const content = await readFile(abs, "utf-8");
      codeRefContents.push(`--- ${ref} ---\n${content.slice(0, 24_000)}`);
    } catch {
      // skip
    }
  }

  const userPrompt = `# Article under review (slug: ${entry.slug})

\`\`\`mdx
${articleBody}
\`\`\`

# Glossary

\`\`\`yaml
${glossaryText}
\`\`\`

# Code references the author was given

${codeRefContents.join("\n\n")}

# Your task

Review the article per the reviewer template. Return JSON only.`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    system: promptTemplate,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  if (values.out) {
    await writeFile(values.out, text, "utf-8");
  } else {
    console.log(text);
  }
}

function deriveSlugFromFile(file: string): string {
  const rel = resolve(file).replace(CONTENT_DIR + "/", "");
  return rel.replace(/\.mdx$/, "").replace(/\//g, ".");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
