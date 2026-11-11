import { VStack } from "@astryxdesign/core/VStack";

import { styles } from "./landing-styles";

/**
 * The construction grid behind the landing page. A single frame carries a
 * two-tier graph-paper grid: fine modules for scale and heavier 96px rules for
 * structure. The frame stands off the live area, so the grid never competes
 * with the type, and the page margins stay quiet.
 */
export function LandingGuides() {
  return (
    <VStack aria-hidden="true" style={styles.guides}>
      <VStack style={styles.guideFrame} />
    </VStack>
  );
}
