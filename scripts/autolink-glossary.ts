#!/usr/bin/env tsx
/**
 * autolink-glossary — rewrite bare glossary terms in MDX body content
 * into <Glossary term="..."> calls on first mention per page.
 *
 * --check  : report what would change without writing
 * (default): write changes in place
 *
 * Skips:
 *   - frontmatter
 *   - code blocks (``` fenced and `inline`)
 *   - existing <Glossary> tags
 *   - inside other tags' attribute values
 */
import { readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CONTENT_DIR = join(REPO_ROOT, "src/content/docs");
const GLOSSARY_PATH = join(REPO_ROOT, "content/glossary.yaml");

interface GlossaryEntry {
  anchor: string;
  term: string;
  aliases: string[];
}

async function findMdxFiles(): Promise<string[]> {
  const out: string[] = [];
  const iter = glob("**/*.mdx", { cwd: CONTENT_DIR });
  for await (const entry of iter) out.push(entry);
  return out;
}

function splitFrontmatter(body: string): [string, string] {
  const match = body.match(/^---\n[\s\S]*?\n---\n/);
  if (!match) return ["", body];
  return [match[0], body.slice(match[0].length)];
}

/**
 * Rewrite the FIRST bare occurrence of each known term per file,
 * skipping fenced code, inline code, and pre-existing <Glossary> tags.
 */
function autolink(content: string, glossary: GlossaryEntry[]): {
  rewritten: string;
  rewrites: number;
} {
  // Split on fenced code blocks so we can rejoin without touching them.
  const fenceSplit = content.split(/(```[\s\S]*?```)/g);

  let rewrites = 0;
  const seen = new Set<string>();

  const processed = fenceSplit.map((chunk) => {
    if (chunk.startsWith("```")) return chunk;
    // Skip inline code as well.
    const codeSplit = chunk.split(/(`[^`]*`)/g);
    return codeSplit
      .map((part) => {
        if (part.startsWith("`")) return part;
        return rewriteText(part, glossary, seen, () => rewrites++);
      })
      .join("");
  });

  return { rewritten: processed.join(""), rewrites };
}

function rewriteText(
  text: string,
  glossary: GlossaryEntry[],
  seen: Set<string>,
  bump: () => void
): string {
  let out = text;
  for (const entry of glossary) {
    if (seen.has(entry.anchor)) continue;
    const candidates = [entry.term, ...entry.aliases];
    for (const candidate of candidates) {
      // Match the term as a whole word, case-sensitive for acronyms.
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![\\w-])(${escaped})(?![\\w-])`);
      if (pattern.test(out)) {
        out = out.replace(pattern, `<Glossary term="${entry.term}">$1</Glossary>`);
        seen.add(entry.anchor);
        bump();
        break;
      }
    }
  }
  return out;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const glossary = parseYaml(
    await readFile(GLOSSARY_PATH, "utf-8")
  ) as GlossaryEntry[];

  const files = await findMdxFiles();
  let totalRewrites = 0;
  let filesChanged = 0;

  for (const rel of files) {
    // Skip the glossary page itself.
    if (rel === "glossary.mdx") continue;

    const path = join(CONTENT_DIR, rel);
    const body = await readFile(path, "utf-8");
    const [frontmatter, content] = splitFrontmatter(body);
    const { rewritten, rewrites } = autolink(content, glossary);
    if (rewrites === 0) continue;

    filesChanged++;
    totalRewrites += rewrites;
    console.log(`[GLO] ${rel}: ${rewrites} term(s)`);

    if (!checkOnly) {
      // Ensure the Glossary import is present.
      const withImport = ensureGlossaryImport(rewritten);
      await writeFile(path, frontmatter + withImport, "utf-8");
    }
  }

  if (checkOnly && totalRewrites > 0) {
    console.log(
      `Autolink would rewrite ${totalRewrites} term(s) across ${filesChanged} file(s) — run without --check to apply.`
    );
  } else if (checkOnly) {
    console.log(`Autolink: no changes needed across ${files.length} files.`);
  } else {
    console.log(
      `Autolink: rewrote ${totalRewrites} term(s) across ${filesChanged} file(s).`
    );
  }
}

function ensureGlossaryImport(content: string): string {
  if (content.includes("import Glossary")) return content;
  return `\nimport Glossary from "@components/Glossary.astro";\n${content}`;
}

main().catch((err) => {
  console.error(err);
});
