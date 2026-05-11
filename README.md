# docs.polaris.express

Public documentation site for [Polaris Express](https://polaris.express)
— the EV-charging platform. Built with
[Astro Starlight](https://starlight.astro.build/), deployed to
Cloudflare Pages at `docs.polaris.express`.

## Local dev

```bash
nvm use         # Node 20
npm install
npm run dev     # http://localhost:4321
```

## Common commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Astro dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run check` | Astro check + frontmatter + glossary + screenshots + cspell |
| `npm run author -- --slug <slug>` | Run the writer agent on one backlog entry |
| `npm run author:tier -- --tier P0` | Author all P0 backlog entries |
| `npm run autolink` | Rewrite bare glossary terms into `<Glossary>` tags |
| `npm run vocab` | Refresh `.cspell.json` from sibling submodules |
| `npm run drift` | Compare frontmatter `code_refs_sha` against current refs |

## Layout

```
docs/
  astro.config.mjs           # Starlight + integrations + sidebar topics
  src/
    content/docs/            # Authored MDX (Starlight content collection)
    components/              # Custom MDX components (Tutorial, Screenshot, ...)
    overrides/               # Starlight component overrides (PageFrame, Hero)
    styles/
      brand.css              # OKLch tokens mirrored from web/
      accents.css            # Per-section accent overrides
  content/
    backlog.yaml             # Master article backlog
    glossary.yaml            # Term -> definition manifest
  prompts/                   # Reusable agent prompt templates
  scripts/                   # author / review / drift / vocab / lint
  public/screenshots/        # Hand-curated screenshots (placeholders OK)
```

## Authoring pipeline

The doc site is authored by an agent fleet driven from
`scripts/author-article.ts`. The backlog at `content/backlog.yaml` is
the single source of truth. Each entry pairs a target article with the
prompt template, the source files the writer must consult, and a
status field.

Local authoring:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run author -- --slug user.web.sessions.start-a-charge
```

CI authoring (recommended for bulk passes):

- Open the **Author article(s)** workflow on GitHub.
- Enter a slug or a tier (P0/P1/P2). Toggle `dry_run` to preview.
- The workflow authors, autolinks, opens a PR, and posts a reviewer
  verdict as a PR comment. Reviewer is **advisory** — author the PR
  merges at their discretion.

## Brand alignment

The visual identity mirrors the customer portal (`example.com`). All
color, spacing, radius, and font tokens are OKLch values copied
verbatim from `web/assets/styles.css`. The per-section accent system
(User=Volt green, Admin=Cyan, Selfhost=Amber, Reference=Violet) is
applied via the `PageFrame` override which sets `data-section` on
`<html>`.

## Deploy

PRs deploy to a Cloudflare Pages preview URL via the **Deploy**
workflow. Merges to `main` deploy to production at
`https://docs.polaris.express`.

Required repo secrets:

- `ANTHROPIC_API_KEY` — Author + reviewer agents
- `CLOUDFLARE_API_TOKEN` — Scoped to the `docs-polaris-express`
  Pages project only
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

## Related repos

This repo lives as a submodule of the
[Polaris Express monorepo](https://github.com/expresscharge/monorepo).
Sibling submodules (`web/`, `ios/`, `email-worker/`, `steve/`) provide
the source code that articles cite. The writer agents resolve
`code_refs` paths against the aggregator root.
