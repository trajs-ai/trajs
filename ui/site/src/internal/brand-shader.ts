import type { Shader } from "@figma/expressive-components";

import { palette, type ColorMode } from "../themes/trajs/palette";
import {
  manifest,
  render,
  setup,
} from "./lib/custom-effects/CodeComponentId_f53e22406c2430640cabdd5b386c7e02089096e0_0a6f51f8ea068112f0f81ff766dff88806a26fbb";

function pigment(hex: string) {
  return {
    r: Math.fround(Number.parseInt(hex.slice(1, 3), 16) / 255),
    g: Math.fround(Number.parseInt(hex.slice(3, 5), 16) / 255),
    b: Math.fround(Number.parseInt(hex.slice(5, 7), 16) / 255),
    a: 1,
  };
}

function createBrandShader(mode: ColorMode): Shader {
  const colors = palette[mode];

  return {
    setup,
    render,
    manifest,
    params: {
      cloudScale: 1,
      flow: 0.6000000238418579,
      fieldLayout: {
        x: 46.13557434082031,
        y: 56.589420318603516,
        radius: 57.56120681762695,
        angle: 100.59839630126953,
      },
      apricot: pigment(colors.markApricot),
      layering: 0.6499999761581421,
      cloudSoftness: 0.7200000286102295,
      cloudStrength: 0.3499999940395355,
      preset: 0,
      flowDirection: 32,
      motionSpeed: 3,
      coral: pigment(colors.markCoral),
      golden: pigment(colors.markGolden),
      grainSize: 0.699999988079071,
      grainStrength: 0.18000000715255737,
      driftAmount: 1,
      seed: 42,
    },
  };
}

export const brandShaders = { light: createBrandShader("light"), dark: createBrandShader("dark") };

export const stillBrandShaders = {
  light: { ...brandShaders.light, manifest: { ...manifest, isAnimated: false } },
  dark: { ...brandShaders.dark, manifest: { ...manifest, isAnimated: false } },
};
