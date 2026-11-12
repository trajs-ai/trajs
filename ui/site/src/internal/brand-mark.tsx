import { VStack } from "@astryxdesign/core/VStack";
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";

const ShaderFill = lazy(async () => {
  const module = await import("@figma/expressive-components");

  return { default: module.ShaderFill };
});

type BrandShader = ComponentProps<typeof ShaderFill>["shader"];

// The exported `symbol-outline.svg` path, one string per subpath. Splitting it
// lets `pathLength` normalize every edge to unit length, so the wireframe
// closes as one figure instead of its short struts landing long before the
// diagonals do.
const outline = [
  "M253.662 312.679H3.66172V3.66172H312.679",
  "M253.662 312.679H503.662V3.66172H312.679",
  "M312.679 3.66172L3.66172 312.679",
  "M312.679 3.66172L408.17 158.17",
  "M503.662 312.679L408.17 158.17",
  "M253.662 312.679L408.17 158.17",
];

// Only a live path can be drawn on, so the outline is inline rather than an
// image: `pathLength` plus a dash pattern the length of the path turns the
// stroke into a pen that stops wherever the offset says. The theme's ink
// replaces the two exported fills, which carry those same two colors.
function BrandOutline({ started, onDrawn }: { started: boolean; onDrawn: () => void }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 507.323 316.34"
      preserveAspectRatio="none"
      overflow="visible"
      className="landing-outline"
    >
      <g
        className={
          started ? "landing-outline-path landing-outline-path--started" : "landing-outline-path"
        }
        onTransitionEnd={(event) => {
          if (event.propertyName === "stroke-dashoffset") onDrawn();
        }}
      >
        {outline.map((d) => (
          <path key={d} d={d} pathLength={1} />
        ))}
      </g>
    </svg>
  );
}

// The shader module and its GPU setup finish after the first paint, so the mark
// fills in behind the header's blur instead of appearing all at once. The
// canvas mounts transparent and reveals on the next frame, which gives the
// transition a painted start state to move away from.

// `ShaderFill` gives its canvas inline `width` and `height` of 100%, then merges
// the caller's style after them, so a class cannot set the shader's own box.
// Losing that box stretches the canvas across the mask wrapper and moves the
// fill away from the figure the lines closed.
const shaderBox: CSSProperties = {
  width: "76.5708%",
  height: "130.6006%",
  left: "11.7146%",
  top: "-15.3003%",
};

function ShaderReveal({ shader, revealed }: { shader: BrandShader; revealed: boolean }) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!revealed) return;

    const frame = requestAnimationFrame(() => setSettled(true));

    return () => cancelAnimationFrame(frame);
  }, [revealed]);

  return (
    <ShaderFill
      shader={shader}
      className={settled ? "landing-shader landing-shader--settled" : "landing-shader"}
      style={shaderBox}
    />
  );
}

/**
 * The hero's mark, drawn in two beats. The paper island fades up while the
 * wireframe etches itself on, then the shader settles into the figure the lines
 * closed. The fill waits for the draw to end rather than for a copy of its
 * duration, so retiming either beat keeps the order. Reduced motion renders the
 * finished mark at once.
 */
export function BrandMark({
  mask,
  shader,
  reducesMotion,
}: {
  mask: string;
  shader: BrandShader;
  reducesMotion: boolean;
}) {
  const [started, setStarted] = useState(reducesMotion);
  const [drawn, setDrawn] = useState(false);

  // The plate and the path paint their untouched state first, so both
  // transitions have a start value to move away from.
  useEffect(() => {
    if (reducesMotion) return;

    const frame = requestAnimationFrame(() => setStarted(true));

    return () => cancelAnimationFrame(frame);
  }, [reducesMotion]);

  return (
    <>
      <VStack
        className={
          started ? "landing-symbol-plate landing-symbol-plate--started" : "landing-symbol-plate"
        }
      >
        <VStack className="landing-grain" />
      </VStack>
      <VStack
        className="landing-symbol-mask"
        // SAFETY: React's CSSProperties has no index signature for custom
        // properties, but every `--*` key is a valid declaration at runtime.
        style={{ "--landing-symbol-mask": `url("${mask}")` } as CSSProperties}
      >
        <Suspense fallback={null}>
          <ShaderReveal shader={shader} revealed={drawn || reducesMotion} />
        </Suspense>
      </VStack>
      <BrandOutline started={started} onDrawn={() => setDrawn(true)} />
    </>
  );
}
