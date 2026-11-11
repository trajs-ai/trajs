import { VStack } from "@astryxdesign/core/VStack";

import { styles } from "./landing-styles";

// The ruler keeps one graduation per 24px module, a longer one every fourth
// module, and the longest every sixteenth, measured from the frame's
// top-left corner. Every mark shares the frame's 1px weight, so rank is
// carried by length and a step of color, and the scale stays a quiet margin
// note rather than a second border.
const RULER_MODULE = 24;
const RULER_HEIGHT = 20;

const graduations = [
  { every: RULER_MODULE, length: 6, color: "var(--color-guide)" },
  { every: RULER_MODULE * 4, length: 11, color: "var(--color-guide-strong)" },
  { every: RULER_MODULE * 16, length: 16, color: "var(--color-guide-strong)" },
] as const;

function RulerTicks({ edge }: { edge: "top" | "left" }) {
  const vertical = edge === "left";

  return (
    <svg
      aria-hidden="true"
      width={vertical ? RULER_HEIGHT : "100%"}
      height={vertical ? "100%" : RULER_HEIGHT}
      style={vertical ? styles.guideRulerLeft : styles.guideRulerTop}
    >
      <defs>
        {graduations.map(({ every, length, color }, index) => (
          <pattern
            key={every}
            id={`trajs-ruler-${edge}-${index}`}
            width={vertical ? RULER_HEIGHT : every}
            height={vertical ? every : RULER_HEIGHT}
            patternUnits="userSpaceOnUse"
            // Each tier opens one of its own graduations in, so the corner
            // node owns the datum and no mark doubles the node's outline.
            // It also puts every long mark on a bold grid line.
            patternTransform={vertical ? `translate(0 ${every})` : `translate(${every} 0)`}
          >
            <line
              // The stroke is centered on the pixel next to the tile edge
              // it grows from, so it lands crisp at 1:1 and meets the
              // frame's border without a seam or a half-pixel blur.
              x1={vertical ? RULER_HEIGHT - 0.5 : 0.5}
              x2={vertical ? RULER_HEIGHT - 0.5 - length : 0.5}
              y1={vertical ? 0.5 : RULER_HEIGHT - 0.5}
              y2={vertical ? 0.5 : RULER_HEIGHT - 0.5 - length}
              strokeWidth={1}
              strokeLinecap="round"
              style={{ stroke: color }}
            />
          </pattern>
        ))}
      </defs>
      {graduations.map(({ every }, index) => (
        <rect key={every} width="100%" height="100%" fill={`url(#trajs-ruler-${edge}-${index})`} />
      ))}
    </svg>
  );
}

// The sheet's graph paper: the ruler's 24px module repeats across the plate,
// with every fourth line stepped up so it reads as drafted stock instead of
// ruled notepaper. Both tiers are 1px and sit under the grain.
function SheetGrid() {
  return (
    <svg aria-hidden="true" width="100%" height="100%" style={styles.guideGrid}>
      <defs>
        <pattern
          id="trajs-sheet-grid-minor"
          width={RULER_MODULE}
          height={RULER_MODULE}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0.5 0V${RULER_MODULE}M0 0.5H${RULER_MODULE}`}
            strokeWidth={1}
            style={{ stroke: "var(--color-grid)" }}
          />
        </pattern>
        <pattern
          id="trajs-sheet-grid-major"
          width={RULER_MODULE * 4}
          height={RULER_MODULE * 4}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0.5 0V${RULER_MODULE * 4}M0 0.5H${RULER_MODULE * 4}`}
            strokeWidth={1}
            style={{ stroke: "var(--color-grid-strong)" }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#trajs-sheet-grid-minor)" />
      <rect width="100%" height="100%" fill="url(#trajs-sheet-grid-major)" />
    </svg>
  );
}

/**
 * The construction sheet behind the landing page: the page frame, its graph
 * paper, the margin ruler along the top and left edges, and the paper's
 * grain. The grid and the ruler share one 24px module, with every fourth
 * line stepped up, so the plate, the scale and the corner marks all measure
 * from the same origin. The ruler keeps a longer mark every 96px and the
 * longest every 384px, so the sheet is calibrated without a single line
 * entering the live area. The grain is clipped to the frame's own plate, so
 * the pasteboard around it stays plain.
 *
 * The corner marks live in `LandingMarks`, above this layer, so the masthead
 * can reach the plate's top edge.
 */
export function LandingGuides() {
  return (
    <VStack aria-hidden="true" style={styles.guides}>
      <VStack style={styles.guideFrame}>
        <SheetGrid />
        <VStack style={styles.grain} />
        <RulerTicks edge="top" />
        <RulerTicks edge="left" />
      </VStack>
    </VStack>
  );
}

/**
 * The four register marks that pin the frame's corners. They paint above the
 * content, because the sheet's top row is an opaque band that reaches the
 * frame's own edge.
 */
export function LandingMarks() {
  return (
    <VStack aria-hidden="true" style={styles.guideMarks}>
      <VStack style={styles.guideNodeTopLeft} />
      <VStack style={styles.guideNodeTopRight} />
      <VStack style={styles.guideNodeBottomLeft} />
      <VStack style={styles.guideNodeBottomRight} />
    </VStack>
  );
}
