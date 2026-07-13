
import React, { useRef } from 'react';

export type PreviewLayout = 'left' | 'center' | 'right';
export type PreviewFont = 'sans' | 'serif';

// Custom copy typed straight onto the preview. One shared store across all
// three layouts — set your headline once and it follows you between
// left/center/right — with per-field fallbacks to each layout's sample copy.
// Only overridden fields are stored; empty/unchanged edits fall back.
export type PreviewCopyField = 'brand' | 'navCta' | 'eyebrow' | 'headline' | 'sub' | 'primaryCta' | 'secondaryCta';
export type PreviewCopy = Partial<Record<PreviewCopyField, string>>;

interface Props {
  layout: PreviewLayout;
  font?: PreviewFont;
  copy?: PreviewCopy;
  onCopyChange?: (field: PreviewCopyField, value: string | null) => void;
}

// Applied only to the headline — nav/buttons stay sans, matching how real
// designs pair a serif display headline with sans UI chrome rather than
// switching the whole mock over.
const headlineFont = (font: PreviewFont) =>
  font === 'serif' ? { fontFamily: '"Playfair Display", serif' } : {};

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

/** Hover/focus affordance for editable text — injected once per overlay. */
const EditStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .pv-edit { cursor: text; user-select: text; border-radius: 3px; outline: 1.5px dashed transparent; outline-offset: 5px; transition: outline-color .15s ease; }
    .pv-edit:hover { outline-color: rgba(255,255,255,0.35); }
    .pv-edit:focus { outline-color: rgba(255,255,255,0.65); outline-style: solid; outline-width: 1px; }
  ` }} />
);

type LayoutProps = {
  font: PreviewFont;
  copy: PreviewCopy;
  onCopyChange?: (field: PreviewCopyField, value: string | null) => void;
};

const Nav: React.FC<Pick<LayoutProps, 'copy' | 'onCopyChange'>> = ({ copy, onCopyChange }) => (
  // px-[8%] matches the headline content blocks' inset (see Left/Right layouts
  // below) — keeps logo and CTA aligned with the main title, and pulls them in
  // from the raw edge so they don't collide with the app's fixed corner UI
  // (Eye / Fullscreen icon buttons sit at that same top-right corner).
  <div className="absolute top-0 inset-x-0 flex items-center justify-between px-[8%] py-6 z-10">
    <div className="flex items-center gap-2.5">
      <div className="w-6 h-6 rounded-full border-[1.5px] border-white/70" />
      <span className="text-white text-sm font-semibold tracking-widest uppercase opacity-90">
        <EditableText field="brand" fallback="Brand" copy={copy} onCopyChange={onCopyChange} />
      </span>
    </div>
    <div className="flex items-center gap-8 text-white/60 text-sm font-medium">
      {['Features', 'Pricing', 'About'].map(l => (
        <span key={l}>{l}</span>
      ))}
    </div>
    <button className="px-5 py-2 rounded-full border border-white/40 text-white text-sm font-semibold tracking-wide">
      <EditableText field="navCta" fallback="Get Started" copy={copy} onCopyChange={onCopyChange} />
    </button>
  </div>
);

// ── Left ──────────────────────────────────────────────────────────────────────

const LeftLayout: React.FC<LayoutProps> = ({ font, copy, onCopyChange }) => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav copy={copy} onCopyChange={onCopyChange} />
    <div className="flex-1 flex flex-col justify-center px-[8%] gap-6 max-w-[55%]">
      <p className="text-[11px] tracking-[0.22em] uppercase text-white/50 font-semibold">
        ✦ &nbsp;<EditableText field="eyebrow" fallback="The Platform for Creators" copy={copy} onCopyChange={onCopyChange} />
      </p>
      <h1
        className="text-[clamp(2.8rem,5.5vw,5.5rem)] font-semibold text-white leading-[1.05] tracking-tight"
        style={{ textShadow: '0 4px 40px rgba(0,0,0,0.5)', ...headlineFont(font) }}
      >
        <EditableText field="headline" fallback={'Design that\ndrives results.'} copy={copy} onCopyChange={onCopyChange} />
      </h1>
      <p className="text-[clamp(0.95rem,1.2vw,1.15rem)] text-white/65 leading-relaxed max-w-sm">
        <EditableText field="sub" fallback="We help ambitious brands turn their ideas into high-performing digital experiences." copy={copy} onCopyChange={onCopyChange} />
      </p>
      <div className="flex items-center gap-5 mt-1">
        <button className="px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm shadow-lg">
          <EditableText field="primaryCta" fallback="Start Your Project" copy={copy} onCopyChange={onCopyChange} />
        </button>
        <button className="text-white/80 font-semibold text-sm underline underline-offset-4 decoration-white/30">
          <EditableText field="secondaryCta" fallback="See Our Work →" copy={copy} onCopyChange={onCopyChange} />
        </button>
      </div>
    </div>
  </div>
);

// ── Centre ────────────────────────────────────────────────────────────────────

const CenterLayout: React.FC<LayoutProps> = ({ font, copy, onCopyChange }) => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav copy={copy} onCopyChange={onCopyChange} />
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-6">
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase text-white/55 border border-white/20 px-4 py-1.5 rounded-full backdrop-blur-sm">
        <span className="text-white/40">✦</span> <EditableText field="eyebrow" fallback="New · Product Launch" copy={copy} onCopyChange={onCopyChange} />
      </span>
      <h1
        className="text-[clamp(3rem,7vw,6rem)] font-semibold text-white leading-[1.04] tracking-tight max-w-4xl"
        style={{ textShadow: '0 4px 32px rgba(0,0,0,0.4)', ...headlineFont(font) }}
      >
        <EditableText field="headline" fallback={'Ideas that move\nthe world forward.'} copy={copy} onCopyChange={onCopyChange} />
      </h1>
      <p className="text-[clamp(1rem,1.4vw,1.2rem)] text-white/65 max-w-xl leading-relaxed">
        <EditableText field="sub" fallback="Build, ship, and scale without limits. The platform built for ambitious creators." copy={copy} onCopyChange={onCopyChange} />
      </p>
      <div className="flex items-center gap-4 mt-2">
        <button className="px-7 py-3.5 rounded-full bg-white text-black font-semibold text-sm tracking-wide shadow-lg">
          <EditableText field="primaryCta" fallback="Start for free" copy={copy} onCopyChange={onCopyChange} />
        </button>
        <button className="px-7 py-3.5 rounded-full border border-white/35 text-white font-semibold text-sm tracking-wide backdrop-blur-sm">
          <EditableText field="secondaryCta" fallback="See how it works" copy={copy} onCopyChange={onCopyChange} />
        </button>
      </div>
    </div>
  </div>
);

// ── Right ─────────────────────────────────────────────────────────────────────

const RightLayout: React.FC<LayoutProps> = ({ font, copy, onCopyChange }) => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav copy={copy} onCopyChange={onCopyChange} />
    <div className="flex-1 flex flex-col justify-center items-end px-[8%] gap-6 ml-auto max-w-[55%] text-right">
      <p className="text-[11px] tracking-[0.22em] uppercase text-white/50 font-semibold">
        <EditableText field="eyebrow" fallback="The Platform for Creators" copy={copy} onCopyChange={onCopyChange} /> &nbsp;✦
      </p>
      <h1
        className="text-[clamp(2.8rem,5.5vw,5.5rem)] font-semibold text-white leading-[1.05] tracking-tight"
        style={{ textShadow: '0 4px 40px rgba(0,0,0,0.5)', ...headlineFont(font) }}
      >
        <EditableText field="headline" fallback={'Your brand.\nBeautifully built.'} copy={copy} onCopyChange={onCopyChange} />
      </h1>
      <p className="text-[clamp(0.95rem,1.2vw,1.15rem)] text-white/65 leading-relaxed max-w-sm">
        <EditableText field="sub" fallback="Premium digital experiences for forward-thinking teams who refuse to settle." copy={copy} onCopyChange={onCopyChange} />
      </p>
      <div className="flex items-center gap-5 mt-1 justify-end">
        <button className="px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm shadow-lg">
          <EditableText field="primaryCta" fallback="Get Started" copy={copy} onCopyChange={onCopyChange} />
        </button>
        <button className="text-white/80 font-semibold text-sm underline underline-offset-4 decoration-white/30">
          <EditableText field="secondaryCta" fallback="See Our Work →" copy={copy} onCopyChange={onCopyChange} />
        </button>
      </div>
    </div>
  </div>
);

// ── Export ────────────────────────────────────────────────────────────────────

const PreviewOverlay: React.FC<Props> = ({ layout, font = 'sans', copy = {}, onCopyChange }) => {
  const props = { font, copy, onCopyChange };
  return (
    <>
      <EditStyles />
      {layout === 'left' && <LeftLayout {...props} />}
      {layout === 'center' && <CenterLayout {...props} />}
      {layout === 'right' && <RightLayout {...props} />}
    </>
  );
};

export default PreviewOverlay;
