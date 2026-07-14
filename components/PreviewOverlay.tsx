
import React, { useEffect, useRef, useState } from 'react';

export type PreviewLayout = 'left' | 'center' | 'right';
export type PreviewFont = 'sans' | 'serif';
export type PreviewTheme = 'light' | 'dark'; // text color: light = white type (dark images), dark = ink type (light images)

// Custom copy typed straight onto the preview. One shared store across all
// three layouts — set your headline once and it follows you between
// left/center/right — with per-field fallbacks to each layout's sample copy.
// Only overridden fields are stored; empty/unchanged edits fall back.
export type PreviewCopyField = 'brand' | 'navCta' | 'eyebrow' | 'headline' | 'sub' | 'primaryCta' | 'secondaryCta';
export type PreviewCopy = Partial<Record<PreviewCopyField, string>>;

interface Props {
  layout: PreviewLayout;
  font?: PreviewFont;
  theme?: PreviewTheme;
  copy?: PreviewCopy;
  onCopyChange?: (field: PreviewCopyField, value: string | null) => void;
  logo?: string | null;                       // data URL of an uploaded logo
  onLogoChange?: (dataUrl: string | null) => void;
  // Elements removed from the mock entirely (hover ✕, like the logo slot) —
  // flex-column layouts collapse the freed space automatically. Restored via
  // the toolbar reset. Only the headline isn't hideable: no hero without one.
  hidden?: PreviewCopyField[];
  onHide?: (field: PreviewCopyField) => void;
  // In Free ratio the canvas fills the whole area, putting the mock's nav
  // underneath the app's floating ratio selector — this nudges it clear.
  navInset?: boolean;
}

// Applied only to the headline — nav/buttons stay sans, matching how real
// designs pair a serif display headline with sans UI chrome rather than
// switching the whole mock over.
const headlineFont = (font: PreviewFont) =>
  font === 'serif' ? { fontFamily: '"Playfair Display", serif' } : {};

// ── Theme palette ─────────────────────────────────────────────────────────────
// One palette object instead of hardcoded white classes, so the whole mock
// flips for light backgrounds (pale Silkscreen paper, bright Postcard skies…)
// where white-on-light type was previously unreadable.

const palette = (theme: PreviewTheme) => theme === 'light' ? {
  text: '#ffffff',
  strong: 'rgba(255,255,255,0.9)',
  muted: 'rgba(255,255,255,0.65)',
  dim: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.4)',
  borderSoft: 'rgba(255,255,255,0.2)',
  underline: 'rgba(255,255,255,0.3)',
  btnBg: '#ffffff',
  btnText: '#000000',
  headlineShadow: '0 4px 40px rgba(0,0,0,0.5)',
  editOutline: 'rgba(255,255,255,0.35)',
  editOutlineFocus: 'rgba(255,255,255,0.65)',
} : {
  text: '#161512',
  strong: 'rgba(22,21,18,0.9)',
  muted: 'rgba(22,21,18,0.68)',
  dim: 'rgba(22,21,18,0.55)',
  faint: 'rgba(22,21,18,0.42)',
  border: 'rgba(22,21,18,0.4)',
  borderSoft: 'rgba(22,21,18,0.22)',
  underline: 'rgba(22,21,18,0.3)',
  btnBg: '#161512',
  btnText: '#ffffff',
  headlineShadow: 'none',
  editOutline: 'rgba(22,21,18,0.35)',
  editOutlineFocus: 'rgba(22,21,18,0.65)',
};

type Pal = ReturnType<typeof palette>;

// ── Inline editing ────────────────────────────────────────────────────────────
// Every text element in the mock is click-to-edit, directly on the preview:
// contentEditable with Enter committing (blur), Escape reverting, and paste
// forced to plain text. Committing text identical to the fallback (or empty)
// clears the override so the field tracks the sample copy again.

const EditableText: React.FC<{
  field: PreviewCopyField;
  fallback: string;               // may contain \n — rendered via pre-line
  copy: PreviewCopy;
  onCopyChange?: (field: PreviewCopyField, value: string | null) => void;
  className?: string;
}> = ({ field, fallback, copy, onCopyChange, className = '' }) => {
  const original = useRef('');
  const value = copy[field];

  if (!onCopyChange) {
    return <span style={{ whiteSpace: 'pre-line' }}>{value ?? fallback}</span>;
  }

  return (
    <span
      className={`pv-edit pointer-events-auto ${className}`}
      style={{ whiteSpace: 'pre-line' }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={`Edit ${field} text`}
      onFocus={e => { original.current = e.currentTarget.textContent ?? ''; }}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
        if (e.key === 'Escape') {
          e.currentTarget.textContent = original.current;
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onPaste={e => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
      onBlur={e => {
        const text = (e.currentTarget.textContent ?? '').trim();
        onCopyChange(field, text === '' || text === fallback ? null : text);
      }}
    >
      {value ?? fallback}
    </span>
  );
};

/** Hover/focus affordance for editable text + logo slot — themed via CSS vars. */
const EditStyles: React.FC<{ pal: Pal }> = ({ pal }) => (
  <style dangerouslySetInnerHTML={{ __html: `
    .pv-edit { cursor: text; user-select: text; border-radius: 3px; outline: 1.5px dashed transparent; outline-offset: 5px; transition: outline-color .15s ease; }
    .pv-edit:hover { outline-color: ${pal.editOutline}; }
    .pv-edit:focus { outline-color: ${pal.editOutlineFocus}; outline-style: solid; outline-width: 1px; }
    .pv-logo { cursor: pointer; border-radius: 6px; outline: 1.5px dashed transparent; outline-offset: 4px; transition: outline-color .15s ease; position: relative; }
    .pv-logo:hover { outline-color: ${pal.editOutline}; }
    .pv-logo .pv-logo-x { opacity: 0; transition: opacity .15s ease; }
    .pv-logo:hover .pv-logo-x { opacity: 1; }
    .pv-hideable { position: relative; pointer-events: auto; }
    .pv-hide-x { position: absolute; top: -8px; right: -8px; width: 16px; height: 16px; border-radius: 50%;
      font-size: 9px; line-height: 1; display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.3); border: none; cursor: pointer; }
    .pv-hideable:hover .pv-hide-x { opacity: 1; }
    .pv-hide-x-in { top: 50%; right: 10px; transform: translateY(-50%); }
  ` }} />
);

// ── Logo slot ─────────────────────────────────────────────────────────────────
// The nav's placeholder circle doubles as a drop target for a real logo:
// click to pick a PNG/SVG, hover shows a remove chip once one is set.

const LogoSlot: React.FC<{
  pal: Pal;
  logo?: string | null;
  onLogoChange?: (dataUrl: string | null) => void;
}> = ({ pal, logo, onLogoChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!onLogoChange) {
    return logo
      ? <img src={logo} alt="Logo" className="h-6 w-auto max-w-[120px] object-contain" />
      : <div className="w-6 h-6 rounded-full border-[1.5px]" style={{ borderColor: pal.strong }} />;
  }

  return (
    <span className="pv-logo pointer-events-auto inline-flex items-center" role="button" tabIndex={0}
      aria-label={logo ? 'Replace logo' : 'Upload your logo'}
      title={logo ? 'Click to replace your logo' : 'Click to drop in your logo'}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}>
      {logo ? (
        <>
          <img src={logo} alt="Logo" className="h-6 w-auto max-w-[120px] object-contain" />
          <button className="pv-logo-x absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: pal.btnBg, color: pal.btnText, fontSize: 9, lineHeight: 1 }}
            title="Remove logo" aria-label="Remove logo"
            onClick={e => { e.stopPropagation(); onLogoChange(null); }}>
            ✕
          </button>
        </>
      ) : (
        <div className="w-6 h-6 rounded-full border-[1.5px]" style={{ borderColor: pal.strong }} />
      )}
      <input ref={inputRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = ev => onLogoChange(ev.target?.result as string);
          r.readAsDataURL(f);
          e.target.value = '';
        }} />
    </span>
  );
};

/** Hover ✕ chip that removes an optional element from the mock. `inset`
    pins it just inside the right edge (vertically centred) for full-width
    elements like mobile buttons, where the corner position drifts offscreen. */
const HideX: React.FC<{ field: PreviewCopyField; onHide?: (f: PreviewCopyField) => void; pal: Pal; inset?: boolean }> =
  ({ field, onHide, pal, inset }) => onHide ? (
    <button className={`pv-hide-x ${inset ? 'pv-hide-x-in' : ''} pointer-events-auto`}
      title="Remove this element" aria-label={`Remove ${field}`}
      style={{ background: pal.btnBg, color: pal.btnText, border: `1px solid ${pal.btnText}59` }}
      onClick={e => { e.stopPropagation(); onHide(field); }}>
      ✕
    </button>
  ) : null;

type LayoutProps = {
  font: PreviewFont;
  pal: Pal;
  copy: PreviewCopy;
  onCopyChange?: (field: PreviewCopyField, value: string | null) => void;
  logo?: string | null;
  onLogoChange?: (dataUrl: string | null) => void;
  hidden: Set<PreviewCopyField>;
  onHide?: (field: PreviewCopyField) => void;
  navInset?: boolean;
};

const Nav: React.FC<LayoutProps> = ({ pal, copy, onCopyChange, logo, onLogoChange, hidden, onHide, navInset }) => (
  // px-[8%] matches the headline content blocks' inset (see Left/Right layouts
  // below) — keeps logo and CTA aligned with the main title, and pulls them in
  // from the raw edge so they don't collide with the app's fixed corner UI
  // (Eye / Fullscreen icon buttons sit at that same top-right corner).
  <div className="absolute inset-x-0 flex items-center justify-between px-[8%] py-6 z-10"
    style={{ top: navInset ? 44 : 0 }}>
    <div className="flex items-center gap-2.5">
      <LogoSlot pal={pal} logo={logo} onLogoChange={onLogoChange} />
      {!hidden.has('brand') && (
        <span className="pv-hideable text-sm font-semibold tracking-widest uppercase" style={{ color: pal.strong }}>
          <EditableText field="brand" fallback="Brand" copy={copy} onCopyChange={onCopyChange} />
          <HideX field="brand" onHide={onHide} pal={pal} />
        </span>
      )}
    </div>
    <div className="flex items-center gap-8 text-sm font-medium" style={{ color: pal.dim }}>
      {['Features', 'Pricing', 'About'].map(l => (
        <span key={l}>{l}</span>
      ))}
    </div>
    {!hidden.has('navCta') ? (
      <button className="pv-hideable px-5 py-2 rounded-full border text-sm font-semibold tracking-wide"
        style={{ borderColor: pal.border, color: pal.text }}>
        <EditableText field="navCta" fallback="Get Started" copy={copy} onCopyChange={onCopyChange} />
        <HideX field="navCta" onHide={onHide} pal={pal} />
      </button>
    ) : <span />}
  </div>
);

// ── Mobile ────────────────────────────────────────────────────────────────────
// Rendered automatically when the canvas box is narrow (9:16 ratio, tall
// crops…) instead of cramming the desktop nav into a phone-shaped frame —
// the existing ratio selector doubles as the device switcher, no extra UI.

const MobileLayout: React.FC<LayoutProps> = ({ font, pal, copy, onCopyChange, logo, onLogoChange, hidden, onHide, navInset }) => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    {/* Compact nav: logo + hamburger */}
    <div className="absolute inset-x-0 flex items-center justify-between px-6 py-5 z-10"
      style={{ top: navInset ? 44 : 0 }}>
      <div className="flex items-center gap-2">
        <LogoSlot pal={pal} logo={logo} onLogoChange={onLogoChange} />
        {!hidden.has('brand') && (
          <span className="pv-hideable text-[13px] font-semibold tracking-widest uppercase" style={{ color: pal.strong }}>
            <EditableText field="brand" fallback="Brand" copy={copy} onCopyChange={onCopyChange} />
            <HideX field="brand" onHide={onHide} pal={pal} />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-[5px]" aria-hidden>
        <span style={{ width: 20, height: 2, background: pal.strong, borderRadius: 1, display: 'block' }} />
        <span style={{ width: 20, height: 2, background: pal.strong, borderRadius: 1, display: 'block' }} />
      </div>
    </div>

    <div className="flex-1 flex flex-col justify-center px-6 gap-5">
      {!hidden.has('eyebrow') && (
        <p className="pv-hideable self-start text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ color: pal.dim }}>
          ✦ &nbsp;<EditableText field="eyebrow" fallback="New · Product Launch" copy={copy} onCopyChange={onCopyChange} />
          <HideX field="eyebrow" onHide={onHide} pal={pal} />
        </p>
      )}
      <h1 className="text-[clamp(2rem,10.5cqw,3.6rem)] font-semibold leading-[1.08] tracking-tight"
        style={{ color: pal.text, textShadow: pal.headlineShadow, ...headlineFont(font) }}>
        <EditableText field="headline" fallback={'Ideas that move\nthe world forward.'} copy={copy} onCopyChange={onCopyChange} />
      </h1>
      {!hidden.has('sub') && (
        <p className="pv-hideable text-[0.95rem] leading-relaxed" style={{ color: pal.muted }}>
          <EditableText field="sub" fallback="Build, ship, and scale without limits. The platform built for ambitious creators." copy={copy} onCopyChange={onCopyChange} />
          <HideX field="sub" onHide={onHide} pal={pal} inset />
        </p>
      )}
      <div className="flex flex-col gap-3 mt-1">
        {!hidden.has('primaryCta') && (
          <button className="pv-hideable px-6 py-3.5 rounded-xl font-semibold text-sm shadow-lg text-center"
            style={{ background: pal.btnBg, color: pal.btnText }}>
            <EditableText field="primaryCta" fallback="Start for free" copy={copy} onCopyChange={onCopyChange} />
            <HideX field="primaryCta" onHide={onHide} pal={pal} inset />
          </button>
        )}
        {!hidden.has('secondaryCta') && (
          <button className="pv-hideable px-6 py-3.5 rounded-xl border font-semibold text-sm text-center"
            style={{ borderColor: pal.border, color: pal.text }}>
            <EditableText field="secondaryCta" fallback="See how it works" copy={copy} onCopyChange={onCopyChange} />
            <HideX field="secondaryCta" onHide={onHide} pal={pal} inset />
          </button>
        )}
      </div>
    </div>
  </div>
);

// ── Left ──────────────────────────────────────────────────────────────────────

const LeftLayout: React.FC<LayoutProps> = (p) => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav {...p} />
    <div className="flex-1 flex flex-col justify-center px-[8%] gap-6 max-w-[55%]">
      {!p.hidden.has('eyebrow') && (
        <p className="pv-hideable self-start text-[11px] tracking-[0.22em] uppercase font-semibold" style={{ color: p.pal.dim }}>
          ✦ &nbsp;<EditableText field="eyebrow" fallback="New · Product Launch" copy={p.copy} onCopyChange={p.onCopyChange} />
          <HideX field="eyebrow" onHide={p.onHide} pal={p.pal} />
        </p>
      )}
      <h1
        className="text-[clamp(2.2rem,5.5cqw,5.5rem)] font-semibold leading-[1.05] tracking-tight"
        style={{ color: p.pal.text, textShadow: p.pal.headlineShadow, ...headlineFont(p.font) }}
      >
        <EditableText field="headline" fallback={'Ideas that move\nthe world forward.'} copy={p.copy} onCopyChange={p.onCopyChange} />
      </h1>
      {!p.hidden.has('sub') && (
        <p className="pv-hideable self-start text-[clamp(0.9rem,1.2cqw,1.15rem)] leading-relaxed max-w-sm" style={{ color: p.pal.muted }}>
          <EditableText field="sub" fallback="Build, ship, and scale without limits. The platform built for ambitious creators." copy={p.copy} onCopyChange={p.onCopyChange} />
          <HideX field="sub" onHide={p.onHide} pal={p.pal} />
        </p>
      )}
      <div className="flex items-center gap-5 mt-1">
        {!p.hidden.has('primaryCta') && (
          <button className="pv-hideable px-6 py-3 rounded-lg font-semibold text-sm shadow-lg"
            style={{ background: p.pal.btnBg, color: p.pal.btnText }}>
            <EditableText field="primaryCta" fallback="Start for free" copy={p.copy} onCopyChange={p.onCopyChange} />
            <HideX field="primaryCta" onHide={p.onHide} pal={p.pal} />
          </button>
        )}
        {!p.hidden.has('secondaryCta') && (
          <button className="pv-hideable font-semibold text-sm underline underline-offset-4"
            style={{ color: p.pal.strong, textDecorationColor: p.pal.underline }}>
            <EditableText field="secondaryCta" fallback="See how it works" copy={p.copy} onCopyChange={p.onCopyChange} />
            <HideX field="secondaryCta" onHide={p.onHide} pal={p.pal} />
          </button>
        )}
      </div>
    </div>
  </div>
);

// ── Centre ────────────────────────────────────────────────────────────────────

const CenterLayout: React.FC<LayoutProps> = (p) => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav {...p} />
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-6">
      {!p.hidden.has('eyebrow') && (
        <span className="pv-hideable inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase border px-4 py-1.5 rounded-full backdrop-blur-sm"
          style={{ color: p.pal.dim, borderColor: p.pal.borderSoft }}>
          <span style={{ color: p.pal.faint }}>✦</span> <EditableText field="eyebrow" fallback="New · Product Launch" copy={p.copy} onCopyChange={p.onCopyChange} />
          <HideX field="eyebrow" onHide={p.onHide} pal={p.pal} />
        </span>
      )}
      <h1
        className="text-[clamp(2.4rem,7cqw,6rem)] font-semibold leading-[1.04] tracking-tight max-w-4xl"
        style={{ color: p.pal.text, textShadow: p.pal.headlineShadow === 'none' ? 'none' : '0 4px 32px rgba(0,0,0,0.4)', ...headlineFont(p.font) }}
      >
        <EditableText field="headline" fallback={'Ideas that move\nthe world forward.'} copy={p.copy} onCopyChange={p.onCopyChange} />
      </h1>
      {!p.hidden.has('sub') && (
        <p className="pv-hideable text-[clamp(0.95rem,1.4cqw,1.2rem)] max-w-xl leading-relaxed" style={{ color: p.pal.muted }}>
          <EditableText field="sub" fallback="Build, ship, and scale without limits. The platform built for ambitious creators." copy={p.copy} onCopyChange={p.onCopyChange} />
          <HideX field="sub" onHide={p.onHide} pal={p.pal} />
        </p>
      )}
      <div className="flex items-center gap-4 mt-2">
        {!p.hidden.has('primaryCta') && (
          <button className="pv-hideable px-7 py-3.5 rounded-full font-semibold text-sm tracking-wide shadow-lg"
            style={{ background: p.pal.btnBg, color: p.pal.btnText }}>
            <EditableText field="primaryCta" fallback="Start for free" copy={p.copy} onCopyChange={p.onCopyChange} />
            <HideX field="primaryCta" onHide={p.onHide} pal={p.pal} />
          </button>
        )}
        {!p.hidden.has('secondaryCta') && (
          <button className="pv-hideable px-7 py-3.5 rounded-full border font-semibold text-sm tracking-wide backdrop-blur-sm"
            style={{ borderColor: p.pal.border, color: p.pal.text }}>
            <EditableText field="secondaryCta" fallback="See how it works" copy={p.copy} onCopyChange={p.onCopyChange} />
            <HideX field="secondaryCta" onHide={p.onHide} pal={p.pal} />
          </button>
        )}
      </div>
    </div>
  </div>
);

// ── Right ─────────────────────────────────────────────────────────────────────

const RightLayout: React.FC<LayoutProps> = (p) => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav {...p} />
    <div className="flex-1 flex flex-col justify-center items-end px-[8%] gap-6 ml-auto max-w-[55%] text-right">
      {!p.hidden.has('eyebrow') && (
        <p className="pv-hideable self-end text-[11px] tracking-[0.22em] uppercase font-semibold" style={{ color: p.pal.dim }}>
          <EditableText field="eyebrow" fallback="New · Product Launch" copy={p.copy} onCopyChange={p.onCopyChange} /> &nbsp;✦
          <HideX field="eyebrow" onHide={p.onHide} pal={p.pal} />
        </p>
      )}
      <h1
        className="text-[clamp(2.2rem,5.5cqw,5.5rem)] font-semibold leading-[1.05] tracking-tight"
        style={{ color: p.pal.text, textShadow: p.pal.headlineShadow, ...headlineFont(p.font) }}
      >
        <EditableText field="headline" fallback={'Ideas that move\nthe world forward.'} copy={p.copy} onCopyChange={p.onCopyChange} />
      </h1>
      {!p.hidden.has('sub') && (
        <p className="pv-hideable self-end text-[clamp(0.9rem,1.2cqw,1.15rem)] leading-relaxed max-w-sm" style={{ color: p.pal.muted }}>
          <EditableText field="sub" fallback="Build, ship, and scale without limits. The platform built for ambitious creators." copy={p.copy} onCopyChange={p.onCopyChange} />
          <HideX field="sub" onHide={p.onHide} pal={p.pal} />
        </p>
      )}
      <div className="flex items-center gap-5 mt-1 justify-end">
        {!p.hidden.has('primaryCta') && (
          <button className="pv-hideable px-6 py-3 rounded-lg font-semibold text-sm shadow-lg"
            style={{ background: p.pal.btnBg, color: p.pal.btnText }}>
            <EditableText field="primaryCta" fallback="Start for free" copy={p.copy} onCopyChange={p.onCopyChange} />
            <HideX field="primaryCta" onHide={p.onHide} pal={p.pal} />
          </button>
        )}
        {!p.hidden.has('secondaryCta') && (
          <button className="pv-hideable font-semibold text-sm underline underline-offset-4"
            style={{ color: p.pal.strong, textDecorationColor: p.pal.underline }}>
            <EditableText field="secondaryCta" fallback="See how it works" copy={p.copy} onCopyChange={p.onCopyChange} />
            <HideX field="secondaryCta" onHide={p.onHide} pal={p.pal} />
          </button>
        )}
      </div>
    </div>
  </div>
);

// ── Export ────────────────────────────────────────────────────────────────────

// Swap to the mobile hero when the canvas is phone-shaped: portrait
// proportions (taller than wide) or genuinely narrow. Proportion, not a
// fixed pixel width — a 9:16 box on a large display is still a phone.
const MOBILE_BREAKPOINT = 620;

const PreviewOverlay = ({ layout, font = 'sans', theme = 'light', copy = {}, onCopyChange, logo, onLogoChange, hidden = [], onHide, navInset = false }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setIsMobile(width < MOBILE_BREAKPOINT || width < height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pal = palette(theme);
  const props: LayoutProps = { font, pal, copy, onCopyChange, logo, onLogoChange, hidden: new Set(hidden), onHide, navInset };

  return (
    <div ref={rootRef} className="absolute inset-0" style={{ containerType: 'inline-size' }}>
      <EditStyles pal={pal} />
      {isMobile ? <MobileLayout {...props} /> : (
        <>
          {layout === 'left' && <LeftLayout {...props} />}
          {layout === 'center' && <CenterLayout {...props} />}
          {layout === 'right' && <RightLayout {...props} />}
        </>
      )}
    </div>
  );
};

export default PreviewOverlay;
