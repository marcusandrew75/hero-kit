import { BackgroundState } from './types';
import { DEFAULT } from './defaultState';

// The Dice — rolls a random-but-tasteful effect stack. Confirmed against the
// actual per-pixel pipeline (components/Canvas.tsx, "Step 2: per-pixel
// transforms"): grade/splitTone/gradientMap/edgeGlow/imageGlitch/dispersion/
// warp/kaleidoscope/channelSmear/pixelSort/relief/contour/riso/silkscreen/
// cmyk/halftone/postcard/dither all
// run as SEQUENTIAL DESTRUCTIVE passes over the same buffer, in that fixed
// order — stacking two heavy "remap" effects just means the second overwrites/
// muddies the first's output. So every roll picks exactly one "hero" from
// that pool, randomizes its own params within a tasteful sub-range (never the
// slider extremes, which is where these effects tend to look broken rather
// than stylized), then layers on independently-rolled lighter "finish"
// touches (grade/split-tone/vignette/grain/CA/pattern/ambient) that are
// either genuinely additive or, at worst, quietly absorbed into a heavy
// hero rather than fighting it.
//
// atmosphereStyle and Effect Mask are deliberately excluded from the hero
// pool — atmosphere's compositing relationship with the source photo wasn't
// verified closely enough here to randomize confidently, and Effect Mask
// needs real paint strokes tied to actual image content, not something a
// randomizer can meaningfully generate.

export interface DiceRoll { patch: Partial<BackgroundState>; hero: string; }

const rand    = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.round(rand(min, max));
const pick    = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance  = (p: number) => Math.random() < p;

const DIRS = ['up', 'down', 'left', 'right'] as const;

const RISO_PAIRS: [string, string][] = [
  ['#ff48b0', '#0078bf'], // DEFAULT's own fluorescent pink/blue
  ['#ff6b35', '#004e89'], // orange/navy
  ['#ffd23f', '#ee4266'], // yellow/red
  ['#06d6a0', '#7209b7'], // teal/purple
];

const DUOTONE_PAIRS: [string, string][] = [
  [DEFAULT.ditherDuotoneShadowColor, DEFAULT.ditherDuotoneHighlightColor],
  ['#1a0f2e', '#ffe0f0'],
  ['#0a1f14', '#e8f4b8'],
];

const EDGE_GLOW_COLORS = ['#00ffff', '#ff00aa', '#ffd23f', '#39ff14', '#ff6b35'];
const RELIEF_TINTS = ['#8a8a8a', '#b08d57', '#9c9284', '#6b7280', '#b87333']; // steel/bronze/stone/slate/copper
const LOW_POLY_EDGE_COLORS = ['#000000', '#ffffff', '#1a2b1a', '#e84320'];
const VORONOI_GAP_COLORS = ['#0a0a0a', '#1a1a1a', '#ffffff', '#e84320'];
const SPLIT_SHADOW_COLORS = ['#1a237e', '#0a1f14', '#2d1b00'];
const SPLIT_HIGHLIGHT_COLORS = ['#ff6d00', '#ffd23f', '#ee4266'];
const AMBIENT_COLORS = ['#6366f1', '#ff6b35', '#06d6a0', '#ffd23f', '#ee4266'];

const GRADE_PRESETS = [
  'teal-orange', 'golden-hour', 'arctic', 'noir', 'moody', 'vellichor',
  'polaroid', 'kodachrome', 'cross-process', 'lomo', 'faded', 'vhs',
] as const;
const PATTERN_STYLES = ['grid', 'dot', 'iso-grid', 'scanline', 'hex', 'waves', 'plus'] as const;
const PATTERN_BLENDS = ['normal', 'overlay', 'screen', 'soft-light', 'multiply'] as const;
const AMBIENT_POSITIONS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'] as const;

interface Hero { id: string; make: () => Partial<BackgroundState>; }

const HEROES: Hero[] = [
  {
    id: 'halftone',
    make: () => ({
      halftoneEnabled: true,
      halftonePattern: pick(['dot', 'line', 'crosshatch'] as const),
      halftoneDotSize: rand(3, 6),
      halftoneSpacing: rand(6, 12),
      halftoneAngle: randInt(15, 75),
      halftoneColor: '#000000', halftoneOpacity: 1, halftoneInvert: false,
      halftoneDuotoneEnabled: chance(0.25), halftoneBgColor: DEFAULT.halftoneBgColor,
    }),
  },
  {
    id: 'riso',
    make: () => {
      const [c1, c2] = pick(RISO_PAIRS);
      return {
        risoEnabled: true, risoColor1: c1, risoColor2: c2,
        risoScale: randInt(3, 6), risoOffset: randInt(2, 5), risoGrain: randInt(25, 55),
      };
    },
  },
  {
    id: 'silkscreen',
    make: () => ({
      silkscreenEnabled: true,
      silkscreenPaperColor: DEFAULT.silkscreenPaperColor,
      silkscreenInk1: DEFAULT.silkscreenInk1, silkscreenInk2: DEFAULT.silkscreenInk2, silkscreenInk3: DEFAULT.silkscreenInk3,
      silkscreenKeyThreshold: randInt(20, 45), silkscreenStipple: randInt(20, 55),
    }),
  },
  {
    id: 'bloom',
    make: () => ({
      bloomEnabled: true,
      bloomThreshold: randInt(45, 75), bloomIntensity: randInt(55, 90),
      bloomRadius: randInt(15, 45), bloomWarmth: randInt(-20, 20),
    }),
  },
  {
    id: 'postcard',
    make: () => ({
      postcardEnabled: true,
      postcardSaturation: randInt(30, 65), postcardWarmth: randInt(-20, 35),
      postcardLevels: randInt(3, 6), postcardScale: randInt(1, 4),
    }),
  },
  {
    id: 'gradientMap',
    make: () => ({
      gradientMapEnabled: true,
      gradientMapPreset: pick(['thermal', 'infrared', 'acid', 'x-ray', 'sunset', 'toxic', 'gold', 'mono'] as const),
      gradientMapStrength: randInt(75, 100),
      gradientMapInvert: chance(0.15),
    }),
  },
  {
    id: 'relief',
    make: () => ({
      reliefEnabled: true,
      reliefAngle: randInt(0, 360),
      reliefDepth: randInt(40, 70),
      reliefColorize: randInt(0, 35),
      reliefTint: pick(RELIEF_TINTS),
    }),
  },
  {
    id: 'contour',
    make: () => ({
      contourEnabled: true,
      contourLevels: randInt(6, 12),
      contourLineColor: DEFAULT.contourLineColor,
      contourBgColor: DEFAULT.contourBgColor,
      // Either "lines over the photo" or "clean tinted map" — two distinct looks
      contourFill: chance(0.5) ? randInt(15, 35) : randInt(70, 95),
    }),
  },
  {
    id: 'lowPoly',
    make: () => ({
      lowPolyEnabled: true,
      lowPolyPoints: randInt(150, 700),
      lowPolyEdgeBias: randInt(40, 80),
      lowPolyShowEdges: chance(0.35),
      lowPolyEdgeColor: pick(LOW_POLY_EDGE_COLORS),
      lowPolyStrength: randInt(85, 100),
    }),
  },
  {
    id: 'voronoi',
    make: () => ({
      voronoiEnabled: true,
      voronoiPoints: randInt(150, 700),
      voronoiEdgeBias: randInt(40, 80),
      voronoiGapWidth: randInt(1, 5),
      voronoiGapColor: pick(VORONOI_GAP_COLORS),
      voronoiStrength: randInt(85, 100),
    }),
  },
  {
    id: 'kaleidoscope',
    make: () => ({
      kaleidoscopeEnabled: true,
      kaleidoscopeMode: pick(['radial', 'mirror'] as const),
      kaleidoscopeSegments: pick([3, 4, 6, 8, 12]),
      kaleidoscopeAngle: randInt(0, 360),
      kaleidoscopeZoom: rand(0.8, 1.4),
    }),
  },
  {
    id: 'kuwahara',
    make: () => ({
      kuwaharaEnabled: true,
      kuwaharaRadius: randInt(2, 8), kuwaharaStrength: randInt(70, 100),
      kuwaharaSoftness: randInt(0, 40), kuwaharaVibrance: randInt(0, 30), kuwaharaEdgeAccent: randInt(0, 25),
    }),
  },
  {
    id: 'cmyk',
    make: () => ({ cmykSeparationEnabled: true, cmykDotSize: rand(3, 6), cmykSpacing: rand(6, 14) }),
  },
  {
    id: 'dither',
    make: () => {
      const style = pick(['bayer', 'floyd-steinberg', 'atkinson', 'ascii'] as const);
      if (style === 'ascii') {
        return { ditherStyle: style, ditherAsciiCharSize: randInt(10, 20), ditherAsciiBrightness: randInt(-20, 40), ditherDuotoneEnabled: false };
      }
      const duotone = chance(0.35);
      const [shadow, highlight] = pick(DUOTONE_PAIRS);
      return {
        ditherStyle: style, ditherScale: randInt(2, 6), ditherMatrixSize: pick([2, 4, 8, 16] as const),
        ditherDuotoneEnabled: duotone,
        ditherDuotoneShadowColor: duotone ? shadow : DEFAULT.ditherDuotoneShadowColor,
        ditherDuotoneHighlightColor: duotone ? highlight : DEFAULT.ditherDuotoneHighlightColor,
        ditherDuotoneLevels: randInt(2, 4),
      };
    },
  },
  {
    id: 'dispersion',
    make: () => ({
      dispersionEnabled: true,
      dispersionStrength: randInt(60, 150), dispersionThreshold: randInt(20, 160),
      dispersionDirection: pick(['up', 'right', 'down', 'chaos', 'radial'] as const),
      dispersionSpread: rand(0.2, 0.6),
    }),
  },
  {
    id: 'warp',
    make: () => ({
      warpEnabled: true,
      warpStrength: randInt(20, 60), warpScale: rand(2, 6), warpOctaves: randInt(2, 4),
      warpStyle: pick(['warp', 'swirl', 'flow'] as const),
    }),
  },
  {
    id: 'channelSmear',
    make: () => ({
      channelSmearEnabled: true, channelSmearThreshold: randInt(40, 140),
      channelSmearRDir: pick(DIRS), channelSmearGDir: pick(DIRS), channelSmearBDir: pick(DIRS),
    }),
  },
  {
    id: 'pixelSort',
    make: () => ({
      pixelSortEnabled: true, pixelSortThreshold: randInt(80, 180),
      pixelSortDirection: pick(DIRS), pixelSortMode: pick(['brightness', 'hue', 'saturation'] as const),
    }),
  },
  {
    id: 'imageGlitch',
    make: () => ({
      imageGlitchEnabled: true, imageGlitchStyle: pick(['digital', 'corrupt', 'signal'] as const),
      imageGlitchIntensity: randInt(25, 65), imageGlitchShift: randInt(15, 60), imageGlitchRgbSplit: randInt(3, 15),
    }),
  },
  {
    id: 'motionBlur',
    make: () => ({
      motionBlurEnabled: true, motionBlurType: pick(['horizontal', 'vertical', 'zoom'] as const),
      motionBlurStrength: randInt(15, 45),
    }),
  },
  {
    id: 'spotBlur',
    make: () => {
      const count = chance(0.5) ? 1 : 2;
      const blurSpots = Array.from({ length: count }, (_, i) => ({
        id: `dice-spot-${i}`, x: rand(0.25, 0.75), y: rand(0.25, 0.75), radius: rand(0.35, 0.6),
      }));
      return { spotBlurEnabled: true, spotBlurRadius: randInt(14, 24), blurSpots };
    },
  },
  {
    id: 'edgeGlow',
    make: () => ({
      edgeGlowEnabled: true, edgeGlowColor: pick(EDGE_GLOW_COLORS),
      edgeGlowIntensity: randInt(55, 90), edgeGlowBloom: randInt(6, 16), edgeGlowDarken: rand(0.3, 0.6),
    }),
  },
  {
    id: 'liquidGlass',
    make: () => {
      const count = chance(0.6) ? 1 : 2;
      const liquidGlassBlobs = Array.from({ length: count }, (_, i) => ({
        id: `dice-glass-${i}`, x: rand(0.3, 0.7), y: rand(0.3, 0.7), radius: rand(0.18, 0.35),
      }));
      return {
        liquidGlassEnabled: true, liquidGlassBlobs,
        liquidGlassRefraction: randInt(35, 80), liquidGlassFrost: rand(2, 12),
        liquidGlassFringe: randInt(25, 65), liquidGlassRimIntensity: randInt(35, 80),
      };
    },
  },
];

// Independently-rolled lighter touches layered on top of the hero. Grade and
// split-tone are both "color mood" — mutually exclusive with each other so
// they don't fight over the same job, everything else can combine freely.
const rollFinish = (): Partial<BackgroundState> => {
  const finish: Partial<BackgroundState> = {};

  const mood = Math.random();
  if (mood < 0.6) {
    finish.colorGradeEnabled = true;
    finish.colorGradePreset = pick(GRADE_PRESETS);
    finish.colorGradeStrength = rand(0.6, 1.0);
  } else if (mood < 0.85) {
    finish.splitToneEnabled = true;
    finish.splitToneShadowColor = pick(SPLIT_SHADOW_COLORS);
    finish.splitToneHighlightColor = pick(SPLIT_HIGHLIGHT_COLORS);
    finish.splitToneStrength = randInt(40, 80);
    finish.splitToneBalance = randInt(-20, 20);
  }

  if (chance(0.5)) finish.vignetteStrength = rand(0.15, 0.45);
  if (chance(0.55)) { finish.noiseOpacity = rand(0.04, 0.18); finish.noiseColor = '#ffffff'; }
  if (chance(0.3)) finish.chromaticAberration = rand(1, 6);
  if (chance(0.2)) {
    finish.patternStyle = pick(PATTERN_STYLES);
    finish.patternOpacity = rand(0.05, 0.15);
    finish.patternColor = '#ffffff';
    finish.patternBlendMode = pick(PATTERN_BLENDS);
  }
  if (chance(0.2)) {
    finish.ambientLightIntensity = rand(0.15, 0.4);
    finish.ambientLightColor = pick(AMBIENT_COLORS);
    finish.ambientLightPosition = pick(AMBIENT_POSITIONS);
  }

  return finish;
};

export const rollDice = (excludeHero?: string): DiceRoll => {
  const pool = excludeHero ? HEROES.filter(h => h.id !== excludeHero) : HEROES;
  const hero = pick(pool);
  return { patch: { ...hero.make(), ...rollFinish() }, hero: hero.id };
};
