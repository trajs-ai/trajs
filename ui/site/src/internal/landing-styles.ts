import type { CSSProperties } from "react";

// The backdrop has to fill exactly the plate the outline draws, so both take
// their placement from here.
const markPlacement: CSSProperties = {
  position: "absolute",
  width: "164.173%",
  maxWidth: "none",
  left: "-32.0865%",
  top: "18.366%",
  transform: "rotate(90deg)",
};

/**
 * Layout for the landing page. Every value that changes across the responsive
 * contract is a theme local token (see `themes/trajs/trajsTheme.ts`), so the
 * breakpoint rules live in the generated theme CSS instead of in this file.
 */
export const styles = {
  page: {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    // Revealing the header needs scroll travel. Short pages reserve enough
    // travel even when their content fits in the window.
    minHeight: "calc(100svh + max(var(--landing-nav-height), 5rem))",
    // The page is a pasteboard: the frame paints the board the content sits
    // on, and the margins around it fall back to the darker work surface.
    background: "var(--color-pasteboard)",
    color: "var(--color-text-primary)",
    padding: "var(--landing-page-top) var(--landing-page-inline) var(--landing-page-bottom)",
  },
  // The page isolates its own stacking context, so this negative layer stays
  // above the page fill and behind the content.
  guides: {
    position: "absolute",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
  },
  // The frame stands off the live area by the frame outset. It carries a
  // graph-paper grid at two scales, the same way a drafting sheet separates
  // its fine measuring modules from its heavier structural rules.
  guideFrame: {
    position: "absolute",
    insetBlock:
      "calc(var(--landing-page-top) - var(--landing-frame-outset)) calc(var(--landing-page-bottom) - var(--landing-frame-outset))",
    insetInline:
      "calc(var(--landing-page-inline) - var(--landing-frame-outset)) calc(var(--landing-page-inline) - var(--landing-frame-outset))",
    backgroundColor: "var(--color-background-body)",
    backgroundImage:
      "linear-gradient(to right, var(--color-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--color-grid) 1px, transparent 1px), linear-gradient(to right, var(--color-grid-major) 1px, transparent 1px), linear-gradient(to bottom, var(--color-grid-major) 1px, transparent 1px)",
    backgroundSize:
      "var(--landing-grid-unit) var(--landing-grid-unit), var(--landing-grid-unit) var(--landing-grid-unit), var(--landing-grid-major) var(--landing-grid-major), var(--landing-grid-major) var(--landing-grid-major)",
    border: "1px solid var(--color-guide-strong)",
  },
  header: {
    // The header floats over the page at every breakpoint, and only its
    // contents reflow.
    position: "fixed",
    zIndex: 10,
    top: "var(--landing-nav-top)",
    left: "var(--landing-page-inline)",
    right: "var(--landing-page-inline)",
    minHeight: "var(--landing-nav-height)",
    padding: "var(--landing-nav-padding-block) var(--landing-nav-padding-inline)",
    borderRadius: "var(--radius-element)",
    background: "var(--color-background-surface)",
    backdropFilter: "blur(var(--spacing-4))",
  },
  headerEnd: {
    marginInlineStart: "auto",
    gap: "var(--spacing-6)",
  },
  brand: {
    fontFamily: "var(--landing-brand-family)",
    fontSize: "var(--landing-brand-size)",
    fontWeight: 300,
    letterSpacing: "0.11em",
  },
  brandMark: {
    transform: "rotate(90deg)",
    marginInline: "var(--spacing-0-5)",
  },
  nav: {
    display: "var(--landing-nav-display)",
    gap: "var(--landing-nav-gap)",
    color: "var(--color-ink-muted)",
    fontSize: "var(--landing-nav-font-size)",
    letterSpacing: "var(--landing-nav-tracking)",
    fontWeight: 300,
  },
  navLink: { fontSize: "inherit", fontWeight: "inherit", whiteSpace: "nowrap" },
  changelog: { display: "var(--landing-changelog-display)" },
  inkAsset: { flexShrink: 0 },
  // The copy glyph is an exported image, but the confirmation check is drawn
  // inline so it can take the copy glyph's ink from the theme.
  commandIcon: { flexShrink: 0, color: "var(--color-text-secondary)" },
  menuButton: { display: "var(--landing-menu-display)" },
  themeToggle: {
    width: "var(--landing-theme-toggle-size)",
    height: "var(--landing-theme-toggle-size)",
    minHeight: "var(--landing-theme-toggle-size)",
    padding: 0,
    borderRadius: "var(--radius-inner)",
    color: "var(--color-ink-muted)",
  },
  hero: {
    paddingBlock: "var(--landing-stage-top) var(--landing-stage-bottom)",
    width: "var(--landing-hero-width)",
    marginInline: "var(--landing-hero-margin)",
    gridTemplateColumns: "var(--landing-hero-columns)",
    gridTemplateAreas: "var(--landing-hero-areas)",
    columnGap: "var(--landing-hero-column-gap)",
    rowGap: "var(--landing-hero-row-gap)",
    alignItems: "var(--landing-hero-align)",
  },
  headline: {
    gridArea: "headline",
    paddingBlockStart: "var(--landing-heading-top)",
    minWidth: 0,
  },
  heading: {
    whiteSpace: "nowrap",
    // SAFETY: the theme root and both adaptation rules always set this token
    // to a valid CSS text-align value, so the substitution is start, end, or
    // center by construction.
    textAlign: "var(--landing-heading-align)" as CSSProperties["textAlign"],
  },
  headlineLine: {
    font: "inherit",
    lineHeight: "inherit",
    letterSpacing: "inherit",
    color: "inherit",
    textAlign: "inherit",
  },
  analysisLine: {
    font: "inherit",
    lineHeight: "inherit",
    letterSpacing: "0.03em",
    color: "inherit",
    textAlign: "inherit",
  },
  art: {
    gridArea: "art",
    position: "relative",
    width: "100%",
    minWidth: 0,
    alignItems: "var(--landing-art-align)",
  },
  lockup: {
    position: "relative",
    width: "var(--landing-lockup-width)",
    aspectRatio: "var(--landing-lockup-aspect)",
  },
  symbol: {
    position: "absolute",
    inset: "0 auto 0 0",
    width: "var(--landing-symbol-width)",
  },
  symbolMask: {
    position: "absolute",
    width: "130.6006%",
    aspectRatio: "403.578 / 309.017",
    left: "-15.3003%",
    top: "9.4561%",
    transform: "rotate(90deg)",
    maskSize: "100% 100%",
    maskRepeat: "no-repeat",
  },
  shader: {
    position: "absolute",
    width: "76.5708%",
    height: "130.6006%",
    left: "11.7146%",
    top: "-15.3003%",
    transform: "rotate(-90deg)",
  },
  outline: markPlacement,
  wordmark: {
    position: "absolute",
    display: "var(--landing-wordmark-display)",
    width: "59.0538%",
    height: "auto",
    left: "calc(var(--landing-wordmark-offset) * 100%)",
    top: "49.088%",
  },
  ctas: {
    gridArea: "var(--landing-cta-area)",
    alignSelf: "var(--landing-cta-align)",
    justifySelf: "var(--landing-cta-justify)",
    marginBlock: "var(--landing-cta-margin-block)",
    marginInline: "var(--landing-cta-margin-inline)",
    display: "var(--landing-cta-display)",
    gap: "var(--landing-cta-gap)",
  },
  action: { flexShrink: 0 },
  actionIcon: {
    flexShrink: 0,
    width: "var(--landing-action-icon-size)",
    height: "var(--landing-action-icon-size)",
  },
  command: {
    display: "flex",
    alignItems: "center",
    border: "var(--border-width) solid var(--color-border-emphasized)",
    borderRadius: "var(--radius-element)",
    minHeight: "var(--landing-control-height)",
    paddingInline: "var(--landing-command-padding)",
    gap: "var(--landing-command-gap)",
    flexShrink: 0,
    // The page's grid sits behind everything, so the control needs an opaque
    // fill to read as one field instead of a window onto the board.
    background: "var(--color-background-body)",
  },
  commandText: {
    fontFamily: "var(--font-family-code)",
    fontSize: "var(--landing-command-size)",
    lineHeight: "var(--landing-command-leading)",
    color: "var(--color-ink-command)",
    whiteSpace: "nowrap",
    letterSpacing: "0.02em",
  },
  prompt: {
    fontFamily: "var(--font-family-code)",
    fontSize: "var(--landing-prompt-size)",
    fontWeight: 500,
    color: "var(--color-ink-quiet)",
  },
  indexSection: {
    position: "relative",
    borderBlockStart: "1px solid var(--color-guide-strong)",
    paddingBlockStart: "var(--landing-index-rule-gap)",
  },
  index: {
    position: "relative",
    gridTemplateColumns: "var(--landing-index-columns)",
    gap: "var(--landing-index-gap)",
    alignItems: "stretch",
  },
  indexItem: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "var(--landing-card-columns)",
    gridTemplateRows: "auto 1fr auto",
    gridTemplateAreas: "var(--landing-card-areas)",
    rowGap: "var(--landing-card-gap)",
    columnGap: "var(--landing-card-gap)",
    alignContent: "start",
    alignItems: "start",
  },
  indexHead: { gridArea: "head", minWidth: 0 },
  indexBody: {
    gridArea: "body",
    fontSize: "var(--landing-index-body-size)",
    lineHeight: "var(--landing-index-body-leading)",
    letterSpacing: "0.01em",
  },
  indexLink: {
    gridArea: "link",
    justifySelf: "var(--landing-card-link-justify)",
    alignSelf: "center",
    fontFamily: "var(--font-family-code)",
    fontSize: "var(--landing-index-link-size)",
    lineHeight: "var(--landing-index-label-leading)",
    letterSpacing: "0.12em",
  },
  status: {
    fontSize: "var(--landing-index-link-size)",
    color: "var(--color-text-secondary)",
    minHeight: "var(--spacing-6)",
  },
  menuLink: {
    display: "block",
    paddingBlock: "var(--spacing-2)",
    paddingInline: "var(--spacing-3)",
    borderRadius: "var(--radius-inner)",
    color: "var(--color-ink-muted)",
  },
  menuLabel: {
    fontSize: "0.9375rem",
    fontWeight: 300,
    letterSpacing: "0.08em",
    lineHeight: 1.5,
  },
} satisfies Record<string, CSSProperties>;
