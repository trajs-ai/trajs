import darkArrow from "../assets/figma/arrow.svg";
import darkArrowRight from "../assets/figma/icon-arrow-right20.svg";
import darkArrowUpRight from "../assets/figma/icon-arrow-up-right12.svg";
import darkCopy from "../assets/figma/icon-copy20.svg";
import lightArrow from "../assets/figma/light/arrow.svg";
import lightArrowRight from "../assets/figma/light/icon-arrow-right20.svg";
import lightArrowUpRight from "../assets/figma/light/icon-arrow-up-right12.svg";
import lightCopy from "../assets/figma/light/icon-copy20.svg";
import lightLogoMark from "../assets/figma/light/logo-mark.svg";
import lightSymbolFill from "../assets/figma/light/symbol-fill.svg";
import lightWordmark from "../assets/figma/light/wordmark.svg";
import darkLogoMark from "../assets/figma/logo-mark.svg";
import darkSymbolFill from "../assets/figma/symbol-fill.svg";
import darkWordmark from "../assets/figma/wordmark.svg";

export const landingAssets = {
  light: {
    arrow: lightArrow,
    arrowRight: lightArrowRight,
    arrowUpRight: lightArrowUpRight,
    copy: lightCopy,
    logoMark: lightLogoMark,
    symbolFill: lightSymbolFill,
    wordmark: lightWordmark,
  },
  dark: {
    arrow: darkArrow,
    arrowRight: darkArrowRight,
    arrowUpRight: darkArrowUpRight,
    copy: darkCopy,
    logoMark: darkLogoMark,
    symbolFill: darkSymbolFill,
    wordmark: darkWordmark,
  },
} as const;
