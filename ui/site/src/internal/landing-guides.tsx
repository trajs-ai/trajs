import { VStack } from "@astryxdesign/core/VStack";

import { styles } from "./landing-styles";

/**
 * The construction sheet behind the landing page: the page frame, the margin
 * ruler along its top and left edges, and the paper's grain. The ruler keeps
 * one tick per 24px module and a longer mark every 96px, measured from the
 * frame's top-left corner, so the sheet is calibrated without a single line
 * entering the live area. The grain is clipped to the frame's own plate, so
 * the pasteboard around it stays plain.
 */
export function LandingGuides() {
  return (
    <VStack aria-hidden="true" style={styles.guides}>
      <VStack style={styles.guideFrame}>
        <VStack style={styles.grain} />
        <VStack style={styles.guideRuleMinor} />
        <VStack style={styles.guideRuleMajor} />
        <VStack style={styles.guideRuleTopMinor} />
        <VStack style={styles.guideRuleTopMajor} />
      </VStack>
    </VStack>
  );
}
