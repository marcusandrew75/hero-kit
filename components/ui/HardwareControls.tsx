/**
 * HardwareControls.tsx — v3
 *
 * Dieter Rams / Braun + Teenage Engineering premium control system.
 * CSS classes (.knob, .toggle, .lever, .pattern-btn, .control-panel) live in
 * index.html <style> and handle all depth/shadow/gradient effects.
 * This file wires up the React behaviour and SVG arc tracks.
 *
 * Geometry note (KnobSlider):
 *   Arc runs from SVG 135° (7 o'clock) CW 270° to SVG 45° (5 o'clock).
 *   CSS --rotation = norm * 270 - 135 degrees (matches the arc endpoints exactly).
 */

import React, { useRef, useCallback, useId, useState } from 'react';

/* ─── Color tokens (used for inline text colours and SVG strokes only) ──────── */
export const T = {
  bg:       '#f2f0eb', // warm page background
  surface:  '#ffffff', // card face
  panel:    '#eae7e1', // button / inset background
  text:     '#1a1917', // primary text + dark header band
  muted:    '#6b6860', // secondary labels
  dim:      '#9a9690', // faint hints / attribution text
  border:   '#cdc9bf', // hairline border
  borderDk: '#b8b4aa', // stronger border / button bottom-edge shadow
  accent:   '#e84320', // TE orange-red
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
   SCREW HEAD — decorative Phillips fastener for panel corners.
   Every Braun and TE device has visible screws. At 9×9px they're imperceptible
   at a glance but unmistakable when you look — exactly the kind of craft detail
   that separates hardware from software.                                        */

const ScrewHead: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg
    width={9} height={9}
    viewBox="0 0 9 9"
    style={{ display: 'block', pointerEvents: 'none', ...style }}
    aria-hidden
  >
    {/* Outer screw-head circle */}
    <circle cx="4.5" cy="4.5" r="4" fill="none" stroke="rgba(26,25,23,0.18)" strokeWidth="0.75" />
    {/* Inner shadow ring — gives the head a slight domed look */}
    <circle cx="4.5" cy="4.5" r="2.8" fill="none" stroke="rgba(26,25,23,0.08)" strokeWidth="0.5" />
    {/* Phillips crosshair slots */}
    <line x1="4.5" y1="2"   x2="4.5" y2="7"   stroke="rgba(26,25,23,0.20)" strokeWidth="0.75" strokeLinecap="round" />
    <line x1="2"   y1="4.5" x2="7"   y2="4.5" stroke="rgba(26,25,23,0.20)" strokeWidth="0.75" strokeLinecap="round" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────────
   HARDWARE PANEL
   .control-panel (CSS) handles the card shadow, border, and grain texture.     */

export const HardwarePanel: React.FC<{
  label: string;
  children: React.ReactNode;
  active?: boolean; // shows orange LED dot when section is enabled
  number?: number;  // sequential panel index — renders as "01", "02"… like TE devices
  className?: string;
}> = ({ label, children, active = false, number, className = '' }) => (
  <div className={className}>
    {/* Section header — hatch mark + optional panel number + label */}
    <div className="flex items-center gap-2.5 mb-2 select-none">
      {/* Diagonal hatch block */}
      <div
        className="shrink-0 rounded-sm"
        style={{
          width: 22, height: 13,
          background: 'repeating-linear-gradient(-45deg, rgba(26,25,23,0.28) 0, rgba(26,25,23,0.28) 1.5px, transparent 1.5px, transparent 5.5px)',
        }}
      />
      {/* Sequential number — zero-padded, Share Tech Mono, like "07" on the TE K.O. II */}
      {number !== undefined && (
        <span
          className="leading-none shrink-0"
          style={{
            fontFamily: '"Share Tech Mono", ui-monospace, monospace',
            fontSize: 11,
            color: T.dim,
            letterSpacing: '0.04em',
          }}
        >
          {String(number).padStart(2, '0')}
        </span>
      )}
      {active && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: T.accent, boxShadow: `0 0 4px rgba(232,67,32,0.55)` }}
        />
      )}
      <span
        className="text-[10px] font-bold tracking-[0.2em] uppercase leading-none"
        style={{ color: T.text }}
      >
        {label}
      </span>
    </div>
    {/* Card body — screws positioned in each corner like real hardware fasteners */}
    <div className="control-panel rounded-xl p-5 space-y-4" style={{ position: 'relative' }}>
      <ScrewHead style={{ position: 'absolute', top: 7,    left: 7,  marginTop: 0 }} />
      <ScrewHead style={{ position: 'absolute', top: 7,    right: 7, marginTop: 0 }} />
      <ScrewHead style={{ position: 'absolute', bottom: 7, left: 7,  marginTop: 0 }} />
      <ScrewHead style={{ position: 'absolute', bottom: 7, right: 7, marginTop: 0 }} />
      {children}
    </div>
  </div>
);

/* Label + control on one row */
export const HardwareRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-3">
    <span className="text-[11px] font-medium shrink-0 w-[72px] select-none" style={{ color: T.muted }}>
      {label}
    </span>
    <div className="flex-1 flex items-center justify-end gap-2">{children}</div>
  </div>
);

/* Generic sliding-pill tab bar — shared by DocsPanel, LooksPanel, and the
   Source/Layer gallery pickers, which each used to hand-roll their own copy
   (some hardcoded for exactly 2 tabs, which breaks outright with a 3rd).
   `size` matches each panel's original look: 'md' (11px/7px padding) for
   DocsPanel/LooksPanel, 'sm' (10px/5px padding) for the gallery pickers.
   Tabs are always equal-width (flex:1) — the sliding indicator's position/
   width is computed as an equal fraction of the total bar, so content-width
   tabs of different label lengths (e.g. "Pexels" vs "Unsplash") would leave
   the indicator visibly misaligned with the actual button it's meant to
   highlight. Equal width is what keeps the two in sync at any tab count. */
export const TabBar: React.FC<{
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
}> = ({ options, value, onChange, size = 'md' }) => {
  const count = options.length;
  const idx   = Math.max(0, options.findIndex(o => o.id === value));
  const fontSize = size === 'sm' ? 10 : 11;
  const padding  = `${size === 'sm' ? 5 : 7}px 0`;
  return (
    <div className="relative flex rounded-full border" style={{
      background: T.panel, borderColor: T.border,
      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)', padding: 3,
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: 3, bottom: 3,
        left: `calc(3px + ${idx} * ((100% - 6px) / ${count}))`,
        width: `calc((100% - 6px) / ${count})`,
        background: T.surface, borderRadius: 9999,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'none',
      }} />
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} className="leading-none"
          style={{
            position: 'relative', zIndex: 1, flex: 1,
            padding, fontSize, fontWeight: 600, borderRadius: 9999,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: value === o.id ? T.text : T.muted,
            transition: 'color 0.22s ease',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   KNOB SLIDER — SVG arc track + CSS .knob body

   Structure:
     ┌─────────────────── 64×64 container ─────────────────────┐
     │  SVG (full size, position:absolute)                      │
     │    • gray background arc  (full 270° track)              │
     │    • accent fill arc      (0 → current value)            │
     │  .knob div (52×52, centered, position:absolute)          │
     │    • radial-gradient body via CSS class                  │
     │    • ::after notch indicator, rotated by --rotation      │
     └──────────────────────────────────────────────────────────┘

   Arc geometry (standard knob convention):
     START = 135° SVG  →  7 o'clock  (lower-left)
     END   = 45°  SVG  →  5 o'clock  (lower-right)
     SWEEP = 270°  clockwise via 12 o'clock
     GAP   = 90°  at bottom (6 o'clock area)

   CSS --rotation maps:  norm 0 → -135°  (7 o'clock)
                         norm 1 → +135°  (5 o'clock)
   Formula: rotation = norm * 270 - 135                                         */

/* ─────────────────────────────────────────────────────────────────────────────
   LCD DISPLAY — editable numeric readout styled like a hardware segment display.
   Light blue background + Share Tech Mono font references the TX-6 / TE display.
   Click to type a value directly; Enter/blur commits and clamps to min/max.
   Used by both KnobSlider and HwSlider so all numeric readouts share the style.  */

export const LcdDisplay: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit?: string;
  onChange: (v: number) => void;
  small?: boolean;
}> = ({ value, min, max, step, decimals, unit = '', onChange, small = false }) => {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const stepped = parseFloat((Math.round(clamped / step) * step).toFixed(decimals));
      onChange(stepped);
    }
    setEditing(false);
  };

  const sharedStyle: React.CSSProperties = {
    minWidth:   small ? 30 : 40,
    padding:    small ? '2px 4px' : '3px 6px',
    borderRadius: 3,
    // Dark LCD window — black background + light text, like a real segment display
    background: '#1a1917',
    border:     'none',
    boxShadow:  'inset 0 1px 3px rgba(0,0,0,0.35)',
    fontFamily: '"Share Tech Mono", ui-monospace, "Courier New", monospace',
    fontSize:   small ? 9 : 11,
    fontWeight: 700,
    color:      '#f2f0eb',
    letterSpacing: '0.04em',
    textAlign:  'center',
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        style={{ ...sharedStyle, outline: 'none', width: small ? 34 : 44, cursor: 'text', display: 'block' }}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      style={{ ...sharedStyle, cursor: 'text', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { e.stopPropagation(); setDraft(value.toFixed(decimals)); setEditing(true); }}
      title="Click to enter a value"
    >
      {value.toFixed(decimals)}{unit}
    </div>
  );
};

// Polar coords helper — SVG system (Y-down, 0°=right, clockwise positive)
const polar = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos((deg * Math.PI) / 180),
  y: cy + r * Math.sin((deg * Math.PI) / 180),
});

// Clockwise arc path between two angles
const svgArc = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  if (Math.abs(a1 - a0) < 0.5) return '';
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  // Large-arc flag: 1 if sweep > 180°
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
};

export const KnobSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  unit?: string;
  size?: 'md' | 'sm'; // md=52px (default), sm=36px for secondary controls
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, decimals = 0, unit = '', size = 'md', onChange }) => {
  const dragRef = useRef<{ y: number; val: number } | null>(null);
  const norm = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const sm = size === 'sm';

  // Geometry — all values scale with size so the two variants are fully independent
  const BOX      = sm ? 46 : 64;   // outer container px
  const CX       = BOX / 2;        // SVG centre
  const R_TRACK  = sm ? 19 : 29;   // arc track radius
  const R_TICK   = sm ? 22 : 33;   // panel tick mark radius (just outside track)
  const KNOB_PX  = sm ? 36 : 52;   // CSS .knob div size
  const OFFSET   = (BOX - KNOB_PX) / 2; // absolute inset to centre the knob div

  // Drag sensitivity: 120px travel = full range for md, 90px for sm
  const DRAG_PX  = sm ? 90 : 120;

  // Arc: 135° → 405° ≡ 45° (standard 7→5 o'clock sweep, 270°)
  const START = 135, SWEEP = 270;
  const curDeg = START + norm * SWEEP;

  // CSS --rotation: maps SVG angle back to CSS rotate() (0° = up)
  const cssRotation = `${(curDeg - 270).toFixed(1)}deg`;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { y: e.clientY, val: value };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (dragRef.current.y - ev.clientY) / DRAG_PX;
      const raw = dragRef.current.val + delta * (max - min);
      const clamped = Math.min(max, Math.max(min, raw));
      const stepped = Math.round(clamped / step) * step;
      onChange(parseFloat(stepped.toFixed(decimals)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [value, min, max, step, decimals, DRAG_PX, onChange]);

  // Tick stroke widths scale with size
  const tickMidR   = sm ? 0.9 : 1.2;
  const triLen     = sm ? 2.6 : 3.4;  // triangle height (radial)
  const triHalf    = sm ? 1.4 : 1.8;  // half-width of triangle base, in px
  const arcWidth   = sm ? 2.5 : 3.5;
  const shadowW    = sm ? 4   : 5;

  // Builds a small triangle pointing inward (toward knob centre) at the given
  // angle — the range-boundary markers used on Braun T3 / TP1 scale faces.
  // Tip sits closer to centre; base sits further out along the radial line.
  // Base half-angle (radians) ≈ triHalf / baseR — small-angle arc approximation.
  const endTriangle = (angle: number) => {
    const tipR    = R_TICK - triLen * 0.5;
    const baseR   = R_TICK + triLen * 0.5;
    const halfDeg = (triHalf / baseR) * (180 / Math.PI);
    const tip = polar(CX, CX, tipR, angle);
    const b1  = polar(CX, CX, baseR, angle - halfDeg);
    const b2  = polar(CX, CX, baseR, angle + halfDeg);
    return `${tip.x.toFixed(2)},${tip.y.toFixed(2)} ${b1.x.toFixed(2)},${b1.y.toFixed(2)} ${b2.x.toFixed(2)},${b2.y.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col items-center select-none"
      style={{ width: BOX, gap: sm ? 4 : 6 }}>
      {/* Knob + arc track composite */}
      <div
        style={{ position: 'relative', width: BOX, height: BOX }}
        onMouseDown={onMouseDown}
        title={`${label}: ${value.toFixed(decimals)}${unit} — drag up/down`}
      >
        {/* SVG arc track — sits behind the .knob div */}
        <svg
          viewBox={`0 0 ${BOX} ${BOX}`}
          width={BOX} height={BOX}
          overflow="visible"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {/* Panel tick marks — 7 mid dots + 2 inward-pointing end triangles
              marking the min/max travel limits, like a Braun scale face. */}
          {Array.from({ length: 9 }, (_, i) => {
            const angle = START + (i / 8) * SWEEP;
            const isEnd = i === 0 || i === 8;
            if (isEnd) {
              return (
                <polygon key={i}
                  points={endTriangle(angle)}
                  fill="rgba(26,25,23,0.38)"
                />
              );
            }
            const pt = polar(CX, CX, R_TICK, angle);
            return (
              <circle key={i}
                cx={pt.x.toFixed(2)} cy={pt.y.toFixed(2)}
                r={tickMidR}
                fill="rgba(26,25,23,0.16)"
              />
            );
          })}

          {/* Groove depth shadow */}
          <path d={svgArc(CX, CX, R_TRACK, START, START + SWEEP)}
            fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth={shadowW} strokeLinecap="round"
            style={{ filter: 'blur(0.5px)' }}
          />
          {/* Gray background arc */}
          <path d={svgArc(CX, CX, R_TRACK, START, START + SWEEP)}
            fill="none" stroke={T.borderDk} strokeWidth={arcWidth} strokeLinecap="round"
          />
          {/* Accent fill arc */}
          {norm > 0.005 && (
            <path d={svgArc(CX, CX, R_TRACK, START, curDeg)}
              fill="none" stroke={T.accent} strokeWidth={arcWidth} strokeLinecap="round"
            />
          )}
        </svg>

        {/* CSS knob body — centred in the container */}
        <div
          className={`knob${sm ? ' sm' : ''}`}
          style={{
            position: 'absolute',
            top: OFFSET, left: OFFSET,
            ['--rotation' as string]: cssRotation,
          }}
        />
      </div>

      {/* LCD display — shared component, editable on click */}
      <LcdDisplay
        value={value} min={min} max={max}
        step={step} decimals={decimals} unit={unit}
        onChange={onChange} small={sm}
      />
      {/* Label */}
      <span
        className="tracking-widest uppercase leading-none text-center"
        style={{ fontSize: sm ? 8 : 9, color: T.muted }}
      >
        {label}
      </span>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   PATTERN GRID — .pattern-btn handles all depth, hover and active shadows.
   Buttons are fully controlled by the CSS class.                               */

export const PatternGrid: React.FC<{
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  columns?: number;
  compact?: boolean; // tighter padding + smaller text for dense 5-column grids
}> = ({ options, value, onChange, columns = 4, compact = false }) => (
  <div
    className="grid gap-1.5"
    style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
  >
    {options.map(opt => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        className={`pattern-btn${opt.id === value ? ' active' : ''}${compact ? ' compact' : ''}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   TACTILE TOGGLE — fully-rounded pill switch.
   .toggle / .toggle.on / .toggle .lever — all styling is in CSS.
   React only manages the `on` class and `aria-checked`.                        */

export const TactileToggle: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string; // kept for API compat but IEC notation is always shown
}> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2">
    {/* IEC 60417 notation — "I" = on, "O" = off, printed either side of the switch
        like the panel markings on every Braun and Teenage Engineering device.
        Active symbol is dark, inactive fades to dim so the state is unambiguous. */}
    <span
      className="select-none leading-none transition-colors"
      style={{
        fontFamily: '"Share Tech Mono", ui-monospace, monospace',
        fontSize: 10, fontWeight: 700,
        color: value ? T.text : T.dim,
      }}
    >I</span>
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`toggle${value ? ' on' : ''}`}
    >
      <div className="lever" />
    </button>
    <span
      className="select-none leading-none transition-colors"
      style={{
        fontFamily: '"Share Tech Mono", ui-monospace, monospace',
        fontSize: 10, fontWeight: 700,
        color: !value ? T.text : T.dim,
      }}
    >O</span>
    {label && (
      <span
        className="text-[11px] font-medium transition-colors select-none ml-1"
        style={{ color: value ? T.text : T.muted }}
      >
        {label}
      </span>
    )}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   COLOR SWATCH — round jewel-in-bezel color picker.
   The double-ring shadow gives a sense of physical inset.                      */

export const ColorSwatch: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label?: string;
  size?: number;
  hideHex?: boolean; // drop the hex text — for tight rows like Ambient (slider + swatch share the row)
}> = ({ value, onChange, label, size = 28, hideHex = false }) => (
  <div className="flex items-center gap-2.5">
    <label className="relative cursor-pointer shrink-0 group" style={{ width: size, height: size }}>
      <span
        className="block w-full h-full rounded-full transition-transform duration-100 group-hover:scale-110"
        style={{
          backgroundColor: value,
          // White inner ring → border ring → drop shadow = jewel-in-bezel
          boxShadow: `
            0 0 0 2px  rgba(255,255,255,0.85),
            0 0 0 4px  ${T.border},
            0 3px 8px  rgba(0,0,0,0.18),
            0 1px 2px  rgba(0,0,0,0.12)
          `,
        }}
      />
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </label>
    {!hideHex && (
    <div className="flex flex-col leading-none gap-[3px]">
      <span
        className="text-[11px] font-mono font-semibold uppercase tracking-wider"
        style={{ color: T.text }}
      >
        {value.toUpperCase()}
      </span>
      {label && <span className="text-[9px]" style={{ color: T.muted }}>{label}</span>}
    </div>
    )}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   EXAMPLE PANEL — all four controls together.
   Import and drop anywhere to preview the design system.                       */

export const ExamplePanel: React.FC = () => {
  const [grain,    setGrain]    = React.useState(22);
  const [opacity,  setOpacity]  = React.useState(80);
  const [blur,     setBlur]     = React.useState(4);
  const [color,    setColor]    = React.useState('#c8c0b8');
  const [pattern,  setPattern]  = React.useState('dot');
  const [enabled,  setEnabled]  = React.useState(true);
  const [halftone, setHalftone] = React.useState(false);

  const PATTERNS = [
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
    <div className="p-5 space-y-4 w-[292px] rounded-2xl" style={{ background: T.bg }}>

      <HardwarePanel label="Grain & Texture" active={enabled}>
        <HardwareRow label="Enable">
          <TactileToggle value={enabled} onChange={setEnabled} label={enabled ? 'On' : 'Off'} />
        </HardwareRow>
        {enabled && (
          <>
            <div className="flex justify-around pt-1">
              <KnobSlider label="Grain"   value={grain}   min={0} max={50}  onChange={setGrain}   />
              <KnobSlider label="Opacity" value={opacity} min={0} max={100} onChange={setOpacity} unit="%" />
              <KnobSlider label="Blur"    value={blur}    min={0} max={20}  onChange={setBlur}    step={0.5} decimals={1} />
            </div>
            <HardwareRow label="Tint">
              <ColorSwatch value={color} onChange={setColor} label="grain color" />
            </HardwareRow>
          </>
        )}
      </HardwarePanel>

      <HardwarePanel label="Pattern">
        <PatternGrid options={PATTERNS} value={pattern} onChange={setPattern} columns={4} />
      </HardwarePanel>

      <HardwarePanel label="FX">
        <HardwareRow label="Halftone">
          <TactileToggle value={halftone} onChange={setHalftone} label={halftone ? 'On' : 'Off'} />
        </HardwareRow>
        <HardwareRow label="Film grain">
          <TactileToggle value={enabled} onChange={setEnabled} label={enabled ? 'On' : 'Off'} />
        </HardwareRow>
      </HardwarePanel>

    </div>
  );
};
