/**
 * The width where the tablet composition starts. The tablet hero is a fixed
 * 640px block inside 2 × 40px page padding, so 720 is the first width where it
 * fits without shrinking the block.
 */
export const tabletBreakpoint = 720;

/** The width where the position-sensitive desktop composition starts. */
export const desktopBreakpoint = 1440;

/**
 * The width of the Figma desktop board. Every size in the desktop composition
 * is drawn on this board: below it the whole composition scales down as one
 * unit, and at or above it the composition stops growing while the page
 * margins take all of the extra width.
 */
export const desktopBoardWidth = 1920;

/** The desktop board's content width: 1920 minus its two 5vw page margins. */
export const desktopContentWidth = desktopBoardWidth - 2 * (desktopBoardWidth * 0.05);
