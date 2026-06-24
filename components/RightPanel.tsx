
import React, { useState } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import SpotBlurMap from './SpotBlurMap';
import {
  BackgroundState, AtmosphereStyle, PatternStyle, ImageFilter,
  ImageMask, DitherStyle, GenerativePreset, ExportFormat, ExportResolution,
  AmbientPosition,
} from '../types';

// ─── Design tokens ────────────────────────────────────────────────────────────
// label text : text-[11px]  (section headers: tracking-widest text-[10px])
// control text: text-xs  (12px)
// panel width : 310px

// ─── Primitives ───────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] tracking-[0.18em] text-[#555] uppercase font-semibold px-5 pt-5 pb-2.5 select-none">
    {children}
  </p>
);

const Divider = () => <div className="h-px bg-[#222] mx-5 mt-1" />;

/** Left label + right control, single row */
const Row: React.FC<{ label: string; children: React.ReactNode; tall?: boolean }> = ({ label, children, tall }) => (
  <div className={`flex items-center px-5 ${tall ? 'py-2.5' : 'py-[9px]'} gap-3`}>
    <span className="text-[11px] text-[#888] shrink-0 w-[80px]">{label}</span>
    <div className="flex-1 flex items-center justify-end gap-2 min-w-0">{children}</div>
  </div>
);

/** Full-width block with optional sub-label */
const Block: React.FC<{ label?: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`px-5 py-2 ${className}`}>
    {label && <p className="text-[11px] text-[#666] mb-2">{label}</p>}
    {children}
  </div>
);

const Slider: React.FC<{
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; decimals?: number;
}> = ({ value, min, max, step = 1, onChange, decimals = 0 }) => (
  <div className="flex items-center gap-2.5 flex-1 min-w-0">
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="heroken-slider flex-1 min-w-0"
    />
    <span className="text-[11px] text-[#777] w-9 text-right tabular-nums shrink-0">
      {value.toFixed(decimals)}
    </span>
  </div>
);

const ColorDot: React.FC<{ value: string; onChange: (v: string) => void; size?: number }> = ({ value, onChange, size = 22 }) => (
  <label className="relative cursor-pointer shrink-0" style={{ width: size, height: size }}>
    <span className="block w-full h-full rounded-full border border-white/[0.12] shadow-sm" style={{ backgroundColor: value }} />
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
  </label>
);

/** Segmented control — equal-width pill buttons */
const Segment: React.FC<{
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex bg-[#1c1c1c] rounded-lg p-[3px] border border-[#2c2c2c] gap-[2px] w-full">
    {options.map(o => (
      <button
        key={o.id}
        onClick={() => onChange(o.id)}
        className={`flex-1 py-[6px] text-xs font-medium rounded-md transition-all leading-none
          ${value === o.id ? 'bg-white text-black shadow-sm' : 'text-[#777] hover:text-[#bbb]'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** Small chip — multi-option grids */
const Chip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`py-[7px] text-[11px] rounded-md border transition-all leading-none font-medium
      ${active ? 'bg-white text-black border-white' : 'text-[#666] border-[#2c2c2c] hover:border-[#444] hover:text-[#aaa]'}`}
  >
    {label}
  </button>
);

// ─── Super Visuals gallery ───────────────────────────────────────────────────

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
  // 300px WebP thumbnail for the grid (396KB total vs 19MB originals)
  thumb: `/super-visuals-ahmed-hassan/thumbs/${name}.webp`,
  // Full JPEG loaded only when selected as canvas source
  src:   `/super-visuals-ahmed-hassan/${name}.jpg`,
}));

// ─── Atmosphere grid ──────────────────────────────────────────────────────────

const ATMO: { id: AtmosphereStyle; label: string; icon: string }[] = [
  { id: 'none',           label: 'None',    icon: 'ph-prohibit' },
  { id: 'fluid-mesh',     label: 'Fluid',   icon: 'ph-waves' },
  { id: 'aurora',         label: 'Aurora',  icon: 'ph-rainbow' },
  { id: 'animated-mesh',  label: 'Spin',    icon: 'ph-spinner' },
  { id: 'mesh-accent',    label: 'Accent',  icon: 'ph-gradient' },
  { id: 'kinetic-flow',   label: 'Flow',    icon: 'ph-path' },
  { id: 'molten-orb',     label: 'Molten',  icon: 'ph-fire' },
  { id: 'volumetric-fog', label: 'Fog',     icon: 'ph-cloud' },
  { id: 'generative',     label: 'Gen.',    icon: 'ph-star-four' },
  { id: 'light-leak',     label: 'Leak',    icon: 'ph-sun-dim' },
  { id: 'shimmer',        label: 'Shimmer', icon: 'ph-shooting-star' },
  { id: 'glitch',         label: 'Glitch',  icon: 'ph-code-block' },
  { id: 'glow',           label: 'Glow',    icon: 'ph-sun' },
  { id: 'fade-bottom',    label: 'Fade',    icon: 'ph-gradient-horizontal' },
];

// ─── Gallery + Pexels search ──────────────────────────────────────────────────

const GALLERY_INITIAL = 8;
const PEXELS_KEY      = (import.meta as any).env?.VITE_PEXELS_API_KEY as string;
const QUICK_SEARCHES  = ['Landscape', 'Atmospheric', 'Cinematic', 'Cosmic', 'Abstract', 'Moody', 'Misty'];

interface PexelsPhoto {
  id: number;
  alt: string;
  photographer: string;
  src: { small: string; large2x: string };
}

const GallerySection: React.FC<{ imageUrl?: string; onChange: (p: Partial<BackgroundState>) => void }> = ({ imageUrl, onChange }) => {
  const [tab, setTab]             = useState<'curated' | 'pexels'>('curated');
  const [expanded, setExpanded]   = useState(false);
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<PexelsPhoto[]>([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  const fetchPexels = async (q: string, pg: number) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res  = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20&page=${pg}&orientation=landscape`,
        { headers: { Authorization: PEXELS_KEY } },
      );
      const data = await res.json();
      const photos: PexelsPhoto[] = data.photos ?? [];
      setResults(pg === 1 ? photos : prev => [...prev, ...photos]);
      setHasMore(photos.length === 20);
      setLastQuery(q);
      setPage(pg);
    } catch { /* silent fail */ }
    finally { setSearching(false); }
  };

  const doSearch = (q: string) => { setQuery(q); setResults([]); fetchPexels(q, 1); };

  const visible = expanded ? GALLERY : GALLERY.slice(0, GALLERY_INITIAL);

  return (
    <div className="px-5 pb-2">

      {/* Tab bar + attribution */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex bg-[#1c1c1c] rounded-md p-[3px] border border-[#2a2a2a] gap-[2px]">
          {(['curated', 'pexels'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-[5px] text-[10px] font-medium rounded-[4px] transition-all leading-none ${
                tab === t ? 'bg-white text-black shadow-sm' : 'text-[#666] hover:text-[#aaa]'
              }`}>
              {t === 'curated' ? 'Curated' : 'Pexels'}
            </button>
          ))}
        </div>
        {tab === 'curated' && (
          <p className="text-[9px] text-[#555]">Super Visuals by{' '}
            <a href="https://x.com/uihssn" target="_blank" rel="noopener noreferrer"
              className="text-[#3a3a3a] underline underline-offset-2 hover:text-[#666] transition-colors"
              onClick={e => e.stopPropagation()}>Ahmed Hassan</a>
          </p>
        )}
        {tab === 'pexels' && (
          <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer"
            className="text-[9px] text-[#333] hover:text-[#666] transition-colors">
            Photos by Pexels
          </a>
        )}
      </div>

      {/* ── Curated ── */}
      {tab === 'curated' && (<>
        <div className="grid grid-cols-4 gap-1">
          {visible.map(item => {
            const active = imageUrl === item.src;
            return (
              <button key={item.src}
                onClick={() => onChange({ imageUrl: item.src, videoUrl: undefined })}
                className={`relative aspect-square overflow-hidden rounded-md border transition-all ${
                  active ? 'border-white/70 ring-1 ring-white/40' : 'border-transparent hover:border-white/20'
                }`}>
                <img src={item.thumb} alt="" width={64} height={64}
                  className="w-full h-full object-cover"
                  loading={expanded ? 'lazy' : 'eager'} decoding="async" />
                {active && <div className="absolute inset-0 bg-white/10" />}
              </button>
            );
          })}
        </div>
        {!expanded && GALLERY.length > GALLERY_INITIAL && (
          <button onClick={() => setExpanded(true)}
            className="w-full mt-2 py-1.5 text-[10px] text-[#555] hover:text-[#999] border border-[#222] hover:border-[#333] rounded-lg transition-colors">
            View all {GALLERY.length} images
          </button>
        )}
        {expanded && (
          <button onClick={() => setExpanded(false)}
            className="w-full mt-2 py-1.5 text-[10px] text-[#555] hover:text-[#999] border border-[#222] hover:border-[#333] rounded-lg transition-colors">
            Show less
          </button>
        )}
      </>)}

      {/* ── Pexels ── */}
      {tab === 'pexels' && (<>
        {/* Quick searches */}
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK_SEARCHES.map(q => (
            <button key={q} onClick={() => doSearch(q)}
              className={`px-2.5 py-1 text-[10px] rounded-full border transition-all ${
                lastQuery.toLowerCase() === q.toLowerCase()
                  ? 'border-white/40 bg-white/10 text-white'
                  : 'border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#999]'
              }`}>{q}</button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex gap-1.5 mb-2">
          <input type="text" placeholder="Search Pexels…" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(query)}
            className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-[#444] outline-none focus:border-[#444] transition-colors" />
          <button onClick={() => doSearch(query)} disabled={searching}
            className="px-3 py-1.5 bg-white text-black text-[10px] font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors shrink-0">
            {searching ? '…' : 'Go'}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="grid grid-cols-4 gap-1">
            {results.map(photo => {
              const active = imageUrl === photo.src.large2x;
              return (
                <button key={photo.id}
                  onClick={() => onChange({ imageUrl: photo.src.large2x, videoUrl: undefined })}
                  title={`${photo.alt || 'Photo'} · ${photo.photographer}`}
                  className={`relative aspect-square overflow-hidden rounded-md border transition-all ${
                    active ? 'border-white/70 ring-1 ring-white/40' : 'border-transparent hover:border-white/20'
                  }`}>
                  <img src={photo.src.small} alt={photo.alt || ''} width={64} height={64}
                    className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  {active && <div className="absolute inset-0 bg-white/10" />}
                </button>
              );
            })}
          </div>
        )}

        {results.length === 0 && !searching && lastQuery && (
          <p className="text-[10px] text-[#444] text-center py-4">No results for "{lastQuery}"</p>
        )}
        {results.length === 0 && !searching && !lastQuery && (
          <p className="text-[10px] text-[#444] text-center py-6 leading-relaxed px-2">
            Tap a quick search or type your own to pull from millions of photos.
          </p>
        )}
        {hasMore && !searching && (
          <button onClick={() => fetchPexels(lastQuery, page + 1)}
            className="w-full mt-2 py-1.5 text-[10px] text-[#555] hover:text-[#999] border border-[#222] hover:border-[#333] rounded-lg transition-colors">
            Load more
          </button>
        )}
        {searching && results.length > 0 && (
          <p className="text-[10px] text-[#444] text-center py-2">Loading…</p>
        )}
      </>)}
    </div>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────

interface RightPanelProps {
  state: BackgroundState;
  onChange: (patch: Partial<BackgroundState>) => void;
  onOpenLooks: () => void;
  onResetEffects: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ state, onChange, onOpenLooks, onResetEffects }) => {
  const [format, setFormat]       = useState<ExportFormat>('PNG');
  const [resolution, setResolution] = useState<ExportResolution>('2x');
  const [exporting, setExporting] = useState(false);

  const set = (patch: Partial<BackgroundState>) => onChange(patch);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = e => set({ imageUrl: e.target?.result as string, videoUrl: undefined });
      r.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      set({ videoUrl: URL.createObjectURL(file), imageUrl: undefined });
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
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
      a.href = dataUrl;
      a.click();
    } catch {
      alert('Export failed — try a lower resolution.');
    } finally {
      setExporting(false);
    }
  };

  const hasSource = !!(state.imageUrl || state.videoUrl);
  const hasAtmo   = state.atmosphereStyle !== 'none';
  const speedAtmos: AtmosphereStyle[] = ['fluid-mesh', 'animated-mesh', 'aurora', 'shimmer', 'kinetic-flow'];

  const FILTERS: { id: ImageFilter; label: string }[] = [
    { id: 'none',       label: 'None'    },
    { id: 'grayscale',  label: 'B&W'     },
    { id: 'desaturate', label: 'Muted'   },
    { id: 'tint',       label: 'Tint'    },
    { id: 'duotone',    label: 'Duotone' },
    { id: 'frosted',    label: 'Frosted' },
  ];

  const MASKS: { id: ImageMask; label: string }[] = [
    { id: 'none',        label: 'None'   },
    { id: 'fade-bottom', label: 'Bottom' },
    { id: 'fade-left',   label: 'Left'   },
    { id: 'fade-right',  label: 'Right'  },
    { id: 'radial',      label: 'Radial' },
    { id: 'soft-edges',  label: 'Soft'   },
  ];

  const PATTERNS: { id: PatternStyle; label: string }[] = [
    { id: 'none',     label: 'Off'   },
    { id: 'grid',     label: 'Grid'  },
    { id: 'dot',      label: 'Dot'   },
    { id: 'iso-grid', label: 'ISO'   },
    { id: 'scanline', label: 'Scan'  },
    { id: 'hex',      label: 'Hex'   },
    { id: 'waves',    label: 'Waves' },
    { id: 'plus',     label: 'Plus'  },
  ];

  return (
    <div
      className="w-[310px] shrink-0 flex flex-col bg-[#161616] border-l border-[#222] h-full"
      style={{ overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}
    >

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] shrink-0">
        <div className="flex items-center gap-2">
          <img src="/herokit_logomark_light.png" alt="" className="w-5 h-5 object-contain" />
          <span className="text-sm font-semibold text-white tracking-wide">HeroKit</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onResetEffects}
            title="Reset all effects to defaults (keeps image)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#555] hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <i className="ph ph-arrow-counter-clockwise text-base" />
            <span className="text-[11px] font-medium">Reset</span>
          </button>
          <button
            onClick={onOpenLooks}
            title="Looks — save, share & history"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#555] hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <i className="ph ph-bookmark-simple text-base" />
            <span className="text-[11px] font-medium">Looks</span>
          </button>
        </div>
      </div>

      {/* ── SOURCE ──────────────────────────────────────────────────────── */}
      <SectionLabel>Source</SectionLabel>

      <div className="px-5 pb-3 space-y-2">
        <label
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-2 w-full h-[72px] rounded-xl border border-dashed border-[#2e2e2e] cursor-pointer hover:border-[#555] hover:bg-white/[0.03] transition-all text-[#555] hover:text-[#999]"
        >
          <i className="ph ph-upload-simple text-xl" />
          <span className="text-xs tracking-wide">Upload Image / Video</span>
          <input type="file" className="hidden" accept="image/*,video/mp4,video/webm"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>

        {hasSource && (
          <button
            onClick={() => set({ imageUrl: undefined, videoUrl: undefined })}
            className="w-full py-2 text-xs text-[#666] hover:text-[#bbb] border border-[#252525] hover:border-[#3a3a3a] rounded-lg transition-colors"
          >
            Clear source
          </button>
        )}
      </div>

      {/* ── GALLERY ─────────────────────────────────────────────────────── */}
      <GallerySection imageUrl={state.imageUrl} onChange={onChange} />

      <Divider />

      {/* ── EXPORT ──────────────────────────────────────────────────────── */}
      <SectionLabel>Export</SectionLabel>

      <div className="px-5 pb-5 space-y-3">
        {/* Format selector — full-width, large */}
        <Segment
          options={[{ id: 'PNG', label: 'PNG' }, { id: 'WebP', label: 'WebP' }, { id: 'JPG', label: 'JPG' }]}
          value={format}
          onChange={v => setFormat(v as ExportFormat)}
        />

        {/* Export button — full width, prominent */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center justify-center gap-2 py-[10px] bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40"
        >
          {exporting
            ? <i className="ph ph-spinner animate-spin text-base" />
            : <i className="ph-bold ph-download-simple text-base" />}
          {exporting ? 'Exporting…' : 'Export'}
        </button>

        {/* Resolution */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#888] shrink-0 w-[80px]">Resolution</span>
          <div className="flex-1">
            <Segment
              options={[{ id: '1x', label: '1×' }, { id: '2x', label: '2×' }, { id: '4x', label: '4×' }]}
              value={resolution}
              onChange={v => setResolution(v as ExportResolution)}
            />
          </div>
        </div>
      </div>

      <Divider />

      {/* ── BACKGROUND ──────────────────────────────────────────────────── */}
      <SectionLabel>Background</SectionLabel>

      <Row label="Color">
        <div className="flex items-center gap-2.5">
          <ColorDot value={state.bgColor} onChange={v => set({ bgColor: v })} size={24} />
          <span className="text-xs text-[#666] font-mono uppercase tracking-wider">{state.bgColor}</span>
        </div>
      </Row>

      {hasSource && (
        <>
          <Block label="Filter">
            <div className="grid grid-cols-3 gap-1.5">
              {FILTERS.map(f => (
                <Chip key={f.id} label={f.label} active={state.imageFilter === f.id}
                  onClick={() => set({ imageFilter: f.id })} />
              ))}
            </div>
          </Block>

          {(state.imageFilter === 'tint' || state.imageFilter === 'duotone') && (
            <Row label="Tint color">
              <ColorDot value={state.tintColor} onChange={v => set({ tintColor: v })} size={24} />
            </Row>
          )}

          <Row label="Blur">
            <Slider value={state.imageBlur} min={0} max={20} step={0.5} decimals={1}
              onChange={v => set({ imageBlur: v })} />
          </Row>
          <Row label="Opacity">
            <Slider value={Math.round(state.imageOpacity * 100)} min={0} max={100}
              onChange={v => set({ imageOpacity: v / 100 })} />
          </Row>

          <Block label="Mask">
            <div className="grid grid-cols-3 gap-1.5">
              {MASKS.map(m => (
                <Chip key={m.id} label={m.label} active={state.imageMask === m.id}
                  onClick={() => set({ imageMask: m.id })} />
              ))}
            </div>
          </Block>
        </>
      )}

      <Divider />

      {/* ── EFFECTS ─────────────────────────────────────────────────────── */}
      <SectionLabel>Effects</SectionLabel>

      {/* 5-column grid — icon + label visible */}
      <div className="px-5 pb-3 grid grid-cols-5 gap-1.5">
        {ATMO.map(o => (
          <button
            key={o.id}
            onClick={() => set({ atmosphereStyle: o.id })}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all
              ${state.atmosphereStyle === o.id
                ? 'bg-white/10 border-white/30 text-white'
                : 'border-[#272727] text-[#454545] hover:border-[#3a3a3a] hover:text-[#888]'}`}
          >
            <i className={`ph ${o.icon} text-lg`} />
            <span className="text-[9px] leading-none text-center font-medium">{o.label}</span>
          </button>
        ))}
      </div>

      {hasAtmo && (
        <>
          <Row label="Colors">
            <div className="flex gap-3 items-center">
              <ColorDot value={state.meshColors.color1} onChange={v => set({ meshColors: { ...state.meshColors, color1: v } })} size={24} />
              <ColorDot value={state.meshColors.color2} onChange={v => set({ meshColors: { ...state.meshColors, color2: v } })} size={24} />
              <ColorDot value={state.meshColors.color3} onChange={v => set({ meshColors: { ...state.meshColors, color3: v } })} size={24} />
            </div>
          </Row>

          {speedAtmos.includes(state.atmosphereStyle) && (
            <Row label="Speed">
              <div className="flex-1">
                <Segment
                  options={[{ id:'slow', label:'Slow' }, { id:'normal', label:'Mid' }, { id:'fast', label:'Fast' }]}
                  value={state.meshSpeed}
                  onChange={v => set({ meshSpeed: v as 'slow' | 'normal' | 'fast' })}
                />
              </div>
            </Row>
          )}

          {state.atmosphereStyle === 'fluid-mesh' && (<>
            <Row label="Complexity">
              <Slider value={state.meshComplexity} min={1} max={10} step={0.5} decimals={1} onChange={v => set({ meshComplexity: v })} />
            </Row>
            <Row label="Turbulence">
              <Slider value={state.meshTurbulence} min={0} max={1} step={0.05} decimals={2} onChange={v => set({ meshTurbulence: v })} />
            </Row>
            <Row label="Zoom">
              <Slider value={state.meshZoom} min={0.5} max={3} step={0.1} decimals={1} onChange={v => set({ meshZoom: v })} />
            </Row>
            <Row label="Contrast">
              <Slider value={state.meshContrast} min={0.5} max={3} step={0.1} decimals={1} onChange={v => set({ meshContrast: v })} />
            </Row>
            <Row label="Frequency">
              <Slider value={state.meshFrequency} min={1} max={10} step={0.5} decimals={1} onChange={v => set({ meshFrequency: v })} />
            </Row>
          </>)}

          {state.atmosphereStyle === 'kinetic-flow' && (<>
            <Row label="Speed">
              <Slider value={state.kineticSpeed} min={0.1} max={3} step={0.1} decimals={1} onChange={v => set({ kineticSpeed: v })} />
            </Row>
            <Row label="Trail length">
              <Slider value={state.kineticTrailLength} min={5} max={60} onChange={v => set({ kineticTrailLength: v })} />
            </Row>
            <Row label="Chaos">
              <Slider value={state.kineticChaos} min={0.1} max={2} step={0.1} decimals={1} onChange={v => set({ kineticChaos: v })} />
            </Row>
          </>)}

          {state.atmosphereStyle === 'molten-orb' && (<>
            <Row label="Roughness">
              <Slider value={state.moltenRoughness} min={0} max={1} step={0.05} decimals={2} onChange={v => set({ moltenRoughness: v })} />
            </Row>
            <Row label="Distortion">
              <Slider value={state.moltenDistortion} min={0} max={1} step={0.05} decimals={2} onChange={v => set({ moltenDistortion: v })} />
            </Row>
          </>)}

          {state.atmosphereStyle === 'volumetric-fog' && (<>
            <Row label="Density">
              <Slider value={state.fogDensity} min={0} max={1} step={0.05} decimals={2} onChange={v => set({ fogDensity: v })} />
            </Row>
            <Row label="Speed">
              <Slider value={state.fogSpeed} min={0.05} max={2} step={0.05} decimals={2} onChange={v => set({ fogSpeed: v })} />
            </Row>
          </>)}

          {/* Effects opacity — visible for all active effects */}
          <Row label="Opacity">
            <Slider
              value={Math.round((state.effectsOpacity ?? 1) * 100)}
              min={0} max={100}
              onChange={v => set({ effectsOpacity: v / 100 })}
            />
          </Row>

          {state.atmosphereStyle === 'generative' && (
            <Block label="Preset">
              <div className="grid grid-cols-5 gap-1.5">
                {(['orbital','particles','matrix','fluid-grid','noise-field'] as GenerativePreset[]).map(p => (
                  <Chip key={p}
                    label={p === 'fluid-grid' ? 'Grid' : p === 'noise-field' ? 'Field' : p.charAt(0).toUpperCase() + p.slice(1)}
                    active={state.generativePreset === p}
                    onClick={() => set({ generativePreset: p })} />
                ))}
              </div>
            </Block>
          )}
        </>
      )}

      <Divider />

      {/* ── GRAIN & TEXTURE ─────────────────────────────────────────────── */}
      <SectionLabel>Grain & Texture</SectionLabel>

      <Row label="Film grain">
        <Slider value={Math.round(state.noiseOpacity * 100)} min={0} max={50}
          onChange={v => set({ noiseOpacity: v / 100 })} />
      </Row>
      {state.noiseOpacity > 0 && (
        <Row label="Grain color">
          <ColorDot value={state.noiseColor} onChange={v => set({ noiseColor: v })} size={24} />
        </Row>
      )}

      <Block label="Pattern">
        <div className="grid grid-cols-4 gap-1.5">
          {PATTERNS.map(p => (
            <Chip key={p.id} label={p.label} active={state.patternStyle === p.id}
              onClick={() => set({ patternStyle: p.id })} />
          ))}
        </div>
      </Block>

      {state.patternStyle !== 'none' && (<>
        <Row label="Opacity">
          <Slider value={Math.round(state.patternOpacity * 100)} min={1} max={100}
            onChange={v => set({ patternOpacity: v / 100 })} />
        </Row>
        <Row label="Color">
          <ColorDot value={state.patternColor} onChange={v => set({ patternColor: v })} size={24} />
        </Row>
        <Block label="Blend mode">
          <div className="grid grid-cols-5 gap-1.5">
            {(['normal','overlay','screen','soft-light','multiply'] as const).map(bm => (
              <Chip key={bm}
                label={bm === 'soft-light' ? 'Soft' : bm.charAt(0).toUpperCase() + bm.slice(1)}
                active={state.patternBlendMode === bm}
                onClick={() => set({ patternBlendMode: bm })} />
            ))}
          </div>
        </Block>
      </>)}

      <Divider />

      {/* ── IMAGE GLITCH ────────────────────────────────────────────────── */}
      <SectionLabel>Image Glitch</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ imageGlitchEnabled: !state.imageGlitchEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.imageGlitchEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.imageGlitchEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.imageGlitchEnabled && (<>
        <Block label="Style">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { id: 'digital', label: 'Digital'  },
              { id: 'corrupt', label: 'Corrupt'  },
              { id: 'signal',  label: 'Signal'   },
            ] as const).map(s => (
              <Chip key={s.id} label={s.label}
                active={(state.imageGlitchStyle ?? 'digital') === s.id}
                onClick={() => set({ imageGlitchStyle: s.id })} />
            ))}
          </div>
        </Block>
        <Row label="Intensity">
          <Slider value={state.imageGlitchIntensity ?? 40} min={1} max={100}
            onChange={v => set({ imageGlitchIntensity: v })} />
        </Row>
        <Row label="Shift">
          <Slider value={state.imageGlitchShift ?? 30} min={1} max={150}
            onChange={v => set({ imageGlitchShift: v })} />
        </Row>
        <Row label="RGB Split">
          <Slider value={state.imageGlitchRgbSplit ?? 5} min={0} max={40}
            onChange={v => set({ imageGlitchRgbSplit: v })} />
        </Row>
        <p className="text-[10px] text-[#444] px-5 pb-2 italic">
          Each slider change regenerates the pattern.
        </p>
      </>)}

      <Divider />

      {/* ── MOTION BLUR ─────────────────────────────────────────────────── */}
      <SectionLabel>Motion Blur</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ motionBlurEnabled: !state.motionBlurEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.motionBlurEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.motionBlurEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.motionBlurEnabled && (<>
        <Row label="Type">
          <div className="flex-1">
            <Segment
              options={[
                { id: 'horizontal', label: '↔ Horiz' },
                { id: 'vertical',   label: '↕ Vert'  },
                { id: 'zoom',       label: '⊙ Zoom'  },
              ]}
              value={state.motionBlurType ?? 'horizontal'}
              onChange={v => set({ motionBlurType: v as 'horizontal' | 'vertical' | 'zoom' })}
            />
          </div>
        </Row>
        <Row label="Strength">
          <Slider value={state.motionBlurStrength ?? 20} min={2} max={80}
            onChange={v => set({ motionBlurStrength: v })} />
        </Row>
      </>)}

      <Divider />

      {/* ── SPOT BLUR ───────────────────────────────────────────────────── */}
      <SectionLabel>Spot Blur</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ spotBlurEnabled: !state.spotBlurEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.spotBlurEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.spotBlurEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.spotBlurEnabled && (<>
        <Row label="BG blur">
          <Slider value={state.spotBlurRadius ?? 18} min={2} max={40}
            onChange={v => set({ spotBlurRadius: v })} />
        </Row>
        <Block>
          <SpotBlurMap
            spots={state.blurSpots ?? []}
            onChange={spots => set({ blurSpots: spots })}
          />
        </Block>
      </>)}

      <Divider />

      {/* ── HALFTONE ────────────────────────────────────────────────────── */}
      <SectionLabel>Halftone</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ halftoneEnabled: !state.halftoneEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${
            state.halftoneEnabled
              ? 'bg-white border-white'
              : 'bg-[#2a2a2a] border-[#3a3a3a]'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
            state.halftoneEnabled
              ? 'left-5 bg-black'
              : 'left-0.5 bg-[#666]'
          }`} />
        </button>
      </Row>

      {state.halftoneEnabled && (<>
        <Row label="Dot size">
          <Slider value={state.halftoneDotSize} min={1} max={12} step={0.5} decimals={1}
            onChange={v => set({ halftoneDotSize: v })} />
        </Row>
        <Row label="Spacing">
          <Slider value={state.halftoneSpacing} min={3} max={30} step={0.5} decimals={1}
            onChange={v => set({ halftoneSpacing: v })} />
        </Row>
        <Row label="Color">
          <ColorDot value={state.halftoneColor} onChange={v => set({ halftoneColor: v })} size={24} />
        </Row>
        <Row label="Opacity">
          <Slider value={Math.round((state.halftoneOpacity ?? 1) * 100)} min={0} max={100}
            onChange={v => set({ halftoneOpacity: v / 100 })} />
        </Row>
        <Row label="Invert">
          <button
            onClick={() => set({ halftoneInvert: !state.halftoneInvert })}
            className={`relative w-10 h-5 rounded-full border transition-all ${
              state.halftoneInvert
                ? 'bg-white border-white'
                : 'bg-[#2a2a2a] border-[#3a3a3a]'
            }`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
              state.halftoneInvert
                ? 'left-5 bg-black'
                : 'left-0.5 bg-[#666]'
            }`} />
          </button>
        </Row>
      </>)}

      <Divider />

      {/* ── COLOR GRADE ─────────────────────────────────────────────────── */}
      <SectionLabel>Color Grade</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ colorGradeEnabled: !state.colorGradeEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.colorGradeEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.colorGradeEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.colorGradeEnabled && (<>
        <Block label="Preset">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { id: 'teal-orange',  label: 'Teal & Orange', chip: 'linear-gradient(135deg,#0d9488,#f97316)' },
              { id: 'golden-hour',  label: 'Golden Hour',   chip: 'linear-gradient(135deg,#f59e0b,#b45309)' },
              { id: 'arctic',       label: 'Arctic',        chip: 'linear-gradient(135deg,#bae6fd,#1e40af)' },
              { id: 'noir',         label: 'Noir',          chip: 'linear-gradient(135deg,#111,#555)' },
              { id: 'moody',        label: 'Moody',         chip: 'linear-gradient(135deg,#1e1b4b,#4c1d95)' },
              { id: 'vellichor',    label: 'Vellichor',     chip: 'linear-gradient(135deg,#92400e,#d97706)' },
              { id: 'polaroid',     label: 'Polaroid',      chip: 'linear-gradient(135deg,#fde68a,#fbbf24)' },
              { id: 'kodachrome',   label: 'Kodachrome',    chip: 'linear-gradient(135deg,#dc2626,#f97316)' },
              { id: 'cross-process',label: 'X-Process',     chip: 'linear-gradient(135deg,#16a34a,#ca8a04)' },
              { id: 'lomo',         label: 'Lomography',    chip: 'linear-gradient(135deg,#7c3aed,#db2777)' },
              { id: 'faded',        label: 'Faded',         chip: 'linear-gradient(135deg,#94a3b8,#cbd5e1)' },
              { id: 'vhs',          label: 'VHS',           chip: 'linear-gradient(135deg,#166534,#15803d)' },
            ] as const).map(p => (
              <button
                key={p.id}
                onClick={() => set({ colorGradePreset: p.id })}
                className={`relative rounded-lg overflow-hidden border transition-all group ${state.colorGradePreset === p.id ? 'border-white' : 'border-[#2a2a2a] hover:border-[#555]'}`}
                style={{ height: 52 }}
              >
                <div className="absolute inset-0" style={{ background: p.chip }} />
                <div className={`absolute inset-0 transition-all ${state.colorGradePreset === p.id ? 'bg-black/10' : 'bg-black/40 group-hover:bg-black/20'}`} />
                <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-semibold text-white drop-shadow leading-tight px-1">{p.label}</span>
              </button>
            ))}
          </div>
        </Block>
        <Row label="Strength">
          <Slider value={Math.round((state.colorGradeStrength ?? 1) * 100)} min={0} max={100}
            onChange={v => set({ colorGradeStrength: v / 100 })} />
        </Row>
      </>)}

      <Divider />

      {/* ── DISPERSION ──────────────────────────────────────────────────── */}
      <SectionLabel>Dispersion</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ dispersionEnabled: !state.dispersionEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.dispersionEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.dispersionEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.dispersionEnabled && (<>
        <Row label="Threshold">
          <Slider value={state.dispersionThreshold ?? 80} min={1} max={240}
            onChange={v => set({ dispersionThreshold: v })} />
        </Row>
        <Row label="Strength">
          <Slider value={state.dispersionStrength ?? 60} min={5} max={180}
            onChange={v => set({ dispersionStrength: v })} />
        </Row>
        <Row label="Spread">
          <Slider value={Math.round((state.dispersionSpread ?? 0.6) * 100)} min={0} max={100}
            onChange={v => set({ dispersionSpread: v / 100 })} />
        </Row>
        <Block label="Direction">
          <div className="grid grid-cols-5 gap-1.5">
            {([
              { id: 'up',     icon: 'ph-arrow-up',          label: 'Up'     },
              { id: 'right',  icon: 'ph-arrow-right',        label: 'Right'  },
              { id: 'down',   icon: 'ph-arrow-down',         label: 'Down'   },
              { id: 'radial', icon: 'ph-arrows-out-simple',  label: 'Out'    },
              { id: 'chaos',  icon: 'ph-shuffle',            label: 'Chaos'  },
            ] as const).map(d => (
              <button
                key={d.id}
                onClick={() => set({ dispersionDirection: d.id })}
                title={d.label}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border transition-all ${
                  (state.dispersionDirection ?? 'up') === d.id
                    ? 'bg-white/10 border-white/35 text-white'
                    : 'border-[#252525] text-[#444] hover:border-[#3a3a3a] hover:text-[#888]'
                }`}
              >
                <i className={`ph ${d.icon} text-base`} />
                <span className="text-[9px]">{d.label}</span>
              </button>
            ))}
          </div>
        </Block>
        <p className="text-[10px] text-[#444] px-5 pb-2 italic">
          High threshold (~140) = silhouette only. Low threshold = full texture scatter.
        </p>
      </>)}

      <Divider />

      {/* ── RGB CHANNEL SMEAR ───────────────────────────────────────────── */}
      <SectionLabel>RGB Channel Smear</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ channelSmearEnabled: !state.channelSmearEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.channelSmearEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.channelSmearEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.channelSmearEnabled && (<>
        <Row label="Threshold">
          <Slider value={state.channelSmearThreshold ?? 80} min={0} max={240}
            onChange={v => set({ channelSmearThreshold: v })} />
        </Row>

        {/* Per-channel direction pickers */}
        {([
          { key: 'channelSmearRDir' as const, label: 'R', color: '#f87171' },
          { key: 'channelSmearGDir' as const, label: 'G', color: '#4ade80' },
          { key: 'channelSmearBDir' as const, label: 'B', color: '#60a5fa' },
        ]).map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-3 px-5 py-[7px]">
            <span className="text-[12px] font-bold w-4 shrink-0 tabular-nums" style={{ color }}>{label}</span>
            <div className="flex gap-1 flex-1">
              {([
                { id: 'up',    icon: 'ph-arrow-up'    },
                { id: 'down',  icon: 'ph-arrow-down'  },
                { id: 'left',  icon: 'ph-arrow-left'  },
                { id: 'right', icon: 'ph-arrow-right' },
              ] as const).map(d => (
                <button
                  key={d.id}
                  onClick={() => set({ [key]: d.id } as any)}
                  className={`flex-1 py-2 flex items-center justify-center rounded-md border transition-all
                    ${(state[key] ?? (label === 'R' ? 'up' : label === 'G' ? 'left' : 'right')) === d.id
                      ? 'border-white/40 bg-white/10 text-white'
                      : 'border-[#252525] text-[#444] hover:border-[#3a3a3a] hover:text-[#888]'
                    }`}
                >
                  <i className={`ph ${d.icon} text-sm`} />
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="text-[10px] text-[#444] px-5 pb-2 italic">
          Lower threshold = more pixels smear. Try with Warp for prismatic oil-paint results.
        </p>
      </>)}

      <Divider />

      {/* ── DISPLACEMENT WARP ───────────────────────────────────────────── */}
      <SectionLabel>Displacement Warp</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ warpEnabled: !state.warpEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.warpEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.warpEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.warpEnabled && (<>
        <Row label="Style">
          <div className="flex-1">
            <Segment
              options={[{ id: 'warp', label: 'Warp' }, { id: 'swirl', label: 'Swirl' }, { id: 'flow', label: 'Flow' }]}
              value={state.warpStyle ?? 'warp'}
              onChange={v => set({ warpStyle: v as 'warp' | 'swirl' | 'flow' })}
            />
          </div>
        </Row>
        <Row label="Strength">
          <Slider value={state.warpStrength ?? 30} min={2} max={120} step={1}
            onChange={v => set({ warpStrength: v })} />
        </Row>
        <Row label="Scale">
          <Slider value={state.warpScale ?? 3} min={0.5} max={12} step={0.5} decimals={1}
            onChange={v => set({ warpScale: v })} />
        </Row>
        <Row label="Detail">
          <Slider value={state.warpOctaves ?? 3} min={1} max={5} step={1}
            onChange={v => set({ warpOctaves: v })} />
        </Row>
        <p className="text-[10px] text-[#444] px-5 pb-2 italic">
          Combine with Pixel Sort for painterly results.
        </p>
      </>)}

      <Divider />

      {/* ── PIXEL SORT ──────────────────────────────────────────────────── */}
      <SectionLabel>Pixel Sort</SectionLabel>

      <Row label="Enable">
        <button
          onClick={() => set({ pixelSortEnabled: !state.pixelSortEnabled })}
          className={`relative w-10 h-5 rounded-full border transition-all ${state.pixelSortEnabled ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#3a3a3a]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${state.pixelSortEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[#666]'}`} />
        </button>
      </Row>

      {state.pixelSortEnabled && (<>
        <Row label="Threshold">
          <Slider value={state.pixelSortThreshold ?? 128} min={0} max={255}
            onChange={v => set({ pixelSortThreshold: v })} />
        </Row>
        <Row label="Direction">
          <div className="flex-1">
            <Segment
              options={[{ id:'up', label:'Up' }, { id:'down', label:'Down' }, { id:'left', label:'Left' }, { id:'right', label:'Right' }]}
              value={state.pixelSortDirection ?? 'up'}
              onChange={v => set({ pixelSortDirection: v as 'up'|'down'|'left'|'right' })}
            />
          </div>
        </Row>
        <Row label="Sort by">
          <div className="flex-1">
            <Segment
              options={[{ id:'brightness', label:'Luma' }, { id:'hue', label:'Hue' }, { id:'saturation', label:'Sat' }]}
              value={state.pixelSortMode ?? 'brightness'}
              onChange={v => set({ pixelSortMode: v as 'brightness'|'hue'|'saturation' })}
            />
          </div>
        </Row>
        <p className="text-[10px] text-[#444] px-5 pb-2 italic">
          Processing may take a moment on large images.
        </p>
      </>)}

      <Divider />

      {/* ── LIGHT & FX ──────────────────────────────────────────────────── */}
      <SectionLabel>Light & FX</SectionLabel>

      <Row label="Dark overlay">
        <Slider value={Math.round(state.overlayOpacity * 100)} min={0} max={90}
          onChange={v => set({ overlayOpacity: v / 100 })} />
      </Row>
      <Row label="Vignette">
        <Slider value={Math.round((state.vignetteStrength ?? 0) * 100)} min={0} max={100}
          onChange={v => set({ vignetteStrength: v / 100 })} />
      </Row>
      <Row label="Ambient" tall>
        <div className="flex items-center gap-2.5 flex-1">
          <Slider value={Math.round(state.ambientLightIntensity * 100)} min={0} max={100}
            onChange={v => set({ ambientLightIntensity: v / 100 })} />
          <ColorDot value={state.ambientLightColor} onChange={v => set({ ambientLightColor: v })} size={24} />
        </div>
      </Row>

      {state.ambientLightIntensity > 0 && (
        <Block label="Ambient position">
          <div className="grid grid-cols-3 gap-1 w-[78px]">
            {(['tl','tc','tr','ml','mc','mr','bl','bc','br'] as AmbientPosition[]).map(pos => (
              <button key={pos} onClick={() => set({ ambientLightPosition: pos })}
                className={`aspect-square rounded-sm transition-all
                  ${state.ambientLightPosition === pos ? 'bg-white' : 'bg-[#2a2a2a] hover:bg-[#3c3c3c]'}`}
              />
            ))}
          </div>
        </Block>
      )}

      <Row label="RGB Shift">
        <Slider value={state.chromaticAberration} min={0} max={50} step={1} decimals={0}
          onChange={v => set({ chromaticAberration: v })} />
      </Row>

      <Block label="Dither">
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { id: 'none',            label: 'Off'      },
            { id: 'bayer',           label: 'Bayer'    },
            { id: 'floyd-steinberg', label: 'F-S'      },
            { id: 'atkinson',        label: 'Atkinson' },
          ] as const).map(d => (
            <Chip key={d.id} label={d.label}
              active={state.ditherStyle === d.id}
              onClick={() => set({ ditherStyle: d.id })} />
          ))}
        </div>
      </Block>
      {state.ditherStyle !== 'none' && (
        <Row label="Scale">
          <Slider value={state.ditherScale} min={1} max={8} onChange={v => set({ ditherScale: v })} />
        </Row>
      )}

      <div className="h-10 shrink-0" />
    </div>
  );
};

export default RightPanel;
