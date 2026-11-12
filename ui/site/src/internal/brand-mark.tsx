import { VStack } from "@astryxdesign/core/VStack";
import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";

import { styles } from "./landing-styles";

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
function BrandOutline({
  started,
  reducesMotion,
  onDrawn,
}: {
  started: boolean;
  reducesMotion: boolean;
  onDrawn: () => void;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 507.323 316.34"
      preserveAspectRatio="none"
      overflow="visible"
      style={styles.outline}
    >
      <g
        fill="none"
        stroke="var(--color-text-primary)"
        strokeWidth={7.32345}
        style={{
          strokeDasharray: "1 1",
          strokeDashoffset: started ? 0 : 1,
          transition: reducesMotion ? "none" : "var(--landing-mark-transition)",
        }}
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
function ShaderReveal({
  shader,
  reducesMotion,
  revealed,
}: {
  shader: BrandShader;
  reducesMotion: boolean;
  revealed: boolean;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!revealed) return;

    const frame = requestAnimationFrame(() => setSettled(true));

    return () => cancelAnimationFrame(frame);
  }, [revealed]);

  return (
    <ShaderFill
      shader={shader}
      style={{
        ...styles.shader,
        opacity: settled ? 1 : 0,
        filter: settled ? "blur(0)" : "blur(var(--landing-shader-blur))",
        transition: reducesMotion ? "none" : "var(--landing-shader-transition)",
      }}
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
        style={{
          ...styles.symbolPlate,
          opacity: started ? 1 : 0,
          transition: reducesMotion ? "none" : "var(--landing-mark-transition)",
        }}
      >
        <VStack style={styles.grain} />
      </VStack>
      <VStack style={{ ...styles.symbolMask, maskImage: `url("${mask}")` }}>
        <Suspense fallback={null}>
          <ShaderReveal
            shader={shader}
            reducesMotion={reducesMotion}
            revealed={drawn || reducesMotion}
          />
        </Suspense>
      </VStack>
      <BrandOutline
        started={started}
        reducesMotion={reducesMotion}
        onDrawn={() => setDrawn(true)}
      />
    </>
  );
}
