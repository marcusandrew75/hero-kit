import { BackgroundState } from './types';

export interface BuiltInPreset {
  name: string;
  description: string;
  emoji: string;
  state: Partial<BackgroundState>;
}

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    name: 'Analog Film',
    description: 'Vellichor grade · heavy grain · vignette',
    emoji: '📽',
    state: {
      colorGradeEnabled: true, colorGradePreset: 'vellichor', colorGradeStrength: 0.9,
      noiseOpacity: 0.22, noiseColor: '#ffffff',
      vignetteStrength: 0.42, imageMask: 'radial',
      patternStyle: 'none', ditherStyle: 'none',
      dispersionEnabled: false, pixelSortEnabled: false,
      channelSmearEnabled: false, warpEnabled: false,
      imageGlitchEnabled: false,
    },
  },
  {
    name: 'Polaroid',
    description: 'Warm lifted tones · soft vignette · grain',
    emoji: '🟨',
    state: {
      colorGradeEnabled: true, colorGradePreset: 'polaroid', colorGradeStrength: 1,
      noiseOpacity: 0.18, noiseColor: '#ffffff',
      vignetteStrength: 0.3, imageMask: 'radial',
      patternStyle: 'none', ditherStyle: 'none',
      dispersionEnabled: false, pixelSortEnabled: false,
      channelSmearEnabled: false, warpEnabled: false,
      imageGlitchEnabled: false,
    },
  },
  {
    name: 'Disperse',
    description: 'Golden hour · particle scatter upward',
    emoji: '✦',
    state: {
      colorGradeEnabled: true, colorGradePreset: 'golden-hour', colorGradeStrength: 1,
      dispersionEnabled: true, dispersionStrength: 80, dispersionThreshold: 130,
      dispersionDirection: 'up', dispersionSpread: 0.5,
      noiseOpacity: 0.1, vignetteStrength: 0.25,
      patternStyle: 'none', ditherStyle: 'none',
      pixelSortEnabled: false, channelSmearEnabled: false, warpEnabled: false,
      imageGlitchEnabled: false,
    },
  },
  {
    name: 'Oil Paint',
    description: 'Warp · pixel sort · warm grade',
    emoji: '🎨',
    state: {
      colorGradeEnabled: true, colorGradePreset: 'vellichor', colorGradeStrength: 0.7,
      warpEnabled: true, warpStyle: 'flow', warpStrength: 38, warpScale: 4, warpOctaves: 3,
      pixelSortEnabled: true, pixelSortThreshold: 120, pixelSortDirection: 'up', pixelSortMode: 'brightness',
      noiseOpacity: 0.08, vignetteStrength: 0.3,
      patternStyle: 'none', ditherStyle: 'none',
      dispersionEnabled: false, channelSmearEnabled: false, imageGlitchEnabled: false,
    },
  },
  {
    name: 'Prism',
    description: 'RGB channel smear in three directions',
    emoji: '🌈',
    state: {
      channelSmearEnabled: true, channelSmearThreshold: 60,
      channelSmearRDir: 'up', channelSmearGDir: 'left', channelSmearBDir: 'right',
      noiseOpacity: 0.1, vignetteStrength: 0.2,
      colorGradeEnabled: false, dispersionEnabled: false,
      pixelSortEnabled: false, warpEnabled: false, imageGlitchEnabled: false,
      patternStyle: 'none', ditherStyle: 'none',
    },
  },
  {
    name: 'Glitch Art',
    description: 'Digital glitch · VHS grade · scanlines',
    emoji: '📺',
    state: {
      imageGlitchEnabled: true, imageGlitchStyle: 'digital', imageGlitchIntensity: 55,
      imageGlitchShift: 45, imageGlitchRgbSplit: 8,
      colorGradeEnabled: true, colorGradePreset: 'vhs', colorGradeStrength: 0.9,
      patternStyle: 'scanline', patternOpacity: 0.1, patternColor: '#ffffff', patternBlendMode: 'normal',
      vignetteStrength: 0.3, noiseOpacity: 0.08,
      dispersionEnabled: false, pixelSortEnabled: false,
      channelSmearEnabled: false, warpEnabled: false, ditherStyle: 'none',
    },
  },
  {
    name: 'Noir Print',
    description: 'Black & white · Atkinson dither · vignette',
    emoji: '🖤',
    state: {
      colorGradeEnabled: true, colorGradePreset: 'noir', colorGradeStrength: 1,
      ditherStyle: 'atkinson', ditherScale: 4,
      vignetteStrength: 0.55, noiseOpacity: 0.18, noiseColor: '#ffffff',
      patternStyle: 'none',
      dispersionEnabled: false, pixelSortEnabled: false,
      channelSmearEnabled: false, warpEnabled: false, imageGlitchEnabled: false,
    },
  },
  {
    name: 'Neon Dreams',
    description: 'Cross-process · channel smear · scanlines',
    emoji: '⚡',
    state: {
      colorGradeEnabled: true, colorGradePreset: 'cross-process', colorGradeStrength: 0.85,
      channelSmearEnabled: true, channelSmearThreshold: 75,
      channelSmearRDir: 'up', channelSmearGDir: 'left', channelSmearBDir: 'right',
      patternStyle: 'scanline', patternOpacity: 0.08, patternColor: '#ffffff', patternBlendMode: 'overlay',
      vignetteStrength: 0.25, noiseOpacity: 0.06,
      dispersionEnabled: false, pixelSortEnabled: false,
      warpEnabled: false, imageGlitchEnabled: false, ditherStyle: 'none',
    },
  },
];
