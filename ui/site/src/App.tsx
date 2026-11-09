import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { VStack } from "@astryxdesign/core/VStack";

import { defaultThemeSlug, themes } from "./astryx-themes";

export function App() {
  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <VStack gap={3} padding={6} maxWidth={640}>
        <Heading level={1}>trajs</Heading>
        <Text>
          A trajectory is the unit trajs stores, reads and analyses. This page is where the site
          starts, built with the Astryx design system.
        </Text>
        <Text type="supporting">
          Start every page from a template: `pnpm exec astryx build` reads the workflow, names the
          closest template, and lists the ones to fill it with.
        </Text>
        <Link href="https://astryx.atmeta.com/docs/getting-started" isExternalLink isStandalone>
          Astryx documentation
        </Link>
      </VStack>
    </Theme>
  );
}
