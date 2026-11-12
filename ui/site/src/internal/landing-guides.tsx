import { VStack } from "@astryxdesign/core/VStack";

import { styles } from "./landing-styles";

// The ruler keeps one graduation per 24px module, a longer one every fourth
// module, and the longest every sixteenth, measured from the frame's
// top-left corner. Every mark shares the frame's 1px weight and one color, so
// rank is carried by length alone and the scale stays a quiet margin note
// rather than a second border.
const RULER_MODULE = 24;
const RULER_HEIGHT = 20;
const RULER_TILE = RULER_MODULE * 16;

// One tile holds the whole sixteenth-module period, so every graduation is
// drawn once: nested tiers would stack their alpha where a long mark sits on a
// short one and grad the scale from dark to light.
const graduations = Array.from(
  { length: RULER_TILE / RULER_MODULE },
  (_, index) => index * RULER_MODULE,
);

function markLength(offset: number) {
  if (offset % RULER_TILE === 0) return 16;

  return offset % (RULER_MODULE * 4) === 0 ? 11 : 6;
}

function RulerTicks({ edge }: { edge: "top" | "left" }) {
  const vertical = edge === "left";

  // The stroke is centered on the pixel next to the edge it grows from, so it
  // lands crisp at 1:1 and meets the frame's border without a seam or a
  // half-pixel blur.
  const marks = graduations.map((offset) => {
    const end = RULER_HEIGHT - 0.5 - markLength(offset);

    return vertical
      ? `M${RULER_HEIGHT - 0.5} ${offset + 0.5}H${end}`
      : `M${offset + 0.5} ${RULER_HEIGHT - 0.5}V${end}`;
  });

  return (
    <svg
      aria-hidden="true"
      width={vertical ? RULER_HEIGHT : "100%"}
      height={vertical ? "100%" : RULER_HEIGHT}
      style={vertical ? styles.guideRulerLeft : styles.guideRulerTop}
    >
      <defs>
        <pattern
          id={`trajs-ruler-${edge}`}
          width={vertical ? RULER_HEIGHT : RULER_TILE}
          height={vertical ? RULER_TILE : RULER_HEIGHT}
          patternUnits="userSpaceOnUse"
          // The tile opens one of its own graduations in, so the corner node
          // owns the datum and no mark doubles the node's outline. It also
          // puts every long mark on a bold grid line.
          patternTransform={vertical ? `translate(0 ${RULER_TILE})` : `translate(${RULER_TILE} 0)`}
        >
          <path
            d={marks.join("")}
            strokeWidth={1}
            strokeLinecap="round"
            style={{ stroke: "var(--color-guide)" }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#trajs-ruler-${edge})`} />
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
