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

// One seamless turbulence tile, tiled at a fixed module. The filter leaves its
// alpha so the speckle composites itself over the board, which reads as the
// same regular grain in both color modes instead of a haze.
const grainTile =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='144' height='144'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='144' height='144' filter='url(%23grain)'/%3E%3C/svg%3E\")";

// The footer ends in a labeled pointer, so it takes the sheet's one label
// treatment.
const linkLabel: CSSProperties = {
  fontFamily: "var(--font-family-code)",
  fontSize: "var(--landing-index-link-size)",
  lineHeight: "var(--landing-index-label-leading)",
  letterSpacing: "0.12em",
};

// The legal line is the same mono label one step down, so it can set its own
// size without inheriting the footer link's.
const legalLabel: CSSProperties = {
  fontFamily: "var(--font-family-code)",
  fontSize: "var(--landing-footer-legal-size)",
  lineHeight: "var(--landing-index-label-leading)",
  letterSpacing: "var(--landing-footer-legal-tracking)",
  whiteSpace: "nowrap",
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
  // The sheet is the main content only: the frame draws its plate and closes
  // the border above the footer, which stands on the pasteboard outside it.
  sheet: {
    position: "relative",
    isolation: "isolate",
  },
  // The page isolates its own stacking context, so this negative layer stays
  // above the page fill and behind the content.
  guides: {
    position: "absolute",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
  },
  // The grain belongs to the frame's plate, not the pasteboard around it, so
  // the margins stay clean and only the live area reads as printed stock. It
  // never takes input, and the tile is static: no repaint per frame, no motion
  // to reduce.
  grain: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: grainTile,
    backgroundSize: "var(--landing-grain-size) var(--landing-grain-size)",
    backgroundRepeat: "repeat",
    opacity: "var(--landing-grain-opacity)",
  },
  // The frame stands off the live area, so no line of copy or control ever
  // touches the trim. It wraps the sheet only and stops above the footer, so
  // the footer reads as a separate block instead of the sheet's last row.
  guideFrame: {
    position: "absolute",
    inset: "calc(-1 * var(--landing-frame-outset))",
    background: "var(--color-background-body)",
    border: "1px solid var(--color-guide-strong)",
  },
  // The ruler turns the corner: the same module continues along the frame's
  // top edge, so the sheet is calibrated on two sides while the live area
  // stays completely clear of lines.
  guideRuleTopMinor: {
    position: "absolute",
    display: "var(--landing-ruler-display)",
    bottom: "100%",
    left: 0,
    right: 0,
    height: "0.25rem",
    backgroundImage:
      "repeating-linear-gradient(to right, var(--color-guide) 0 1px, transparent 1px var(--landing-ruler-unit))",
  },
  guideRuleTopMajor: {
    position: "absolute",
    display: "var(--landing-ruler-display)",
    bottom: "100%",
    left: 0,
    right: 0,
    height: "0.5rem",
    backgroundImage:
      "repeating-linear-gradient(to right, var(--color-guide-strong) 0 1px, transparent 1px var(--landing-ruler-major))",
  },
  // Both ticks start at the frame's top edge and sit outside its border, so
  // the scale reads as one measured run without crossing the live area.
  guideRuleMinor: {
    position: "absolute",
    display: "var(--landing-ruler-display)",
    right: "100%",
    top: 0,
    bottom: 0,
    width: "0.25rem",
    backgroundImage:
      "repeating-linear-gradient(to bottom, var(--color-guide) 0 1px, transparent 1px var(--landing-ruler-unit))",
  },
  guideRuleMajor: {
    position: "absolute",
    display: "var(--landing-ruler-display)",
    right: "100%",
    top: 0,
    bottom: 0,
    width: "0.5rem",
    backgroundImage:
      "repeating-linear-gradient(to bottom, var(--color-guide-strong) 0 1px, transparent 1px var(--landing-ruler-major))",
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
  status: {
    fontSize: "var(--landing-index-link-size)",
    color: "var(--color-text-secondary)",
    minHeight: "var(--spacing-6)",
  },
  footer: {
    // The footer is detached from the sheet: it opens with a rule over a
    // labeled grid, but it sits below the frame's bottom border on the
    // pasteboard, so it reads as the page's footer rather than the sheet's
    // last row.
    borderBlockStart: "1px solid var(--color-guide-strong)",
    marginBlockStart: "var(--landing-footer-gap)",
    paddingBlockStart: "var(--landing-footer-padding)",
    paddingBlockEnd: "var(--landing-footer-bottom)",
  },
  footerIndex: {
    gridTemplateColumns: "var(--landing-footer-columns)",
    columnGap: "var(--landing-footer-column-gap)",
    rowGap: "var(--landing-footer-row-gap)",
    alignItems: "start",
  },
  footerBrand: {
    display: "grid",
    rowGap: "var(--landing-footer-brand-gap)",
    alignContent: "start",
    minWidth: 0,
  },
  footerAbout: {
    fontSize: "var(--landing-index-body-size)",
    lineHeight: "var(--landing-index-body-leading)",
    letterSpacing: "0.01em",
    maxWidth: "var(--landing-footer-about-width)",
  },
  footerGroup: {
    display: "grid",
    rowGap: "var(--landing-card-gap)",
    alignContent: "start",
    minWidth: 0,
  },
  footerLinks: {
    display: "grid",
    rowGap: "var(--landing-footer-link-gap)",
    justifyItems: "start",
  },
  footerLink: {
    ...linkLabel,
    fontSize: "var(--landing-footer-link-size)",
  },
  footerLegal: {
    borderBlockStart: "1px solid var(--color-guide-strong)",
    marginBlockStart: "var(--landing-footer-legal-gap)",
    paddingBlockStart: "var(--landing-footer-legal-padding)",
    gap: "var(--spacing-4)",
  },
  footerMeta: {
    gap: "var(--landing-footer-meta-gap)",
    minWidth: 0,
  },
  footerLegalText: {
    ...legalLabel,
    color: "var(--color-ink-muted)",
  },
  footerLegalLabel: legalLabel,
  footerLegalLink: {
    color: "var(--color-text-primary)",
    whiteSpace: "nowrap",
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
