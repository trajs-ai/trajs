import { configDefaults, defineConfig } from "vite-plus";

// What fmt and lint stay out of: agent tooling assets and the vendored anti-slop
// plugin, which are copied sources rather than project code, and the files
// `@astryxdesign/cli` writes in the site — a generated theme module, a theme
// template and the agent docs — which stay as it wrote them so rerunning it is a
// no-op. The rest is written by a build, or by `changeset version`.
const ignoredByFmtAndLint = [
  ".agents/**",
  // Changesets indents a changelog entry by the two spaces of the list marker it
  // sits under, including the blank lines inside a multi-paragraph entry, so
  // every release writes trailing whitespace the formatter would strip again.
  "**/CHANGELOG.md",
  "tools/oxlint/anti-slop/**",
  // Written by `astryx init` and `astryx theme add`, which rewrite them from
  // their own records.
  "ui/site/src/astryx-themes.ts",
  "ui/site/theme.template.ts",
  // The agent docs `astryx init` writes: its text is wider than the formatter
  // wraps, and reformatting it would make the next init a diff of its own.
  "ui/site/AGENTS.md",
];

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  test: {
    // `references/` holds symlinks to sibling checkouts that `.agents/prepare`
    // creates. Those are other repositories, which run their own tests, so this
    // workspace's run stops at its own packages.
    exclude: [...configDefaults.exclude, "references/**"],
  },
  fmt: {
    ignorePatterns: [...ignoredByFmtAndLint],
    // Organize imports into Oxfmt's default groups (builtin, external,
    // internal, relative, style) and sort within each, so import order is a
    // formatter concern rather than something reviewers have to check.
    sortImports: true,
  },
  lint: {
    ignorePatterns: [...ignoredByFmtAndLint],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      {
        name: "anti-slop-effect",
        specifier: "./tools/oxlint/anti-slop/effect/index.ts",
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "anti-slop-effect/no-manual-effect-error-tag": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      "anti-slop-effect/no-manual-tagged-construction": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-match": "error",
      // These APIs take the value itself, so a call reads inside out where a
      // `.pipe(...)` stage reads left to right; the rewrite is mechanical.
      "anti-slop-effect/prefer-pipe-for-data-last-apis": "warn",
      // Deep call nesting is a readability prompt, not a defect, and a nested
      // value does not always have the `.pipe(...)` a staged chain would call.
      "anti-slop-effect/prefer-pipe-over-nesting": "warn",
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    // Cache tasks, not `package.json` scripts (the Vite+ default). Script
    // caching would also cover long-running commands like the site's dev server,
    // whose cached output would be replayed instead of served.
    cache: { tasks: true, scripts: false },
    tasks: {
      // `vp run site` starts the site's Vite dev server; the task is never
      // replayed for the same reason.
      site: {
        command: "vp run site#dev",
        cache: false,
      },
    },
  },
});
