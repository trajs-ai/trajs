import { defineTheme } from "@astryxdesign/core/theme";

import { desktopBreakpoint, desktopContentWidth, tabletBreakpoint } from "./layout";
import { colorPair } from "./palette";

export const trajsTheme = defineTheme({
  name: "trajs",
  typography: {
    body: { family: "Google Sans Flex", fallbacks: "system-ui, sans-serif" },
    heading: { family: "Google Sans Flex", fallbacks: "system-ui, sans-serif" },
    code: { family: "IBM Plex Mono", fallbacks: "ui-monospace, monospace" },
  },
  radius: { base: 4, multiplier: 1 },
  tokens: {
    "--color-background-body": colorPair("canvas"),
    "--color-background-surface": colorPair("glass"),
    "--color-background-card": colorPair("canvas"),
    "--color-background-muted": colorPair("control"),
    "--color-text-primary": colorPair("ink"),
    "--color-text-secondary": colorPair("secondary"),
    "--color-icon-primary": colorPair("ink"),
    "--color-border": colorPair("border"),
    "--color-border-emphasized": colorPair("borderStrong"),
    "--color-accent": colorPair("action"),
    "--color-on-accent": colorPair("onAction"),
    "--color-text-accent": "var(--color-text-primary)",
    "--color-icon-accent": "var(--color-text-primary)",
    "--color-overlay-hover": ["#1717170c", "#ffffff0c"],
    "--color-overlay-pressed": ["#17171719", "#ffffff19"],
    "--radius-element": "0.25rem",
    "--size-element-lg": "3.5rem",
    "--font-weight-normal": "300",
    "--text-body-size": "1.25rem",
    "--text-body-leading": "2rem",
    "--text-body-weight": "300",
    "--text-display-1-size": "var(--landing-display-size)",
    "--text-display-1-leading": "var(--landing-display-leading)",
    "--text-display-1-weight": "250",
    "--focus-outline-color": "var(--color-text-primary)",
  },
  localTokens: {
    "--landing-header-blur": "0.75rem",
    "--landing-header-transition": "opacity 180ms ease, filter 220ms ease",
    "--landing-theme-toggle-size": "1.5rem",
    "--landing-prompt-size": "clamp(0.8125rem, 0.9896vw, 1.1875rem)",
    "--color-pasteboard": colorPair("pasteboard"),
    "--color-guide": colorPair("guide"),
    "--color-guide-strong": colorPair("guideStrong"),
    "--color-grid": colorPair("grid"),
    "--color-grid-major": colorPair("gridMajor"),
    "--color-ink-quiet": colorPair("quiet"),
    "--color-ink-muted": colorPair("muted"),
    "--color-ink-command": colorPair("command"),
    "--color-surface-control": colorPair("control"),
    "--color-surface-control-border": colorPair("controlBorder"),
    "--color-pigment-coral": colorPair("markCoral"),
    "--color-pigment-apricot": colorPair("markApricot"),
    "--color-pigment-golden": colorPair("markGolden"),

    // Page frame: desktop is the base; the adaptation rules below override
    // these for the tablet (md) and phone (below md) layouts.
    "--landing-page-inline": "clamp(2.5rem, 4vw, 6rem)",
    "--landing-page-top": "var(--landing-page-inline)",
    "--landing-page-bottom": "var(--landing-page-inline)",
    // The frame is outset from the live area by its own token. Its grid uses
    // one measuring module and a heavier rule every four modules.
    "--landing-frame-outset": "1.5rem",
    "--landing-grid-unit": "1.5rem",
    "--landing-grid-major": "6rem",
    "--landing-index-rule-gap": "2.5rem",

    // Header
    "--landing-nav-top": "clamp(1.5rem, 2vw, 2.5rem)",
    "--landing-nav-height": "clamp(4.75rem, 2.5rem + 2.5vw, 5.5rem)",
    "--landing-nav-padding-block": "1rem",
    "--landing-nav-padding-inline": "3rem",
    "--landing-nav-gap": "1.75rem",
    "--landing-nav-font-size": "0.9375rem",
    "--landing-nav-tracking": "0.08em",
    "--landing-nav-display": "flex",
    "--landing-menu-display": "none",
    "--landing-brand-size": "1.25rem",
    "--landing-brand-family": "'IBM Plex Sans', system-ui, sans-serif",

    // Hero
    "--landing-stage-top": "calc(var(--landing-nav-height) + 3rem)",
    "--landing-stage-bottom": "8rem",
    "--landing-hero-areas": '"headline art"',
    "--landing-hero-columns": "minmax(0, 678fr) minmax(0, 1010fr)",
    "--landing-hero-column-gap": "2.5rem",
    "--landing-hero-row-gap": "0rem",
    "--landing-hero-width": "auto",
    "--landing-hero-margin": "0",
    "--landing-hero-align": "start",
    "--landing-heading-top": "clamp(0rem, 13.3333vw - 12rem, 4rem)",
    "--landing-heading-align": "end",
    "--landing-display-size": "clamp(3rem, 2.5625rem + 4.896vw, 8.4375rem)",
    "--landing-display-leading": "1.0666667",
    "--landing-art-align": "flex-start",
    "--landing-lockup-width": "86.85535%",
    "--landing-lockup-aspect": "877.239 / 500.003",
    "--landing-symbol-width": "35.2262%",
    "--landing-wordmark-display": "block",
    "--landing-wordmark-offset": "0.409469",
    "--landing-cta-display": "flex",
    "--landing-cta-area": "art",
    "--landing-cta-align": "end",
    "--landing-cta-justify": "start",
    "--landing-cta-margin-block": "0 1rem",
    "--landing-cta-margin-inline":
      "calc(var(--landing-lockup-width) * var(--landing-wordmark-offset)) 0",
    "--landing-cta-gap": "var(--spacing-4)",
    "--landing-command-gap": "var(--spacing-3)",
    "--landing-action-icon-size": "1.25rem",

    // CTAs and controls
    "--landing-action-size": "clamp(0.9375rem, 1.1979vw, 1.4375rem)",
    "--landing-command-size": "clamp(0.875rem, 1.0417vw, 1.25rem)",
    "--landing-command-leading": "clamp(1.25rem, 1.25vw, 1.5rem)",
    "--landing-control-height": "clamp(3rem, 2.9167vw, 3.5rem)",
    "--landing-action-padding": "clamp(1rem, 1.4583vw, 1.75rem)",
    "--landing-command-padding": "clamp(0.875rem, 1.0417vw, 1.25rem)",

    // Index
    "--landing-index-columns": "repeat(3, minmax(0, 1fr))",
    "--landing-index-gap": "clamp(3rem, 2.5vw + 1.2rem, 4.5rem)",
    "--landing-index-body-size": "clamp(1rem, 0.75rem + 0.4167vw, 1.25rem)",
    "--landing-index-body-leading": "clamp(1.5rem, 1.25rem + 0.625vw, 2rem)",
    "--landing-index-label-size": "clamp(0.875rem, 0.75rem + 0.3125vw, 1.125rem)",
    "--landing-index-label-leading": "1.5rem",
    "--landing-index-link-size": "clamp(0.8125rem, 0.5rem + 0.4167vw, 1rem)",
    "--landing-changelog-display": "flex",
    "--landing-card-gap": "1.25rem",
    "--landing-card-columns": "minmax(0, 1fr)",
    "--landing-card-areas": '"head" "body" "link"',
    "--landing-card-link-justify": "start",
  },
  adaptations: {
    // The desktop hero is a position-sensitive composition: the art keeps its
    // lockup ratio and the CTA row is pinned to the art column. It only holds
    // together at the width of the 1440 board and above, so xl is the design's
    // own desktop edge rather than the default 1280. Everything narrower uses
    // the tablet composition, which is a centered, width-insensitive block.
    widthBreakpoints: { md: tabletBreakpoint, xl: desktopBreakpoint },
    rules: [
      {
        // Desktop type and controls scale from the board without enlarging
        // the page margins in short windows. The hero keeps a separate width
        // cap so wide screens preserve the proportions of the artwork.
        when: { width: { from: "xl" } },
        value: {
          // The button's own height must follow the same scale as its width
          // and label; a fixed 56px height here stretched the control on every
          // narrow desktop.
          tokens: { "--size-element-lg": "var(--landing-control-height)" },
          localTokens: {
            "--landing-nav-height": "min(clamp(4.75rem, 2.5rem + 2.5vw, 5.5rem), 8.1481481svh)",
            "--landing-nav-padding-inline": "min(3rem, 4.4444444svh)",
            "--landing-nav-gap": "min(1.75rem, 2.5925926svh)",
            "--landing-nav-font-size": "min(0.9375rem, 1.3888889svh)",
            "--landing-brand-size": "min(1.25rem, 1.8518519svh)",
            "--landing-stage-top":
              "min(calc(var(--landing-nav-height) + min(3rem, 2.5vw)), 12.5925926svh)",
            "--landing-stage-bottom": "min(6rem, 5vw, 8.8888889svh)",
            "--landing-hero-width": `min(100%, ${desktopContentWidth}px, 176svh)`,
            "--landing-hero-margin": "auto",
            "--landing-hero-column-gap": "min(2.5rem, 2.0833333vw, 3.7037037svh)",
            "--landing-heading-top": "min(4rem, 3.3333333vw, 5.9259259svh)",
            "--landing-display-size": "min(8.4375rem, 7.03125vw, 12.5svh)",
            "--landing-prompt-size": "min(1.1875rem, 0.9895833vw, 1.7592593svh)",
            "--landing-action-size": "min(1.4375rem, 1.1979167vw, 2.1296296svh)",
            "--landing-command-size": "min(1.25rem, 1.0416667vw, 1.8518519svh)",
            "--landing-command-leading": "min(1.5rem, 1.25vw, 2.2222222svh)",
            "--landing-control-height": "min(3.5rem, 2.9166667vw, 5.1851852svh)",
            "--landing-action-padding": "min(1.75rem, 1.4583333vw, 2.5925926svh)",
            "--landing-command-padding": "min(1.25rem, 1.0416667vw, 1.8518519svh)",
            "--landing-cta-gap": "min(1rem, 0.8333333vw, 1.4814815svh)",
            "--landing-command-gap": "min(0.75rem, 0.625vw, 1.1111111svh)",
            "--landing-action-icon-size": "min(1.25rem, 1.0416667vw, 1.8518519svh)",
            "--landing-cta-margin-block": "0 min(1rem, 0.8333333vw, 1.4814815svh)",
            "--landing-index-gap": "min(4.5rem, 3.75vw, 6.6666667svh)",
            "--landing-index-body-size": "min(1.25rem, 1.0416667vw, 1.8518519svh)",
            "--landing-index-body-leading": "min(2rem, 1.6666667vw, 2.962963svh)",
            "--landing-index-label-size": "min(1.125rem, 0.9375vw, 1.6666667svh)",
            "--landing-index-label-leading": "min(1.5rem, 1.25vw, 2.2222222svh)",
            "--landing-index-link-size": "min(1rem, 0.8333333vw, 1.4814815svh)",
            "--landing-card-gap": "min(1.25rem, 1.0416667vw, 1.8518519svh)",
          },
        },
      },
      {
        // Tablet: the header keeps the desktop's floating, reveal-on-scroll
        // behavior while its contents reflow; the hero becomes a centered
        // art + headline pair with the CTAs underneath, and the index keeps
        // three columns. This holds from md up to the desktop edge.
        when: { width: { from: "md", below: "xl" } },
        value: {
          localTokens: {
            "--landing-page-inline": "2.5rem",
            "--landing-frame-outset": "1rem",
            "--landing-index-rule-gap": "1.75rem",
            "--landing-nav-height": "5.5rem",
            // The tablet header keeps its 834 board spacing and tightens just
            // enough for the 720px edge, where the 640px hero still fits.
            "--landing-nav-padding-inline": "clamp(2rem, 14.035vw - 4.3125rem, 3rem)",
            "--landing-nav-gap": "clamp(1.25rem, 7.018vw - 1.906rem, 1.75rem)",
            // The tablet block is the 834 × 1112 board. Below that height the
            // stage gaps close so the index stays on the first screen; the
            // fixed header overlays the top band instead of taking flow space.
            "--landing-stage-top": "clamp(6.875rem, calc(10rem - (1112px - 100svh) * 0.34), 10rem)",
            "--landing-stage-bottom":
              "clamp(6.875rem, calc(10rem - (1112px - 100svh) * 0.34), 10rem)",
            "--landing-hero-areas": '"art headline" "ctas ctas"',
            "--landing-hero-columns": "minmax(0, 190fr) minmax(0, 395fr)",
            "--landing-hero-column-gap": "3.5rem",
            "--landing-hero-row-gap": "4rem",
            "--landing-hero-width": "40rem",
            "--landing-hero-margin": "auto",
            "--landing-hero-align": "center",
            "--landing-heading-top": "0rem",
            "--landing-heading-align": "start",
            "--landing-display-size": "5.625rem",
            "--landing-display-leading": "1.1556",
            "--landing-art-align": "center",
            "--landing-lockup-width": "100%",
            "--landing-lockup-aspect": "190 / 307.426",
            "--landing-symbol-width": "100%",
            "--landing-wordmark-display": "none",
            "--landing-cta-area": "ctas",
            "--landing-cta-align": "start",
            "--landing-cta-justify": "start",
            "--landing-cta-margin-block": "0",
            "--landing-cta-margin-inline": "0",
            "--landing-changelog-display": "none",
            "--landing-action-size": "1.4375rem",
            "--landing-command-size": "1.25rem",
            "--landing-command-leading": "1.5rem",
            "--landing-prompt-size": "1.1875rem",
            "--landing-control-height": "3.5rem",
            "--landing-action-padding": "1.75rem",
            "--landing-command-padding": "1.25rem",
            "--landing-index-gap": "1.5rem",
            "--landing-index-body-size": "1rem",
            "--landing-index-body-leading": "1.5625rem",
            "--landing-index-label-size": "0.9375rem",
            "--landing-index-link-size": "0.875rem",
            "--landing-card-gap": "1rem",
          },
        },
      },
      {
        // Phone: one column all the way down. The nav becomes a menu sheet,
        // the symbol sits above the headline, the CTAs move into that sheet,
        // and the index cards put their link on the head row.
        when: { width: { below: "md" } },
        value: {
          localTokens: {
            "--landing-page-inline": "1.25rem",
            // The phone layout is a single column in a 20px margin, so the
            // frame outset and index rule stay small.
            "--landing-frame-outset": "0.5rem",
            "--landing-index-rule-gap": "1.5rem",
            "--landing-nav-height": "3.25rem",
            "--landing-nav-padding-block": "0.5rem",
            "--landing-nav-padding-inline": "1rem",
            "--landing-nav-display": "none",
            "--landing-menu-display": "flex",
            // The fixed header takes no space in the flow, so the stage
            // reserves the header band.
            "--landing-stage-top": "calc(var(--landing-nav-height) + 1.5rem)",
            "--landing-stage-bottom": "1.5rem",
            "--landing-hero-areas": '"art" "headline"',
            "--landing-hero-columns": "minmax(0, 1fr)",
            "--landing-hero-column-gap": "0rem",
            "--landing-hero-row-gap": "1.5rem",
            "--landing-hero-width": "auto",
            "--landing-hero-margin": "0",
            "--landing-hero-align": "start",
            "--landing-heading-top": "0rem",
            "--landing-heading-align": "center",
            "--landing-display-size": "clamp(2.5rem, 15.276vw, 3.7236rem)",
            "--landing-display-leading": "1.1",
            "--landing-art-align": "center",
            // The phone composition is a fixed-size block from the 390 board,
            // where the symbol is 160.952 wide; the mark keeps that size
            // instead of tracking the viewport width.
            "--landing-lockup-width": "10.0595rem",
            "--landing-lockup-aspect": "160.952 / 260.426",
            "--landing-symbol-width": "100%",
            "--landing-wordmark-display": "none",
            "--landing-cta-display": "none",
            "--landing-index-columns": "minmax(0, 1fr)",
            "--landing-index-gap": "1rem",
            "--landing-index-body-size": "0.9375rem",
            "--landing-index-body-leading": "1.4375rem",
            "--landing-index-label-size": "0.9375rem",
            "--landing-index-link-size": "0.8125rem",
            "--landing-card-gap": "0.5rem",
            "--landing-card-areas": '"head link" "body body"',
            "--landing-card-link-justify": "end",
          },
        },
      },
    ],
  },
  components: {
    heading: {
      "level:1": {
        letterSpacing: "-0.01em",
        fontWeight: "var(--text-display-1-weight)",
        textAlign: "end",
        fontVariationSettings: "'wdth' 100, 'ROND' 0",
      },
      "level:2": {
        fontSize: "var(--landing-index-label-size)",
        fontWeight: "300",
        lineHeight: "var(--landing-index-label-leading)",
        letterSpacing: "0.16em",
      },
    },
    text: {
      "type:code": { fontFamily: "var(--font-family-code)" },
    },
    link: { base: { color: "inherit" } },
    "bottom-sheet": { base: { backgroundColor: "var(--color-background-card)" } },
    // The phone menu belongs to the header, so it paints the header glass.
    // The canvas underneath keeps rows legible over the artwork while a
    // little of the page shows through.
    popover: {
      base: {
        backgroundColor: "color-mix(in srgb, var(--color-background-body) 88%, transparent)",
        backgroundImage:
          "linear-gradient(var(--color-background-surface), var(--color-background-surface))",
        backdropFilter: "blur(var(--spacing-4))",
        borderRadius: "var(--radius-element)",
      },
    },
    button: {
      base: { fontWeight: "500", borderRadius: "var(--radius-element)" },
      "size:lg": {
        fontSize: "var(--landing-action-size)",
        paddingInline: "var(--landing-action-padding)",
        minHeight: "var(--landing-control-height)",
      },
    },
  },
});
