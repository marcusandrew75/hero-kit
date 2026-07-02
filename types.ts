
export type AtmosphereStyle =
  | 'none'
  | 'fluid-mesh'
  | 'animated-mesh'
  | 'mesh-accent'
  | 'generative'
  | 'kinetic-flow'
  | 'molten-orb'
  | 'volumetric-fog'
  | 'aurora'
  | 'light-leak'
  | 'shimmer'
  | 'glitch'
  | 'glow'
  | 'fade-bottom';

export type PatternStyle = 'none' | 'grid' | 'dot' | 'iso-grid' | 'scanline' | 'hex' | 'waves' | 'plus';

export type ImageFilter = 'none' | 'grayscale' | 'desaturate' | 'tint' | 'duotone' | 'frosted';

export type ImageMask = 'none' | 'fade-bottom' | 'fade-left' | 'fade-right' | 'radial' | 'soft-edges';

export type DitherStyle = 'none' | 'bayer' | 'floyd-steinberg' | 'atkinson' | 'ascii';

export type GenerativePreset = 'orbital' | 'particles' | 'matrix' | 'fluid-grid' | 'noise-field';

export type ExportFormat = 'PNG' | 'WebP' | 'JPG';

export type ExportResolution = '1x' | '2x' | '4x';

export type AmbientPosition = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export interface MeshColors {
  color1: string;
  color2: string;
  color3: string;
}

export interface BackgroundState {
  // Source
  bgColor: string;      // empty-canvas backdrop — matches the app's light theme
  maskColor: string;    // color revealed through Mask fades — independent of bgColor
  imageUrl?: string;
  videoUrl?: string;

  // Image / video processing
  imageFilter: ImageFilter;
  imageBlur: number;
  imageMask: ImageMask;
  imageOpacity: number;
  tintColor: string;           // Used by tint / duotone filter modes
  chromaticAberration: number; // 0–20 px RGB shift
  ditherStyle: DitherStyle;
  ditherScale: number;
  ditherDuotoneEnabled: boolean;
  ditherDuotoneShadowColor: string;
  ditherDuotoneHighlightColor: string;
  ditherDuotoneLevels: number; // 2–8 tonal steps, independent of dot/cell Scale
  ditherDuotoneInvert: boolean;
  ditherAsciiCharSize: number;   // 6–32px, independent of the shared dot/cell Scale
  ditherAsciiBrightness: number; // -100 to 100, biases luminance before ramp mapping
  ditherMatrixSize: number;      // 2, 4, 8 or 16 — Bayer ordered-dither pattern coarseness

  // Atmosphere
  atmosphereStyle: AtmosphereStyle;
  meshColors: MeshColors;
  meshSpeed: 'slow' | 'normal' | 'fast';
  meshComplexity: number;
  meshTurbulence: number;
  meshZoom: number;
  meshContrast: number;
  meshFrequency: number;
  kineticSpeed: number;
  kineticTrailLength: number;
  kineticChaos: number;
  moltenRoughness: number;
  moltenDistortion: number;
  fogDensity: number;
  fogSpeed: number;
  generativePreset: GenerativePreset;

  // Overlays
  overlayOpacity: number;
  noiseOpacity: number;
  noiseColor: string;
  patternStyle: PatternStyle;
  patternOpacity: number;
  patternColor: string;
  patternBlendMode: 'normal' | 'overlay' | 'screen' | 'soft-light' | 'multiply';

  // Ambient light
  ambientLightIntensity: number;
  ambientLightColor: string;
  ambientLightPosition: AmbientPosition;

  // Light & FX extras
  vignetteStrength: number; // 0–1

  // Effects opacity (applied to the whole atmosphere layer)
  effectsOpacity: number;   // 0–1

  // Halftone
  halftoneEnabled: boolean;
  halftoneDotSize: number;
  halftoneSpacing: number;
  halftoneColor: string;
  halftoneOpacity: number;
  halftoneInvert: boolean;
  halftonePattern: 'dot' | 'line' | 'crosshatch';
  halftoneAngle: number; // degrees — screen angle for line/crosshatch, like CMYK plate angles

  // Color Grade (includes vintage presets)
  colorGradeEnabled: boolean;
  colorGradePreset: 'teal-orange' | 'golden-hour' | 'arctic' | 'noir' | 'moody' | 'vellichor'
                  | 'polaroid' | 'kodachrome' | 'cross-process' | 'lomo' | 'faded' | 'vhs';
  colorGradeStrength: number;

  // Pixel Sort
  pixelSortEnabled: boolean;
  pixelSortThreshold: number;
  pixelSortDirection: 'up' | 'down' | 'left' | 'right';
  pixelSortMode: 'brightness' | 'hue' | 'saturation';

  // Edge Glow / Neon
  edgeGlowEnabled: boolean;
  edgeGlowColor: string;
  edgeGlowIntensity: number;  // 0–100
  edgeGlowBloom: number;      // blur radius px
  edgeGlowDarken: number;     // 0–1 how much to darken base

  // Split Tone
  splitToneEnabled: boolean;
  splitToneShadowColor: string;
  splitToneHighlightColor: string;
  splitToneStrength: number;  // 0–100
  splitToneBalance: number;   // -50 to +50

  // Riso Print — duotone ink layers with misregistration + grain, mimicking Risograph
  risoEnabled: boolean;
  risoColor1: string;    // first ink plate color
  risoColor2: string;    // second ink plate color
  risoScale: number;     // 1–16, halftone dot/cell size for each ink layer
  risoOffset: number;    // 0–10px, misregistration between the two ink layers
  risoGrain: number;     // 0–100, organic ink-edge noise

  // CMYK Separation — 4-plate halftone reproduction at classic print screen angles
  cmykSeparationEnabled: boolean;
  cmykDotSize: number;   // 1–12
  cmykSpacing: number;   // 3–30

  // Image layers (composited on top of primary imageUrl)
  layers: ImageLayer[];

  // Dispersion
  dispersionEnabled: boolean;
  dispersionStrength: number;    // how far particles scatter (px)
  dispersionThreshold: number;   // edge sensitivity 0–255
  dispersionDirection: 'up' | 'right' | 'down' | 'chaos' | 'radial';
  dispersionSpread: number;      // noise variation 0–1

  // RGB Channel Smear
  channelSmearEnabled: boolean;
  channelSmearThreshold: number;
  channelSmearRDir: 'up' | 'down' | 'left' | 'right';
  channelSmearGDir: 'up' | 'down' | 'left' | 'right';
  channelSmearBDir: 'up' | 'down' | 'left' | 'right';

  // Displacement warp
  warpEnabled: boolean;
  warpStrength: number;   // pixel displacement amount
  warpScale: number;      // noise frequency
  warpOctaves: number;    // noise detail 1–5
  warpStyle: 'warp' | 'swirl' | 'flow';

  // Image Glitch
  imageGlitchEnabled: boolean;
  imageGlitchStyle: 'digital' | 'corrupt' | 'signal';
  imageGlitchIntensity: number;  // 0–100
  imageGlitchShift: number;      // px horizontal displacement
  imageGlitchRgbSplit: number;   // px RGB channel separation

  // Motion blur
  motionBlurEnabled: boolean;
  motionBlurType: 'horizontal' | 'vertical' | 'zoom';
  motionBlurStrength: number;   // 1–60 steps / intensity

  // Spot blur
  spotBlurEnabled: boolean;
  spotBlurRadius: number;        // background blur px (5–40)
  blurSpots: BlurSpot[];

  // Effect Mask — paint a region to restrict the whole active effect stack to;
  // everywhere else stays as the original, unprocessed image.
  effectMaskEnabled: boolean;
  effectMaskStrokes: MaskStroke[];
  effectMaskBrushSize: number;   // 0–1 relative to min(w,h)
  effectMaskFeather: number;     // 0–100 px blur applied to the mask edge
  effectMaskInvert: boolean;
  effectMaskShowOverlay: boolean;
}

export type LayerBlendMode = 'screen' | 'multiply' | 'overlay' | 'soft-light' | 'difference' | 'luminosity';

export interface ImageLayer {
  id: string;
  imageUrl?: string;
  blendMode: LayerBlendMode;
  opacity: number; // 0–1
}

export interface BlurSpot {
  id: string;
  x: number;      // 0–1 relative to canvas width
  y: number;      // 0–1 relative to canvas height
  radius: number; // 0–1 relative to min(w,h)
}

export interface MaskStroke {
  points: { x: number; y: number }[]; // 0–1 relative coords — resolution-independent, no bitmap stored
  size: number;                        // brush radius, 0–1 relative to min(w,h)
}

