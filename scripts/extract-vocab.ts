#!/usr/bin/env tsx
/**
 * extract-vocab — walk the sibling submodules (web, ios, email-worker,
 * steve) and the docs site itself for product-specific vocabulary, then
 * write the result to .cspell.json's `words` array.
 *
 * Sources scanned:
 *   - README.md and CLAUDE.md headings (markdown ATX headers)
 *   - PascalCase identifiers in *.ts, *.tsx, *.swift, *.java
 *   - .env.example keys
 *   - URL slug segments under web/routes/
 *
 * Output: .cspell.json {"words": [...]} sorted unique.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { glob } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MONOREPO_ROOT = resolve(REPO_ROOT, "..");
const SIBLINGS = ["web", "ios", "email-worker", "steve"];

const CSPELL_PATH = join(REPO_ROOT, ".cspell.json");

const PASCAL = /\b[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+\b/g;
const ENV_KEY = /^([A-Z][A-Z0-9_]+)=/gm;
const ATX_HEADING = /^#{1,6}\s+(.+)$/gm;

async function findFiles(root: string, pattern: string): Promise<string[]> {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const iter = glob(pattern, { cwd: root });
  for await (const entry of iter) out.push(join(root, entry));
  return out;
}

function harvestPascal(content: string, into: Set<string>) {
  for (const m of content.matchAll(PASCAL)) into.add(m[0]);
}

function harvestEnvKeys(content: string, into: Set<string>) {
  for (const m of content.matchAll(ENV_KEY)) into.add(m[1]);
}

function harvestHeadingWords(content: string, into: Set<string>) {
  for (const m of content.matchAll(ATX_HEADING)) {
    for (const w of m[1].split(/\s+/)) {
      const clean = w.replace(/[^A-Za-z0-9-]/g, "");
      if (clean.length >= 3 && /^[A-Z]/.test(clean)) into.add(clean);
    }
  }
}

async function main() {
  const words = new Set<string>();

  // Seed terms — domain language we always want recognized
  for (const seed of [
    "OCPP",
    "SteVe",
    "Lago",
    "Polaris",
    "Polaris Express",
    "expreScan",
    "ExpressCharge",
    "BorderBeam",
    "BetterAuth",
    "Pagefind",
    "Cloudflare",
    "Drizzle",
    "Wrangler",
    "MariaDB",
    "kWh",
    "OAuth",
    "PKCE",
    "DESFire",
    "Mifare",
    "MIFARE",
    "NTAG",
    "idTag",
    "MeterValues",
    "ChargeBox",
    "expchg",
    "APNs",
    "SwiftUI",
    "OKLch",
    "Tailwind",
    "Starlight",
    "MDX",
    "Iconify",
    "Lucide",
    "shadcn",
    "Radix",
    "Croner",
    "deno",
    "Astro",
    "Vite",
    "frontmatter",
    "subagent",
    "Fresh",
    "Preact",
    "Mermaid",
    "wrangler",
    "selfhost",
    "selfhosters",
    "submodule",
    "submodules",
    "monorepo",
    "Anthropic",
    "llms",
    "OpenGraph",
  ]) {
    words.add(seed);
  }

  for (const sibling of SIBLINGS) {
    const root = join(MONOREPO_ROOT, sibling);
    if (!existsSync(root)) continue;

    // READMEs and CLAUDE.md
    for (const path of await findFiles(
      root,
      "**/{README,CLAUDE}.md"
    )) {
      try {
        const content = await readFile(path, "utf-8");
        harvestHeadingWords(content, words);
        harvestPascal(content, words);
      } catch {
        // skip
      }
    }

    // Env example
    for (const path of await findFiles(root, "**/.env.example")) {
      try {
        const content = await readFile(path, "utf-8");
        harvestEnvKeys(content, words);
      } catch {
        // skip
      }
    }

    // Identifier scan: limit to ts/tsx/swift/java to avoid heavy walks
    for (const path of await findFiles(
      root,
      "**/*.{ts,tsx,swift,java}"
    )) {
      try {
        const content = await readFile(path, "utf-8");
        harvestPascal(content, words);
      } catch {
        // skip
      }
    }
  }

  // Filter: drop very short tokens and unlikely false positives
  const filtered = [...words]
    .filter((w) => w.length >= 3 && w.length <= 40)
    .sort();

  const config = {
    version: "0.2",
    language: "en",
    words: filtered,
    ignorePaths: ["node_modules/**", "dist/**", ".astro/**", ".cache/**"],
  };

  await writeFile(CSPELL_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${filtered.length} words to ${CSPELL_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
