import { defineTheme } from "@astryxdesign/core/theme";

import { colorPair } from "./palette";

/**
 * The TRAJS skin. It holds the board's reviewed palette mapped onto Astryx's
 * semantic roles, its three typefaces, and the two component defaults the board
 * draws.
 *
 * It carries no page geometry. The landing page's composition lives in its own
 * stylesheet as `--landing-*` properties, which keeps the theme swappable and
 * the page rebuildable without touching the other.
 */
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
    // The board has one hue for accent, so accent ink is the accent itself.
    // Collapsing it into primary ink would empty the role of its meaning.
    "--color-text-accent": "var(--color-accent)",
    "--color-icon-accent": "var(--color-accent)",
    "--color-overlay-hover": ["#1717170c", "#ffffff0c"],
    "--color-overlay-pressed": ["#17171719", "#ffffff19"],
    // The board draws a 4px corner on every element, half the step the radius
    // scale generates from `base: 4`, so the generated value is overridden.
    "--radius-element": "0.25rem",
    // Body copy is 20/32 at weight 300 on the board.
    "--font-weight-normal": "300",
    "--text-body-size": "1.25rem",
    "--text-body-leading": "2rem",
    "--text-body-weight": "300",
    "--focus-outline-color": "var(--color-text-primary)",
  },
  /**
   * Roles Astryx's semantic set has no name for. The board's sheet, its
   * wordmark face and its quieter inks each need a name of their own.
   */
  localTokens: {
    "--font-wordmark": "'IBM Plex Sans', system-ui, sans-serif",
    // `pasteboard` is the work surface the frame sits on, `guide` draws the
    // frame and ruler, and `grid` tints the sheet's graph paper one step below
    // the guides so the stock stays behind the copy.
    "--color-pasteboard": colorPair("pasteboard"),
    "--color-guide": colorPair("guide"),
    "--color-guide-strong": colorPair("guideStrong"),
    "--color-grid": colorPair("grid"),
    "--color-grid-strong": colorPair("gridStrong"),
    "--color-ink-muted": colorPair("muted"),
    "--color-ink-command": colorPair("command"),
  },
  components: {
    // Controls take the board's 4px corner and medium label.
    button: {
      base: { fontWeight: "500", borderRadius: "var(--radius-element)" },
    },
    // The phone menu belongs to the glass header. Painting the header surface
    // instead of a solid panel keeps the artwork faintly visible behind rows
    // that carry their own legible ink.
    popover: {
      base: {
        backgroundColor: "color-mix(in srgb, var(--color-background-body) 88%, transparent)",
        backgroundImage:
          "linear-gradient(var(--color-background-surface), var(--color-background-surface))",
        backdropFilter: "blur(var(--spacing-4))",
        borderRadius: "var(--radius-element)",
      },
    },
    "bottom-sheet": {
      base: { backgroundColor: "var(--color-background-card)" },
    },
  },
});
