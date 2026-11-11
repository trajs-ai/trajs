import { VStack } from "@astryxdesign/core/VStack";

import { styles } from "./landing-styles";

/**
 * The construction sheet behind the landing page: the page frame, the margin
 * ruler and the crop brackets. Every line is drawn from the same page tokens
 * the content uses, and the frame stands off the live area so the sheet never
 * crowds the type.
 */
export function LandingGuides() {
  return (
    <VStack aria-hidden="true" style={styles.guides}>
      <VStack style={styles.guideFrame}>
        <VStack style={styles.guideRuleMinor} />
        <VStack style={styles.guideRuleMajor} />
        <VStack style={styles.cropTopLeft} />
        <VStack style={styles.cropTopRight} />
        <VStack style={styles.cropBottomLeft} />
        <VStack style={styles.cropBottomRight} />
      </VStack>
    </VStack>
  );
}

/**
 * The index's column guides. They run down the middle of each gutter, so they
 * divide the three columns without ever touching a line of copy.
 */
export function IndexGuides() {
  return (
    <VStack aria-hidden="true" style={styles.indexGuides}>
      <VStack style={{ ...styles.indexGuide, ...styles.indexGuideFirst }} />
      <VStack style={{ ...styles.indexGuide, ...styles.indexGuideSecond }} />
    </VStack>
  );
}
