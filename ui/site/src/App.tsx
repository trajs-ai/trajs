import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { Popover } from "@astryxdesign/core/Popover";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { VStack } from "@astryxdesign/core/VStack";
import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";

import { defaultThemeSlug, themes } from "./astryx-themes";
import { brandShaders, stillBrandShaders } from "./internal/brand-shader";
import { landingAssets } from "./internal/landing-assets";
import { LandingGuides } from "./internal/landing-guides";
import { styles } from "./internal/landing-styles";
import { palette, type ColorMode } from "./themes/trajs/palette";

const repository = "https://github.com/trajs-ai/trajs";
const installCommand = "pnpm i effect @trajs/core";

const ShaderFill = lazy(async () => {
  const module = await import("@figma/expressive-components");

  return { default: module.ShaderFill };
});

// The shader module and its GPU setup finish after the first paint, so the mark
// fills in behind the header's blur instead of appearing all at once. The
// canvas mounts transparent and reveals on the next frame, which gives the
// transition a painted start state to move away from.
function ShaderReveal({
  shader,
  reducesMotion,
}: {
  shader: ComponentProps<typeof ShaderFill>["shader"];
  reducesMotion: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <ShaderFill
      shader={shader}
      style={{
        ...styles.shader,
        opacity: revealed ? 1 : 0,
        filter: revealed ? "blur(0)" : "blur(var(--landing-shader-blur))",
        transition: reducesMotion ? "none" : "var(--landing-shader-transition)",
      }}
    />
  );
}

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

const license = `${repository}/blob/main/LICENSE`;

// The index already names the three ideas; the footer names where to read
// about them and where the project lives.
const footerGroups = [
  {
    title: "RESOURCES",
    label: "Resources",
    links: [
      { label: "DOCUMENTATION", href: `${repository}#readme` },
      { label: "EXAMPLES", href: `${repository}/tree/main/examples` },
      { label: "CHANGELOG", href: `${repository}/blob/main/packages/core/CHANGELOG.md` },
    ],
  },
  {
    title: "COMMUNITY",
    label: "Community",
    links: [
      { label: "GITHUB", href: repository },
      { label: "DISCUSSIONS", href: `${repository}/discussions` },
      { label: "ISSUES", href: `${repository}/issues` },
    ],
  },
] as const;

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2.075" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M6 0.7V1.95M6 10.05V11.3M0.7 6H1.95M10.05 6H11.3M2.26 2.26L3.13 3.13M9.74 2.26L8.87 3.13M2.26 9.74L3.13 8.87M9.74 9.74L8.87 8.87"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="6.9375 6.9375 10.125 10.125"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.4697 6.93701C9.85399 7.73187 9.4873 8.72972 9.4873 9.81299C9.48741 12.4086 11.5918 14.5132 14.1875 14.5132C15.2709 14.5132 16.2676 14.1447 17.0625 13.5288C16.3678 15.5831 14.4265 17.0629 12.1377 17.063C9.26581 17.063 6.9375 14.7347 6.9375 11.8628C6.9375 9.57437 8.41605 7.63211 10.4697 6.93701Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={styles.commandIcon}
    >
      <path
        d="M4.75 10.5L8.25 14L15.25 6.5"
        stroke="currentColor"
        strokeWidth="1.7923"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
      <rect width="20" height="2" fill="currentColor" />
      <rect y="8" width="20" height="2" fill="currentColor" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 10.5V1.5M2 5.5L6 1.5L10 5.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [installCopied, setInstallCopied] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Every breakpoint keeps the header fixed to the page frame and reveals it
  // after scrolling.
  const chromeVisible = headerVisible;

  useEffect(() => {
    const update = () => setHeaderVisible(window.scrollY > 64);
    update();
    window.addEventListener("scroll", update, { passive: true });

    return () => window.removeEventListener("scroll", update);
  }, []);

  // The menu renders outside the header, so hiding the header closes it.
  useEffect(() => {
    if (!chromeVisible) setMenuOpen(false);
  }, [chromeVisible]);

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

  // The icon's copied state lasts exactly as long as its announcement, so the
  // two never disagree.
  useEffect(() => {
    if (!copyStatus) return;

    const timer = window.setTimeout(() => {
      setCopyStatus("");
      setInstallCopied(false);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  async function copyInstallCommand() {
    try {
      await navigator.clipboard.writeText(installCommand);
      setInstallCopied(true);
      setCopyStatus("Install command copied.");
    } catch {
      setInstallCopied(false);
      setCopyStatus("Copy unavailable. Select the command to copy it manually.");
    }
  }

  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      <VStack id="top" style={styles.page}>
        <VStack as="main" style={styles.sheet}>
          <LandingGuides />
          <HStack
            as="header"
            vAlign="center"
            gap={4}
            style={{
              ...styles.header,
              opacity: chromeVisible ? 1 : 0,
              filter: chromeVisible ? "blur(0)" : "blur(var(--landing-header-blur))",
              pointerEvents: chromeVisible ? "auto" : "none",
              transition: reducesMotion ? "none" : "var(--landing-header-transition)",
            }}
            inert={!chromeVisible}
            aria-hidden={!chromeVisible}
          >
            <Link href={import.meta.env.BASE_URL} color="inherit" type="inherit">
              <HStack gap={2} vAlign="center" style={styles.brand}>
                <img src={assets.logoMark} alt="" style={styles.brandMark} />
                <Text type="inherit">TRAJS</Text>
              </HStack>
            </Link>
            <HStack vAlign="center" style={styles.headerEnd}>
              <HStack as="nav" aria-label="Main navigation" vAlign="center" style={styles.nav}>
                {navigation.map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    color="inherit"
                    type="inherit"
                    style={
                      label === "CHANGELOG"
                        ? { ...styles.navLink, ...styles.changelog }
                        : styles.navLink
                    }
                  >
                    <HStack gap={1.5} vAlign="center">
                      <Text type="inherit">{label}</Text>
                      {label === "GITHUB" && (
                        <img src={assets.arrow} alt="" style={styles.inkAsset} />
                      )}
                    </HStack>
                  </Link>
                ))}
              </HStack>
              <IconButton
                label={mode === "dark" ? "Use light theme" : "Use dark theme"}
                size="sm"
                variant="ghost"
                style={styles.themeToggle}
                onClick={() => setMode(mode === "dark" ? "light" : "dark")}
                icon={mode === "dark" ? <SunIcon /> : <MoonIcon />}
              />
              <Popover
                isOpen={menuOpen}
                onOpenChange={setMenuOpen}
                label="Menu"
                placement="below"
                alignment="end"
                width={224}
                padding={1}
                content={
                  <VStack gap={0.5}>
                    {navigation.map(({ label, href }) => (
                      <Link
                        key={label}
                        href={href}
                        color="inherit"
                        type="inherit"
                        style={styles.menuLink}
                        onClick={() => setMenuOpen(false)}
                      >
                        <HStack hAlign="between" vAlign="center" gap={3}>
                          <Text type="inherit" style={styles.menuLabel}>
                            {label}
                          </Text>
                          <img src={assets.arrowUpRight} alt="" style={styles.inkAsset} />
                        </HStack>
                      </Link>
                    ))}
                  </VStack>
                }
              >
                <IconButton
                  label="Open menu"
                  variant="ghost"
                  size="sm"
                  style={{
                    ...styles.menuButton,
                    background: menuOpen ? "var(--color-overlay-pressed)" : undefined,
                  }}
                  icon={<MenuIcon />}
                />
              </Popover>
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
                  <VStack
                    style={{ ...styles.symbolMask, maskImage: `url("${assets.symbolFill}")` }}
                  >
                    <Suspense fallback={null}>
                      <ShaderReveal shader={shader} reducesMotion={reducesMotion} />
                    </Suspense>
                  </VStack>
                  <img src={assets.symbolOutline} alt="" style={styles.outline} />
                </VStack>
                <img src={assets.wordmark} alt="" style={styles.wordmark} />
              </VStack>
            </VStack>
            <HStack vAlign="center" style={styles.ctas}>
              <Button
                label="Get started"
                href={navigation[0].href}
                variant="primary"
                size="lg"
                style={styles.action}
                endContent={<img src={assets.arrowRight} alt="" style={styles.actionIcon} />}
              />
              <ClickableCard
                label={`Copy install command: ${installCommand}`}
                onClick={copyInstallCommand}
                variant="transparent"
                padding={0}
                style={styles.command}
              >
                <Text type="code" style={styles.prompt} aria-hidden="true">
                  $
                </Text>
                <Text as="p" type="code" style={styles.commandText}>
                  {installCommand}
                </Text>
                {installCopied ? (
                  <CheckIcon />
                ) : (
                  <img src={assets.copy} alt="" style={styles.inkAsset} />
                )}
              </ClickableCard>
            </HStack>
          </Grid>
          <VStack style={styles.indexSection}>
            <Grid aria-label="Explore TRAJS" columns={3} style={styles.index}>
              {features.map(({ title, icon, description, link }) => (
                <VStack as="article" key={title} style={styles.indexItem}>
                  <HStack gap={2} vAlign="center" style={styles.indexHead}>
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
          </VStack>
          <Text as="p" role="status" aria-live="polite" style={styles.status}>
            {copyStatus}
          </Text>
        </VStack>
        <VStack as="footer" style={styles.footer}>
          <Grid columns={3} style={styles.footerIndex}>
            <VStack style={styles.footerBrand}>
              <Link href={import.meta.env.BASE_URL} color="inherit" type="inherit">
                <HStack gap={2} vAlign="center" style={styles.brand}>
                  <img src={assets.logoMark} alt="" style={styles.brandMark} />
                  <Text type="inherit">TRAJS</Text>
                </HStack>
              </Link>
              <Text as="p" color="secondary" style={styles.footerAbout}>
                Record, analyze and exchange agent trajectories.
              </Text>
            </VStack>
            {footerGroups.map((group) => (
              <VStack
                as="nav"
                key={group.title}
                aria-label={group.label}
                style={styles.footerGroup}
              >
                <Heading level={2}>{group.title}</Heading>
                <VStack style={styles.footerLinks}>
                  {group.links.map(({ label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      color="inherit"
                      type="inherit"
                      style={styles.footerLink}
                    >
                      <HStack gap={1.5} vAlign="center">
                        <Text type="inherit">{label}</Text>
                        <img src={assets.arrowUpRight} alt="" style={styles.inkAsset} />
                      </HStack>
                    </Link>
                  ))}
                </VStack>
              </VStack>
            ))}
          </Grid>
          <HStack vAlign="center" hAlign="between" wrap="wrap" style={styles.footerLegal}>
            <HStack vAlign="center" wrap="wrap" style={styles.footerMeta}>
              <Text type="code" style={styles.footerLegalText}>
                © {new Date().getFullYear()} TRAJS
              </Text>
              <Link href={license} color="inherit" type="inherit" style={styles.footerLegalLink}>
                <HStack gap={1.5} vAlign="center">
                  <Text type="inherit" style={styles.footerLegalLabel}>
                    MIT LICENSE
                  </Text>
                  <img src={assets.arrowUpRight} alt="" style={styles.inkAsset} />
                </HStack>
              </Link>
            </HStack>
            <Link href="#top" color="inherit" type="inherit" style={styles.footerLegalLink}>
              <HStack gap={1.5} vAlign="center">
                <Text type="inherit" style={styles.footerLegalLabel}>
                  BACK TO TOP
                </Text>
                <ArrowUpIcon />
              </HStack>
            </Link>
          </HStack>
        </VStack>
      </VStack>
    </Theme>
  );
}
