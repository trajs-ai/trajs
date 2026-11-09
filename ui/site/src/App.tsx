import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { VStack } from "@astryxdesign/core/VStack";
import { lazy, Suspense, useEffect, useState } from "react";

import { defaultThemeSlug, themes } from "./astryx-themes";
import { brandShaders, stillBrandShaders } from "./internal/brand-shader";
import { landingAssets } from "./internal/landing-assets";
import { styles } from "./internal/landing-styles";
import { palette, type ColorMode } from "./themes/trajs/palette";

const repository = "https://github.com/trajs-ai/trajs";
const installCommand = "pnpm i effect @trajs/core";

const ShaderFill = lazy(async () => {
  const module = await import("@figma/expressive-components");

  return { default: module.ShaderFill };
});

const navigation = [
  { label: "DOCS", href: `${repository}#readme` },
  { label: "EXAMPLES", href: `${repository}/tree/main/examples` },
  { label: "BLOG", href: `${repository}/discussions` },
  { label: "CHANGELOG", href: `${repository}/blob/main/packages/core/CHANGELOG.md` },
  { label: "GITHUB", href: repository },
];

const features = [
  {
    title: "RECORD",
    icon: "record",
    description: "Capture every thought, tool call and observation as a typed, timestamped step.",
    link: navigation[0],
  },
  {
    title: "ANALYSIS",
    icon: "analysis",
    description: "Replay any run, diff two trajectories, and profile tokens, latency and cost.",
    link: navigation[1],
  },
  {
    title: "EXCHANGE",
    icon: "exchange",
    description: "One portable file. Share a link, export to JSONL, or open it in any runtime.",
    link: navigation[2],
  },
] as const;

export function App() {
  const [mode, setMode] = useState<ColorMode>(() => {
    try {
      return localStorage.getItem("trajs-color-mode") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  const [reducesMotion, setReducesMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const assets = landingAssets[mode];
  const shader = (reducesMotion ? stillBrandShaders : brandShaders)[mode];
  const [copyStatus, setCopyStatus] = useState("");
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const update = () => setHeaderVisible(window.scrollY > 64);
    update();
    window.addEventListener("scroll", update, { passive: true });

    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducesMotion(query.matches);
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    if (themeColor) themeColor.content = palette[mode].canvas;

    try {
      localStorage.setItem("trajs-color-mode", mode);
    } catch {
      /* The selected mode still applies when browser storage is unavailable. */
    }
  }, [mode]);

  useEffect(() => {
    if (!copyStatus) return;
    const timer = window.setTimeout(() => setCopyStatus(""), 2500);

    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  async function copyInstallCommand() {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopyStatus("Install command copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select the command to copy it manually.");
    }
  }

  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      <VStack as="main" style={styles.page}>
        <img src={assets.patternGrid} alt="" aria-hidden="true" style={styles.grid} />
        <HStack
          as="header"
          hAlign="between"
          vAlign="center"
          wrap="wrap"
          gap={4}
          style={{
            ...styles.header,
            opacity: headerVisible ? 1 : 0,
            filter: headerVisible ? "blur(0)" : "blur(var(--landing-header-blur))",
            transform: headerVisible ? "translateY(0)" : "translateY(var(--landing-header-offset))",
            pointerEvents: headerVisible ? "auto" : "none",
            transition: reducesMotion ? "none" : "var(--landing-header-transition)",
          }}
          inert={!headerVisible}
          aria-hidden={!headerVisible}
        >
          <Link href={import.meta.env.BASE_URL} color="inherit" type="inherit">
            <HStack gap={2} vAlign="center" style={styles.brand}>
              <img src={assets.logoMark} alt="" style={styles.brandMark} />
              <Text type="inherit">TRAJS</Text>
            </HStack>
          </Link>
          <HStack
            as="nav"
            aria-label="Main navigation"
            wrap="wrap"
            vAlign="center"
            style={styles.nav}
          >
            {navigation.map(({ label, href }) => (
              <Link key={label} href={href} color="inherit" type="inherit" style={styles.navLink}>
                <HStack gap={1.5} vAlign="center">
                  <Text type="inherit">{label}</Text>
                  {label === "GITHUB" && <img src={assets.arrow} alt="" style={styles.inkAsset} />}
                </HStack>
              </Link>
            ))}
          </HStack>
          <HStack vAlign="center" style={styles.toggle} role="group" aria-label="Color theme">
            <IconButton
              label="Use light theme"
              tooltip="Light theme"
              size="sm"
              variant="ghost"
              style={{ ...styles.themeSegment, backgroundColor: "var(--color-segment-light)" }}
              aria-pressed={mode === "light"}
              onClick={() => setMode("light")}
              icon={<img src={assets.sun} alt="" style={styles.inkAsset} />}
            />
            <IconButton
              label="Use dark theme"
              tooltip="Dark theme"
              size="sm"
              variant="ghost"
              style={{ ...styles.themeSegment, backgroundColor: "var(--color-segment-dark)" }}
              aria-pressed={mode === "dark"}
              onClick={() => setMode("dark")}
              icon={<img src={assets.segmentDark} alt="" style={styles.inkAsset} />}
            />
          </HStack>
        </HStack>
        <Grid columns={2} align="start" style={styles.hero}>
          <VStack style={styles.headline}>
            <Heading level={1} type="display-1" style={styles.heading}>
              <Text as="span" display="block" type="inherit" style={styles.headlineLine}>
                Record.
              </Text>
              <Text as="span" display="block" type="inherit" style={styles.analysisLine}>
                Analysis.
              </Text>
              <Text as="span" display="block" type="inherit" style={styles.headlineLine}>
                Exchange.
              </Text>
            </Heading>
          </VStack>
          <VStack style={styles.art}>
            <VStack role="img" aria-label="TRAJS" style={styles.lockup}>
              <VStack style={styles.symbol} aria-hidden="true">
                <VStack style={{ ...styles.symbolMask, maskImage: `url("${assets.symbolFill}")` }}>
                  <Suspense fallback={null}>
                    <ShaderFill shader={shader} style={styles.shader} />
                  </Suspense>
                </VStack>
                <img src={assets.symbolOutline} alt="" style={styles.outline} />
              </VStack>
              <img src={assets.wordmark} alt="" style={styles.wordmark} />
            </VStack>
            <HStack wrap="wrap" vAlign="center" style={styles.ctas}>
              <Button
                label="Get started"
                href={navigation[0].href}
                variant="primary"
                size="lg"
                endContent={<img src={assets.arrowRight} alt="" style={styles.inkAsset} />}
              />
              <HStack gap={3} vAlign="center" style={styles.command}>
                <Text type="code" style={styles.prompt} aria-hidden="true">
                  $
                </Text>
                <Text as="p" type="code" style={styles.commandText}>
                  {installCommand}
                </Text>
                <IconButton
                  label="Copy install command"
                  tooltip="Copy command"
                  variant="ghost"
                  size="sm"
                  onClick={copyInstallCommand}
                  icon={<img src={assets.copy} alt="" style={styles.inkAsset} />}
                />
              </HStack>
            </HStack>
          </VStack>
        </Grid>
        <Grid aria-label="Explore TRAJS" columns={3} style={styles.index}>
          {features.map(({ title, icon, description, link }) => (
            <VStack as="article" gap={5} key={title} style={styles.indexItem}>
              <HStack gap={2} vAlign="center">
                <img src={assets[icon]} alt="" style={styles.inkAsset} />
                <Heading level={2}>{title}</Heading>
              </HStack>
              <Text as="p" color="secondary" style={styles.indexBody}>
                {description}
              </Text>
              <Link href={link.href} color="inherit" type="inherit" style={styles.indexLink}>
                <HStack gap={2} vAlign="center">
                  <Text type="inherit">{link.label}</Text>
                  <img src={assets.arrowUpRight} alt="" style={styles.inkAsset} />
                </HStack>
              </Link>
            </VStack>
          ))}
        </Grid>
        <Text as="p" role="status" aria-live="polite" style={styles.status}>
          {copyStatus}
        </Text>
      </VStack>
    </Theme>
  );
}
