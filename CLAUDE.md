# docs.polaris.express — project notes for Claude

## Project overview

Astro Starlight site at `docs.polaris.express`. Public docs for the
Polaris Express EV-charging platform. Five top-level sections (User,
Admin, Selfhost, Reference, Glossary/Changelog), agent-authored from
`content/backlog.yaml` via `scripts/author-article.ts`.

## Key commands

- `npm run dev` — Astro dev (HMR, http://localhost:4321)
- `npm run build` — Production build to `dist/`
- `npm run check` — Astro check + frontmatter + glossary + screenshots + cspell
- `npm run author -- --slug <slug>` — Author one article (needs `ANTHROPIC_API_KEY`)
- `npm run author:tier -- --tier P0` — Author all P0 backlog entries
- `npm run autolink` — Rewrite bare glossary terms in MDX
- `npm run drift` — Diff frontmatter `code_refs_sha` vs current refs
- `npm run vocab` — Re-extract `.cspell.json` from sibling submodules

## Visual identity rules

The docs site is **brand-locked to the customer portal**
(`example.com`). All color/spacing/radius tokens are copied verbatim
from `web/assets/styles.css` into `src/styles/brand.css`. Do not
invent tokens here.

The per-section accent system mirrors `web/src/lib/colors.ts`:

| Section | Accent | OKLch (light) |
| --- | --- | --- |
| User | Volt green | `oklch(0.60 0.22 145)` |
| Admin | Electric cyan | `oklch(0.55 0.20 220)` |
| Selfhost | Amber | `oklch(0.75 0.18 85)` |
| Reference/API | Violet | `oklch(0.55 0.22 280)` |
| Changelog | Rose | `oklch(0.50 0.24 25)` |

The PageFrame override sets `data-section` on `<html>`; accents.css
rewires `--sl-color-accent` per section.

## BorderBeam rules

Per `web/CLAUDE.md`, the BorderBeam motif is reserved for **live /
in-progress** semantics. Applied to:

- Landing hero (`src/components/BrandHero.astro`) — once
- Nowhere else in docs (no decorative use)

`prefers-reduced-motion` falls back to a static gradient.

## Component rules

- All authored pages are `.mdx`, not `.md`.
- Use `<Tutorial>` + `<TutorialStep>` for numbered step-by-step
  procedures. Use `<Steps>` (Starlight built-in) for short inline
  numbered lists.
- Use `<Screenshot>` for app screenshots; if no real capture exists,
  omit `src` to render the skeleton placeholder. Always provide `alt`.
- Use `<Persona>` for persona-targeted callouts.
- Use `<EnvVar>` for env-var references in selfhost runbooks.
- Use `<Endpoint>` for API endpoint chips.
- Prefer the autolinker for glossary terms — only hand-tag when the
  surrounding sentence needs a different anchor than the first match.

## Authoring rules

- Every article cites `code_refs` in frontmatter. Agents read those
  files; CI's drift workflow watches them.
- Reviewer agent is **advisory, non-blocking**. All CI checks
  (frontmatter, links, screenshots, glossary, cspell, budget, a11y)
  use `continue-on-error: true`. Minimal resistance to shipping.
- Never invent UI affordances. If a claim isn't backed by
  `code_refs`, leave a `<!-- TODO: confirm -->` comment.

## Local CI fallback

The submodule mirrors the aggregator's "every CI job has a local
equivalent" pattern:

| CI job | Local equivalent |
| --- | --- |
| `check` (astro + frontmatter + glossary + screenshots + cspell) | `npm run check` |
| `build` | `npm run build` |
| `deploy` | `npx wrangler pages deploy dist --project-name=docs-polaris-express` |
| `drift` | `npm run drift` |
| `vocab` | `npm run vocab` |

## Things to delete rather than patch

- Hand-rolled HTML cards in MDX → `<LinkCard>` or `<Card>`
- Bare term mentions of glossary words → run `npm run autolink`
- Custom CSS for accents → bind to `--sl-color-accent` via section
  data attribute, don't add new color literals
- Repeated import lines for the same component across many pages →
  hoist into `src/content.config.ts` schema docs or document in a
  per-section index.mdx
