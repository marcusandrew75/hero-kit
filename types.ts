
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
  | 'fade-bottom'
  // Paper Shaders (@paper-design/shaders-react) — GPU shader canvases, same
  // z-[1] atmosphere layer as the effects above. Genuine <canvas> elements,
  // which is what lets Video Export sweep them up automatically.
  | 'warp'
  | 'voronoi'
  | 'metaballs'
  | 'pulsing-border'
  | 'god-rays'
  | 'smoke-ring';

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
  imageAttribution?: ImageAttribution;

  // Image / video processing
  imageFilter: ImageFilter;
  imageBlur: number;
  imageMask: ImageMask;
  imageOpacity: number;
  imageFlipH: boolean;
  imageFlipV: boolean;
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
  halftoneDuotoneEnabled: boolean; // flat two-ink mode: fills to halftoneBgColor, stamps halftoneColor as opaque dot coverage instead of multiply-blending over the photo
  halftoneBgColor: string;

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

  // Silkscreen — flat spot-ink posterization: every pixel mapped to the nearest
  // of a small hand-picked ink set over a paper ground, with a thresholded
  // black key plate for silhouettes/linework and stipple noise breaking up
  // tonal boundaries. The 70s-movie-poster / vintage book-plate / comic look.
  silkscreenEnabled: boolean;
  silkscreenPaperColor: string;   // lightest ground "paper" ink
  silkscreenInk1: string;
  silkscreenInk2: string;
  silkscreenInk3: string;
  silkscreenKeyThreshold: number; // 0–100, luminance below this → black key plate
  silkscreenStipple: number;      // 0–100, speckle noise at tonal boundaries

  // Postcard — oversaturated warm grade + limited palette + fine ordered
  // texture. Texture scale sweeps the look from vintage linen-postcard weave
  // (fine) to 90s videogame dither (chunky) — same mechanics, different era.
  postcardEnabled: boolean;
  postcardSaturation: number; // 0–100, saturation boost
  postcardWarmth: number;     // -50 to 50, warm/cool shift
  postcardLevels: number;     // 2–8 per-channel quantization levels
  postcardScale: number;      // 1–8 dither cell size: 1 = linen weave, 8 = chunky game dither

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

// Unsplash requires attribution + a link to the photographer's profile
// wherever a photo is actually used, not just while browsing — this rides
// alongside imageUrl/layer.imageUrl and must be reset/preserved in lockstep
// with it (cleared on a new image, carried forward when the image itself is
// unchanged, e.g. applying a Look).
export interface ImageAttribution {
  source: 'unsplash';
  name: string;
  profileUrl: string; // photographer's Unsplash profile — UTM added at render time
}

export interface ImageLayer {
  id: string;
  imageUrl?: string;
  attribution?: ImageAttribution;
  blendMode: LayerBlendMode;
  opacity: number; // 0–1
  // Position/size within the canvas — all optional and default to a full
  // 0,0,1,1 box (today's full-bleed behavior) so layers saved before this
  // field existed render exactly as they always have.
  x?: number;              // 0–1, left edge relative to canvas width
  y?: number;               // 0–1, top edge relative to canvas height
  width?: number;           // 0–1, relative to canvas width
  height?: number;          // 0–1, relative to canvas height
  naturalAspect?: number;   // image's own width/height — locks resize ratio
  hidden?: boolean;         // skip this layer entirely at render/export time
  flipH?: boolean;
  flipV?: boolean;
  rotation?: number;        // degrees, clockwise, about the box's own center
  // Per-layer eraser — paint away parts of this layer's own image (e.g. a
  // busy background around a subject) so a hard rectangular box doesn't show
  // once the layer is resized down. Strokes are 0-1 relative to the LAYER'S
  // OWN box, not the canvas, so an erased region moves/scales with the layer.
  maskStrokes?: MaskStroke[];
  maskFeather?: number;      // 0-100, same slider range as Effect Mask's
  // 'keep' (default): painted area is kept, everything else removed — the
  // subject-cutout model, which sidesteps the box-edge halo entirely since
  // the outside is never hand-erased, just never kept. 'erase': the inverse,
  // for removing a small area while keeping the rest.
  maskMode?: 'keep' | 'erase';
  maskBrushSize?: number;    // persisted per layer, matches Effect Mask's own persistence
  maskShowOverlay?: boolean; // persisted per layer, matches Effect Mask's own persistence
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

