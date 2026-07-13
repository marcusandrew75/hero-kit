import React, { useEffect, useState } from 'react';
import { T } from '../ui/HardwareControls';

// ─── Shared marketing-page primitives ─────────────────────────────────────────
// Extracted verbatim from LandingPage.tsx so the Teams page (and any future
// marketing pages) reuse the exact same visual language — hatch marks,
// numbered section tags, mono spec type, grotesk headings, scroll reveals —
// rather than drifting copies. Purely a move: no visual changes.

export const MONO: React.CSSProperties    = { fontFamily: '"Share Tech Mono", monospace' };
export const GROTESK: React.CSSProperties = { fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.02em' };

/** Hatch-mark cluster — the ///// motif from the tool's panel headers. */
export const Hatch: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <span className="inline-flex gap-[3px]" aria-hidden>
    {Array.from({ length: count }).map((_, i) => (
      <span key={i} style={{
        width: 1.5, height: 10, background: T.borderDk,
        transform: 'skewX(-24deg)', display: 'inline-block',
      }} />
    ))}
  </span>
);

/** Section eyebrow — hatch + zero-padded number + tracked-out label. */
export const SectionTag: React.FC<{ number: string; label: string }> = ({ number, label }) => (
  <div className="flex items-center gap-3">
    <Hatch />
    <span className="text-[11px] font-bold" style={{ ...MONO, color: T.dim }}>{number}</span>
    <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: T.muted }}>{label}</span>
  </div>
);

/** Image that renders a labelled dot-grid placeholder until the real file
    exists in public/landing/ — swap-in is automatic, no code change needed.
    Pass onExpand to make the whole tile clickable for a full-size view,
    with an enlarge affordance badge in the bottom-right corner. */
export const SmartImg: React.FC<{ src: string; alt: string; ratio: string; className?: string; onExpand?: (src: string) => void }> =
  ({ src, alt, ratio, className = '', onExpand }) => {
  const [ok, setOk] = useState(true);
  const expandable = !!onExpand && ok;
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
      aria-label={expandable ? 'View full size' : undefined}
      onClick={expandable ? () => onExpand!(src) : undefined}
      onKeyDown={expandable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand!(src); } } : undefined}
      style={{
        aspectRatio: ratio,
        background: T.panel,
        border: `1px solid ${T.border}`,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.7)',
        cursor: expandable ? 'zoom-in' : undefined,
      }}>
      {ok ? (
        <>
          <img src={src} alt={alt} onError={() => setOk(false)}
            className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          {onExpand && (
            <span aria-hidden
              className="absolute bottom-2.5 right-2.5 flex items-center justify-center w-8 h-8 rounded-lg pointer-events-none"
              style={{
                background: 'rgba(242,240,235,0.88)',
                border: `1px solid ${T.border}`,
                color: T.text,
                backdropFilter: 'blur(4px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}>
              <i className="ph-bold ph-arrows-out-simple text-sm" />
            </span>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{
            backgroundImage: `radial-gradient(${T.borderDk} 1px, transparent 1px)`,
            backgroundSize: '14px 14px',
          }}>
          <i className="ph ph-image text-2xl" style={{ color: T.dim }} />
          <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ ...MONO, color: T.muted, background: T.bg }}>
            public{src}
          </span>
        </div>
      )}
    </div>
  );
};

/** Blinking status LED — staggered via animation-delay. */
export const Led: React.FC<{ delay?: number }> = ({ delay = 0 }) => (
  <span className="landing-led" style={{ animationDelay: `${delay}s`, background: T.accent }} aria-hidden />
);

/** Circular avatar with an initial fallback until the real file lands. */
export const Avatar: React.FC<{ src: string; alt: string; initial: string; size?: number }> =
  ({ src, alt, initial, size = 44 }) => {
  const [ok, setOk] = useState(true);
  return (
    <span className="relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0"
      style={{
        width: size, height: size,
        background: T.panel, border: `1px solid ${T.border}`,
        boxShadow: '0 1px 0 rgba(255,255,255,0.7), inset 0 1px 2px rgba(0,0,0,0.06)',
      }}>
      {ok ? (
        <img src={src} alt={alt} onError={() => setOk(false)}
          className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="text-[15px] font-bold" style={{ ...GROTESK, color: T.dim }}>{initial}</span>
      )}
    </span>
  );
};

/** Page-scoped animation keyframes shared by all marketing pages. */
export const MarketingMotionStyles: React.FC = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .landing-reveal { opacity: 0; transform: translateY(22px); transition: opacity .65s ease, transform .65s cubic-bezier(0.22,1,0.36,1); }
    .landing-reveal-in { opacity: 1; transform: none; }
    @keyframes landing-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .landing-marquee-track { display: flex; gap: 16px; width: max-content; animation: landing-marquee 52s linear infinite; }
    .landing-marquee:hover .landing-marquee-track { animation-play-state: paused; }
    @keyframes landing-blink { 0%, 78% { opacity: 1; } 82%, 96% { opacity: 0.25; } 100% { opacity: 1; } }
    .landing-led { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0;
      box-shadow: 0 0 6px rgba(232,67,32,0.55); animation: landing-blink 3.4s ease-in-out infinite; }
    @keyframes landing-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
    .landing-float { animation: landing-float 5.5s ease-in-out infinite; }
    @keyframes landing-eq { 0%, 100% { transform: scaleY(0.45); } 50% { transform: scaleY(1); } }
    .landing-eq-bar { display: inline-block; transform-origin: bottom; border-radius: 1px;
      animation: landing-eq 1.6s ease-in-out infinite; }
    @keyframes landing-lightbox-scrim { from { opacity: 0; } to { opacity: 1; } }
    @keyframes landing-lightbox-img { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
    .landing-lightbox { animation: landing-lightbox-scrim .25s ease both; }
    .landing-lightbox img { animation: landing-lightbox-img .35s cubic-bezier(0.22,1,0.36,1) both; }
    @media (prefers-reduced-motion: reduce) {
      .landing-marquee-track, .landing-led, .landing-float, .landing-eq-bar { animation: none; }
      .landing-reveal { opacity: 1; transform: none; transition: none; }
    }
  ` }} />
);

/** Scroll-reveal: fades/rises any .landing-reveal element in once. */
export const useScrollReveal = (rootRef: React.RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('landing-reveal-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    root.querySelectorAll('.landing-reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
};
