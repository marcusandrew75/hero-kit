import React, { useEffect, useRef, useState } from 'react';
import { T } from './ui/HardwareControls';
import {
  MONO, GROTESK, SectionTag, Led, MarketingMotionStyles, useScrollReveal,
} from './landing/shared';

// ─── HeroKit for Teams ────────────────────────────────────────────────────────
// B2B marketing page at /teams. Same design language as the landing page —
// shared primitives from landing/shared.tsx, same tokens, no new visual
// system. The free tool is untouched; this page carries its own offer.

const CONTACT_HREF = 'mailto:teams@herokit.app?subject=HeroKit%20for%20Teams';

const TITLE = 'HeroKit for Teams — Your brand, running as a tool';
const DESCRIPTION =
  'On-brand hero sections your whole team can ship in minutes — set up and kept sharp by a creative director. ' +
  'Brand setup in a week, or an ongoing asset engine for teams shipping at volume.';

/** Primary CTA — same hardware button as the rest of the site, as a real
    link so it's keyboard-focusable and works without JS. */
const ContactCta: React.FC<{ small?: boolean; label?: string }> = ({ small, label = 'Talk to us about your brand' }) => (
  small ? (
    <a href={CONTACT_HREF} className="hw-cta" style={{ width: 'auto', padding: '9px 18px', fontSize: 12, textDecoration: 'none' }}>
      {label}
    </a>
  ) : (
    <div className="hw-cta-mount" style={{ display: 'inline-block' }}>
      <a href={CONTACT_HREF} className="hw-cta" style={{ width: 'auto', padding: '13px 34px', fontSize: 14, textDecoration: 'none' }}>
        <i className="ph-bold ph-arrow-right text-base" aria-hidden /> {label}
      </a>
    </div>
  )
);

// Logos drop into public/landing/logos/ as <slug>.svg or <slug>.png —
// e.g. sennheiser.svg. Either extension works; until a file exists the
// company renders as a plain text name so the strip never looks broken.
const CABANA_LOGOS = [
  { name: 'Sennheiser', slug: 'sennheiser' },
  { name: 'Cisco', slug: 'cisco' },
  { name: 'Boardriders', slug: 'boardriders' },
  { name: 'Buffer', slug: 'buffer' },
  { name: 'Dolby', slug: 'dolby' },
  { name: 'Logitech', slug: 'logitech' },
  { name: 'Spreadshirt', slug: 'spreadshirt' },
];

const CompanyLogo: React.FC<{ name: string; slug: string }> = ({ name, slug }) => {
  // Try svg → png → text fallback
  const [ext, setExt] = useState<'svg' | 'png' | 'none'>('svg');
  if (ext === 'none') {
    return (
      <span className="text-[15px] font-bold" style={{ ...GROTESK, color: T.dim }}>{name}</span>
    );
  }
  return (
    <img src={`/landing/logos/${slug}.${ext}`} alt={name}
      className="h-6 md:h-7 w-auto object-contain"
      style={{ filter: 'grayscale(1)', opacity: 0.55 }}
      loading="lazy"
      onError={() => setExt(ext === 'svg' ? 'png' : 'none')} />
  );
};

const TeamsPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  // Page meta — index.html's title/description belong to the tool, so swap
  // them for this page's lifetime and restore on unmount.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = TITLE;
    const meta = document.querySelector('meta[name="description"]');
    const prevDescription = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', DESCRIPTION);
    return () => {
      document.title = prevTitle;
      if (meta && prevDescription !== null) meta.setAttribute('content', prevDescription);
    };
  }, []);

  return (
    // h-screen + overflow-y-auto: the app's <body> is overflow-hidden, so the
    // page must own its scrolling internally (same as LandingPage).
    <div ref={rootRef} className="h-screen w-full overflow-y-auto overflow-x-hidden"
      style={{ background: T.bg, color: T.text }}>

      <MarketingMotionStyles />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-2.5" aria-label="HeroKit home">
          <img src="/herokit_logomark_dark.png" alt="" className="w-6 h-6 object-contain" />
          <div className="flex flex-col gap-[3px]">
            <span className="text-[15px] font-bold tracking-wide leading-none" style={{ ...GROTESK, color: T.text }}>
              HeroKit <span className="font-semibold" style={{ color: T.muted }}>for Teams</span>
            </span>
            <span className="text-[10px] font-medium leading-none" style={{ color: T.accent }}>ヒーロー</span>
          </div>
        </a>
        <ContactCta small label="Talk to us" />
      </header>

      {/* ── 1 · Hero ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-24">
        <div className="max-w-3xl">
          <p className="text-[12px] font-bold tracking-[0.22em] uppercase mb-6" style={{ ...MONO, color: T.muted }}>
            For teams · Set up by a creative director
          </p>

          <h1 className="text-[44px] md:text-[72px] font-bold leading-[0.98] mb-7" style={GROTESK}>
            Your brand,<br />
            <span style={{ color: T.accent }}>running as a tool.</span>
          </h1>

          <p className="text-[17px] md:text-[19px] leading-relaxed mb-10 max-w-2xl" style={{ color: T.muted }}>
            On-brand hero sections your whole team can ship in minutes. Set up — and kept
            sharp — by a creative director, not a template.
          </p>

          <ContactCta />
          <p className="mt-4 text-[12px] font-medium" style={{ color: T.dim }}>
            Opens an email to <span style={{ fontWeight: 600, color: T.muted }}>teams@herokit.app</span> — a real person replies.
          </p>
        </div>
      </section>

      {/* ── 2 · The problem ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="01" label="The problem" />
          <h2 className="text-[26px] md:text-[38px] font-bold leading-tight mt-5 max-w-3xl" style={GROTESK}>
            You ship landing pages every week — a launch, a campaign, an ICP.
            Every one has to be on-brand. Without a designer on staff, that's
            a grind and <span style={{ color: T.accent }}>the brand slowly leaks.</span>
          </h2>
        </div>
      </section>

      {/* ── 3 · How it works ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="02" label="How it works" />
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {[
            ['1', 'We install your brand.', 'Your colours, type, logo and rules, built into HeroKit.'],
            ['2', 'Your team ships.', 'On-brand heroes in minutes. No briefs, no waiting.'],
            ['3', 'We keep it growing.', 'The system evolves as your brand does.'],
          ].map(([n, title, body], i) => (
            <div key={n} className="control-panel landing-reveal" style={{ padding: '22px 20px', transitionDelay: `${i * 0.08}s` }}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold mb-4"
                style={{ ...MONO, background: T.text, color: T.bg }}>{n}</span>
              <h3 className="text-[16px] font-bold mb-2" style={GROTESK}>{title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: T.muted }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 · It's not just heroes ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="03" label="It's not just heroes" />
          <h2 className="text-[26px] md:text-[38px] font-bold leading-tight mt-5 mb-4 max-w-3xl" style={GROTESK}>
            A hero is your brand applied to a canvas — so the same engine runs
            everything shaped like one.
          </h2>
          <p className="text-[15px] md:text-[16px] leading-relaxed mb-8 max-w-2xl" style={{ color: T.muted }}>
            Share images, social headers, email banners, ad creative, deck covers.
            The hero's just the flagship.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Share images', 'Social headers', 'Email banners', 'Ad creative', 'Deck covers'].map((name, i) => (
              <span key={name}
                className="inline-flex items-center gap-2 px-3 py-[7px] rounded-lg text-[12px] font-semibold"
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  boxShadow: '0 1px 0 rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
                }}>
                <Led delay={i * 0.35} />
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5 · Two ways to work ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="04" label="Two ways to work" />
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-5 mt-10 items-stretch">
          {[
            {
              tag: 'Brand Setup · one-off',
              heading: 'We install your brand as a tool your team keeps forever.',
              items: [
                'Your colours, type, logo and rules, configured',
                'A starter set of on-brand hero templates',
                'Your whole team self-serves, no design skills needed',
                'Live in about a week',
              ],
              footer: 'Fixed price. Fixed scope. Yours to keep.',
            },
            {
              tag: 'Asset Engine · monthly',
              heading: 'We run your on-brand surface, so you never brief a landing page again.',
              items: [
                'Everything in Brand Setup, plus:',
                'New heroes and campaign variants, on tap',
                'The same engine extended to social, email, ads and decks',
                'Refreshes as your brand evolves',
              ],
              footer: 'For teams shipping at volume.',
            },
          ].map((card, i) => (
            <div key={card.tag} className="control-panel landing-reveal flex flex-col"
              style={{ padding: '28px 26px', transitionDelay: `${i * 0.08}s` }}>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase mb-4" style={{ ...MONO, color: T.dim }}>
                {card.tag}
              </p>
              <h3 className="text-[20px] md:text-[24px] font-bold leading-snug mb-6" style={GROTESK}>
                {card.heading}
              </h3>
              <ul className="flex flex-col gap-3 mb-8">
                {card.items.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed" style={{ color: T.muted }}>
                    <i className="ph-fill ph-seal-check text-base mt-[1px] shrink-0" style={{ color: T.accent }} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-5 text-[13px] font-bold border-t" style={{ ...GROTESK, borderColor: T.border, color: T.text }}>
                {card.footer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6 · Who it's for ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="05" label="Who it's for" />
          <h2 className="text-[26px] md:text-[38px] font-bold leading-tight mt-5 max-w-3xl" style={GROTESK}>
            For teams shipping fast with little or no design support — who still
            need to look like they've got <span style={{ color: T.accent }}>a studio behind them.</span>
          </h2>
        </div>
      </section>

      {/* ── 7 · Credibility strip ────────────────────────────────────────── */}
      {/* Deliberately attributed to Cabana and to practitioners AT these
          companies — not framed as HeroKit for Teams clients. */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="control-panel landing-reveal" style={{ padding: '30px 26px' }}>
          <p className="text-center text-[13.5px] leading-relaxed max-w-2xl mx-auto mb-7" style={{ color: T.muted }}>
            Set up and run by <span style={{ color: T.text, fontWeight: 600 }}>Marc Andrew</span> —
            30 years in design, maker of <span style={{ color: T.text, fontWeight: 600 }}>Cabana</span>,
            used by designers and developers at:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {CABANA_LOGOS.map(l => <CompanyLogo key={l.name} {...l} />)}
          </div>
        </div>
      </section>

      {/* ── 8 · Final CTA ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="control-panel landing-reveal landing-float text-center"
          style={{ padding: '56px 24px 60px' }}>
          <h2 className="text-[34px] md:text-[52px] font-bold leading-tight mb-8" style={GROTESK}>
            Your brand, live in a week.
          </h2>
          <ContactCta label="Set up your brand" />
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between flex-wrap gap-3 py-8">
          <div className="flex items-center gap-2">
            <img src="/herokit_logomark_dark.png" alt="" className="w-4 h-4 object-contain opacity-70" />
            <span className="text-[11px] font-semibold" style={{ color: T.dim }}>
              HeroKit <span style={{ color: T.accent }}>ヒーロー</span> — hero backgrounds, engineered
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/"
              className="text-[11px] font-semibold transition-colors" style={{ color: T.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.dim)}>
              HeroKit — the free tool
            </a>
            <a href="https://x.com/mrcndrw" target="_blank" rel="noreferrer"
              className="text-[11px] font-semibold transition-colors" style={{ color: T.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.dim)}>
              Made by @mrcndrw
            </a>
          </div>
        </footer>
      </section>

    </div>
  );
};

export default TeamsPage;
