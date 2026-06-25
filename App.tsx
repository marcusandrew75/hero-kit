
import React, { useState, useEffect, useRef } from 'react';
import Canvas from './components/Canvas';
import RightPanel from './components/RightPanel';
import PreviewOverlay, { PreviewLayout } from './components/PreviewOverlay';
import LooksPanel, { loadHistory, HistoryEntry } from './components/LooksPanel';
import CanvasDropZone from './components/CanvasDropZone';
import { BackgroundState } from './types';

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT: BackgroundState = {
  bgColor: '#050508',
  imageFilter: 'none',
  imageBlur: 0,
  imageMask: 'none',
  imageOpacity: 1,
  tintColor: '#6366f1',
  chromaticAberration: 0,
  ditherStyle: 'none',
  ditherScale: 1,
  atmosphereStyle: 'none',
  meshColors: { color1: '#c4b5fd', color2: '#6366f1', color3: '#4338ca' },
  meshSpeed: 'slow',
  meshComplexity: 6,
  meshTurbulence: 0.35,
  meshZoom: 1.2,
  meshContrast: 1.2,
  meshFrequency: 3.0,
  kineticSpeed: 1.0,
  kineticTrailLength: 20,
  kineticChaos: 0.5,
  moltenRoughness: 0.4,
  moltenDistortion: 0.5,
  fogDensity: 0.5,
  fogSpeed: 0.5,
  generativePreset: 'orbital',
  overlayOpacity: 0,
  noiseOpacity: 0,
  noiseColor: '#ffffff',
  patternStyle: 'none',
  patternOpacity: 0.1,
  patternColor: '#ffffff',
  patternBlendMode: 'normal',
  ambientLightIntensity: 0,
  ambientLightColor: '#6366f1',
  ambientLightPosition: 'tr',
  vignetteStrength: 0,
  effectsOpacity: 1,
  halftoneEnabled: false,
  halftoneDotSize: 4,
  halftoneSpacing: 8,
  halftoneColor: '#000000',
  halftoneOpacity: 1,
  halftoneInvert: false,
  colorGradeEnabled: false,
  colorGradePreset: 'teal-orange',
  colorGradeStrength: 1,
  pixelSortEnabled: false,
  pixelSortThreshold: 128,
  pixelSortDirection: 'up',
  pixelSortMode: 'brightness',
  layers: [],
  dispersionEnabled: false,
  dispersionStrength: 80,
  dispersionThreshold: 140,
  dispersionDirection: 'up',
  dispersionSpread: 0.5,
  channelSmearEnabled: false,
  channelSmearThreshold: 80,
  channelSmearRDir: 'up',
  channelSmearGDir: 'left',
  channelSmearBDir: 'right',
  warpEnabled: false,
  warpStrength: 30,
  warpScale: 3,
  warpOctaves: 3,
  warpStyle: 'warp',
  imageGlitchEnabled: false,
  imageGlitchStyle: 'digital',
  imageGlitchIntensity: 40,
  imageGlitchShift: 30,
  imageGlitchRgbSplit: 5,
  motionBlurEnabled: false,
  motionBlurType: 'horizontal',
  motionBlurStrength: 20,
  spotBlurEnabled: false,
  spotBlurRadius: 18,
  blurSpots: [],
};

export { DEFAULT };

// ─── App ──────────────────────────────────────────────────────────────────────

const RATIOS = [
  { id: 'free',  label: 'Free',  css: ''       },
  { id: '16:9',  label: '16:9',  css: '16/9'   },
  { id: '4:3',   label: '4:3',   css: '4/3'    },
  { id: '1:1',   label: '1:1',   css: '1/1'    },
  { id: '9:16',  label: '9:16',  css: '9/16'   },
  { id: '21:9',  label: '21:9',  css: '21/9'   },
];

const PREVIEW_LAYOUTS: { id: PreviewLayout; icon: string; title: string }[] = [
  { id: 'left',   icon: 'ph-text-align-left',   title: 'Left aligned'   },
  { id: 'center', icon: 'ph-text-align-center',  title: 'Centred'        },
  { id: 'right',  icon: 'ph-text-align-right',   title: 'Right aligned'  },
];

const HISTORY_MAX = 25;

const saveHistoryEntry = (s: BackgroundState) => {
  try {
    const { imageUrl: _i, videoUrl: _v, ...rest } = s;
    const entry: HistoryEntry = { id: crypto.randomUUID(), state: rest, timestamp: Date.now() };
    const prev = loadHistory();
    localStorage.setItem('herokit-history', JSON.stringify([entry, ...prev].slice(0, HISTORY_MAX)));
  } catch { /* quota exceeded */ }
};

const App: React.FC = () => {
  const [state, setState]                 = useState<BackgroundState>(DEFAULT);
  const [showPreview, setShowPreview]     = useState(false);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>('left');
  const [previewDim, setPreviewDim]       = useState(0);
  const [showLooks, setShowLooks]         = useState(false);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [aspectRatio, setAspectRatio]     = useState('free');
  const [boxSize, setBoxSize]             = useState<{ w: number; h: number } | null>(null);
  const [hideEffects, setHideEffects]     = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout>>();

  // Apply URL-shared look on first load
  useEffect(() => {
    const hash = location.hash;
    if (hash.startsWith('#look=')) {
      try {
        const lookState = JSON.parse(decodeURIComponent(escape(atob(hash.slice(6)))));
        setState(prev => ({ ...prev, ...lookState }));
        history.replaceState(null, '', location.pathname);
      } catch { /* malformed — ignore */ }
    }
  }, []);

  // Paste image from clipboard anywhere in the app
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const r = new FileReader();
          r.onload = ev => setState(prev => ({ ...prev, imageUrl: ev.target?.result as string, videoUrl: undefined }));
          r.readAsDataURL(file);
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // Recompute constrained canvas size whenever ratio or container resizes
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const compute = () => {
      const r = RATIOS.find(x => x.id === aspectRatio);
      if (!r?.css) { setBoxSize(null); return; }
      const [rw, rh] = r.css.split('/').map(Number);
      const ratio    = rw / rh;
      const availW   = el.clientWidth  - 32;   // horizontal padding
      const availH   = el.clientHeight - 108;  // top bar + bottom bar
      const scale    = Math.min(availW / rw, availH / rh);
      setBoxSize({ w: Math.floor(scale * rw), h: Math.floor(scale * rh) });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspectRatio]);

  // Auto-save history (debounced 3s after last change)
  useEffect(() => {
    clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => saveHistoryEntry(state), 3000);
    return () => clearTimeout(historyTimer.current);
  }, [state]);

  const handleChange = (patch: Partial<BackgroundState>) => setState(prev => ({ ...prev, ...patch }));

  const handleApplyLook = (patch: Partial<BackgroundState>) =>
    setState(prev => ({ ...prev, ...patch, imageUrl: prev.imageUrl, videoUrl: prev.videoUrl }));

  // Reset all effects to defaults, keep the source image
  const handleResetEffects = () =>
    setState(prev => ({ ...DEFAULT, imageUrl: prev.imageUrl, videoUrl: prev.videoUrl }));

  const hasSource = !!(state.imageUrl || state.videoUrl);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111]">
      {/* Canvas area */}
      <div
        ref={outerRef}
        className={`flex-1 relative overflow-hidden transition-colors duration-300 ${
          aspectRatio !== 'free' ? 'flex items-center justify-center bg-[#060606]' : ''
        }`}
      >
        {/* Constrained canvas box — fills freely or locks to exact computed size */}
        <div
          className="relative overflow-hidden"
          style={
            boxSize
              ? {
                  width:  boxSize.w,
                  height: boxSize.h,
                  flexShrink: 0,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.6)',
                }
              : { position: 'absolute', inset: 0 }
          }
        >
          <Canvas state={state} hideEffects={hideEffects} />

          {/* Drop zone — shown when no image/video loaded */}
          {!hasSource && <CanvasDropZone onChange={handleChange} />}

          {/* Dim layer — preview only */}
          {showPreview && previewDim > 0 && (
            <div
              className="absolute inset-0 z-[99] pointer-events-none bg-black"
              style={{ opacity: previewDim / 100 }}
            />
          )}

          {/* Context preview overlay */}
          {showPreview && (
            <div className="absolute inset-0 z-[100]">
              <PreviewOverlay layout={previewLayout} />
            </div>
          )}
        </div>

        {/* Aspect ratio selector — top centre */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[130] flex items-center bg-black/55 backdrop-blur-md border border-white/10 rounded-full px-1.5 py-1.5 gap-0.5 shadow-xl">
          {RATIOS.map(r => (
            <button
              key={r.id}
              onClick={() => setAspectRatio(r.id)}
              className={`px-3 py-[6px] rounded-full text-[11px] font-medium transition-all ${
                aspectRatio === r.id
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Top-right button cluster */}
        <div className="absolute top-4 right-4 z-[130] flex items-center gap-2">
          {/* Hold to bypass all effects */}
          <button
            title="Hold to bypass effects"
            onMouseDown={() => setHideEffects(true)}
            onMouseUp={() => setHideEffects(false)}
            onMouseLeave={() => setHideEffects(false)}
            onTouchStart={() => setHideEffects(true)}
            onTouchEnd={() => setHideEffects(false)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-sm border transition-all select-none ${
              hideEffects
                ? 'bg-white text-black border-white'
                : 'bg-black/40 border-white/10 text-white/40 hover:text-white hover:border-white/25'
            }`}
          >
            <i className="ph ph-eye text-sm" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? 'Show panel' : 'Hide panel'}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-all"
          >
            <i className={`ph ${isFullscreen ? 'ph-sidebar-simple' : 'ph-arrows-out'} text-sm`} />
          </button>
        </div>

        {/* Floating preview toggle */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-1.5 py-1.5 shadow-2xl">

          {/* Toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              showPreview ? 'bg-white text-black' : 'text-white/70 hover:text-white'
            }`}
          >
            <i className={`ph ${showPreview ? 'ph-eye-slash' : 'ph-eye'} text-sm`} />
            {showPreview ? 'Hide' : 'Preview in context'}
          </button>

          {showPreview && (
            <>
              {/* Divider */}
              <div className="w-px h-4 bg-white/15 mx-0.5" />

              {/* Layout icon buttons */}
              {PREVIEW_LAYOUTS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setPreviewLayout(l.id)}
                  title={l.title}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                    previewLayout === l.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  <i className={`ph ${l.icon} text-base`} />
                </button>
              ))}

              {/* Divider */}
              <div className="w-px h-4 bg-white/15 mx-0.5" />

              {/* Dim slider */}
              <div className="flex items-center gap-2 px-2">
                <i className="ph ph-circle-half text-white/40 text-sm" />
                <input
                  type="range"
                  min={0} max={80} step={1}
                  value={previewDim}
                  onChange={e => setPreviewDim(Number(e.target.value))}
                  className="heroken-slider w-20"
                  title="Dim background"
                />
                <span className="text-[10px] text-white/40 w-6 tabular-nums">{previewDim}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right panel — GPU layer keeps the compositor texture alive during
          the width animation so no per-frame repaint. height:100% restores
          the h-full chain that h-screen → flex → panel depends on. */}
      <div
        style={{ width: isFullscreen ? 0 : 310, transition: 'width 280ms cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0 }}
      >
        <div style={{ width: 310, height: '100%', transform: 'translateZ(0)' }}>
          <RightPanel state={state} onChange={handleChange} onOpenLooks={() => setShowLooks(true)} onResetEffects={handleResetEffects} />
        </div>
      </div>

      {/* Looks panel modal */}
      {showLooks && (
        <LooksPanel
          state={state}
          onApply={handleApplyLook}
          onClose={() => setShowLooks(false)}
        />
      )}
    </div>
  );
};

export default App;
