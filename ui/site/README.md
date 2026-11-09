# site

The trajs site: a Vite app of React 19 and the
[Astryx](https://astryx.atmeta.com/docs/getting-started) design system, which is
what its pages are built from.

Run it from the repository root with `vp run site`, or from this directory:

```bash
vp dev      # Vite dev server
vp build    # production bundle into dist/
vp preview  # preview the built bundle
```

`.github/workflows/deploy.yml` builds it for GitHub Pages, which serves a project
site under a path of its own: the workflow passes that path as `SITE_BASE_PATH`,
which `vite.config.ts` turns into Vite's `base`, and a build without it answers on
`/`.

## The design system

`src/main.tsx` imports the reset and the prebuilt component styles, which is the
whole of the plain-CSS path the design system's getting-started guide calls for:
components arrive styled, in the cascade layers the stylesheets themselves
declare, and the theme's own stylesheets arrive with the generated theme module.
There is no Tailwind bridge and no StyleX compiler here, so `className` carries
only what the site writes itself and `xstyle` overrides are not available: style
a page with component props and design tokens, as `AGENTS.md` spells out.

`src/astryx-themes.ts` is written by the CLI, not by hand: it imports the built
module, the production CSS and the font CSS of the local TRAJS theme, and
`src/App.tsx` wraps the page in `<Theme theme={themes[defaultThemeSlug]}>`. To
change the look, install another `@astryxdesign/theme-*` package and add it with
`pnpm exec astryx theme add`; `pnpm exec astryx theme use` moves the default.
`theme.template.ts` is the starting point `astryx init --all` writes for a theme
of the site's own, and nothing imports it.

The landing page follows the desktop Figma board `267:90`. Its extracted
variables, semantic mappings, local fonts and rebuild instructions live in
[`src/themes/trajs/README.md`](src/themes/trajs/README.md). Edit `trajsTheme.ts`
and rebuild the theme rather than editing its generated CSS or adding global
color overrides. Both modes share `palette.ts`; each uses its own original
Figma SVG assets and shader pigments. Responsive layout is deferred.

The header is fixed and initially hidden. Scrolling past 64 CSS pixels reveals
it through blur, opacity and translation; returning to the top hides it again.
Hidden navigation is inert. Reduced-motion preferences disable this transition
and render a still frame of the brand shader.

The mark uses the original exported shader with the official
`@figma/expressive-components` runtime. It requires WebGPU on HTTPS or localhost.
The runtime leaves the fill empty when WebGPU is unavailable; the original
outline and wordmark remain visible. The shader source is preserved verbatim
under `src/internal/lib/custom-effects/`.

Navigation currently points at the project's GitHub README, examples,
discussions and changelog. The BLOG label uses discussions until a blog
destination exists.

## The Astryx CLI

`@astryxdesign/cli` is a dev dependency, so the project answers with its own
version and the components, tokens and templates it ships are read from what is
installed. Run it from this directory as `pnpm exec astryx <command>` — the form
the agent docs give, which resolves the binary the package declares instead of a
path into `node_modules` that has to be guessed.

```bash
pnpm exec astryx component          # every component, with its import path
pnpm exec astryx component Button   # one component's props and usage
pnpm exec astryx docs               # every doc topic
pnpm exec astryx template --list    # page templates to start from
pnpm exec astryx doctor             # check the project's Astryx setup
```

## What the agent tools read

`astryx init` wrote `AGENTS.md`, and it is the only copy the site keeps: every
agent that reads project guidance reads that file, so one text stays current
instead of one per tool. The per-tool copies init offers — `GEMINI.md`,
`.claude/CLAUDE.md`, and the Cursor rule written with `--agent-docs-path` — were
removed, and so was the MCP entry pointing a tool at the design system.

That text sits in one managed block, between the `ASTRYX:START` and `ASTRYX:END`
comments: `astryx init` rewrites the block and leaves the rest of the file as it
is, so rerunning it refreshes the guidance. What it writes follows the setup it
finds — the styling rule it states, for one — so rerun it after changing that
setup or upgrading Astryx, and delete the `GEMINI.md` it writes alongside.

The same documentation is served over MCP at `https://astryx.atmeta.com/mcp`,
for an agent to search instead of running the CLI; connect it in whichever tool
you use rather than committing a config per tool.
