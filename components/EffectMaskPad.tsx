
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MaskStroke } from '../types';
import { TactileToggle, LcdDisplay, T } from './ui/HardwareControls';

interface Props {
  imageUrl?: string;
  strokes: MaskStroke[];
  onChange: (strokes: MaskStroke[]) => void;
  brushSize: number;
  onBrushSizeChange: (v: number) => void;
  feather: number;
  onFeatherChange: (v: number) => void;
  invert: boolean;
  onInvertChange: (v: boolean) => void;
  showOverlay: boolean;
  onShowOverlayChange: (v: boolean) => void;
  accentColor: string;
  hint?: React.ReactNode; // overridable empty-state instruction
}

// ─── Drawing surface — shared between the compact pad and the expanded modal ──

const PadSurface: React.FC<{
  imageUrl?: string;
  strokes: MaskStroke[];
  onChange: (strokes: MaskStroke[]) => void;
  brushSize: number;
  feather: number;
  invert: boolean;
  showOverlay: boolean;
  accentColor: string;
  hint?: React.ReactNode;
  hideHint?: boolean; // compact pad — the expand button + description below already cover this
  tall?: boolean; // taller aspect for the expanded modal — more room to work
}> = ({ imageUrl, strokes, onChange, brushSize, feather, invert, showOverlay, accentColor, hint, hideHint, tall }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [hovering, setHovering] = useState(false);
  // Live brush-size cursor — position + diameter (px), tracked separately from
  // the stroke overlay canvas so it updates on every pointer move, not just
  // while actively painting.
  const [cursorPx, setCursorPx] = useState<{ x: number; y: number; size: number } | null>(null);
  // Magnifier (modal only) — shows a zoomed loupe of the image while actively
  // painting, so fine subject edges are easy to trace precisely. Needs the
  // image's natural pixel size to replicate its object-cover crop math.
  const [isPainting, setIsPainting] = useState(false);
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);

  // Strokes drawn locally but not yet pushed to the parent. The paint preview
  // redraws from these directly (imperative, cheap) on every pointermove.
  // `onChange` — which propagates up through RightPanel → Canvas.tsx and
  // re-runs the ENTIRE effects pipeline — only fires once the user stops
  // painting for COMMIT_DELAY_MS. An 80ms throttle during active dragging
  // still fired far more often than a full pixel pipeline can keep up with;
  // committing on settle instead means zero pipeline work while dragging.
  const localStrokesRef = useRef<MaskStroke[]>([]);
  const inProgressRef   = useRef<MaskStroke | null>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [processing, setProcessing] = useState(false);
  const COMMIT_DELAY_MS = 700;

  const drawFrame = useCallback((extra: MaskStroke[]) => {
    const canvas = canvasRef.current;
    const wrap   = containerRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!showOverlay) return;

    // Feather previewed here too (scaled to the pad's own size vs render size)
    // so what you paint matches the soft edge you'll actually get on export.
    if (feather > 0) ctx.filter = `blur(${feather * (w / 800)}px)`;

    const allStrokes = [...strokes, ...extra];

    const paintStrokes = () => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const scale = Math.min(w, h);
      allStrokes.forEach(stroke => {
        const r = stroke.size * scale;
        if (stroke.points.length === 1) {
          const p = stroke.points[0];
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (stroke.points.length > 1) {
          ctx.lineWidth = r * 2;
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
          }
          ctx.stroke();
        }
      });
    };

    ctx.fillStyle = accentColor;
    ctx.strokeStyle = accentColor;
    // Bumped from 0.35 — was reading as too faint, especially in the larger
    // expanded view where the same opacity covers proportionally more area.
    ctx.globalAlpha = 0.55;

    if (!invert) {
      paintStrokes();
    } else {
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      paintStrokes();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
  }, [strokes, showOverlay, invert, accentColor, feather]);

  // Live preview = committed strokes (prop) + settled-but-uncommitted local
  // strokes + whatever's currently being dragged. All purely local/cheap.
  const redraw = useCallback(() => {
    const extra = inProgressRef.current
      ? [...localStrokesRef.current, inProgressRef.current]
      : localStrokesRef.current;
    drawFrame(extra);
  }, [drawFrame]);

  useEffect(() => {
    redraw();
    const wrap = containerRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  // Cancel any pending debounce on unmount so it can't fire after the pad's gone
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const toRel = (e: React.PointerEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  // Fires once painting has settled — commits every locally-drawn stroke in
  // one batch (so several quick strokes in a row still only trigger one
  // pipeline re-run), then clears the local buffer.
  const scheduleCommit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (localStrokesRef.current.length === 0) return;
      setProcessing(true);
      onChange([...strokes, ...localStrokesRef.current]);
      localStrokesRef.current = [];
      // The pipeline runs synchronously inside Canvas.tsx's effect, triggered
      // by the state update above — double rAF lands just after that paint,
      // giving a reasonably accurate "done" signal without cross-component wiring.
      requestAnimationFrame(() => requestAnimationFrame(() => setProcessing(false)));
    }, COMMIT_DELAY_MS);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    const p = toRel(e);
    inProgressRef.current = { points: [p], size: brushSize };
    setIsPainting(true);
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    const p = toRel(e);
    // Diameter in px, computed against the pad's own current size — matches
    // the same `min(w,h)` convention used everywhere else brushSize is applied.
    setCursorPx({ x: p.x, y: p.y, size: brushSize * Math.min(r.width, r.height) * 2 });
    if (!inProgressRef.current) return;
    inProgressRef.current.points.push(p);
    redraw(); // instant local feedback only — no onChange, no pipeline work at all
  };

  const handlePointerUp = () => {
    setIsPainting(false);
    if (inProgressRef.current) {
      localStrokesRef.current = [...localStrokesRef.current, inProgressRef.current];
      inProgressRef.current = null;
      redraw();
      scheduleCommit();
    }
  };
  const handlePointerLeave = () => { handlePointerUp(); setCursorPx(null); };

  // Hint only shows before the user has painted anything, and fades out on
  // hover so it never obstructs the view once they're actually working —
  // it reappears if they mouse away without painting, as a standing reminder.
  const showHint = !hideHint && strokes.length === 0 && !hovering;

  // Magnifier — replicates the <img>'s object-cover crop math so the zoomed
  // loupe centers on exactly the point under the cursor, letting fine subject
  // edges be traced precisely. Only active in the expanded modal (tall) while
  // a stroke is actively being painted. Offset up-and-right of the actual
  // cursor (clamped to the pad's own bounds) so the lens never covers the
  // exact point being painted.
  const MAG_SIZE = 150, MAG_ZOOM = 3, MAG_OFFSET = 24;
  let magnifier: { style: React.CSSProperties; left: number; top: number } | null = null;
  if (tall && isPainting && cursorPx && natSize && containerRef.current) {
    const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight;
    const coverScale = Math.max(cw / natSize.w, ch / natSize.h);
    const offX = (cw - natSize.w * coverScale) / 2;
    const offY = (ch - natSize.h * coverScale) / 2;
    // Point under the cursor, in the image's own natural pixel space
    const imgX = (cursorPx.x * cw - offX) / coverScale;
    const imgY = (cursorPx.y * ch - offY) / coverScale;
    const bgScale = coverScale * MAG_ZOOM;

    const cursorLeftPx = cursorPx.x * cw, cursorTopPx = cursorPx.y * ch;
    const half = cursorPx.size / 2 + MAG_OFFSET;
    let left = cursorLeftPx + half, top = cursorTopPx - half - MAG_SIZE;
    if (left + MAG_SIZE > cw) left = cursorLeftPx - half - MAG_SIZE; // flip to the left if it'd overflow
    if (top < 0) top = cursorTopPx + half;                            // flip below if it'd overflow above
    left = Math.max(0, Math.min(cw - MAG_SIZE, left));
    top  = Math.max(0, Math.min(ch - MAG_SIZE, top));

    magnifier = {
      left, top,
      style: {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: `${natSize.w * bgScale}px ${natSize.h * bgScale}px`,
        backgroundPosition: `${MAG_SIZE / 2 - imgX * bgScale}px ${MAG_SIZE / 2 - imgY * bgScale}px`,
        backgroundRepeat: 'no-repeat',
      },
    };
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden cursor-none select-none"
      style={{ aspectRatio: tall ? '16 / 11' : '16 / 9', background: '#1a1917' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
          onLoad={e => setNatSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      {/* Fires once painting settles (see scheduleCommit) — tells the user why
          the actual image hasn't updated yet while they were dragging. */}
      {processing && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <i className="ph ph-spinner animate-spin text-[11px]" style={{ color: 'rgba(255,255,255,0.9)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>Processing…</span>
        </div>
      )}
      {/* Brush-size cursor — white ring + dark outer ring stays visible against
          both light and dark parts of the image, same double-ring technique
          used by the ColorSwatch elsewhere in the app. */}
      {cursorPx && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: cursorPx.x * 100 + '%',
            top: cursorPx.y * 100 + '%',
            width: cursorPx.size,
            height: cursorPx.size,
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.12)',
            boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9), 0 0 0 2.5px rgba(0,0,0,0.5)',
          }}
        />
      )}
      {/* Magnifier loupe — zoomed view of the image around the cursor while
          actively painting, for precise edge tracing (expanded modal only). */}
      {magnifier && (
        <div
          className="absolute rounded-full pointer-events-none overflow-hidden"
          style={{
            left: magnifier.left, top: magnifier.top,
            width: MAG_SIZE, height: MAG_SIZE,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4)',
            ...magnifier.style,
          }}
        >
          {/* Crosshair marking the exact point under the cursor */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 2px rgba(0,0,0,0.6)' }} />
            <div style={{ position: 'absolute', width: 14, height: 1, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 2px rgba(0,0,0,0.6)' }} />
          </div>
        </div>
      )}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200"
        style={{ opacity: showHint ? 1 : 0 }}
      >
        <p className="text-[11px] text-white/50 text-center leading-relaxed px-6">
          {hint ?? <>Paint where effects apply.<br />Everything else stays original.</>}
        </p>
      </div>
    </div>
  );
};

// ─── Public component — compact pad + expand-to-modal for precision work ────

const EffectMaskPad: React.FC<Props> = ({
  imageUrl, strokes, onChange, brushSize, onBrushSizeChange,
  feather, onFeatherChange, invert, onInvertChange,
  showOverlay, onShowOverlayChange, accentColor, hint,
}) => {
  const [expanded, setExpanded] = useState(false);

  const sharedSurfaceProps = { imageUrl, strokes, onChange, brushSize, feather, invert, showOverlay, accentColor, hint };

  return (
    <>
      <div className="relative">
        <PadSurface {...sharedSurfaceProps} hideHint />
        {/* Expand — centered so it reads immediately as "there's more here",
            rather than a small corner affordance easy to miss. The sidebar is
            310px wide, genuinely fiddly for precision painting; this opens
            the same pad much larger with its own controls. */}
        <button
          onClick={() => setExpanded(true)}
          title="Expand for more precise painting"
          className="absolute inset-0 m-auto w-11 h-11 flex items-center justify-center rounded-full transition-all"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.9)' }}
        >
          <i className="ph ph-arrows-out text-lg" />
        </button>
      </div>

      {expanded && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/45 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setExpanded(false); }}
        >
          <div
            className="control-panel rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2.5">
                <div className="shrink-0 rounded-sm" style={{
                  width: 22, height: 13,
                  background: 'repeating-linear-gradient(-45deg, rgba(26,25,23,0.28) 0, rgba(26,25,23,0.28) 1.5px, transparent 1.5px, transparent 5.5px)',
                }} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: T.text }}>Effect Mask</span>
              </div>
              <button onClick={() => setExpanded(false)} style={{ color: T.muted }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                <i className="ph ph-x text-lg" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <PadSurface {...sharedSurfaceProps} tall />

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium" style={{ color: T.muted }}>Brush size</span>
                    <LcdDisplay value={Math.round(brushSize * 100)} min={2} max={40} step={1} decimals={0}
                      onChange={v => onBrushSizeChange(v / 100)} small />
                  </div>
                  <input type="range" min={2} max={40} value={Math.round(brushSize * 100)}
                    onChange={e => onBrushSizeChange(Number(e.target.value) / 100)}
                    className="hw-slider w-full" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium" style={{ color: T.muted }}>Feather</span>
                    <LcdDisplay value={feather} min={0} max={100} step={1} decimals={0}
                      onChange={onFeatherChange} small />
                  </div>
                  <input type="range" min={0} max={100} value={feather}
                    onChange={e => onFeatherChange(Number(e.target.value))}
                    className="hw-slider w-full" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TactileToggle value={invert} onChange={onInvertChange} />
                  <span className="text-[11px] font-medium" style={{ color: T.muted }}>Invert</span>
                </div>
                <div className="flex items-center gap-2">
                  <TactileToggle value={showOverlay} onChange={onShowOverlayChange} />
                  <span className="text-[11px] font-medium" style={{ color: T.muted }}>Show paint</span>
                </div>
                <button onClick={() => onChange([])} disabled={strokes.length === 0}
                  className="text-[11px] font-medium disabled:opacity-40 transition-colors"
                  style={{ color: T.muted }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                  onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                  Clear Mask
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default EffectMaskPad;
