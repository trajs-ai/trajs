export const palette = {
  light: {
    canvas: "#eeeeee",
    pasteboard: "#e2e2e2",
    guide: "#17171733",
    guideStrong: "#17171745",
    ink: "#171717",
    secondary: "#5f5f66",
    muted: "#6b6b70",
    subtle: "#5f5f66",
    quiet: "#7b7b80",
    command: "#353539",
    action: "#171717",
    onAction: "#ffffff",
    glass: "#ffffff33",
    control: "#0000000f",
    controlBorder: "#0000001f",
    border: "#1717171f",
    borderStrong: "#1717172e",
    markCoral: "#ff908c",
    markApricot: "#ffb378",
    markGolden: "#ffd21b",
  },
  dark: {
    canvas: "#171717",
    pasteboard: "#0d0d0d",
    guide: "#ffffff24",
    guideStrong: "#ffffff3d",
    ink: "#f2f2ef",
    secondary: "#9c9ca3",
    muted: "#c4c4ca",
    subtle: "#8a8a91",
    quiet: "#6e6e75",
    command: "#e4e4e2",
    action: "#f2f2ef",
    onAction: "#0b0b0c",
    glass: "#ffffff14",
    control: "#ffffff1f",
    controlBorder: "#ffffff21",
    border: "#ffffff1f",
    borderStrong: "#ffffff38",
    markCoral: "#0f69be",
    markApricot: "#9b9954",
    markGolden: "#f4bd22",
  },
} as const;

export type ColorMode = keyof typeof palette;

export function colorPair(role: keyof typeof palette.light): [string, string] {
  return [palette.light[role], palette.dark[role]];
}
