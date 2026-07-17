
import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BUILT_IN_PRESETS } from '../presets';
import { toPng, toJpeg } from 'html-to-image';
import SpotBlurMap from './SpotBlurMap';
import EffectMaskPad from './EffectMaskPad';
import DocsPanel from './DocsPanel';
import { generateBackground } from '../services/generate';
import {
  HardwarePanel, HardwareRow, KnobSlider, TactileToggle, PatternGrid, ColorSwatch, LcdDisplay, T, TabBar,
} from './ui/HardwareControls';
import {
  BackgroundState, PatternStyle, ImageFilter, ImageMask,
  DitherStyle, ExportFormat, ExportResolution,
  AmbientPosition, ImageLayer, LayerBlendMode, AtmosphereStyle, ImageAttribution,
} from '../types';

// ─── Local primitives ────────────────────────────────────────────────────────

// ─── Thumbnail hover preview ─────────────────────────────────────────────────
// The gallery/Pexels grids show tiny 48-64px center-cropped squares, which
// makes it hard to judge composition when browsing. Hovering a thumb shows a
// much larger, un-cropped preview floating to the left of the sidebar.
// Portaled to document.body since the sidebar's own wrapper has a
// `transform: translateZ(0)` (App.tsx) which creates a containing block for
// `position: fixed` descendants — same reason DocsPanel is portaled.
const THUMB_PREVIEW_MAX = 260;   // px, both width and height cap
const THUMB_PREVIEW_GAP = 322;   // px from viewport right edge — sidebar width (310) + margin

interface ThumbHover { src: string; top: number; }

/** Per-grid hover state: call bind(src) on a thumb's onMouseEnter/onMouseLeave. */
const useThumbHover = () => {
  const [hover, setHover] = useState<ThumbHover | null>(null);
  const timerRef = useRef<number>();
  const onEnter = (src: string) => (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const top = Math.max(12, Math.min(window.innerHeight - 12 - THUMB_PREVIEW_MAX, centerY - THUMB_PREVIEW_MAX / 2));
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setHover({ src, top }), 120);
  };
  const onLeave = () => { clearTimeout(timerRef.current); setHover(null); };
  return { hover, onEnter, onLeave };
};

const ThumbHoverPreview: React.FC<{ hover: ThumbHover | null }> = ({ hover }) => {
  if (!hover) return null;
  return createPortal(
    <div className="fixed z-[300] pointer-events-none rounded-xl border p-1.5"
      style={{
        right: THUMB_PREVIEW_GAP, top: hover.top,
        background: T.surface, borderColor: T.border,
        boxShadow: '0 12px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
      }}>
      <img src={hover.src} alt=""
        style={{ display: 'block', maxWidth: THUMB_PREVIEW_MAX, maxHeight: THUMB_PREVIEW_MAX, width: 'auto', height: 'auto', borderRadius: 8 }} />
    </div>,
    document.body,
  );
};

/** Light-themed horizontal range slider with accent-coloured fill track + LCD readout. */
const HwSlider: React.FC<{
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; decimals?: number; unit?: string;
}> = ({ value, min, max, step = 1, onChange, decimals = 0, unit = '' }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="hw-slider flex-1 min-w-0"
        style={{ background: `linear-gradient(to right,${T.accent} 0%,${T.accent} ${pct}%,${T.border} ${pct}%,${T.border} 100%)` }}
      />
      <LcdDisplay
        value={value} min={min} max={max}
        step={step} decimals={decimals} unit={unit}
        onChange={onChange} small
      />
    </div>
  );
};

/** Pill-shaped segmented control. */
const HwSegment: React.FC<{
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => {
  const count = options.length;
  const activeIdx = Math.max(0, options.findIndex(o => o.id === value));

  return (
    <div
      className="relative flex rounded-full w-full border"
      style={{
        background: T.panel,
        borderColor: T.border,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)',
        padding: 3,
      }}
    >
      {/* Sliding white pill — moves to the active option with a spring easing.
          calc(3px + N * ((100% - 6px) / count)) positions it exactly under each
          equal-width flex-1 button regardless of the container's actual width.  */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 3, bottom: 3,
          left:  `calc(3px + ${activeIdx} * ((100% - 6px) / ${count}))`,
          width: `calc((100% - 6px) / ${count})`,
          background: T.surface,
          borderRadius: 9999,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
      />
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="leading-none"
          style={{
            position: 'relative', zIndex: 1,
            flex: 1,
            padding: '5px 0',
            fontSize: 11, fontWeight: 600,
            borderRadius: 9999,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: value === o.id ? T.text : T.muted,
            transition: 'color 0.22s ease',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

/** Label row — label on left, control(s) on right. */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-3">
    <span className="text-[11px] font-medium shrink-0 w-[80px] select-none" style={{ color: T.muted }}>{label}</span>
    <div className="flex-1 flex items-center justify-end gap-2 min-w-0">{children}</div>
  </div>
);

/** Single effect row: number + label + toggle, with collapsible param body below. */
const EffectSection: React.FC<{
  label: string;
  number: number;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}> = ({ label, number, enabled, onToggle, children }) => (
  <div>
    <div className="flex items-center gap-2 py-2.5"
      style={{
        /* 3D groove divider — two hairlines: shadow below, highlight above.
           Gives the appearance of a machined channel pressed into the panel. */
        borderBottom: `1px solid ${T.borderDk}`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.75)`,
      }}>
      {/* LED status dot — glows when effect is active, invisible when off */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200"
        style={enabled ? {
          background: T.accent,
          boxShadow: `0 0 5px rgba(232,67,32,0.55), 0 0 2px ${T.accent}`,
        } : {
          background: T.border,
          boxShadow: 'none',
        }}
      />
      {/* Sequential row number — same Share Tech Mono treatment as panel numbers,
          turns a long toggle list into something that reads like a patch bay. */}
      <span
        className="leading-none shrink-0"
        style={{
          fontFamily: '"Share Tech Mono", ui-monospace, monospace',
          fontSize: 10, color: T.dim, letterSpacing: '0.04em',
        }}
      >
        {String(number).padStart(2, '0')}
      </span>
      <span className="text-[9px] font-bold tracking-[0.09em] uppercase flex-1 select-none whitespace-nowrap" style={{ color: T.text }}>
        {label}
      </span>
      <TactileToggle value={enabled} onChange={onToggle} />
    </div>
    {enabled && children && (
      <div className="pt-4 pb-3 space-y-4">{children}</div>
    )}
  </div>
);

// ─── Gallery constants ───────────────────────────────────────────────────────

const GALLERY = [
  'AI_Bg_02','AI_Bg_05','AI_Bg_07','AI_Bg_08','AI_Bg_09',
  'AI_Bg_011','AI_Bg_012','AI_Bg_012-1','AI_Bg_013','AI_Bg_013-1',
  'AI_Bg_016','AI_Bg_018','AI_Bg_019','AI_Bg_020','AI_Bg_021',
  'AI_Bg_025','AI_Bg_025-1','AI_Bg_028','AI_Bg_029','AI_Bg_030',
  'AI_Bg_030-1','AI_Bg_031','AI_Bg_031-1','AI_Bg_032','AI_Bg_033',
  'AI_Bg_034','AI_Bg_035','AI_Bg_037','AI_Bg_038','AI_Bg_042',
  'AI_Bg_043','AI_Bg_044','AI_Bg_047','AI_Bg_047-1','AI_Bg_048',
  'AI_Bg_052','AI_Bg_053','AI_Bg_054','AI_Bg_054-1','AI_Bg_055',
  'AI_Bg_057','AI_Bg_074','AI_Bg_077','AI_Bg_078','AI_Bg_079',
  'AI_Bg_082',
].map(name => ({
  thumb: `/super-visuals-ahmed-hassan/thumbs/${name}.webp`,
  src:   `/super-visuals-ahmed-hassan/${name}.jpg`,
}));

const GALLERY_INITIAL = 8;
const PEXELS_KEY      = (import.meta as any).env?.VITE_PEXELS_API_KEY as string;
const QUICK_SEARCHES  = ['Landscape', 'Atmospheric', 'Cinematic', 'Cosmic', 'Abstract', 'Moody'];

interface PexelsPhoto {
  id: number; alt: string; photographer: string;
  src: { small: string; medium: string; large2x: string };
}

// Trimmed shape returned by api/unsplash-search.ts (already mapped down from
// Unsplash's raw response server-side).
interface UnsplashPhoto {
  id: string; alt: string;
  urls: { small: string; regular: string };
  user: { name: string; profileUrl: string };
  downloadLocation: string;
}

// Unsplash's mandatory "download" tracking ping — must fire the moment a
// user actually selects a photo, not just when it's displayed in search
// results. Shared by GallerySection and LayerPicker so it's wired in exactly
// one place rather than risking one call site remembering it and the other
// forgetting. Fire-and-forget: the response isn't needed, and a failure here
// shouldn't block the user from using the photo they just picked.
const trackUnsplashDownload = (downloadLocation: string) => {
  fetch(`/api/unsplash-download?url=${encodeURIComponent(downloadLocation)}`).catch(() => {});
};

// ─── Gallery section ─────────────────────────────────────────────────────────

const GallerySection: React.FC<{
  imageUrl?: string;
  onChange: (p: Partial<BackgroundState>) => void;
}> = ({ imageUrl, onChange }) => {
  const [tab, setTab]           = useState<'curated' | 'pexels' | 'unsplash'>('curated');
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<PexelsPhoto[]>([]);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [uQuery, setUQuery]         = useState('');
  const [uResults, setUResults]     = useState<UnsplashPhoto[]>([]);
  const [uPage, setUPage]           = useState(1);
  const [uHasMore, setUHasMore]     = useState(false);
  const [uSearching, setUSearching] = useState(false);
  const [uLastQuery, setULastQuery] = useState('');
  const { hover, onEnter, onLeave } = useThumbHover();

  const fetchPexels = async (q: string, pg: number) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20&page=${pg}&orientation=landscape`,
        { headers: { Authorization: PEXELS_KEY } },
      );
      const data = await res.json();
      const photos: PexelsPhoto[] = data.photos ?? [];
      setResults(pg === 1 ? photos : prev => [...prev, ...photos]);
      setHasMore(photos.length === 20);
      setLastQuery(q); setPage(pg);
    } catch { /* silent */ } finally { setSearching(false); }
  };

  const fetchUnsplash = async (q: string, pg: number) => {
    if (!q.trim()) return;
    setUSearching(true);
    try {
      const res = await fetch(`/api/unsplash-search?query=${encodeURIComponent(q)}&page=${pg}`);
      const data = await res.json();
      const photos: UnsplashPhoto[] = data.results ?? [];
      setUResults(pg === 1 ? photos : prev => [...prev, ...photos]);
      setUHasMore(!!data.hasMore);
      setULastQuery(q); setUPage(pg);
    } catch { /* silent */ } finally { setUSearching(false); }
  };

  const doSearch = (q: string) => { setQuery(q); setResults([]); fetchPexels(q, 1); };
  const doUnsplashSearch = (q: string) => { setUQuery(q); setUResults([]); fetchUnsplash(q, 1); };
  const visible  = expanded ? GALLERY : GALLERY.slice(0, GALLERY_INITIAL);

  const thumbCls = (active: boolean) =>
    `relative aspect-square overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
      active ? 'border-[#1a1917]' : 'border-transparent hover:border-[#b8b4aa]'
    }`;

  return (
    <div className="space-y-2.5">
      {/* Tab bar — sliding pill */}
      <TabBar
        options={[{ id: 'curated', label: 'Curated' }, { id: 'pexels', label: 'Pexels' }, { id: 'unsplash', label: 'Unsplash' }]}
        value={tab} onChange={v => setTab(v as 'curated' | 'pexels' | 'unsplash')}
        size="sm"
      />
      {tab === 'curated' && (
        <p className="text-[9px] text-right" style={{ color: T.dim }}>
          By <a href="https://x.com/uihssn" target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-70" style={{ color: T.muted }}>Ahmed Hassan</a>
        </p>
      )}
      {tab === 'pexels' && (
        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer"
          className="block text-right text-[9px] hover:opacity-70 transition-opacity" style={{ color: T.muted }}>Photos by Pexels</a>
      )}
      {tab === 'unsplash' && (
        <a href="https://unsplash.com/?utm_source=herokit&utm_medium=referral" target="_blank" rel="noopener noreferrer"
          className="block text-right text-[9px] hover:opacity-70 transition-opacity" style={{ color: T.muted }}>Photos by Unsplash</a>
      )}

      {/* Curated grid */}
      {tab === 'curated' && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {visible.map(item => (
              <button key={item.src} onClick={() => onChange({ imageUrl: item.src, videoUrl: undefined, imageAttribution: undefined })}
                onMouseEnter={onEnter(item.src)} onMouseLeave={onLeave}
                className={thumbCls(imageUrl === item.src)}>
                <img src={item.thumb} alt="" width={64} height={64} className="w-full h-full object-cover" loading="eager" decoding="async" />
                {imageUrl === item.src && <div className="absolute inset-0 bg-black/10" />}
              </button>
            ))}
          </div>
          {!expanded && GALLERY.length > GALLERY_INITIAL && (
            <button onClick={() => setExpanded(true)}
              className="w-full py-2 text-[10px] font-medium rounded-lg border transition-all"
              style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
              View all {GALLERY.length} images
            </button>
          )}
          {expanded && (
            <button onClick={() => setExpanded(false)}
              className="w-full py-2 text-[10px] font-medium rounded-lg border transition-all"
              style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
              Show less
            </button>
          )}
        </>
      )}

      {/* Pexels search */}
      {tab === 'pexels' && (
        <>
          <div className="flex flex-wrap gap-1">
            {QUICK_SEARCHES.map(q => (
              <button key={q} onClick={() => doSearch(q)}
                className="px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all"
                style={{
                  borderColor: lastQuery.toLowerCase() === q.toLowerCase() ? T.accent : T.border,
                  color: lastQuery.toLowerCase() === q.toLowerCase() ? T.accent : T.muted,
                  background: T.panel,
                }}>{q}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input type="text" placeholder="Search Pexels…" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(query)}
              className="flex-1 rounded-lg px-3 py-1.5 text-[11px] outline-none border transition-colors"
              style={{ background: T.panel, borderColor: T.border, color: T.text }} />
            <button onClick={() => doSearch(query)} disabled={searching}
              className="px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all disabled:opacity-40"
              style={{ background: T.text, color: T.bg }}>
              {searching ? '…' : 'Go'}
            </button>
          </div>
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {results.map(photo => (
                <button key={photo.id}
                  onClick={() => onChange({ imageUrl: photo.src.large2x, videoUrl: undefined, imageAttribution: undefined })}
                  onMouseEnter={onEnter(photo.src.medium)} onMouseLeave={onLeave}
                  title={`${photo.alt || 'Photo'} · ${photo.photographer}`}
                  className={thumbCls(imageUrl === photo.src.large2x)}>
                  <img src={photo.src.small} alt={photo.alt || ''} width={64} height={64}
                    className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          {results.length === 0 && !searching && lastQuery && (
            <p className="text-[10px] text-center py-4" style={{ color: T.dim }}>No results for "{lastQuery}"</p>
          )}
          {results.length === 0 && !searching && !lastQuery && (
            <p className="text-[10px] text-center py-6 leading-relaxed px-2" style={{ color: T.dim }}>
              Pick a quick search or type your own.
            </p>
          )}
          {hasMore && !searching && (
            <button onClick={() => fetchPexels(lastQuery, page + 1)}
              className="w-full py-2 text-[10px] font-medium rounded-lg border"
              style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
              Load more
            </button>
          )}
        </>
      )}

      {/* Unsplash search */}
      {tab === 'unsplash' && (
        <>
          <div className="flex flex-wrap gap-1">
            {QUICK_SEARCHES.map(q => (
              <button key={q} onClick={() => doUnsplashSearch(q)}
                className="px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all"
                style={{
                  borderColor: uLastQuery.toLowerCase() === q.toLowerCase() ? T.accent : T.border,
                  color: uLastQuery.toLowerCase() === q.toLowerCase() ? T.accent : T.muted,
                  background: T.panel,
                }}>{q}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input type="text" placeholder="Search Unsplash…" value={uQuery}
              onChange={e => setUQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doUnsplashSearch(uQuery)}
              className="flex-1 rounded-lg px-3 py-1.5 text-[11px] outline-none border transition-colors"
              style={{ background: T.panel, borderColor: T.border, color: T.text }} />
            <button onClick={() => doUnsplashSearch(uQuery)} disabled={uSearching}
              className="px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all disabled:opacity-40"
              style={{ background: T.text, color: T.bg }}>
              {uSearching ? '…' : 'Go'}
            </button>
          </div>
          {uResults.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {uResults.map(photo => (
                <button key={photo.id}
                  onClick={() => {
                    onChange({
                      imageUrl: photo.urls.regular, videoUrl: undefined,
                      imageAttribution: { source: 'unsplash', name: photo.user.name, profileUrl: photo.user.profileUrl },
                    });
                    trackUnsplashDownload(photo.downloadLocation);
                  }}
                  onMouseEnter={onEnter(photo.urls.regular)} onMouseLeave={onLeave}
                  title={`${photo.alt || 'Photo'} · ${photo.user.name}`}
                  className={thumbCls(imageUrl === photo.urls.regular)}>
                  <img src={photo.urls.small} alt={photo.alt || ''} width={64} height={64}
                    className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          {uResults.length === 0 && !uSearching && uLastQuery && (
            <p className="text-[10px] text-center py-4" style={{ color: T.dim }}>No results for "{uLastQuery}"</p>
          )}
          {uResults.length === 0 && !uSearching && !uLastQuery && (
            <p className="text-[10px] text-center py-6 leading-relaxed px-2" style={{ color: T.dim }}>
              Pick a quick search or type your own.
            </p>
          )}
          {uHasMore && !uSearching && (
            <button onClick={() => fetchUnsplash(uLastQuery, uPage + 1)}
              className="w-full py-2 text-[10px] font-medium rounded-lg border"
              style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
              Load more
            </button>
          )}
        </>
      )}
      <ThumbHoverPreview hover={hover} />
    </div>
  );
};

// ─── Layers section ──────────────────────────────────────────────────────────

const BLEND_MODES: { id: LayerBlendMode; label: string }[] = [
  { id: 'screen',     label: 'Screen'  },
  { id: 'multiply',   label: 'Multiply'},
  { id: 'overlay',    label: 'Overlay' },
  { id: 'soft-light', label: 'Soft'    },
  { id: 'difference', label: 'Differ.' },
  { id: 'luminosity', label: 'Lumin.'  },
];

const PEXELS_QUICK = ['Atmospheric', 'Cosmic', 'Abstract', 'Texture', 'Moody'];

const LayerPicker: React.FC<{ onPick: (url: string, attribution?: ImageAttribution) => void }> = ({ onPick }) => {
  const [tab, setTab]       = useState<'curated'|'pexels'|'unsplash'>('curated');
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState<{ id: number; src: { small: string; medium: string; large2x: string } }[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage]     = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [uQuery, setUQuery]         = useState('');
  const [uResults, setUResults]     = useState<UnsplashPhoto[]>([]);
  const [uSearching, setUSearching] = useState(false);
  const [uPage, setUPage]           = useState(1);
  const [uHasMore, setUHasMore]     = useState(false);
  const [uLastQuery, setULastQuery] = useState('');
  const { hover, onEnter, onLeave } = useThumbHover();

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = ev => onPick(ev.target?.result as string);
    r.readAsDataURL(file);
  };

  const searchPexels = async (q: string, pg: number = 1) => {
    if (!q.trim() || !PEXELS_KEY) return;
    setSearching(true);
    try {
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&page=${pg}&orientation=landscape`, { headers: { Authorization: PEXELS_KEY } });
      const data = await res.json();
      const photos: { id: number; src: { small: string; medium: string; large2x: string } }[] = data.photos ?? [];
      setResults(pg === 1 ? photos : prev => [...prev, ...photos]);
      setHasMore(photos.length === 12);
      setLastQuery(q); setPage(pg);
    } catch {} finally { setSearching(false); }
  };

  const searchUnsplash = async (q: string, pg: number = 1) => {
    if (!q.trim()) return;
    setUSearching(true);
    try {
      const res = await fetch(`/api/unsplash-search?query=${encodeURIComponent(q)}&page=${pg}`);
      const data = await res.json();
      const photos: UnsplashPhoto[] = data.results ?? [];
      setUResults(pg === 1 ? photos : prev => [...prev, ...photos]);
      setUHasMore(!!data.hasMore);
      setULastQuery(q); setUPage(pg);
    } catch {} finally { setUSearching(false); }
  };

  return (
    <div className="space-y-2">
      <TabBar
        options={[{ id: 'curated', label: 'Gallery' }, { id: 'pexels', label: 'Pexels' }, { id: 'unsplash', label: 'Unsplash' }]}
        value={tab} onChange={v => setTab(v as 'curated' | 'pexels' | 'unsplash')}
        size="sm"
      />
      {/* Dropzone — same treatment as the Layer 1 / Source upload area */}
      <label
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={e => e.preventDefault()}
        className="flex flex-col items-center justify-center gap-2 w-full h-[68px] rounded-xl border-2 border-dashed cursor-pointer transition-all"
        style={{ borderColor: T.border, color: T.muted }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = T.text)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
      >
        <i className="ph ph-upload-simple text-xl" />
        <span className="text-[11px] font-medium tracking-wide">Drop or click to upload</span>
        <input type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </label>
      {tab === 'curated' && (
        <>
          <div className="grid grid-cols-4 gap-1">
            {(expanded ? GALLERY : GALLERY.slice(0, GALLERY_INITIAL)).map(item => (
              <button key={item.src} onClick={() => onPick(item.src)}
                onMouseEnter={onEnter(item.src)} onMouseLeave={onLeave}
                className="aspect-square overflow-hidden rounded-md border-2 border-transparent hover:border-[#b8b4aa] transition-all">
                <img src={item.thumb} alt="" width={48} height={48} className="w-full h-full object-cover"
                  loading={expanded ? 'lazy' : 'eager'} decoding="async" />
              </button>
            ))}
          </div>
          {GALLERY.length > GALLERY_INITIAL && (
            <button onClick={() => setExpanded(v => !v)}
              className="w-full py-1.5 text-[10px] font-medium rounded-lg border transition-all"
              style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
              {expanded ? 'Show less' : `View all ${GALLERY.length} images`}
            </button>
          )}
        </>
      )}
      {tab === 'pexels' && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {PEXELS_QUICK.map(q => (
              <button key={q} onClick={() => { setQuery(q); searchPexels(q); }}
                className="px-2 py-0.5 text-[9px] rounded-full border transition-all"
                style={{ borderColor: T.border, color: T.muted, background: T.panel }}>{q}</button>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPexels(query)}
              placeholder="Search Pexels…"
              className="flex-1 rounded-lg px-2 py-1.5 text-[10px] outline-none border"
              style={{ background: T.panel, borderColor: T.border, color: T.text }} />
            <button onClick={() => searchPexels(query)} disabled={searching}
              className="px-2.5 py-1.5 text-[9px] font-bold rounded-lg disabled:opacity-40"
              style={{ background: T.text, color: T.bg }}>
              {searching ? '…' : 'Go'}
            </button>
          </div>
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {results.map(p => (
                <button key={p.id} onClick={() => onPick(p.src.large2x)}
                  onMouseEnter={onEnter(p.src.medium)} onMouseLeave={onLeave}
                  className="aspect-square overflow-hidden rounded-md border-2 border-transparent hover:border-[#b8b4aa] transition-all">
                  <img src={p.src.small} alt="" width={48} height={48} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {hasMore && !searching && (
            <button onClick={() => searchPexels(lastQuery, page + 1)}
              className="w-full py-1.5 text-[10px] font-medium rounded-lg border transition-all"
              style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
              Load more
            </button>
          )}
          {searching && results.length > 0 && (
            <p className="text-[10px] text-center py-1" style={{ color: T.dim }}>Loading…</p>
          )}
        </div>
      )}
      {tab === 'unsplash' && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {PEXELS_QUICK.map(q => (
              <button key={q} onClick={() => { setUQuery(q); searchUnsplash(q); }}
                className="px-2 py-0.5 text-[9px] rounded-full border transition-all"
                style={{ borderColor: T.border, color: T.muted, background: T.panel }}>{q}</button>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={uQuery} onChange={e => setUQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUnsplash(uQuery)}
              placeholder="Search Unsplash…"
              className="flex-1 rounded-lg px-2 py-1.5 text-[10px] outline-none border"
              style={{ background: T.panel, borderColor: T.border, color: T.text }} />
            <button onClick={() => searchUnsplash(uQuery)} disabled={uSearching}
              className="px-2.5 py-1.5 text-[9px] font-bold rounded-lg disabled:opacity-40"
              style={{ background: T.text, color: T.bg }}>
              {uSearching ? '…' : 'Go'}
            </button>
          </div>
          {uResults.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {uResults.map(p => (
                <button key={p.id}
                  onClick={() => {
                    onPick(p.urls.regular, { source: 'unsplash', name: p.user.name, profileUrl: p.user.profileUrl });
                    trackUnsplashDownload(p.downloadLocation);
                  }}
                  onMouseEnter={onEnter(p.urls.regular)} onMouseLeave={onLeave}
                  title={`${p.alt || 'Photo'} · ${p.user.name}`}
                  className="aspect-square overflow-hidden rounded-md border-2 border-transparent hover:border-[#b8b4aa] transition-all">
                  <img src={p.urls.small} alt="" width={48} height={48} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {uHasMore && !uSearching && (
            <button onClick={() => searchUnsplash(uLastQuery, uPage + 1)}
              className="w-full py-1.5 text-[10px] font-medium rounded-lg border transition-all"
              style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
              Load more
            </button>
          )}
          {uSearching && uResults.length > 0 && (
            <p className="text-[10px] text-center py-1" style={{ color: T.dim }}>Loading…</p>
          )}
        </div>
      )}
      <ThumbHoverPreview hover={hover} />
    </div>
  );
};

// Reads natural pixel dimensions of an image URL — used to lock the layer's
// resize handle to its own aspect ratio in LayerTransformOverlay. Failure
// (e.g. a CORS-blocked measure) just leaves naturalAspect unset — the overlay
// falls back to a 1:1 lock rather than blocking the layer from being used.
const loadNaturalAspect = (url: string): Promise<number | undefined> =>
  new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });

const LayersSection: React.FC<{
  layers: ImageLayer[];
  onChange: (layers: ImageLayer[]) => void;
  editingLayerId: string | null;
  onEditLayer: (id: string | null) => void;
}> = ({ layers, onChange, editingLayerId, onEditLayer }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [erasing, setErasing] = useState<Record<string, boolean>>({});

  const addLayer = () => {
    if (layers.length >= 2) return;
    const id = crypto.randomUUID();
    onChange([...layers, { id, blendMode: 'screen', opacity: 0.8 }]);
    setCollapsed(prev => ({ ...prev, [id]: false }));
  };
  const update = (id: string, patch: Partial<ImageLayer>) => onChange(layers.map(l => l.id === id ? { ...l, ...patch } : l));
  const remove = (id: string) => {
    onChange(layers.filter(l => l.id !== id));
    if (editingLayerId === id) onEditLayer(null);
  };
  const toggle = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-2">
      {layers.map((layer, i) => {
        const isCollapsed = !!collapsed[layer.id];
        const modeLabel = BLEND_MODES.find(m => m.id === layer.blendMode)?.label ?? layer.blendMode;
        const isHidden = !!layer.hidden;
        return (
          <div key={layer.id} className="rounded-xl overflow-hidden border"
            style={{ borderColor: T.border, background: T.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: T.border }}>
              {isCollapsed && layer.imageUrl && (
                <div className="w-7 h-7 rounded overflow-hidden shrink-0" style={{ opacity: isHidden ? 0.35 : 1 }}>
                  <img src={layer.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <span className="text-[11px] font-semibold flex-1" style={{ color: T.muted }}>
                Layer {i + 2}
                {isCollapsed && layer.imageUrl && (
                  <span className="font-normal" style={{ color: T.dim }}>
                    {' '}· {modeLabel} {Math.round(layer.opacity * 100)}%{isHidden ? ' · Hidden' : ''}
                  </span>
                )}
              </span>
              {layer.imageUrl && (
                <button onClick={() => update(layer.id, { hidden: !layer.hidden })}
                  title={isHidden ? 'Show layer' : 'Hide layer'}
                  className="transition-colors px-1" style={{ color: isHidden ? T.dim : T.muted }}>
                  <i className={`ph ${isHidden ? 'ph-eye-slash' : 'ph-eye'} text-sm`} />
                </button>
              )}
              {layer.imageUrl && (
                <button onClick={() => toggle(layer.id)}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                  className="transition-colors px-1" style={{ color: T.dim }}>
                  <i className={`ph ${isCollapsed ? 'ph-caret-down' : 'ph-caret-up'} text-sm`} />
                </button>
              )}
              <button onClick={() => remove(layer.id)}
                title="Delete layer"
                className="transition-colors ml-1 hover:text-red-500" style={{ color: T.border }}>
                <i className="ph ph-trash text-sm" />
              </button>
            </div>
            {!isCollapsed && (
              <div className="p-3 space-y-3" style={{ opacity: isHidden ? 0.5 : 1 }}>
                {layer.imageUrl ? (
                  <>
                    <div className="relative rounded-lg overflow-hidden h-20 group">
                      <img src={layer.imageUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer px-2 py-1 bg-white/20 rounded text-[9px] text-white font-medium">
                          Change
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0]; if (!f) return;
                              const r = new FileReader();
                              r.onload = async ev => {
                                const dataUrl = ev.target?.result as string;
                                const naturalAspect = await loadNaturalAspect(dataUrl);
                                // Reset position/size — a swapped-in image at the old box's
                                // aspect would otherwise look squashed until re-positioned.
                                update(layer.id, { imageUrl: dataUrl, naturalAspect, attribution: undefined, x: 0, y: 0, width: 1, height: 1 });
                              };
                              r.readAsDataURL(f);
                            }} />
                        </label>
                        <button onClick={() => update(layer.id, { imageUrl: undefined, attribution: undefined })}
                          className="px-2 py-1 bg-white/20 rounded text-[9px] text-white font-medium">Clear</button>
                      </div>
                    </div>
                    {layer.attribution && (
                      <p className="text-[9px]" style={{ color: T.dim }}>
                        Photo by{' '}
                        <a href={`${layer.attribution.profileUrl}?utm_source=herokit&utm_medium=referral`}
                          target="_blank" rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:opacity-70" style={{ color: T.muted }}>
                          {layer.attribution.name}
                        </a>{' '}
                        on{' '}
                        <a href="https://unsplash.com/?utm_source=herokit&utm_medium=referral"
                          target="_blank" rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:opacity-70" style={{ color: T.muted }}>
                          Unsplash
                        </a>
                      </p>
                    )}
                  </>
                ) : (
                  <LayerPicker onPick={async (url, attribution) => {
                    const naturalAspect = await loadNaturalAspect(url);
                    update(layer.id, { imageUrl: url, naturalAspect, attribution, x: 0, y: 0, width: 1, height: 1 });
                  }} />
                )}
                <div>
                  <p className="text-[10px] font-medium mb-1.5" style={{ color: T.muted }}>Blend mode</p>
                  <PatternGrid options={BLEND_MODES} value={layer.blendMode} onChange={v => update(layer.id, { blendMode: v as LayerBlendMode })} columns={3} />
                </div>
                <Row label="Opacity">
                  <HwSlider value={Math.round(layer.opacity * 100)} min={1} max={100} onChange={v => update(layer.id, { opacity: v / 100 })} />
                </Row>
                {layer.imageUrl && (
                  <button
                    onClick={() => onEditLayer(editingLayerId === layer.id ? null : layer.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
                    style={
                      editingLayerId === layer.id
                        ? { background: T.accent, color: '#fff' }
                        : { background: T.panel, color: T.muted, border: `1px solid ${T.border}` }
                    }>
                    <i className="ph ph-frame-corners text-sm" />
                    {editingLayerId === layer.id ? 'Done' : 'Move / Resize'}
                  </button>
                )}
                {layer.imageUrl && (
                  <button
                    onClick={() => setErasing(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
                    style={
                      erasing[layer.id]
                        ? { background: T.accent, color: '#fff' }
                        : { background: T.panel, color: T.muted, border: `1px solid ${T.border}` }
                    }>
                    <i className="ph ph-scissors text-sm" />
                    {erasing[layer.id] ? 'Done' : 'Cut Out / Erase'}
                  </button>
                )}
                {layer.imageUrl && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => update(layer.id, { flipH: !layer.flipH })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
                      style={
                        layer.flipH
                          ? { background: T.accent, color: '#fff' }
                          : { background: T.panel, color: T.muted, border: `1px solid ${T.border}` }
                      }>
                      <i className="ph ph-flip-horizontal text-sm" /> Flip H
                    </button>
                    <button
                      onClick={() => update(layer.id, { flipV: !layer.flipV })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
                      style={
                        layer.flipV
                          ? { background: T.accent, color: '#fff' }
                          : { background: T.panel, color: T.muted, border: `1px solid ${T.border}` }
                      }>
                      <i className="ph ph-flip-vertical text-sm" /> Flip V
                    </button>
                  </div>
                )}
                {layer.imageUrl && erasing[layer.id] && (() => {
                  const keep = (layer.maskMode ?? 'keep') === 'keep';
                  const hint = keep
                    ? <>Paint what to keep.<br />Everything else is removed.</>
                    : <>Paint what to remove.<br />Everything else stays.</>;
                  return (
                  <div className="space-y-3 pt-1">
                    {/* Keep is the default — painting the subject you want and
                        letting the rest fall away sidesteps the hard box edge
                        that hand-erasing a whole background always leaves. */}
                    <HwSegment
                      options={[{ id:'keep', label:'Paint to Keep' }, { id:'erase', label:'Paint to Remove' }]}
                      value={keep ? 'keep' : 'erase'}
                      onChange={v => update(layer.id, { maskMode: v as 'keep' | 'erase' })}
                    />
                    <EffectMaskPad
                      imageUrl={layer.imageUrl}
                      strokes={layer.maskStrokes ?? []}
                      onChange={strokes => update(layer.id, { maskStrokes: strokes })}
                      brushSize={layer.maskBrushSize ?? 0.08}
                      onBrushSizeChange={v => update(layer.id, { maskBrushSize: v })}
                      feather={layer.maskFeather ?? 20}
                      onFeatherChange={v => update(layer.id, { maskFeather: v })}
                      invert={false}
                      onInvertChange={() => {}}
                      showOverlay={layer.maskShowOverlay ?? true}
                      onShowOverlayChange={v => update(layer.id, { maskShowOverlay: v })}
                      accentColor={T.accent}
                      hint={hint}
                    />
                    <Row label="Brush size">
                      <HwSlider value={Math.round((layer.maskBrushSize ?? 0.08) * 100)} min={2} max={40}
                        onChange={v => update(layer.id, { maskBrushSize: v / 100 })} />
                    </Row>
                    <Row label="Feather">
                      <HwSlider value={layer.maskFeather ?? 20} min={0} max={100}
                        onChange={v => update(layer.id, { maskFeather: v })} />
                    </Row>
                    <Row label="Show paint">
                      <TactileToggle value={layer.maskShowOverlay ?? true} onChange={v => update(layer.id, { maskShowOverlay: v })} />
                    </Row>
                    <button onClick={() => update(layer.id, { maskStrokes: [] })}
                      disabled={(layer.maskStrokes ?? []).length === 0}
                      className="w-full py-2 text-[11px] font-medium rounded-lg border transition-all disabled:opacity-40"
                      style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
                      Clear painting
                    </button>
                    <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
                      {keep
                        ? 'Paint the part you want to keep — a subject on a busy background, say — and everything else is removed cleanly, with no hard box edge.'
                        : 'Paint the parts to remove, keeping the rest. Best when the thing you want gone is smaller than the thing you want to keep.'}
                    </p>
                  </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
      {layers.length < 2 && (
        <button onClick={addLayer}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed text-[11px] font-medium transition-all"
          style={{ borderColor: T.border, color: T.muted }}>
          <i className="ph ph-plus text-sm" /> Add Layer {layers.length + 2}
        </button>
      )}
    </div>
  );
};

// ─── Preset vibe colours ─────────────────────────────────────────────────────
// Each dot reflects what the preset actually does — grade tone, dominant effect.
const PRESET_DOT: Record<string, string> = {
  'Analog Film':  '#b5700a', // vellichor amber — warm film grain
  'Polaroid':     '#d4a535', // golden yellow — lifted warm tones
  'Disperse':     '#ea8c35', // golden orange — golden hour scatter
  'Oil Paint':    '#7c5a2b', // dark ochre — painterly warp/sort
  'Prism':        '#9333ea', // violet — RGB spectrum split
  'Glitch Art':   '#16a34a', // VHS green — digital glitch
  'Noir Print':   '#525252', // charcoal — B&W dither
  'Neon Dreams':  '#0891b2', // cyan — cross-process neon
};

// ─── Option lists ─────────────────────────────────────────────────────────────

const FILTERS: { id: ImageFilter; label: string }[] = [
  { id: 'none', label: 'None' }, { id: 'grayscale', label: 'B&W' },
  { id: 'desaturate', label: 'Muted' }, { id: 'tint', label: 'Tint' },
  { id: 'duotone', label: 'Duo' }, { id: 'frosted', label: 'Frost' },
];
const MASKS: { id: ImageMask; label: string }[] = [
  { id: 'none', label: 'None' }, { id: 'fade-bottom', label: 'Bottom' },
  { id: 'fade-left', label: 'Left' }, { id: 'fade-right', label: 'Right' },
  { id: 'radial', label: 'Radial' }, { id: 'soft-edges', label: 'Soft' },
];
const PATTERNS: { id: PatternStyle; label: string }[] = [
  { id: 'none', label: 'Off' }, { id: 'grid', label: 'Grid' },
  { id: 'dot', label: 'Dot' }, { id: 'iso-grid', label: 'ISO' },
  { id: 'scanline', label: 'Scan' }, { id: 'hex', label: 'Hex' },
  { id: 'waves', label: 'Waves' }, { id: 'plus', label: 'Plus' },
];
// Doesn't require a source image — atmosphere renders on its own as a
// standalone animated background, or layered behind/around an uploaded photo.
const ATMOSPHERES: { id: AtmosphereStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  // Paper Shaders — GPU canvases, genuinely animated
  { id: 'warp', label: 'Warp' }, { id: 'voronoi', label: 'Voronoi' },
  { id: 'metaballs', label: 'Metaballs' }, { id: 'pulsing-border', label: 'Pulsing Border' },
  { id: 'god-rays', label: 'God Rays' }, { id: 'smoke-ring', label: 'Smoke Ring' },
  // Hand-rolled WebGL
  { id: 'fluid-mesh', label: 'Fluid Mesh' }, { id: 'volumetric-fog', label: 'Fog' },
  { id: 'molten-orb', label: 'Molten Orb' }, { id: 'kinetic-flow', label: 'Kinetic Flow' },
  { id: 'generative', label: 'Generative' },
  // CSS-based
  { id: 'aurora', label: 'Aurora' }, { id: 'light-leak', label: 'Light Leak' },
  { id: 'shimmer', label: 'Shimmer' }, { id: 'glitch', label: 'Glitch' },
  { id: 'glow', label: 'Glow' }, { id: 'mesh-accent', label: 'Mesh Accent' },
  { id: 'animated-mesh', label: 'Spin Mesh' }, { id: 'fade-bottom', label: 'Fade' },
];

// ─── Video export ─────────────────────────────────────────────────────────────
// Recovered and generalized from git history (c1ffafe~1) — HeroKit had this at
// v1.0, hidden while the effects pipeline matured, later deleted in the v2.0
// rewrite. Same core technique: composite every visible layer onto one canvas
// per frame and record it with MediaRecorder. The one line that matters most —
// `container.querySelectorAll('canvas')` — sweeps up every WebGL/canvas atmosphere
// effect (including new Paper Shaders ones) automatically, no per-effect plumbing.
//
// Generalized beyond "only when a video is loaded": the frame source is now
// whichever of <video>/<img> is actually present (or neither, for an
// atmosphere-only background) — previously this hard-required an uploaded video.

// Atmosphere styles that render an actual animated <canvas> — worth recording.
// The CSS-only ones (aurora, glow, shimmer, etc.) don't produce a canvas the
// compositor can pick up, so a video of those would just be a static frame.
const ANIMATED_ATMOSPHERES = new Set<AtmosphereStyle>([
  'fluid-mesh', 'volumetric-fog', 'molten-orb', 'kinetic-flow', 'generative',
  'warp', 'voronoi', 'metaballs', 'pulsing-border', 'god-rays', 'smoke-ring',
]);

const VideoExportSection: React.FC<{ state: BackgroundState }> = ({ state }) => {
  const [format, setFormat]         = useState<'mp4' | 'webm'>('mp4');
  const [duration, setDuration]     = useState(5);
  const [pixelRatio, setPixelRatio] = useState<1 | 2 | 4>(2);
  const [speed, setSpeed]           = useState<0.5 | 1>(1);
  const [exporting, setExporting]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef      = useRef<number>(0);

  const canExport = !!state.videoUrl || ANIMATED_ATMOSPHERES.has(state.atmosphereStyle);

  const exportVideo = async (forceWebm = false) => {
    const container = document.getElementById('heroken-canvas') as HTMLElement | null;
    if (!container) return;
    const vid   = container.querySelector('video') as HTMLVideoElement | null;
    const imgEl = !vid ? (container.querySelector('img') as HTMLImageElement | null) : null;

    const w = container.clientWidth  * pixelRatio;
    const h = container.clientHeight * pixelRatio;

    if (vid) {
      vid.playbackRate = speed;
      if (vid.paused) {
        await new Promise<void>(res => {
          vid.addEventListener('playing', () => res(), { once: true });
          vid.play().catch(() => res());
          setTimeout(res, 800);
        });
      }
      await new Promise(r => setTimeout(r, 120));
    }

    const rec = document.createElement('canvas');
    rec.width = w; rec.height = h;
    const ctx = rec.getContext('2d')!;

    const GW = Math.min(512, w), GH = Math.min(512, h);
    const gCanvas = document.createElement('canvas');
    gCanvas.width = GW; gCanvas.height = GH;
    const gCtx = gCanvas.getContext('2d')!;
    const gImg = gCtx.createImageData(GW, GH);
    const nhex = (state.noiseColor || '#ffffff').replace('#', '');
    const nr = parseInt(nhex.slice(0, 2), 16) || 255;
    const ng = parseInt(nhex.slice(2, 4), 16) || 255;
    const nb = parseInt(nhex.slice(4, 6), 16) || 255;

    const refreshGrain = () => {
      for (let i = 0; i < gImg.data.length; i += 4) {
        const v = Math.random() > 0.65 ? ((Math.random() - 0.65) / 0.35) * 255 : 0;
        gImg.data[i] = nr; gImg.data[i+1] = ng; gImg.data[i+2] = nb; gImg.data[i+3] = v | 0;
      }
      gCtx.putImageData(gImg, 0, 0);
    };
    refreshGrain();

    // Chrome's MediaRecorder.isTypeSupported('video/mp4') can report true
    // while actually producing a silent 0-byte recording (nominal codec
    // support without a working muxer) — more specific codec strings are
    // checked more accurately, and the empty-blob check in onstop below is
    // the real safety net regardless of what isTypeSupported claims.
    const candidates = format === 'mp4' && !forceWebm
      ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=h264', 'video/mp4',
         'video/webm;codecs=vp9', 'video/webm']
      : ['video/webm;codecs=vp9', 'video/webm'];
    const mimeType = candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

    const stream   = rec.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 * pixelRatio });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      if (vid) vid.playbackRate = 1;
      const blob = new Blob(chunks, { type: mimeType });

      // Recorded mp4 came back empty — this browser's mp4 support was a
      // false positive. Silently retry once as webm rather than handing
      // the user a broken 0-byte file.
      if (blob.size === 0 && !forceWebm) {
        exportVideo(true);
        return;
      }
      if (blob.size === 0) {
        alert('Video export failed — try a lower resolution or a shorter duration.');
        setExporting(false); setProgress(0);
        return;
      }

      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.download = `herokit-background.${ext}`;
      a.href = url; a.click();
      URL.revokeObjectURL(url);
      setExporting(false); setProgress(0);
    };

    setExporting(true);
    recorder.start(100);
    const t0 = performance.now();
    const total = duration * 1000;
    let grainTick = 0;

    const render = () => {
      const elapsed = performance.now() - t0;
      if (elapsed >= total) { recorder.stop(); return; }
      setProgress((elapsed / total) * 100);

      ctx.fillStyle = state.bgColor || '#f2f0eb';
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = state.imageOpacity ?? 1;
      if (vid)        { try { ctx.drawImage(vid, 0, 0, w, h); } catch {} }
      else if (imgEl) { try { ctx.drawImage(imgEl, 0, 0, w, h); } catch {} }
      ctx.globalAlpha = 1;

      if ((state.overlayOpacity ?? 0) > 0) {
        ctx.fillStyle = `rgba(0,0,0,${state.overlayOpacity})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Sweeps every <canvas> currently in the DOM — atmosphere shaders
      // (hand-rolled WebGL and Paper Shaders alike), the processed-image
      // effects canvas, and the film grain canvas all land here for free.
      container.querySelectorAll<HTMLCanvasElement>('canvas').forEach(c => {
        try { ctx.drawImage(c, 0, 0, w, h); } catch {}
      });

      if ((state.noiseOpacity ?? 0) > 0) {
        if (grainTick++ % 2 === 0) refreshGrain();
        ctx.globalAlpha = state.noiseOpacity;
        ctx.drawImage(gCanvas, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      if ((state.vignetteStrength ?? 0) > 0) {
        const vg = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.65);
        vg.addColorStop(0.3, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(0,0,0,${state.vignetteStrength})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
      }

      rafRef.current = requestAnimationFrame(render);
    };
    render();
  };

  const cancel = () => {
    recorderRef.current?.stop();
    cancelAnimationFrame(rafRef.current);
    const vid = document.querySelector('#heroken-canvas video') as HTMLVideoElement | null;
    if (vid) vid.playbackRate = 1;
    setExporting(false); setProgress(0);
  };

  return (
    <>
      <HwSegment options={[{ id:'mp4',label:'MP4' },{ id:'webm',label:'WebM' }]}
        value={format} onChange={v => setFormat(v as 'mp4'|'webm')} />
      <Row label="Duration">
        <HwSegment options={[{ id:'3',label:'3s' },{ id:'5',label:'5s' },{ id:'10',label:'10s' },{ id:'15',label:'15s' }]}
          value={String(duration)} onChange={v => setDuration(Number(v))} />
      </Row>
      <Row label="Speed">
        <HwSegment options={[{ id:'0.5',label:'0.5×' },{ id:'1',label:'1×' }]}
          value={String(speed)} onChange={v => setSpeed(Number(v) as 0.5 | 1)} />
      </Row>
      <Row label="Resolution">
        <HwSegment options={[{ id:'1',label:'1×' },{ id:'2',label:'2×' },{ id:'4',label:'4×' }]}
          value={String(pixelRatio)} onChange={v => setPixelRatio(Number(v) as 1 | 2 | 4)} />
      </Row>
      {exporting ? (
        <div className="flex flex-col gap-2">
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: T.panel }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: T.accent }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: T.muted }}>
              Exporting… {(progress * duration / 100).toFixed(1)}s / {duration}s
            </span>
            <button onClick={cancel} className="text-[10px] font-medium" style={{ color: T.muted }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="hw-cta-mount">
          <button onClick={() => exportVideo()} disabled={!canExport} className="hw-cta">
            <i className="ph-bold ph-download-simple text-base" /> Export Video
          </button>
        </div>
      )}
      <p className="text-[9px] leading-relaxed" style={{ color: T.dim }}>
        Bakes atmosphere, grain, vignette &amp; overlay into every frame. Enabled when an animated
        atmosphere effect or a video source is active.
      </p>
    </>
  );
};

// ─── RightPanel ──────────────────────────────────────────────────────────────

interface RightPanelProps {
  state: BackgroundState;
  onChange: (patch: Partial<BackgroundState>) => void;
  onOpenLooks: () => void;
  onResetEffects: () => void;
  editingLayerId: string | null;
  onEditLayer: (id: string | null) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ state, onChange, onOpenLooks, onResetEffects, editingLayerId, onEditLayer }) => {
  const [format, setFormat]       = useState<ExportFormat>('PNG');
  const [resolution, setResolution] = useState<ExportResolution>('2x');
  const [exporting, setExporting] = useState(false);
  const [showDocs, setShowDocs]   = useState(false);
  const [sourceMode, setSourceMode] = useState<'upload' | 'generate'>('upload');
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]   = useState<string | null>(null);
  const set = (patch: Partial<BackgroundState>) => onChange(patch);

  const handleGenerate = async () => {
    if (!genPrompt.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const imageUrl = await generateBackground(genPrompt.trim());
      set({ imageUrl, videoUrl: undefined, imageAttribution: undefined });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = e => set({ imageUrl: e.target?.result as string, videoUrl: undefined, imageAttribution: undefined });
      r.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      set({ videoUrl: URL.createObjectURL(file), imageUrl: undefined, imageAttribution: undefined });
    }
  };

  const handleExport = async () => {
    const node = document.getElementById('heroken-canvas');
    if (!node) return;
    setExporting(true);
    try {
      const pr = resolution === '4x' ? 4 : resolution === '2x' ? 2 : 1;
      const dataUrl = format === 'JPG'
        ? await toJpeg(node, { pixelRatio: pr, quality: 0.95 })
        : await toPng(node, { pixelRatio: pr, cacheBust: true });
      const a = document.createElement('a');
      a.download = `herokit.${format.toLowerCase()}`;
      a.href = dataUrl; a.click();
    } catch { alert('Export failed — try a lower resolution.'); }
    finally { setExporting(false); }
  };

  const hasSource = !!(state.imageUrl || state.videoUrl);

  // ─── Ambient position grid (3×3 dot picker) ───────────────────────────────
  const AmbientPicker = () => (
    <div className="grid grid-cols-3 gap-1" style={{ width: 72 }}>
      {(['tl','tc','tr','ml','mc','mr','bl','bc','br'] as AmbientPosition[]).map(pos => (
        <button key={pos} onClick={() => set({ ambientLightPosition: pos })}
          className="aspect-square rounded-sm transition-all"
          style={{
            background: state.ambientLightPosition === pos ? T.text : T.panel,
            boxShadow: state.ambientLightPosition === pos
              ? `0 0 0 1.5px ${T.accent}`
              : `0 1px 0 ${T.borderDk}, inset 0 1px 0 rgba(255,255,255,0.6)`,
          }} />
      ))}
    </div>
  );

  return (
    <div
      className="w-[310px] shrink-0 flex flex-col h-full"
      style={{
        background: T.bg,
        borderLeft: `1px solid ${T.border}`,
        overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none',
      }}
    >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-7 shrink-0">

        {/* Row 1: logo + name + Japanese | icon buttons — all nowrap so nothing wraps */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/herokit_logomark_dark.png" alt="" className="w-5 h-5 object-contain shrink-0" />
            <div className="flex flex-col gap-[3px]">
              <span className="text-sm font-bold tracking-wide leading-none whitespace-nowrap" style={{ color: T.text }}>HeroKit</span>
              <span className="text-[10px] font-medium leading-none whitespace-nowrap" style={{ color: T.accent }}>ヒーロー</span>
            </div>
          </div>
          {/* Icon-only buttons to keep the row compact */}
          <div className="flex items-center gap-1 shrink-0 ml-3">
            <button onClick={onResetEffects} title="Reset effects"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all text-[11px] font-medium whitespace-nowrap"
              style={{ color: T.muted }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
              <i className="ph ph-arrow-counter-clockwise text-sm" /> Reset
            </button>
            <button onClick={onOpenLooks} title="Looks"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all text-[11px] font-medium whitespace-nowrap"
              style={{ color: T.muted }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
              <i className="ph ph-bookmark-simple text-sm" /> Looks
            </button>
            {/* Icon-only — keeps the row compact. Info icon rather than a hamburger:
                a hamburger signals "navigation drawer," but this opens a modal
                (About / Effects Guide / Changelog) — info is the honest affordance. */}
            <button onClick={() => setShowDocs(true)} title="Guide — about, effects & changelog"
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all"
              style={{ color: T.muted }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
              <i className="ph ph-info text-base" />
            </button>
          </div>
        </div>
      </div>

      {showDocs && <DocsPanel onClose={() => setShowDocs(false)} />}

      <div className="flex flex-col gap-5 px-4 pb-4">

        {/* ── Export ─────────────────────────────────────────────────────── */}
        <HardwarePanel label="Image Export" number={1}>
          <HwSegment
            options={[{ id:'PNG',label:'PNG' },{ id:'WebP',label:'WebP' },{ id:'JPG',label:'JPG' }]}
            value={format} onChange={v => setFormat(v as ExportFormat)}
          />
          {/* Mounting plate — button set into panel surface, K.O. II style */}
          <div className="hw-cta-mount">
            <button onClick={handleExport} disabled={exporting} className="hw-cta">
              {exporting
                ? <><i className="ph ph-spinner animate-spin text-base" /> Exporting…</>
                : <><i className="ph-bold ph-download-simple text-base" /> Export</>}
            </button>
          </div>
          <Row label="Resolution">
            <HwSegment
              options={[{ id:'1x',label:'1×' },{ id:'2x',label:'2×' },{ id:'4x',label:'4×' }]}
              value={resolution} onChange={v => setResolution(v as ExportResolution)}
            />
          </Row>
        </HardwarePanel>

        {/* ── Video Export — hidden for now, parked for a later build ─────── */}
        {false && (
          <HardwarePanel label="Video Export">
            <VideoExportSection state={state} />
          </HardwarePanel>
        )}

        {/* ── Source ─────────────────────────────────────────────────────── */}
        <HardwarePanel label="Source" number={2}>
          {/* Upload/Generate toggle hidden for now — Generate uses a paid,
              per-call Replicate API and shouldn't be reachable on the free
              public tool until it's gated (rate limit / paywall). Logic and
              UI both kept intact behind sourceMode, just not switchable. */}
          {false && (
            <HwSegment
              options={[{ id:'upload',label:'Upload' },{ id:'generate',label:'Generate' }]}
              value={sourceMode} onChange={v => setSourceMode(v as 'upload' | 'generate')}
            />
          )}
          {sourceMode === 'upload' ? (
            hasSource ? (
              <>
                <div className="relative rounded-xl overflow-hidden h-32 group">
                  {state.videoUrl ? (
                    <video src={state.videoUrl} muted loop autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={state.imageUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-white/20 rounded text-[10px] text-white font-medium">
                      Change
                      <input type="file" accept="image/*,video/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                    </label>
                    <button onClick={() => set({ imageUrl: undefined, videoUrl: undefined, imageAttribution: undefined })}
                      className="px-3 py-1.5 bg-white/20 rounded text-[10px] text-white font-medium">Clear</button>
                  </div>
                </div>
                {state.imageAttribution && (
                  <p className="text-[9px] mt-1.5" style={{ color: T.dim }}>
                    Photo by{' '}
                    <a href={`${state.imageAttribution.profileUrl}?utm_source=herokit&utm_medium=referral`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:opacity-70" style={{ color: T.muted }}>
                      {state.imageAttribution.name}
                    </a>{' '}
                    on{' '}
                    <a href="https://unsplash.com/?utm_source=herokit&utm_medium=referral"
                      target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:opacity-70" style={{ color: T.muted }}>
                      Unsplash
                    </a>
                  </p>
                )}
              </>
            ) : (
              <label
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onDragOver={e => e.preventDefault()}
                className="flex flex-col items-center justify-center gap-2 w-full h-[68px] rounded-xl border-2 border-dashed cursor-pointer transition-all"
                style={{ borderColor: T.border, color: T.muted }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.text}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
              >
                <i className="ph ph-upload-simple text-xl" />
                <span className="text-[11px] font-medium tracking-wide">Drop or click to upload</span>
                <input type="file" className="hidden" accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            )
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={genPrompt}
                onChange={e => setGenPrompt(e.target.value)}
                placeholder="Describe a background — e.g. 'foggy pine forest at dawn, muted teal light'"
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border px-3 py-2 text-[11px] leading-relaxed resize-none focus:outline-none"
                style={{ borderColor: T.border, color: T.text, background: T.surface }}
              />
              <div className="hw-cta-mount">
                <button onClick={handleGenerate} disabled={generating || !genPrompt.trim()} className="hw-cta">
                  {generating
                    ? <><i className="ph ph-spinner animate-spin text-base" /> Generating…</>
                    : <><i className="ph-bold ph-magic-wand text-base" /> Generate</>}
                </button>
              </div>
              {genError && (
                <p className="text-[10px] font-medium leading-relaxed" style={{ color: T.accent }}>{genError}</p>
              )}
            </div>
          )}
        </HardwarePanel>

        {/* ── Presets — hidden for now, kept for later ───────────────────── */}
        {false && hasSource && (
          <HardwarePanel label="Presets">
            <div className="grid grid-cols-2 gap-2">
              {BUILT_IN_PRESETS.map(preset => (
                <button key={preset.name} onClick={() => onChange(preset.state)}
                  className="relative text-left rounded-xl p-3 border transition-all pattern-btn"
                  style={{ background: T.panel, borderColor: T.border }}>
                  {/* Vibe dot — top-right corner, colour signals what the preset does */}
                  {PRESET_DOT[preset.name] && (
                    <span
                      className="absolute"
                      style={{
                        top: 7, right: 7,
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: PRESET_DOT[preset.name],
                        boxShadow: `0 0 0 1.5px rgba(255,255,255,0.55)`,
                      }}
                    />
                  )}
                  <p className="text-[11px] font-bold leading-tight pr-3" style={{ color: T.text }}>{preset.name}</p>
                  <p className="text-[9px] mt-0.5 leading-relaxed" style={{ color: T.dim }}>{preset.description}</p>
                </button>
              ))}
            </div>
          </HardwarePanel>
        )}

        {/* ── Gallery ────────────────────────────────────────────────────── */}
        <HardwarePanel label="Gallery" number={3}>
          <GallerySection imageUrl={state.imageUrl} onChange={onChange} />
        </HardwarePanel>

        {/* ── Layers ─────────────────────────────────────────────────────── */}
        {hasSource && (
          <HardwarePanel label="Layers" number={4}>
            <LayersSection layers={state.layers ?? []} onChange={layers => set({ layers })}
              editingLayerId={editingLayerId} onEditLayer={onEditLayer} />
          </HardwarePanel>
        )}

        {/* ── Background — image controls (Filter/Blur/Opacity/Mask fades).
            The Atmosphere block below stays parked for a later build; only
            the photo-treatment controls are live. ─────────────────────────── */}
        {hasSource && (
          <HardwarePanel label="Background" number={5}>
            <div>
              <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Filter</p>
              <PatternGrid options={FILTERS} value={state.imageFilter}
                onChange={v => set({ imageFilter: v as ImageFilter })} columns={3} />
            </div>
            {(state.imageFilter === 'tint' || state.imageFilter === 'duotone') && (
              <Row label="Tint color">
                <ColorSwatch value={state.tintColor} onChange={v => set({ tintColor: v })} />
              </Row>
            )}
            <Row label="Blur">
              <HwSlider value={state.imageBlur} min={0} max={20} step={0.5} decimals={1}
                onChange={v => set({ imageBlur: v })} />
            </Row>
            <Row label="Flip">
              <div className="flex gap-2">
                <button onClick={() => set({ imageFlipH: !state.imageFlipH })}
                  title="Flip horizontal"
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={
                    state.imageFlipH
                      ? { background: T.accent, color: '#fff' }
                      : { background: T.panel, color: T.muted, border: `1px solid ${T.border}` }
                  }>
                  <i className="ph ph-flip-horizontal text-sm" />
                </button>
                <button onClick={() => set({ imageFlipV: !state.imageFlipV })}
                  title="Flip vertical"
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={
                    state.imageFlipV
                      ? { background: T.accent, color: '#fff' }
                      : { background: T.panel, color: T.muted, border: `1px solid ${T.border}` }
                  }>
                  <i className="ph ph-flip-vertical text-sm" />
                </button>
              </div>
            </Row>
            <Row label="Opacity">
              <HwSlider value={Math.round(state.imageOpacity * 100)} min={0} max={100}
                onChange={v => set({ imageOpacity: v / 100 })} />
            </Row>
            <div>
              <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Mask</p>
              <PatternGrid options={MASKS} value={state.imageMask}
                onChange={v => set({ imageMask: v as ImageMask })} columns={3} />
            </div>
            {/* Only shown when a mask is active — this is the color the fade
                reveals underneath. Contextual rather than a permanent row, since
                it's irrelevant the rest of the time. */}
            {state.imageMask !== 'none' && (
              <Row label="Mask color">
                <ColorSwatch value={state.maskColor} onChange={v => set({ maskColor: v })} />
              </Row>
            )}

            {/* Atmosphere — hidden for now, parked for a later build */}
            {false && (
              <>
                <div style={{ height: 1, background: T.border }} />
                <div>
                  <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Atmosphere</p>
                  <PatternGrid options={ATMOSPHERES} value={state.atmosphereStyle}
                    onChange={v => set({ atmosphereStyle: v as AtmosphereStyle })} columns={3} compact />
                </div>
                {state.atmosphereStyle !== 'none' && (
                  <>
                    <Row label="Color 1">
                      <ColorSwatch value={state.meshColors.color1}
                        onChange={v => set({ meshColors: { ...state.meshColors, color1: v } })} />
                    </Row>
                    <Row label="Color 2">
                      <ColorSwatch value={state.meshColors.color2}
                        onChange={v => set({ meshColors: { ...state.meshColors, color2: v } })} />
                    </Row>
                    <Row label="Color 3">
                      <ColorSwatch value={state.meshColors.color3}
                        onChange={v => set({ meshColors: { ...state.meshColors, color3: v } })} />
                    </Row>
                    <Row label="Speed">
                      <HwSegment
                        options={[{ id:'slow',label:'Slow' },{ id:'normal',label:'Normal' },{ id:'fast',label:'Fast' }]}
                        value={state.meshSpeed} onChange={v => set({ meshSpeed: v as typeof state.meshSpeed })}
                      />
                    </Row>
                    {/* Lets an atmosphere effect sit behind/blend with an uploaded
                        photo instead of only working as a standalone background. */}
                    <Row label="Opacity">
                      <HwSlider value={Math.round((state.effectsOpacity ?? 1) * 100)} min={0} max={100}
                        onChange={v => set({ effectsOpacity: v / 100 })} />
                    </Row>
                  </>
                )}
              </>
            )}
          </HardwarePanel>
        )}

        {/* ── Grain & Texture ────────────────────────────────────────────── */}
        <HardwarePanel label="Grain & Texture" number={6} active={state.noiseOpacity > 0}>
          {/* Knob cluster sub-panel — machined recess in the card surface.
              Darker background + deep inset shadow reads as physically depressed,
              bright bottom rim catches the light on the lower machined edge.     */}
          <div style={{
            background: '#e4e1db',
            borderRadius: 10,
            border: '1px solid #cac7c0',
            boxShadow: [
              'inset 0 3px 7px rgba(0,0,0,0.11)',
              'inset 0 1px 3px rgba(0,0,0,0.07)',
              '0 1px 0 rgba(255,255,255,0.70)',
            ].join(', '),
            padding: '16px 8px 14px',
          }}>
            <div className="flex justify-around">
              <KnobSlider label="Grain" value={Math.round(state.noiseOpacity * 100)}
                min={0} max={50} onChange={v => set({ noiseOpacity: v / 100 })} />
              <KnobSlider label="Vignette" value={Math.round((state.vignetteStrength ?? 0) * 100)}
                min={0} max={100} onChange={v => set({ vignetteStrength: v / 100 })} />
              <KnobSlider label="Overlay" value={Math.round(state.overlayOpacity * 100)}
                min={0} max={90} onChange={v => set({ overlayOpacity: v / 100 })} />
            </div>
          </div>
          {state.noiseOpacity > 0 && (
            <Row label="Grain tint">
              <ColorSwatch value={state.noiseColor} onChange={v => set({ noiseColor: v })} />
            </Row>
          )}
          <div style={{ height: 1, background: T.border }} />
          <div>
            <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Pattern overlay</p>
            <PatternGrid options={PATTERNS} value={state.patternStyle}
              onChange={v => set({ patternStyle: v as PatternStyle })} columns={4} />
          </div>
          {state.patternStyle !== 'none' && (
            <>
              <Row label="Opacity">
                <HwSlider value={Math.round(state.patternOpacity * 100)} min={1} max={100}
                  onChange={v => set({ patternOpacity: v / 100 })} />
              </Row>
              <Row label="Color">
                <ColorSwatch value={state.patternColor} onChange={v => set({ patternColor: v })} />
              </Row>
              <div>
                <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Blend mode</p>
                <PatternGrid
                  options={(['normal','overlay','screen','soft-light','multiply'] as const).map(bm => ({
                    id: bm, label: bm === 'soft-light' ? 'Soft' : bm.charAt(0).toUpperCase() + bm.slice(1),
                  }))}
                  value={state.patternBlendMode}
                  onChange={v => set({ patternBlendMode: v as typeof state.patternBlendMode })}
                  columns={5}
                  compact
                />
              </div>
            </>
          )}
        </HardwarePanel>

        {/* ── Effects ────────────────────────────────────────────────────── */}
        <HardwarePanel label="Effects" number={7}>

          {/* Image Glitch */}
          <EffectSection label="Image Glitch" number={1} enabled={state.imageGlitchEnabled}
            onToggle={v => set({ imageGlitchEnabled: v })}>
            <PatternGrid
              options={[{ id:'digital',label:'Digital' },{ id:'corrupt',label:'Corrupt' },{ id:'signal',label:'Signal' }]}
              value={state.imageGlitchStyle ?? 'digital'}
              onChange={v => set({ imageGlitchStyle: v as typeof state.imageGlitchStyle })}
              columns={3}
            />
            <Row label="Intensity">
              <HwSlider value={state.imageGlitchIntensity ?? 40} min={1} max={100}
                onChange={v => set({ imageGlitchIntensity: v })} />
            </Row>
            <Row label="Shift">
              <HwSlider value={state.imageGlitchShift ?? 30} min={1} max={150}
                onChange={v => set({ imageGlitchShift: v })} />
            </Row>
            <Row label="RGB Split">
              <HwSlider value={state.imageGlitchRgbSplit ?? 5} min={0} max={40}
                onChange={v => set({ imageGlitchRgbSplit: v })} />
            </Row>
          </EffectSection>

          {/* Motion Blur */}
          <EffectSection label="Motion Blur" number={2} enabled={state.motionBlurEnabled}
            onToggle={v => set({ motionBlurEnabled: v })}>
            <HwSegment
              options={[{ id:'horizontal',label:'↔ Horiz' },{ id:'vertical',label:'↕ Vert' },{ id:'zoom',label:'⊙ Zoom' }]}
              value={state.motionBlurType ?? 'horizontal'}
              onChange={v => set({ motionBlurType: v as typeof state.motionBlurType })}
            />
            <Row label="Strength">
              <HwSlider value={state.motionBlurStrength ?? 20} min={2} max={80}
                onChange={v => set({ motionBlurStrength: v })} />
            </Row>
          </EffectSection>

          {/* Spot Blur */}
          <EffectSection label="Spot Blur" number={3} enabled={state.spotBlurEnabled}
            onToggle={v => set({ spotBlurEnabled: v })}>
            <Row label="BG blur">
              <HwSlider value={state.spotBlurRadius ?? 18} min={2} max={40}
                onChange={v => set({ spotBlurRadius: v })} />
            </Row>
            <SpotBlurMap spots={state.blurSpots ?? []} onChange={spots => set({ blurSpots: spots })} />
          </EffectSection>

          {/* Halftone */}
          <EffectSection label="Halftone" number={4} enabled={state.halftoneEnabled}
            onToggle={v => set({ halftoneEnabled: v })}>
            <div>
              <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Pattern</p>
              <PatternGrid
                options={[
                  { id:'dot',label:'Dot' },{ id:'line',label:'Line' },{ id:'crosshatch',label:'Crosshatch' },
                ]}
                value={state.halftonePattern}
                onChange={v => set({ halftonePattern: v as typeof state.halftonePattern })}
                columns={3}
              />
            </div>
            <Row label={state.halftonePattern === 'dot' ? 'Dot size' : 'Thickness'}>
              <HwSlider value={state.halftoneDotSize} min={1} max={12} step={0.5} decimals={1}
                onChange={v => set({ halftoneDotSize: v })} />
            </Row>
            <Row label="Spacing">
              <HwSlider value={state.halftoneSpacing} min={3} max={30} step={0.5} decimals={1}
                onChange={v => set({ halftoneSpacing: v })} />
            </Row>
            {state.halftonePattern !== 'dot' && (
              <Row label="Angle">
                {/* Screen angle — real CMYK separations stagger plates at 15/45/75°
                    to avoid moiré. Crosshatch draws a second pass at angle+90°. */}
                <HwSlider value={state.halftoneAngle} min={0} max={180}
                  onChange={v => set({ halftoneAngle: v })} />
              </Row>
            )}
            <Row label="Duotone">
              {/* Flattens the photo to two flat inks — bgColor fills the whole
                  frame, halftoneColor is stamped in as opaque dot coverage —
                  instead of multiply-blending one ink over the source image. */}
              <TactileToggle value={state.halftoneDuotoneEnabled ?? false} onChange={v => set({ halftoneDuotoneEnabled: v })} />
            </Row>
            {state.halftoneDuotoneEnabled && (
              <Row label="Background">
                <ColorSwatch value={state.halftoneBgColor ?? '#ebf2b5'} onChange={v => set({ halftoneBgColor: v })} />
              </Row>
            )}
            <Row label={state.halftoneDuotoneEnabled ? 'Ink' : 'Color'}>
              <ColorSwatch value={state.halftoneColor} onChange={v => set({ halftoneColor: v })} />
            </Row>
            <Row label="Opacity">
              <HwSlider value={Math.round((state.halftoneOpacity ?? 1) * 100)} min={0} max={100}
                onChange={v => set({ halftoneOpacity: v / 100 })} />
            </Row>
            <Row label="Invert">
              <TactileToggle value={state.halftoneInvert} onChange={v => set({ halftoneInvert: v })} />
            </Row>
          </EffectSection>

          {/* Color Grade */}
          <EffectSection label="Color Grade" number={5} enabled={state.colorGradeEnabled}
            onToggle={v => set({ colorGradeEnabled: v })}>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: 'teal-orange',   label: 'Teal & Orange', chip: 'linear-gradient(135deg,#0d9488,#f97316)' },
                { id: 'golden-hour',   label: 'Golden Hour',   chip: 'linear-gradient(135deg,#f59e0b,#b45309)' },
                { id: 'arctic',        label: 'Arctic',        chip: 'linear-gradient(135deg,#bae6fd,#1e40af)' },
                { id: 'noir',          label: 'Noir',          chip: 'linear-gradient(135deg,#111,#555)' },
                { id: 'moody',         label: 'Moody',         chip: 'linear-gradient(135deg,#1e1b4b,#4c1d95)' },
                { id: 'vellichor',     label: 'Vellichor',     chip: 'linear-gradient(135deg,#92400e,#d97706)' },
                { id: 'polaroid',      label: 'Polaroid',      chip: 'linear-gradient(135deg,#fde68a,#fbbf24)' },
                { id: 'kodachrome',    label: 'Kodachrome',    chip: 'linear-gradient(135deg,#dc2626,#f97316)' },
                { id: 'cross-process', label: 'X-Process',     chip: 'linear-gradient(135deg,#16a34a,#ca8a04)' },
                { id: 'lomo',          label: 'Lomography',    chip: 'linear-gradient(135deg,#7c3aed,#db2777)' },
                { id: 'faded',         label: 'Faded',         chip: 'linear-gradient(135deg,#94a3b8,#cbd5e1)' },
                { id: 'vhs',           label: 'VHS',           chip: 'linear-gradient(135deg,#166534,#15803d)' },
              ] as const).map(p => (
                <button key={p.id} onClick={() => set({ colorGradePreset: p.id })}
                  className="relative rounded-lg overflow-hidden border transition-all"
                  style={{
                    height: 52,
                    borderColor: state.colorGradePreset === p.id ? T.text : T.border,
                    boxShadow: state.colorGradePreset === p.id ? `0 0 0 2px ${T.accent}` : 'none',
                  }}>
                  <div className="absolute inset-0" style={{ background: p.chip }} />
                  <div className="absolute inset-0 flex items-end justify-center pb-1.5"
                    style={{ background: state.colorGradePreset === p.id ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.35)' }}>
                    <span className="text-[8px] font-bold text-white drop-shadow text-center leading-tight px-1">{p.label}</span>
                  </div>
                </button>
              ))}
            </div>
            <Row label="Strength">
              <HwSlider value={Math.round((state.colorGradeStrength ?? 1) * 100)} min={0} max={100}
                onChange={v => set({ colorGradeStrength: v / 100 })} />
            </Row>
          </EffectSection>

          {/* Dispersion */}
          <EffectSection label="Dispersion" number={6} enabled={state.dispersionEnabled}
            onToggle={v => set({ dispersionEnabled: v })}>
            <Row label="Threshold">
              <HwSlider value={state.dispersionThreshold ?? 80} min={1} max={240}
                onChange={v => set({ dispersionThreshold: v })} />
            </Row>
            <Row label="Strength">
              <HwSlider value={state.dispersionStrength ?? 60} min={5} max={180}
                onChange={v => set({ dispersionStrength: v })} />
            </Row>
            <Row label="Spread">
              <HwSlider value={Math.round((state.dispersionSpread ?? 0.6) * 100)} min={0} max={100}
                onChange={v => set({ dispersionSpread: v / 100 })} />
            </Row>
            <div>
              <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Direction</p>
              <PatternGrid
                options={[
                  { id:'up',label:'Up' },{ id:'right',label:'Right' },{ id:'down',label:'Down' },
                  { id:'radial',label:'Out' },{ id:'chaos',label:'Chaos' },
                ]}
                value={state.dispersionDirection ?? 'up'}
                onChange={v => set({ dispersionDirection: v as typeof state.dispersionDirection })}
                columns={5}
              />
            </div>
          </EffectSection>

          {/* RGB Channel Smear */}
          <EffectSection label="RGB Channel Smear" number={7} enabled={state.channelSmearEnabled}
            onToggle={v => set({ channelSmearEnabled: v })}>
            <Row label="Threshold">
              <HwSlider value={state.channelSmearThreshold ?? 80} min={0} max={240}
                onChange={v => set({ channelSmearThreshold: v })} />
            </Row>
            {([
              { key: 'channelSmearRDir' as const, label: 'R', color: '#e84320' },
              { key: 'channelSmearGDir' as const, label: 'G', color: '#16a34a' },
              { key: 'channelSmearBDir' as const, label: 'B', color: '#2563eb' },
            ]).map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[12px] font-bold w-4 shrink-0 tabular-nums" style={{ color }}>{label}</span>
                <PatternGrid
                  options={[{ id:'up',label:'↑' },{ id:'down',label:'↓' },{ id:'left',label:'←' },{ id:'right',label:'→' }]}
                  value={state[key] ?? (label === 'R' ? 'up' : label === 'G' ? 'left' : 'right')}
                  onChange={v => set({ [key]: v } as any)}
                  columns={4}
                />
              </div>
            ))}
          </EffectSection>

          {/* Displacement Warp */}
          <EffectSection label="Displacement Warp" number={8} enabled={state.warpEnabled}
            onToggle={v => set({ warpEnabled: v })}>
            <HwSegment
              options={[{ id:'warp',label:'Warp' },{ id:'swirl',label:'Swirl' },{ id:'flow',label:'Flow' }]}
              value={state.warpStyle ?? 'warp'}
              onChange={v => set({ warpStyle: v as typeof state.warpStyle })}
            />
            <Row label="Strength">
              <HwSlider value={state.warpStrength ?? 30} min={2} max={120}
                onChange={v => set({ warpStrength: v })} />
            </Row>
            <Row label="Scale">
              <HwSlider value={state.warpScale ?? 3} min={0.5} max={12} step={0.5} decimals={1}
                onChange={v => set({ warpScale: v })} />
            </Row>
            <Row label="Detail">
              <HwSlider value={state.warpOctaves ?? 3} min={1} max={5}
                onChange={v => set({ warpOctaves: v })} />
            </Row>
          </EffectSection>

          {/* Edge Glow */}
          <EffectSection label="Edge Glow" number={9} enabled={state.edgeGlowEnabled}
            onToggle={v => set({ edgeGlowEnabled: v })}>
            <Row label="Color">
              <ColorSwatch value={state.edgeGlowColor ?? '#00ffff'} onChange={v => set({ edgeGlowColor: v })} />
            </Row>
            <Row label="Intensity">
              <HwSlider value={state.edgeGlowIntensity ?? 65} min={10} max={100}
                onChange={v => set({ edgeGlowIntensity: v })} />
            </Row>
            <Row label="Bloom">
              <HwSlider value={state.edgeGlowBloom ?? 8} min={1} max={30}
                onChange={v => set({ edgeGlowBloom: v })} />
            </Row>
            <Row label="Darken">
              <HwSlider value={Math.round((state.edgeGlowDarken ?? 0.5) * 100)} min={0} max={90}
                onChange={v => set({ edgeGlowDarken: v / 100 })} />
            </Row>
          </EffectSection>

          {/* Split Tone */}
          <EffectSection label="Split Tone" number={10} enabled={state.splitToneEnabled}
            onToggle={v => set({ splitToneEnabled: v })}>
            <Row label="Shadows">
              <ColorSwatch value={state.splitToneShadowColor ?? '#1a237e'} onChange={v => set({ splitToneShadowColor: v })} />
            </Row>
            <Row label="Highlights">
              <ColorSwatch value={state.splitToneHighlightColor ?? '#ff6d00'} onChange={v => set({ splitToneHighlightColor: v })} />
            </Row>
            <Row label="Strength">
              <HwSlider value={state.splitToneStrength ?? 60} min={1} max={100}
                onChange={v => set({ splitToneStrength: v })} />
            </Row>
            <Row label="Balance">
              <HwSlider value={(state.splitToneBalance ?? 0) + 50} min={0} max={100}
                onChange={v => set({ splitToneBalance: v - 50 })} />
            </Row>
          </EffectSection>

          {/* Pixel Sort */}
          <EffectSection label="Pixel Sort" number={11} enabled={state.pixelSortEnabled}
            onToggle={v => set({ pixelSortEnabled: v })}>
            <Row label="Threshold">
              <HwSlider value={state.pixelSortThreshold ?? 128} min={0} max={255}
                onChange={v => set({ pixelSortThreshold: v })} />
            </Row>
            <HwSegment
              options={[{ id:'up',label:'Up' },{ id:'down',label:'Down' },{ id:'left',label:'Left' },{ id:'right',label:'Right' }]}
              value={state.pixelSortDirection ?? 'up'}
              onChange={v => set({ pixelSortDirection: v as typeof state.pixelSortDirection })}
            />
            <HwSegment
              options={[{ id:'brightness',label:'Luma' },{ id:'hue',label:'Hue' },{ id:'saturation',label:'Sat' }]}
              value={state.pixelSortMode ?? 'brightness'}
              onChange={v => set({ pixelSortMode: v as typeof state.pixelSortMode })}
            />
          </EffectSection>

          {/* Riso Print */}
          <EffectSection label="Riso Print" number={12} enabled={state.risoEnabled}
            onToggle={v => set({ risoEnabled: v })}>
            <Row label="Ink 1">
              <ColorSwatch value={state.risoColor1} onChange={v => set({ risoColor1: v })} />
            </Row>
            <Row label="Ink 2">
              <ColorSwatch value={state.risoColor2} onChange={v => set({ risoColor2: v })} />
            </Row>
            <Row label="Dot size">
              <HwSlider value={state.risoScale} min={1} max={16}
                onChange={v => set({ risoScale: v })} />
            </Row>
            <Row label="Misreg.">
              {/* Misregistration — how far the two ink layers are offset from
                  each other, mimicking imperfect real riso master alignment */}
              <HwSlider value={state.risoOffset} min={0} max={10}
                onChange={v => set({ risoOffset: v })} />
            </Row>
            <Row label="Grain">
              <HwSlider value={state.risoGrain} min={0} max={100}
                onChange={v => set({ risoGrain: v })} />
            </Row>
            <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
              Two ink plates, each independently dithered and slightly offset — the imperfect-registration look of real Risograph duplicator prints.
            </p>
          </EffectSection>

          {/* CMYK Separation */}
          <EffectSection label="CMYK Separation" number={13} enabled={state.cmykSeparationEnabled}
            onToggle={v => set({ cmykSeparationEnabled: v })}>
            <Row label="Dot size">
              <HwSlider value={state.cmykDotSize} min={1} max={12} step={0.5} decimals={1}
                onChange={v => set({ cmykDotSize: v })} />
            </Row>
            <Row label="Spacing">
              <HwSlider value={state.cmykSpacing} min={3} max={30} step={0.5} decimals={1}
                onChange={v => set({ cmykSpacing: v })} />
            </Row>
            <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
              Four halftone ink plates at the classic press screen angles (C 15° · M 75° · Y 0° · K 45°) — staggered to avoid moiré, exactly like an offset-press separation.
            </p>
          </EffectSection>

          {/* Silkscreen */}
          <EffectSection label="Silkscreen" number={14} enabled={state.silkscreenEnabled}
            onToggle={v => set({ silkscreenEnabled: v })}>
            <Row label="Paper">
              <ColorSwatch value={state.silkscreenPaperColor} onChange={v => set({ silkscreenPaperColor: v })} />
            </Row>
            <Row label="Ink 1">
              <ColorSwatch value={state.silkscreenInk1} onChange={v => set({ silkscreenInk1: v })} />
            </Row>
            <Row label="Ink 2">
              <ColorSwatch value={state.silkscreenInk2} onChange={v => set({ silkscreenInk2: v })} />
            </Row>
            <Row label="Ink 3">
              <ColorSwatch value={state.silkscreenInk3} onChange={v => set({ silkscreenInk3: v })} />
            </Row>
            <Row label="Key plate">
              {/* Luminance threshold below which pixels print solid black —
                  carves the silhouettes/linework out of the image */}
              <HwSlider value={state.silkscreenKeyThreshold} min={0} max={100}
                onChange={v => set({ silkscreenKeyThreshold: v })} />
            </Row>
            <Row label="Stipple">
              <HwSlider value={state.silkscreenStipple} min={0} max={100}
                onChange={v => set({ silkscreenStipple: v })} />
            </Row>
            <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
              Flat spot-ink posterization — paper ground, three inks and a black key plate, with stipple breaking up the tonal boundaries. The vintage poster / book-plate / comic look.
            </p>
          </EffectSection>

          {/* Postcard */}
          <EffectSection label="Postcard" number={15} enabled={state.postcardEnabled}
            onToggle={v => set({ postcardEnabled: v })}>
            <Row label="Saturation">
              <HwSlider value={state.postcardSaturation} min={0} max={100}
                onChange={v => set({ postcardSaturation: v })} />
            </Row>
            <Row label="Warmth">
              <HwSlider value={state.postcardWarmth} min={-50} max={50}
                onChange={v => set({ postcardWarmth: v })} />
            </Row>
            <Row label="Palette">
              {/* Per-channel quantization levels — fewer = harder retro clamp */}
              <HwSlider value={state.postcardLevels} min={2} max={8}
                onChange={v => set({ postcardLevels: v })} />
            </Row>
            <Row label="Texture">
              {/* Bayer cell size — 1 reads as linen-postcard weave, larger
                  becomes visible 90s-videogame dither */}
              <HwSlider value={state.postcardScale} min={1} max={8}
                onChange={v => set({ postcardScale: v })} />
            </Row>
            <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
              Oversaturated limited-palette color with a fine ordered texture — vintage linen travel postcard at fine Texture, 90s videogame at chunky.
            </p>
          </EffectSection>

        </HardwarePanel>

        {/* ── Light & FX ─────────────────────────────────────────────────── */}
        <HardwarePanel label="Light & FX" number={8}>
          <Row label="Ambient">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <HwSlider value={Math.round(state.ambientLightIntensity * 100)} min={0} max={100}
                onChange={v => set({ ambientLightIntensity: v / 100 })} />
              {/* hideHex — full swatch+hex text would crush the slider into a sliver */}
              <ColorSwatch value={state.ambientLightColor} onChange={v => set({ ambientLightColor: v })} size={20} hideHex />
            </div>
          </Row>
          {state.ambientLightIntensity > 0 && (
            <Row label="Position">
              <AmbientPicker />
            </Row>
          )}
          <Row label="RGB Shift">
            <HwSlider value={state.chromaticAberration} min={0} max={50}
              onChange={v => set({ chromaticAberration: v })} />
          </Row>
          <div>
            <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Dither</p>
            <PatternGrid
              options={[
                { id:'none',label:'Off' },{ id:'bayer',label:'Bayer' },
                { id:'floyd-steinberg',label:'F-S' },{ id:'atkinson',label:'Atkinson' },
                { id:'ascii',label:'ASCII' },
              ]}
              value={state.ditherStyle}
              onChange={v => set({ ditherStyle: v as DitherStyle })}
              columns={5}
              compact
            />
          </div>
          {state.ditherStyle !== 'none' && (
            <>
              {state.ditherStyle === 'ascii' ? (
                <>
                  <Row label="Char size">
                    {/* Dedicated control, not the shared dot/cell Scale — needs a
                        larger default range so characters read as glyphs rather
                        than blur into static at very small sizes. */}
                    <HwSlider value={state.ditherAsciiCharSize} min={6} max={32}
                      onChange={v => set({ ditherAsciiCharSize: v })} />
                  </Row>
                  <Row label="Brightness">
                    {/* Biases luminance before the density-ramp lookup — pulls
                        shadow-heavy images up out of the ramp's near-empty bottom
                        steps so they don't collapse into a flat black void. */}
                    <HwSlider value={state.ditherAsciiBrightness} min={-100} max={100}
                      onChange={v => set({ ditherAsciiBrightness: v })} />
                  </Row>
                </>
              ) : (
                <>
                  <Row label="Scale">
                    {/* Widened 8 → 16: bigger dot/cell size for chunkier, more
                        graphic halftone patterns — matches large-dot reference looks. */}
                    <HwSlider value={state.ditherScale} min={1} max={16}
                      onChange={v => set({ ditherScale: v })} />
                  </Row>
                  {state.ditherStyle === 'bayer' && (
                    <div>
                      {/* Matrix size only affects Bayer — F-S/Atkinson use error
                          diffusion, no fixed threshold grid to resize. Bigger
                          matrix = finer/more photographic pattern; 2×2 = very
                          coarse, graphic dot grid like image 1's sky reference. */}
                      <p className="text-[10px] font-semibold mb-2" style={{ color: T.muted }}>Matrix</p>
                      <PatternGrid
                        options={[
                          { id:'2',label:'2×2' },{ id:'4',label:'4×4' },
                          { id:'8',label:'8×8' },{ id:'16',label:'16×16' },
                        ]}
                        value={String(state.ditherMatrixSize)}
                        onChange={v => set({ ditherMatrixSize: parseInt(v, 10) })}
                        columns={4}
                        compact
                      />
                    </div>
                  )}
                </>
              )}
              <Row label="Duotone">
                <TactileToggle value={state.ditherDuotoneEnabled}
                  onChange={v => set({ ditherDuotoneEnabled: v })} />
              </Row>
              {state.ditherDuotoneEnabled && (
                <>
                  <Row label="Shadows">
                    <ColorSwatch value={state.ditherDuotoneShadowColor}
                      onChange={v => set({ ditherDuotoneShadowColor: v })} />
                  </Row>
                  <Row label="Highlights">
                    <ColorSwatch value={state.ditherDuotoneHighlightColor}
                      onChange={v => set({ ditherDuotoneHighlightColor: v })} />
                  </Row>
                  {/* Levels only affects the dot/error-diffusion dither styles —
                      ASCII already has 10 built-in density steps in its ramp */}
                  {state.ditherStyle !== 'ascii' && (
                    <Row label="Levels">
                      <HwSlider value={state.ditherDuotoneLevels} min={2} max={8}
                        onChange={v => set({ ditherDuotoneLevels: v })} />
                    </Row>
                  )}
                  <Row label="Invert">
                    <TactileToggle value={state.ditherDuotoneInvert}
                      onChange={v => set({ ditherDuotoneInvert: v })} />
                  </Row>
                  <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
                    {state.ditherStyle === 'ascii'
                      ? 'Characters draw in the highlight color over a flat background — the poster / terminal-art look. Invert swaps which color is background vs ink.'
                      : 'Dot/error-diffusion density creates apparent tone from two flat colors — the halftone screen-print look. Invert swaps which color falls on shadows vs highlights.'}
                  </p>
                </>
              )}
              {state.ditherStyle === 'ascii' && !state.ditherDuotoneEnabled && (
                <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
                  Each character is colorized from the source image — full-color ASCII mosaic on black. Enable Duotone for a clean two-color poster look instead.
                </p>
              )}
            </>
          )}
        </HardwarePanel>

        {/* ── Effect Mask ────────────────────────────────────────────────── */}
        {hasSource && (
          <HardwarePanel label="Effect Mask" number={9} active={state.effectMaskEnabled}>
            <Row label="Enable">
              <TactileToggle value={state.effectMaskEnabled} onChange={v => set({ effectMaskEnabled: v })} />
            </Row>
            {state.effectMaskEnabled && (
              <>
                <EffectMaskPad
                  imageUrl={state.imageUrl}
                  strokes={state.effectMaskStrokes}
                  onChange={strokes => set({ effectMaskStrokes: strokes })}
                  brushSize={state.effectMaskBrushSize}
                  onBrushSizeChange={v => set({ effectMaskBrushSize: v })}
                  feather={state.effectMaskFeather}
                  onFeatherChange={v => set({ effectMaskFeather: v })}
                  invert={state.effectMaskInvert}
                  onInvertChange={v => set({ effectMaskInvert: v })}
                  showOverlay={state.effectMaskShowOverlay}
                  onShowOverlayChange={v => set({ effectMaskShowOverlay: v })}
                  accentColor={T.accent}
                />
                <Row label="Brush size">
                  <HwSlider value={Math.round(state.effectMaskBrushSize * 100)} min={2} max={40}
                    onChange={v => set({ effectMaskBrushSize: v / 100 })} />
                </Row>
                <Row label="Feather">
                  <HwSlider value={state.effectMaskFeather} min={0} max={100}
                    onChange={v => set({ effectMaskFeather: v })} />
                </Row>
                <Row label="Show paint">
                  <TactileToggle value={state.effectMaskShowOverlay} onChange={v => set({ effectMaskShowOverlay: v })} />
                </Row>
                <Row label="Invert">
                  <TactileToggle value={state.effectMaskInvert} onChange={v => set({ effectMaskInvert: v })} />
                </Row>
                <button onClick={() => set({ effectMaskStrokes: [] })}
                  disabled={state.effectMaskStrokes.length === 0}
                  className="w-full py-2 text-[11px] font-medium rounded-lg border transition-all disabled:opacity-40"
                  style={{ color: T.muted, borderColor: T.border, background: T.panel }}>
                  Clear Mask
                </button>
                <p className="text-[10px] leading-relaxed" style={{ color: T.dim }}>
                  Restricts every active effect above to the painted area — everywhere else stays as the original image. Invert to restrict effects to everywhere <em>except</em> what you paint.
                </p>
              </>
            )}
          </HardwarePanel>
        )}

      </div>

      {/* Hardware serial plate — non-functional, purely decorative.
          References the fastener plate on the back of a Braun or TE device,
          stamped with a serial number and revision. Uses the LCD mono font
          for consistency with the numeric readouts elsewhere in the panel.   */}
      <div className="shrink-0 px-5 pt-2 pb-6 flex items-center justify-between select-none">
        <span
          style={{
            fontFamily: '"Share Tech Mono", ui-monospace, monospace',
            fontSize: 9, color: T.border, letterSpacing: '0.06em',
          }}
        >
          SN · HK-2025-001
        </span>
        <span
          style={{
            fontFamily: '"Share Tech Mono", ui-monospace, monospace',
            fontSize: 9, color: T.border, letterSpacing: '0.06em',
          }}
        >
          REV. 1.0
        </span>
      </div>
    </div>
  );
};

export default RightPanel;
