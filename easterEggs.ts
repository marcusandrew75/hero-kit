import { BackgroundState } from './types';

// Quiet discovery, not gamification — no badges, no streaks, no progress
// tracking. Each egg is a deliberately narrow combination of 2-3 fields
// (never a single maxed slider), so finding one rewards genuine
// experimentation across the effect rack rather than just cranking one knob
// to its limit. Detection/dedupe lives in App.tsx (in-memory only, never
// persisted — see the useEffect there for why).

export interface EasterEgg {
  id: string;
  test: (state: BackgroundState) => boolean;
  message: string;
}

export const EASTER_EGGS: EasterEgg[] = [
  {
    id: 'noir-heavy-vignette',
    test: s => s.colorGradeEnabled && s.colorGradePreset === 'noir' && s.vignetteStrength > 0.7,
    message: 'Somewhere, a saxophone plays.',
  },
  {
    id: 'riso-full-misregister',
    test: s => s.risoEnabled && s.risoOffset >= 9 && s.risoGrain >= 90,
    message: 'The plates have slipped. On purpose, technically.',
  },
  {
    id: 'ascii-blown-out',
    test: s => s.ditherStyle === 'ascii' && s.ditherAsciiBrightness >= 90,
    message: 'That’s mostly just a blank page now.',
  },
  {
    id: 'vhs-scanline-stack',
    test: s => s.colorGradeEnabled && s.colorGradePreset === 'vhs' && s.patternStyle === 'scanline' && s.patternOpacity > 0.3,
    message: 'Be kind, rewind.',
  },
  {
    id: 'total-signal-loss',
    test: s => s.imageGlitchEnabled && s.imageGlitchIntensity > 90 && s.channelSmearEnabled && s.channelSmearThreshold < 20,
    message: 'We appear to have lost the signal entirely.',
  },
  {
    id: 'invisible-atmosphere',
    test: s => s.effectsOpacity < 0.05 && s.atmosphereStyle !== 'none',
    message: 'All that, and it’s turned all the way down.',
  },
  {
    id: 'silkscreen-all-key',
    test: s => s.silkscreenEnabled && s.silkscreenKeyThreshold > 85 && s.silkscreenStipple > 85,
    message: 'This poster is mostly ink at this point.',
  },
  {
    id: 'postcard-chunky-max',
    test: s => s.postcardEnabled && s.postcardSaturation > 90 && s.postcardScale >= 7,
    message: 'Insert coin to continue.',
  },
];
