import { VStack } from "@astryxdesign/core/VStack";

import { styles } from "./landing-styles";

/**
 * The construction grid behind the landing page. A single frame carries a
 * two-tier graph-paper grid: fine modules for scale and heavier 96px rules for
 * structure. A margin ruler repeats the same two intervals from the frame's
 * top edge, so the scale and the grid share one origin.
 */
export function LandingGuides() {
  return (
    <VStack aria-hidden="true" style={styles.guides}>
      <VStack style={styles.guideFrame}>
        <VStack style={styles.guideRuleMinor} />
        <VStack style={styles.guideRuleMajor} />
      </VStack>
    </VStack>
  );
}
