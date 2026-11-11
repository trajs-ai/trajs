# TRAJS theme

Source: [TRAJS desktop board, 1920 × 1080](https://www.figma.com/design/wHC1Hy6AADFOheDz8FFt1e/TRAJS?node-id=267-90).

`figma.tokens.json` records shared variables, both color modes and the board's
literal canvas fills. `palette.ts` owns the reviewed light/dark colors shared by
the Astryx theme and the shader. `trajsTheme.ts` maps these colors to semantic
roles and component overrides. Both schemes follow the Figma board. Desktop
geometry is the current target; responsive layout is deferred.

| Figma role                            | Astryx role                                    |
| ------------------------------------- | ---------------------------------------------- |
| Canvas `#eeeeee` / `#171717`          | `--color-background-body`                      |
| Ink `#171717` / `#f2f2ef`             | `--color-text-primary`                         |
| Supporting ink `#5f5f66` / `#9c9ca3`  | `--color-text-secondary`                       |
| Glass `#ffffff33` / `#ffffff14`       | `--color-background-surface`                   |
| Action / on-action                    | `--color-accent` / `--color-on-accent`         |
| Border / strong border                | `--color-border` / `--color-border-emphasized` |
| Google Sans Flex                      | Body and heading families                      |
| IBM Plex Mono                         | Code family                                    |
| IBM Plex Sans Light                   | Local wordmark family                          |
| Page budgets, display scale, tracking | `--landing-*` local tokens                     |

The display is 135/144 at weight 250 on the source canvas. Body copy is 20/32
at weight 300. Navigation is 15 at weight 300. Spacing follows the four-pixel
scale, with the source's six- and ten-pixel intermediate gaps.

Four colors belong to the landing page's construction sheet rather than to the
Figma theme: `pasteboard` is the work surface the page frame sits on, `guide` /
`guideStrong` draw the frame, margin ruler and section rules, and `grid` /
`gridMajor` draw the two tiers of the drafting grid inside that frame.

Color pairs are ordered light, then dark. The board's canvas fills are graphite
and literal white, but light mode uses the neutral `#eeeeee` so large empty
areas sit below full brightness. The board's literal fills take precedence over
the separate `color/canvas` variable, whose values are also retained in the
snapshot.

Theme values live in Astryx's scoped theme, including color-scheme pairs.
`src/internal/landing-styles.ts` maps page-specific geometry to these tokens;
it does not contain a second palette. `src/internal/brand-shader.ts` creates
stable animated and reduced-motion shader objects for each mode. Hex pigments
from the palette are converted to Float32 channels, matching the original
Figma parameters. The shader program and its other parameters are unchanged.

Light mode uses coral `#ff908c`, apricot `#ffb378` and gold `#ffd21b`. Dark mode
uses blue `#0f69be`, olive `#9b9954` and gold `#f4bd22`. Changing modes switches
the palette, shader object and asset set together; the selected mode persists
across reloads and updates the browser's theme color.

## Update

Edit colors in `palette.ts`, then run from `ui/site/`:

```sh
pnpm exec astryx theme build src/themes/trajs/trajsTheme.ts
pnpm exec astryx theme add trajs
pnpm exec astryx theme use trajs
pnpm exec astryx theme build src/themes/trajs/trajsTheme.ts --check
vp build
pnpm exec astryx doctor --built dist
pnpm exec astryx doctor --built .
```

Commit the source and generated `trajs.js`, `trajs.css`, `trajs.d.ts` and
`trajs.variants.d.ts` together.
The CLI owns `src/astryx-themes.ts`. `trajs.fonts.css` is authored source and is
discovered by `theme add`. Fonts and all Figma assets are served locally, so
the page does not depend on temporary Figma asset URLs or a font service.

## Fonts and assets

Fonts originate from [Google Fonts](https://github.com/google/fonts), with
their OFL notices in `fonts/`. Google Sans Flex comes from
`ofl/googlesansflex/GoogleSansFlex[ROND,opsz,slnt,wdth,wght].ttf`. IBM Plex Sans
300 and IBM Plex Mono 400/500 come from the corresponding Google Fonts families.

WOFF2 files contain Latin and general punctuation (`U+0000–00FF`,
`U+2000–206F`). Google Sans Flex keeps variable weight and optical size; width
100, roundness 0 and slant 0 match the board. FontTools `pyftsubset` performs
the subset and WOFF2 conversion; `fonttools varLib.instancer` fixes those
three axes. The font faces load through `trajs.fonts.css`.

`src/assets/figma/` holds the original dark assets; its `light/` directory holds
the corresponding light exports. `src/internal/landing-assets.ts` owns the
mode-to-asset mapping. Colors are not approximated with inversion filters.
The build emits the SVGs as cacheable files instead of duplicating both asset
sets inside the JavaScript bundle.

Preserve their view boxes and proportions. The horizontal symbol mask is
rotated at its wrapper while the shader is counter-rotated, so the original
asset clips the portrait mark without rewriting its vector paths.
