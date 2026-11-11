import { VStack } from "@astryxdesign/core/VStack";

import { styles } from "./landing-styles";

/**
 * The construction sheet behind the landing page: the page frame and the
 * margin ruler. The ruler keeps one tick per 24px module and a longer mark
 * every 96px, both measured from the frame's top edge.
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
