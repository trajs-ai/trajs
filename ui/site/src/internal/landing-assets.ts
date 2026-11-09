import darkArrow from "../assets/figma/arrow.svg";
import darkArrowRight from "../assets/figma/icon-arrow-right20.svg";
import darkArrowUpRight from "../assets/figma/icon-arrow-up-right12.svg";
import darkCopy from "../assets/figma/icon-copy20.svg";
import darkRecord from "../assets/figma/icon.svg";
import darkAnalysis from "../assets/figma/icon1.svg";
import darkExchange from "../assets/figma/icon2.svg";
import lightArrow from "../assets/figma/light/arrow.svg";
import lightArrowRight from "../assets/figma/light/icon-arrow-right20.svg";
import lightArrowUpRight from "../assets/figma/light/icon-arrow-up-right12.svg";
import lightCopy from "../assets/figma/light/icon-copy20.svg";
import lightRecord from "../assets/figma/light/icon.svg";
import lightAnalysis from "../assets/figma/light/icon1.svg";
import lightExchange from "../assets/figma/light/icon2.svg";
import lightLogoMark from "../assets/figma/light/logo-mark.svg";
import lightPatternGrid from "../assets/figma/light/pattern-grid.svg";
import lightSegmentDark from "../assets/figma/light/segment-dark.svg";
import lightSun from "../assets/figma/light/sun.svg";
import lightSymbolFill from "../assets/figma/light/symbol-fill.svg";
import lightSymbolOutline from "../assets/figma/light/symbol-outline.svg";
import lightWordmark from "../assets/figma/light/wordmark.svg";
import darkLogoMark from "../assets/figma/logo-mark.svg";
import darkPatternGrid from "../assets/figma/pattern-grid.svg";
import darkSegmentDark from "../assets/figma/segment-dark.svg";
import darkSun from "../assets/figma/sun.svg";
import darkSymbolFill from "../assets/figma/symbol-fill.svg";
import darkSymbolOutline from "../assets/figma/symbol-outline.svg";
import darkWordmark from "../assets/figma/wordmark.svg";

export const landingAssets = {
  light: {
    arrow: lightArrow,
    arrowRight: lightArrowRight,
    arrowUpRight: lightArrowUpRight,
    copy: lightCopy,
    record: lightRecord,
    analysis: lightAnalysis,
    exchange: lightExchange,
    logoMark: lightLogoMark,
    patternGrid: lightPatternGrid,
    segmentDark: lightSegmentDark,
    sun: lightSun,
    symbolFill: lightSymbolFill,
    symbolOutline: lightSymbolOutline,
    wordmark: lightWordmark,
  },
  dark: {
    arrow: darkArrow,
    arrowRight: darkArrowRight,
    arrowUpRight: darkArrowUpRight,
    copy: darkCopy,
    record: darkRecord,
    analysis: darkAnalysis,
    exchange: darkExchange,
    logoMark: darkLogoMark,
    patternGrid: darkPatternGrid,
    segmentDark: darkSegmentDark,
    sun: darkSun,
    symbolFill: darkSymbolFill,
    symbolOutline: darkSymbolOutline,
    wordmark: darkWordmark,
  },
} as const;
