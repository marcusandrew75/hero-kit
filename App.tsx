
import React, { useState, useEffect, useRef } from 'react';
import Canvas from './components/Canvas';
import RightPanel from './components/RightPanel';
import PreviewOverlay, { PreviewLayout, PreviewFont, PreviewTheme, PreviewCopy, PreviewCopyField } from './components/PreviewOverlay';
import LooksPanel, { loadHistory, HistoryEntry } from './components/LooksPanel';
import CanvasDropZone from './components/CanvasDropZone';
import LayerTransformOverlay from './components/LayerTransformOverlay';
import LandingPage from './components/LandingPage';
import TeamsPage from './components/TeamsPage';
import PrivacyPage from './components/PrivacyPage';
import TermsPage from './components/TermsPage';
import BottomSheet, { PEEK_HEIGHT } from './components/BottomSheet';
import { useIsMobile } from './hooks/useIsMobile';
import { useVisualViewport } from './hooks/useVisualViewport';
import EggToast from './components/EggToast';
import { BackgroundState } from './types';
import { DEFAULT } from './defaultState';
import { rollDice } from './dice';
import { EASTER_EGGS, EasterEgg } from './easterEggs';
import PaywallPanel from './components/PaywallPanel';
import { supabase } from './services/supabaseClient';
import { fetchEntitlement, getCachedEntitlement, FREE_ENTITLEMENT, Entitlement } from './services/entitlement';
import type { User } from '@supabase/supabase-js';

export { DEFAULT };

// ─── App ──────────────────────────────────────────────────────────────────────

// Phosphor's dice icons are named by word (ph-dice-five), not numeral.
const DICE_FACE_WORDS = ['one', 'two', 'three', 'four', 'five', 'six'];

// Internal kill switches, not user-facing — flip to false and redeploy to
// hide either feature instantly without touching the implementation.
const EXPORT_FLOURISH_ENABLED = false;
const EASTER_EGGS_ENABLED = false;

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
    const { imageUrl: _i, videoUrl: _v, imageAttribution: _a, layers, ...rest } = s;
    // Layer images are uploaded as base64 data-URIs — leaving them in means every
    // 3-second auto-save writes megabytes to localStorage, which silently exhausts
    // the origin's storage quota within minutes and then blocks ALL further writes,
    // including Looks saves (shared quota). History only needs to restore effect
    // settings, not re-embed the actual layer image data. Attribution is stripped
    // alongside its image for the same reason a Look strips it (see LooksPanel's
    // stripMedia) — otherwise it'd be orphaned data disconnected from any photo.
    const strippedLayers = layers?.map(({ imageUrl: _li, attribution: _la, ...l }) => l);
    const entry: HistoryEntry = { id: crypto.randomUUID(), state: { ...rest, layers: strippedLayers }, timestamp: Date.now() };
    const prev = loadHistory();
    localStorage.setItem('herokit-history', JSON.stringify([entry, ...prev].slice(0, HISTORY_MAX)));
  } catch { /* quota exceeded */ }
};

const App: React.FC = () => {
  // Landing page is the front door at the bare URL; the tool lives at ?app
  // ("Open HeroKit" CTAs set it without a reload, so the tool is directly
  // linkable/bookmarkable). Shared Look links (#look=...) skip the landing
  // entirely — someone opening a shared Look wants the tool, not a pitch.
  const [showLanding, setShowLanding] = useState(() =>
    !new URLSearchParams(window.location.search).has('app') &&
    !window.location.hash.startsWith('#look='),
  );
  const [state, setState]                 = useState<BackgroundState>(DEFAULT);
  const [showPreview, setShowPreview]     = useState(false);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>('left');
  const [previewFont, setPreviewFont]     = useState<PreviewFont>('sans');
  const [previewDim, setPreviewDim]       = useState(0);
  // Custom copy typed onto the preview — persists across sessions so a user's
  // real headline/brand follows them into every future preview.
  const [previewCopy, setPreviewCopy]     = useState<PreviewCopy>(() => {
    try { return JSON.parse(localStorage.getItem('herokit-preview-copy') || '{}'); }
    catch { return {}; }
  });
  // Text theme + uploaded logo — persisted for the same reason as the copy.
  const [previewTheme, setPreviewTheme]   = useState<PreviewTheme>(() =>
    (localStorage.getItem('herokit-preview-theme') as PreviewTheme) || 'light');
  const [previewLogo, setPreviewLogo]     = useState<string | null>(() =>
    localStorage.getItem('herokit-preview-logo'));
  // Optional mock elements removed via their hover ✕ (eyebrow, subhead…)
  const [previewHidden, setPreviewHidden] = useState<PreviewCopyField[]>(() => {
    try { return JSON.parse(localStorage.getItem('herokit-preview-hidden') || '[]'); }
    catch { return []; }
  });
  const [showLooks, setShowLooks]         = useState(false);
  // Auth/entitlement — sibling state, deliberately NOT part of BackgroundState
  // (which is pure design-state, serialized into Looks/History/share-links).
  // entitlement starts from the cached last-known plan (see services/
  // entitlement.ts) so the export/Looks gates don't flash "free" for a frame
  // before the real Supabase round-trip resolves on load.
  const [showPaywall, setShowPaywall]     = useState(false);
  const [user, setUser]                   = useState<User | null>(null);
  const [entitlement, setEntitlement]     = useState<Entitlement>(getCachedEntitlement());
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) { setEntitlement(FREE_ENTITLEMENT); return; }
    let cancelled = false;
    fetchEntitlement(user.id).then(e => { if (!cancelled) setEntitlement(e); });
    return () => { cancelled = true; };
  }, [user]);
  // Stripe redirects back here with ?checkout=success before the webhook
  // necessarily lands — poll briefly rather than a single fetch, since
  // there's a real (usually sub-second, but not guaranteed) race between
  // the redirect and Stripe's server-to-server webhook call.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!user || !params.has('checkout')) return;
    const wasSuccess = params.get('checkout') === 'success';
    params.delete('checkout');
    const cleanSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash);
    if (!wasSuccess) return;
    let cancelled = false;
    let attempts = 0;
    const poll = () => {
      fetchEntitlement(user.id).then(e => {
        if (cancelled) return;
        setEntitlement(e);
        if (e.plan !== 'pro' && attempts < 5) { attempts++; setTimeout(poll, 1500); }
      });
    };
    poll();
    return () => { cancelled = true; };
  }, [user]);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const isMobile = useIsMobile();
  const { offsetTop: viewportOffsetTop, height: viewportHeight } = useVisualViewport();
  const showDebug = typeof window !== 'undefined' && window.location.search.includes('debug');
  const [sheetState, setSheetState]       = useState<'peek' | 'expanded'>('peek');
  const [aspectRatio, setAspectRatio]     = useState('free');
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false);
  const [boxSize, setBoxSize]             = useState<{ w: number; h: number } | null>(null);
  const [hideEffects, setHideEffects]     = useState(false);
  // Which layer (if any) is being repositioned directly on the canvas —
  // transient UI state, never persisted into Looks/History, same treatment
  // as showPreview/isFullscreen/hideEffects above.
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
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
          r.onload = ev => setState(prev => ({ ...prev, imageUrl: ev.target?.result as string, videoUrl: undefined, imageAttribution: undefined }));
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

  // Easter eggs — quiet discovery, not gamification: no badges, no streaks,
  // nothing persisted. foundEggs is in-memory only (dies on reload) so an
  // egg found last session can always be stumbled into again, rather than
  // becoming a tracked "already unlocked" checklist item. The dedupe Set
  // also doubles as edge-detection for free — re-matching an id already in
  // it is a no-op, so nudging a slider back and forth inside an
  // already-matched range doesn't refire, and only one new match surfaces
  // per state-change tick even if a Look/History restore satisfies two at once.
  const foundEggs = useRef<Set<string>>(new Set());
  const [activeEgg, setActiveEgg] = useState<EasterEgg | null>(null);
  const eggDismissTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!EASTER_EGGS_ENABLED) return;
    const match = EASTER_EGGS.find(egg => !foundEggs.current.has(egg.id) && egg.test(state));
    if (match) {
      foundEggs.current.add(match.id);
      setActiveEgg(match);
      clearTimeout(eggDismissTimer.current);
      eggDismissTimer.current = setTimeout(() => setActiveEgg(null), 4000);
    }
  }, [state]);

  // Clear editingLayerId if the layer it points at no longer exists —
  // covers deletion mid-edit without relying on every call site remembering to.
  useEffect(() => {
    if (editingLayerId && !state.layers.some(l => l.id === editingLayerId)) {
      setEditingLayerId(null);
    }
  }, [editingLayerId, state.layers]);

  const handleChange = (patch: Partial<BackgroundState>) => setState(prev => ({ ...prev, ...patch }));

  // Layer positioning and Preview in Context both want the same canvas real
  // estate and both bind pointer/click handling there — mutually exclusive.
  const handleEditLayer = (id: string | null) => {
    setEditingLayerId(id);
    if (id !== null) setShowPreview(false);
  };

  const handlePreviewCopyChange = (field: PreviewCopyField, value: string | null) => {
    setPreviewCopy(prev => {
      const next = { ...prev };
      if (value === null) delete next[field];
      else next[field] = value;
      try { localStorage.setItem('herokit-preview-copy', JSON.stringify(next)); } catch { /* quota — non-critical */ }
      return next;
    });
  };

  // Reset restores both custom copy and any elements removed via their ✕
  const handlePreviewCopyReset = () => {
    setPreviewCopy({});
    setPreviewHidden([]);
    try {
      localStorage.removeItem('herokit-preview-copy');
      localStorage.removeItem('herokit-preview-hidden');
    } catch { /* non-critical */ }
  };

  const handlePreviewHide = (field: PreviewCopyField) => {
    setPreviewHidden(prev => {
      const next = prev.includes(field) ? prev : [...prev, field];
      try { localStorage.setItem('herokit-preview-hidden', JSON.stringify(next)); } catch { /* non-critical */ }
      return next;
    });
  };

  const handlePreviewThemeToggle = () => {
    setPreviewTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('herokit-preview-theme', next); } catch { /* non-critical */ }
      return next;
    });
  };

  const handlePreviewLogoChange = (dataUrl: string | null) => {
    setPreviewLogo(dataUrl);
    try {
      if (dataUrl === null) localStorage.removeItem('herokit-preview-logo');
      else localStorage.setItem('herokit-preview-logo', dataUrl);
    } catch { /* quota — logo still works for this session */ }
  };

  const handleApplyLook = (patch: Partial<BackgroundState>) =>
    setState(prev => ({ ...prev, ...patch, imageUrl: prev.imageUrl, videoUrl: prev.videoUrl, imageAttribution: prev.imageAttribution }));

  // Reset all effects to defaults, keep the source image
  const handleResetEffects = () =>
    setState(prev => ({ ...DEFAULT, imageUrl: prev.imageUrl, videoUrl: prev.videoUrl, imageAttribution: prev.imageAttribution }));

  // The Dice — random effect stack. Full reset to DEFAULT first (so nothing
  // from a prior roll lingers), then the roll's patch on top, then re-pin
  // media + layers back to prev — Dice is about the per-pixel effect stack,
  // not the source image or the compositional Layer 2/3 images someone's
  // placed. lastDiceHero avoids repeating the same hero twice in a row.
  const lastDiceHero = useRef<string>();
  const handleDiceRoll = () => {
    const { patch, hero } = rollDice(lastDiceHero.current);
    lastDiceHero.current = hero;
    setState(prev => ({
      ...DEFAULT, ...patch,
      imageUrl: prev.imageUrl, videoUrl: prev.videoUrl, imageAttribution: prev.imageAttribution,
      layers: prev.layers,
    }));
  };

  // Dice roll lifecycle: spin the button icon through a few faces first (a
  // snap-instant change wouldn't read as a "roll"), then keep the larger
  // centered overlay up until the canvas actually finishes recomputing the
  // new effect stack — canvasProcessing is Canvas's own real pipeline signal
  // (Canvas.tsx's ProcessedImageCanvas), so this tracks genuine work rather
  // than a fixed guess at how long a given effect stack takes to compute.
  const [diceFace, setDiceFace] = useState(5);
  const [dicePhase, setDicePhase] = useState<'idle' | 'spinning' | 'processing'>('idle');
  const [canvasProcessing, setCanvasProcessing] = useState(false);
  const diceKickoff = useRef<ReturnType<typeof setTimeout>>();
  const diceSafety = useRef<ReturnType<typeof setTimeout>>();
  const sawProcessing = useRef(false);

  useEffect(() => () => { clearTimeout(diceKickoff.current); clearTimeout(diceSafety.current); clearTimeout(exportSafety.current); clearTimeout(eggDismissTimer.current); }, []);

  // Keep cycling the face for as long as the overlay is up (spin + wait) —
  // most die faces are close to rotationally symmetric, so a single fixed
  // face just spinning/pulsing barely reads as motion; changing which face
  // shows makes it unmistakable.
  useEffect(() => {
    if (dicePhase === 'idle') return;
    const t = setInterval(() => setDiceFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(t);
  }, [dicePhase]);

  useEffect(() => {
    if (dicePhase !== 'processing') return;
    if (canvasProcessing) {
      sawProcessing.current = true;
    } else if (sawProcessing.current) {
      sawProcessing.current = false;
      clearTimeout(diceSafety.current);
      setDicePhase('idle');
    }
  }, [canvasProcessing, dicePhase]);

  const handleDiceClick = () => {
    if (dicePhase !== 'idle') return;
    setDicePhase('spinning');
    diceKickoff.current = setTimeout(() => {
      handleDiceRoll();
      setDicePhase('processing');
      // Safety net — don't leave the overlay stuck if processing never
      // reports back (e.g. a roll that somehow needs no pipeline pass).
      diceSafety.current = setTimeout(() => setDicePhase('idle'), 2500);
    }, 480);
  };

  // Export flourish — RightPanel's own handleExport drives this via
  // onExportPhaseChange (the mirror of Canvas's onProcessingChange, just
  // flowing the other direction), since a 4x capture can take several real
  // seconds and 'processing' is held open by RightPanel's own await, not a
  // guess. Unlike Dice there's no separate pipeline-recompute signal to
  // wait on — RightPanel's own `finally` is the sole source of truth for
  // "done" — so a single safety timeout reset on every phase change is
  // enough, no sawProcessing-style edge tracking needed.
  const [exportPhase, setExportPhase] = useState<'idle' | 'winding' | 'processing'>('idle');
  const exportSafety = useRef<ReturnType<typeof setTimeout>>();
  const handleExportPhaseChange = (phase: 'idle' | 'winding' | 'processing') => {
    clearTimeout(exportSafety.current);
    setExportPhase(phase);
    if (phase !== 'idle') {
      exportSafety.current = setTimeout(() => setExportPhase('idle'), 6000);
    }
  };

  useEffect(() => () => { clearTimeout(exportSafety.current); }, []);

  const hasSource = !!(state.imageUrl || state.videoUrl);

  // /teams, /privacy, /terms — static pages (served via the vercel.json SPA
  // rewrite; Vite's dev server falls back to index.html for unknown paths
  // natively).
  if (window.location.pathname === '/teams') {
    return <TeamsPage />;
  }
  if (window.location.pathname === '/privacy') {
    return <PrivacyPage />;
  }
  if (window.location.pathname === '/terms') {
    return <TermsPage />;
  }

  if (showLanding) {
    return (
      <LandingPage onOpen={() => {
        history.replaceState(null, '', `${window.location.pathname}?app`);
        setShowLanding(false);
      }} />
    );
  }

  // dvh (falls back to the h-screen class's 100vh on browsers that don't
  // support it) rather than plain vh — iOS Safari's address bar can
  // collapse/expand as you scroll (e.g. scrolling inside the sheet), which
  // changes the effective viewport height mid-session; 100vh doesn't track
  // that, so fixed-positioned chrome (ratio selector, top-right cluster) can
  // end up positioned against a stale reference and appear to drift toward
  // the top. dvh tracks the real visible viewport instead.
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f2f0eb]" style={{ height: '100dvh' }}>
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
          <Canvas state={state} hideEffects={hideEffects} onProcessingChange={setCanvasProcessing} />

          {/* Dice roll — big rotating, slowly pulsing die centered on the
              canvas while the new effect stack spins in, so it's obvious
              something's happening rather than the canvas just silently
              changing. Rotation (animate-spin) and the size pulse are two
              separate nested elements so each keeps its own easing/speed
              instead of compromising both into a single keyframe — and the
              face itself keeps changing (diceFace), since most die faces
              are close to rotationally symmetric and a single fixed face
              just spinning barely reads as motion on its own. */}
          {dicePhase !== 'idle' && (
            <div className="absolute inset-0 z-[135] flex items-center justify-center pointer-events-none bg-black/10">
              <div style={{ animation: 'herokit-dice-pulse 1.8s ease-in-out infinite' }}>
                <i className={`ph-bold ph-dice-${DICE_FACE_WORDS[diceFace - 1]} text-white animate-spin`}
                  style={{ fontSize: 72, filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.4))' }} />
              </div>
            </div>
          )}

          {/* Export flourish — a Polaroid-style card ejects in from above
              while RightPanel's handleExport does the real toPng/toJpeg
              capture, so exporting reads as a small tactile moment instead
              of an instant silent download. 'winding' is a fixed cosmetic
              slide-in-and-settle (no real work yet); 'processing' holds the
              settled card with a soft developing sheen for as long as the
              real capture takes (can be several seconds at 4x); clearing
              back to 'idle' is driven by RightPanel's own promise
              resolution (see onExportPhaseChange), with App's own safety
              timeout as a fallback. No early pixel capture — the photo
              window is a flat decorative fill, not a live preview. */}
          {EXPORT_FLOURISH_ENABLED && exportPhase !== 'idle' && (
            <div className="absolute inset-0 z-[136] flex items-start justify-center pointer-events-none overflow-hidden bg-black/10">
              <div
                className="bg-white shadow-2xl"
                style={{
                  width: '42%',
                  aspectRatio: '4 / 5',
                  marginTop: '18%',
                  padding: '4% 4% 14%',
                  transform: 'translateY(0) rotate(-1.5deg)',
                  animation: exportPhase === 'winding'
                    ? 'herokit-polaroid-eject 420ms cubic-bezier(0.2,0.8,0.3,1) both'
                    : undefined,
                  transition: 'opacity 260ms ease',
                  boxShadow: '0 20px 44px rgba(0,0,0,0.35)',
                }}
              >
                <div className="relative w-full h-full overflow-hidden" style={{ background: '#efece4' }}>
                  {exportPhase === 'processing' && (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
                        animation: 'herokit-polaroid-sheen 1.6s ease-in-out infinite',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Drop zone — shown when no image/video loaded. Stays interactive
              (drag/drop, click-to-browse) even when an atmosphere effect is
              active on its own, but hides its big icon/text so the effect
              is actually visible instead of being covered by an empty-state
              placeholder that implies nothing is happening. */}
          {!hasSource && (
            <CanvasDropZone onChange={handleChange} minimal={state.atmosphereStyle !== 'none'} />
          )}

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
              <PreviewOverlay layout={previewLayout} font={previewFont} theme={previewTheme}
                copy={previewCopy} onCopyChange={handlePreviewCopyChange}
                logo={previewLogo} onLogoChange={handlePreviewLogoChange}
                hidden={previewHidden} onHide={handlePreviewHide}
                navInset={aspectRatio === 'free'} />
            </div>
          )}

          {/* Direct-manipulation layer position/resize — mutually exclusive
              with Preview in Context, see handleEditLayer */}
          {editingLayerId && (() => {
            const layer = state.layers.find(l => l.id === editingLayerId);
            if (!layer) return null;
            return (
              <LayerTransformOverlay
                layer={layer}
                onChange={patch => handleChange({
                  layers: state.layers.map(l => l.id === editingLayerId ? { ...l, ...patch } : l),
                })}
                onDone={() => setEditingLayerId(null)}
              />
            );
          })()}
        </div>

        {/* Aspect ratio selector — a wide pill row on desktop, but that same
            row either overflowed or truncated illegibly against the
            top-right cluster on a real phone (confirmed on-device), so
            mobile gets a single tap-to-open dropdown instead — a much more
            standard, discoverable mobile pattern than a hidden horizontal
            scroll. */}
        {isMobile ? (
          <div className="absolute z-[130]" style={{ top: `calc(env(safe-area-inset-top, 0px) + ${viewportOffsetTop + 16}px)`, left: 16 }}>
            <button
              onClick={() => setRatioMenuOpen(v => !v)}
              className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md border border-black/10 rounded-full pl-3 pr-2.5 py-1.5 text-[11px] font-medium text-black/70 shadow-lg"
            >
              {RATIOS.find(r => r.id === aspectRatio)?.label ?? 'Free'}
              <i className={`ph ph-caret-down text-xs transition-transform ${ratioMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {ratioMenuOpen && (
              <div className="absolute top-full left-0 mt-1.5 bg-white/95 backdrop-blur-md border border-black/10 rounded-2xl p-1.5 shadow-lg flex flex-col gap-0.5 min-w-[104px]">
                {RATIOS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setAspectRatio(r.id); setRatioMenuOpen(false); }}
                    className={`px-3 py-2 rounded-xl text-[12px] font-medium text-left transition-all ${
                      aspectRatio === r.id ? 'bg-[#1a1917] text-[#f2f0eb]' : 'text-black/60'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
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
        )}

        {/* Top-right button cluster — safe-area-aware top offset on mobile,
            plus visualViewport.offsetTop (see hooks/useVisualViewport) so it
            tracks Safari's own collapsing/expanding toolbar rather than
            sitting at a fixed offset that can end up partially behind it
            mid-transition. */}
        <div className="absolute right-4 z-[130] flex items-center gap-2"
          style={{ top: isMobile ? `calc(env(safe-area-inset-top, 0px) + ${viewportOffsetTop + 16}px)` : 16 }}>
          {/* The Dice — random effect stack */}
          <button
            onClick={handleDiceClick}
            title="Roll the dice — random effect stack"
            disabled={!hasSource || dicePhase !== 'idle'}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm border border-black/10 text-black/40 hover:text-black/80 hover:border-black/20 transition-all disabled:opacity-30"
          >
            <i className={`ph-bold ph-dice-${DICE_FACE_WORDS[(dicePhase !== 'idle' ? diceFace : 5) - 1]} text-lg`} />
          </button>

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

          {/* Fullscreen toggle — desktop only. On mobile the canvas is
              already full-bleed with the panel as an overlay sheet, so
              there's no "hide the sidebar" state for this to control. */}
          {!isMobile && (
            <button
              onClick={() => setIsFullscreen(v => !v)}
              title={isFullscreen ? 'Show panel' : 'Hide panel'}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm border border-black/10 text-black/40 hover:text-black/80 hover:border-black/20 transition-all"
            >
              <i className={`ph ${isFullscreen ? 'ph-sidebar-simple' : 'ph-arrows-out'} text-sm`} />
            </button>
          )}
        </div>

        {/* Floating preview toggle — on mobile it needs to sit above the
            peeked sheet rather than overlap it, and its expanded state (which
            grows quite a bit wider) needs to stay on-screen on a narrow
            viewport rather than overflow off the edge. */}
        <div className="absolute left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 bg-white/80 backdrop-blur-md border border-black/10 rounded-full px-1.5 py-1.5 shadow-lg max-w-[calc(100vw-24px)] overflow-x-auto"
          style={{ bottom: isMobile ? PEEK_HEIGHT + 12 : 24 }}>

          {/* Toggle */}
          <button
            onClick={() => { setShowPreview(v => !v); setEditingLayerId(null); }}
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

              {/* Text theme — white type for dark images, ink type for light ones */}
              <button
                onClick={handlePreviewThemeToggle}
                title={previewTheme === 'light' ? 'Switch preview text to dark (for light backgrounds)' : 'Switch preview text to light (for dark backgrounds)'}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-all text-black/35 hover:text-black/70"
              >
                <span className="w-4 h-4 rounded-full border border-black/30"
                  style={{ background: previewTheme === 'light' ? '#ffffff' : '#1a1917' }} />
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

              {/* Reset custom copy / hidden elements — only surfaces once something's changed */}
              {(Object.keys(previewCopy).length > 0 || previewHidden.length > 0) && (
                <>
                  <div className="w-px h-4 bg-black/12 mx-0.5" />
                  <button
                    onClick={handlePreviewCopyReset}
                    title="Reset preview copy and restore removed elements"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-black/35 hover:text-black/70 transition-all"
                  >
                    {/* arrow-counter-clockwise matches the sidebar's Reset affordance —
                        text-t-slash rendered as a broken-looking glyph in this icon set */}
                    <i className="ph ph-arrow-counter-clockwise text-base" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right panel — on mobile the canvas stays full-bleed and the panel
          floats over it as a bottom sheet instead of reflowing a side
          column; on desktop it's the existing fixed-width sidebar whose GPU
          layer keeps the compositor texture alive during the width
          animation so no per-frame repaint. */}
      {isMobile ? (
        <BottomSheet state={sheetState} onStateChange={setSheetState}>
          <RightPanel state={state} onChange={handleChange} onOpenLooks={() => setShowLooks(true)} onResetEffects={handleResetEffects} onOpenAccount={() => setShowPaywall(true)}
            editingLayerId={editingLayerId} onEditLayer={handleEditLayer} mobile
            onExportPhaseChange={EXPORT_FLOURISH_ENABLED ? handleExportPhaseChange : undefined} />
        </BottomSheet>
      ) : (
        <div
          style={{ width: isFullscreen ? 0 : 310, transition: 'width 280ms cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0 }}
        >
          <div style={{ width: 310, height: '100%', transform: 'translateZ(0)' }}>
            <RightPanel state={state} onChange={handleChange} onOpenLooks={() => setShowLooks(true)} onResetEffects={handleResetEffects} onOpenAccount={() => setShowPaywall(true)}
              editingLayerId={editingLayerId} onEditLayer={handleEditLayer}
              onExportPhaseChange={EXPORT_FLOURISH_ENABLED ? handleExportPhaseChange : undefined} />
          </div>
        </div>
      )}

      {/* Looks panel modal */}
      {showLooks && (
        <LooksPanel
          state={state}
          onApply={handleApplyLook}
          onClose={() => setShowLooks(false)}
        />
      )}

      <PaywallPanel
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        user={user}
        entitlement={entitlement}
      />

      {/* Temporary viewport debug readout — only shown when ?debug is in the
          URL, so real users never see it. Lets a real iOS device report the
          actual numbers back (does visualViewport even shrink for the
          keyboard? by how much?) instead of me guessing blind. */}
      {showDebug && (
        <div className="fixed top-1/2 left-2 z-[999] pointer-events-none font-mono text-[11px] leading-tight px-2 py-1.5 rounded"
          style={{ background: 'rgba(0,0,0,0.8)', color: '#0f0' }}>
          innerH: {typeof window !== 'undefined' ? window.innerHeight : 0}<br />
          vvH: {Math.round(viewportHeight)}<br />
          vvTop: {Math.round(viewportOffsetTop)}<br />
          kbd: {typeof window !== 'undefined' ? Math.round(window.innerHeight - viewportHeight - viewportOffsetTop) : 0}
        </div>
      )}

      {EASTER_EGGS_ENABLED && <EggToast message={activeEgg?.message ?? null} />}
    </div>
  );
};

export default App;
