
import React, { useState, useEffect, useRef } from 'react';
import Canvas from './components/Canvas';
import RightPanel from './components/RightPanel';
import PreviewOverlay, { PreviewLayout, PreviewFont } from './components/PreviewOverlay';
import LooksPanel, { loadHistory, HistoryEntry } from './components/LooksPanel';
import CanvasDropZone from './components/CanvasDropZone';
import { BackgroundState } from './types';
import { DEFAULT } from './defaultState';

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
    const { imageUrl: _i, videoUrl: _v, layers, ...rest } = s;
    // Layer images are uploaded as base64 data-URIs — leaving them in means every
    // 3-second auto-save writes megabytes to localStorage, which silently exhausts
    // the origin's storage quota within minutes and then blocks ALL further writes,
    // including Looks saves (shared quota). History only needs to restore effect
    // settings, not re-embed the actual layer image data.
    const strippedLayers = layers?.map(({ imageUrl: _li, ...l }) => l);
    const entry: HistoryEntry = { id: crypto.randomUUID(), state: { ...rest, layers: strippedLayers }, timestamp: Date.now() };
    const prev = loadHistory();
    localStorage.setItem('herokit-history', JSON.stringify([entry, ...prev].slice(0, HISTORY_MAX)));
  } catch { /* quota exceeded */ }
};

const App: React.FC = () => {
  const [state, setState]                 = useState<BackgroundState>(DEFAULT);
  const [showPreview, setShowPreview]     = useState(false);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>('left');
  const [previewFont, setPreviewFont]     = useState<PreviewFont>('sans');
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#f2f0eb]">
      {/* Canvas area */}
      <div
        ref={outerRef}
        className={`flex-1 relative overflow-hidden transition-colors duration-300 ${
          aspectRatio !== 'free' ? 'flex items-center justify-center bg-[#e8e5df]' : ''
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
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
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
              <PreviewOverlay layout={previewLayout} font={previewFont} />
            </div>
          )}
        </div>

        {/* Aspect ratio selector — top centre */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[130] flex items-center bg-white/80 backdrop-blur-md border border-black/10 rounded-full px-1.5 py-1.5 gap-0.5 shadow-lg">
          {RATIOS.map(r => (
            <button
              key={r.id}
              onClick={() => setAspectRatio(r.id)}
              className={`px-3 py-[6px] rounded-full text-[11px] font-medium transition-all ${
                aspectRatio === r.id
                  ? 'bg-[#1a1917] text-[#f2f0eb] shadow-sm'
                  : 'text-black/40 hover:text-black/80'
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
                ? 'bg-[#1a1917] text-[#f2f0eb] border-[#1a1917]'
                : 'bg-white/70 border-black/10 text-black/40 hover:text-black/80 hover:border-black/20'
            }`}
          >
            <i className="ph ph-eye text-sm" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? 'Show panel' : 'Hide panel'}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm border border-black/10 text-black/40 hover:text-black/80 hover:border-black/20 transition-all"
          >
            <i className={`ph ${isFullscreen ? 'ph-sidebar-simple' : 'ph-arrows-out'} text-sm`} />
          </button>
        </div>

        {/* Floating preview toggle */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 bg-white/80 backdrop-blur-md border border-black/10 rounded-full px-1.5 py-1.5 shadow-lg">

          {/* Toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              showPreview ? 'bg-[#1a1917] text-[#f2f0eb]' : 'text-black/60 hover:text-black/90'
            }`}
          >
            <i className={`ph ${showPreview ? 'ph-eye-slash' : 'ph-eye'} text-sm`} />
            {showPreview ? 'Hide' : 'Preview in context'}
          </button>

          {showPreview && (
            <>
              {/* Divider */}
              <div className="w-px h-4 bg-black/12 mx-0.5" />

              {/* Layout icon buttons */}
              {PREVIEW_LAYOUTS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setPreviewLayout(l.id)}
                  title={l.title}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                    previewLayout === l.id
                      ? 'bg-black/10 text-black/90'
                      : 'text-black/35 hover:text-black/70'
                  }`}
                >
                  <i className={`ph ${l.icon} text-base`} />
                </button>
              ))}

              {/* Divider */}
              <div className="w-px h-4 bg-black/12 mx-0.5" />

              {/* Headline font — Sans / Serif, matches the mock's actual title design */}
              <button
                onClick={() => setPreviewFont(f => (f === 'sans' ? 'serif' : 'sans'))}
                title={previewFont === 'sans' ? 'Switch headline to serif' : 'Switch headline to sans-serif'}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                  previewFont === 'serif' ? 'bg-black/10 text-black/90' : 'text-black/35 hover:text-black/70'
                }`}
              >
                <span style={previewFont === 'serif' ? { fontFamily: '"Playfair Display", serif' } : {}} className="text-[15px] font-semibold leading-none">Aa</span>
              </button>

              {/* Divider */}
              <div className="w-px h-4 bg-black/12 mx-0.5" />

              {/* Dim slider */}
              <div className="flex items-center gap-2 px-2">
                <i className="ph ph-circle-half text-black/35 text-sm" />
                <input
                  type="range"
                  min={0} max={80} step={1}
                  value={previewDim}
                  onChange={e => setPreviewDim(Number(e.target.value))}
                  className="heroken-slider w-20"
                  title="Dim background"
                />
                <span className="text-[10px] text-black/40 w-6 tabular-nums">{previewDim}%</span>
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
