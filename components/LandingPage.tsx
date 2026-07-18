import React, { useEffect, useRef, useState } from 'react';
import { T } from './ui/HardwareControls';
import DocsPanel from './DocsPanel';
import {
  MONO, GROTESK, Hatch, SectionTag, SmartImg, Led, Avatar,
  MarketingMotionStyles, useScrollReveal,
} from './landing/shared';

// ─── Landing page ─────────────────────────────────────────────────────────────
// Marketing front-door for HeroKit at the bare URL (the tool lives at ?app).
// Same Braun/Teenage Engineering design language as the tool: light surfaces,
// hatch marks, sequential numbering, mono spec readouts, one orange accent.
// Headings set in Space Grotesk. Shared primitives live in landing/shared.tsx.
//
// Imagery drops into public/landing/ — every missing file renders as a
// labelled placeholder tile showing exactly which filename it expects:
//   gallery-01.jpg … gallery-06.jpg   exported HeroKit outputs (~1600×1000)
//   ui-sidebar.jpg                    tall screenshot of the control sidebar
//   ui-mask.jpg                       Effect Mask being painted on the canvas
//   ui-looks.jpg                      Looks panel open
//   ui-gallery.jpg                    Gallery/Pexels source picker
//   in-context.jpg                    Preview in Context over the canvas (wide)
//   screen-sizes.jpg                  ratio selector toolbar (natural height)
//   marc.jpg                          square portrait for the bio section
//   vlad.jpg · wes.jpg · florent.jpg   testimonial avatars (square)

/** The one CTA that matters — reuses the tool's own hardware button style. */
const OpenCta: React.FC<{ onOpen: () => void; small?: boolean }> = ({ onOpen, small }) => (
  small ? (
    <button onClick={onOpen} className="hw-cta" style={{ width: 'auto', padding: '9px 18px', fontSize: 12 }}>
      Open HeroKit
    </button>
  ) : (
    <div className="hw-cta-mount" style={{ display: 'inline-block' }}>
      <button onClick={onOpen} className="hw-cta" style={{ width: 'auto', padding: '13px 34px', fontSize: 14 }}>
        <i className="ph-bold ph-arrow-right text-base" /> Open HeroKit
      </button>
    </div>
  )
);

// ─── Content data ─────────────────────────────────────────────────────────────

const EFFECTS_RACK: string[] = [
  'Halftone', 'Duotone Halftone', 'Risograph', 'CMYK Separation', 'Silkscreen', 'Postcard',
  'Gradient Map', 'Relief', 'Contour',
  'Bayer Dither', 'Floyd–Steinberg', 'Atkinson', 'ASCII Dither',
  'Duotone Dither', 'Color Grade', 'Split Tone', 'Edge Glow',
  'Image Glitch', 'Dispersion', 'Displacement Warp', 'Channel Smear',
  'Pixel Sort', 'Motion Blur', 'Spot Blur', 'Chromatic Aberration',
  'Effect Mask', 'Film Grain', 'Vignette', 'Pattern Overlays',
];

const GALLERY = Array.from({ length: 7 }, (_, i) =>
  `/landing/gallery-${String(i + 1).padStart(2, '0')}.jpg`);

// ─── Page ─────────────────────────────────────────────────────────────────────

const LandingPage: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [docsTab, setDocsTab] = useState<'about' | 'docs' | 'changelog' | null>(null);

  // Escape closes the lightbox
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  useScrollReveal(rootRef);

  return (
    // h-screen + overflow-y-auto (not min-h-screen): the app's <body> is
    // overflow-hidden, so the landing must own its scrolling internally.
    <div ref={rootRef} className="h-screen w-full overflow-y-auto overflow-x-hidden"
      style={{ background: T.bg, color: T.text }}>

      <MarketingMotionStyles />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/herokit_logomark_dark.png" alt="" className="w-6 h-6 object-contain" />
          <div className="flex flex-col gap-[3px]">
            <span className="text-[15px] font-bold tracking-wide leading-none" style={GROTESK}>HeroKit</span>
            <span className="text-[10px] font-medium leading-none" style={{ color: T.accent }}>ヒーロー</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {/* For Teams — hidden for now, not ready to showcase it yet.
              /teams itself is untouched, just not linked from here. */}
          {false && (
            <a href="/teams" className="text-[13px] font-semibold transition-colors"
              style={{ color: T.muted }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
              For Teams
            </a>
          )}
          {/* Hidden below sm — this minimal header has no mobile nav pattern
              (no hamburger), so on small screens only the CTA stays. */}
          <div className="hidden sm:flex items-center gap-5">
            {([
              ['about', 'About'],
              ['docs', 'Effects'],
              ['changelog', 'Changelog'],
            ] as const).map(([id, label]) => (
              <button key={id} onClick={() => setDocsTab(id)}
                className="text-[13px] font-semibold transition-colors"
                style={{ color: T.muted }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                {label}
              </button>
            ))}
          </div>
          <OpenCta onOpen={onOpen} small />
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-24">
        <div className="max-w-3xl">
          <p className="text-[12px] font-bold tracking-[0.22em] uppercase mb-6" style={{ ...MONO, color: T.muted }}>
            Free · Browser-based · No signup · No uploads
          </p>

          <h1 className="text-[44px] md:text-[72px] font-bold leading-[0.98] mb-7" style={GROTESK}>
            Hero backgrounds,<br />
            <span style={{ color: T.accent }}>engineered.</span>
          </h1>

          <p className="text-[17px] md:text-[19px] leading-relaxed mb-10 max-w-2xl" style={{ color: T.muted }}>
            HeroKit does one thing extremely well: the Hero — the section that sets the tone
            for your whole page. Nail it with real print, dither and glitch effects, and
            export up to 4K. Free. Powerful. In your browser.
          </p>

          <div className="flex items-center gap-5 flex-wrap">
            <OpenCta onOpen={onOpen} />
            <a href="#engine" className="text-[13px] font-semibold transition-colors"
              style={{ color: T.muted }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
              See the engine <i className="ph ph-arrow-down text-xs" />
            </a>
          </div>
        </div>

        {/* Spec strip — LCD-style readout, quiet flex */}
        <div className="mt-16 md:mt-20 flex flex-wrap gap-x-10 gap-y-3 border-t pt-6"
          style={{ borderColor: T.border }}>
          {[
            ['30+', 'stackable effects'],
            ['4K', 'PNG · WebP · JPG export'],
            ['0', 'uploads — fully client-side'],
            ['$0', 'free, no account'],
          ].map(([big, small]) => (
            <div key={small} className="flex items-baseline gap-2.5">
              <span className="text-[22px] font-bold" style={{ ...MONO, color: T.text }}>{big}</span>
              <span className="text-[12px] font-medium" style={{ color: T.dim }}>{small}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 01 · Showcase marquee ────────────────────────────────────────── */}
      <section className="pb-24 md:pb-32">
        <div className="max-w-6xl mx-auto px-6 landing-reveal">
          <SectionTag number="01" label="Made with HeroKit" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-4 max-w-2xl" style={GROTESK}>
            From flat photo to<br />front-page material.
          </h2>
          <p className="text-[15px] md:text-[16px] leading-relaxed mb-10 max-w-2xl" style={{ color: T.muted }}>
            Every one of these started life as an ordinary image — a stock photo, a phone shot,
            a plain gradient — and left as a hero section.
          </p>
        </div>

        {/* Full-bleed marquee — duplicated track for a seamless loop, pauses on hover */}
        <div className="landing-marquee landing-reveal" style={{ overflow: 'hidden' }}>
          <div className="landing-marquee-track">
            {[...GALLERY, ...GALLERY].map((src, i) => (
              <SmartImg key={i} src={src} alt="Made with HeroKit" ratio="16/10"
                className="w-[400px] md:w-[500px] shrink-0" onExpand={setLightbox} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · The engine ──────────────────────────────────────────────── */}
      <section id="engine" className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="02" label="The engine" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-4 max-w-2xl" style={GROTESK}>
            Real print math.<br />Not another CSS filter.
          </h2>
          <p className="text-[15px] md:text-[16px] leading-relaxed mb-12 max-w-2xl" style={{ color: T.muted }}>
            Every effect is computed pixel-by-pixel in a sequential processing pipeline — the same
            way ink actually behaves on a press. Stack them in any order and watch each one react
            to everything underneath it.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              n: '1', icon: 'ph-printer', title: 'Print & screen',
              body: 'Halftone with dot, line and crosshatch screens — plus a flat two-ink Duotone mode straight off a gig poster. Risograph grain. Full CMYK separation at true press angles: C 15° · M 75° · Y 0° · K 45°.',
            },
            {
              n: '2', icon: 'ph-dots-nine', title: 'The dither lab',
              body: 'Ordered Bayer matrices from a chunky 2×2 to a photographic 16×16, Floyd–Steinberg and Atkinson error diffusion, and an ASCII mode that rebuilds your image from type. All remappable to any two-color ink pair.',
            },
            {
              n: '3', icon: 'ph-paint-brush', title: 'Surgical control',
              body: 'Paint an Effect Mask directly on the canvas and the entire stack obeys it — feathered edges, invertible, resolution-independent. Then finish with color grades, split tone, pixel sort, channel smear and glitch.',
            },
          ].map((card, i) => (
            <div key={card.n} className="control-panel landing-reveal" style={{ padding: '22px 20px', transitionDelay: `${i * 0.08}s` }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold"
                  style={{ ...MONO, background: T.text, color: T.bg }}>{card.n}</span>
                <i className={`ph ${card.icon} text-xl`} style={{ color: T.accent }} />
                <h3 className="text-[15px] font-bold" style={GROTESK}>{card.title}</h3>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: T.muted }}>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 03 · The full rack ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="03" label="The full rack" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-4 max-w-2xl" style={GROTESK}>
            Two dozen modules.<br />One pipeline.
          </h2>
          <p className="text-[15px] md:text-[16px] leading-relaxed mb-10 max-w-2xl" style={{ color: T.muted }}>
            Run as many at once as your idea needs — each effect is computed in sequence, so
            every module reacts to everything stacked beneath it.
          </p>
        </div>

        <div className="control-panel landing-reveal" style={{ padding: '18px 16px' }}>
          <div className="flex flex-wrap gap-2">
            {EFFECTS_RACK.map((name, i) => (
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

      {/* ── 04 · The workflow ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="04" label="The workflow" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-4 max-w-2xl" style={GROTESK}>
            Built like an instrument,<br />not a settings page.
          </h2>
          <p className="text-[15px] md:text-[16px] leading-relaxed mb-12 max-w-2xl" style={{ color: T.muted }}>
            Knobs, levers and LCD readouts you can actually feel. Preview your background under a
            real hero layout before you commit, and save any state as a Look to come back to.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {[
            {
              src: '/landing/ui-sidebar.jpg', ratio: '4/5',
              title: 'Hardware controls', icon: 'ph-sliders',
              body: 'Every parameter lives on a numbered panel with tactile knobs, toggles and editable LCD displays — dialled in like outboard gear, not buried in the dropdowns of yet another gloomy dark-mode tool.',
            },
            {
              src: '/landing/ui-mask.jpg', ratio: '4/5',
              title: 'Paint where effects land', icon: 'ph-paint-brush',
              body: 'The Effect Mask turns the whole stack into a brush. Paint a region, feather its edges, invert it — the pipeline composites everything else back to the untouched original.',
            },
            {
              src: '/landing/ui-gallery.jpg', ratio: '4/5',
              title: 'Sources on tap', icon: 'ph-images',
              body: 'Start from a curated gallery, search Pexels without leaving the tool, paste straight from your clipboard, or drop in your own shot. Layer up to two images with blend modes.',
            },
            {
              src: '/landing/ui-looks.jpg', ratio: '4/5',
              title: 'Looks — your recall bank', icon: 'ph-bookmark-simple',
              body: 'Save any state as a named Look and recall it instantly. Auto-history keeps your last sessions on hand, and everything stays in your browser.',
            },
          ].map((f, i) => (
            <div key={f.title} className="landing-reveal" style={{ transitionDelay: `${(i % 2) * 0.08}s` }}>
              <SmartImg src={f.src} alt={f.title} ratio={f.ratio} className="mb-5" />
              <div className="flex items-center gap-2.5 mb-2">
                <i className={`ph ${f.icon} text-lg`} style={{ color: T.accent }} />
                <h3 className="text-[17px] font-bold" style={GROTESK}>{f.title}</h3>
              </div>
              <p className="text-[13.5px] leading-relaxed max-w-md" style={{ color: T.muted }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 · In context ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="05" label="In context" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-4 max-w-2xl" style={GROTESK}>
            A background is only good<br />with the words on top of it.
          </h2>
          <p className="text-[15px] md:text-[16px] leading-relaxed mb-6 max-w-2xl" style={{ color: T.muted }}>
            Every designer knows the round-trip: export, drop it into Figma, lay the copy over
            it… and the headline vanishes into the busy part of the image. Back you go.
            HeroKit kills that loop — flip on <span style={{ color: T.text, fontWeight: 600 }}>Preview
            in Context</span> and a real hero layout sits over your canvas while you work: nav,
            headline, sub-copy and CTAs. And it's not a dummy mock — click any text and{' '}
            <span style={{ color: T.text, fontWeight: 600 }}>type your own</span>, drop{' '}
            <span style={{ color: T.text, fontWeight: 600 }}>your logo</span> into the nav, flip the
            type between light and dark, and watch it all reflow into a real mobile hero on narrow
            ratios. Your brand, remembered for next time. If the type reads, it ships.
          </p>
          <div className="flex flex-wrap gap-x-7 gap-y-2 mb-10">
            {['Type your own copy on the canvas', 'Drop in your own logo', 'Light or dark type', 'Auto mobile layout on narrow ratios', 'Serif or grotesk headlines'].map((f, i) => (
              <span key={f} className="inline-flex items-center gap-2 text-[12px] font-semibold" style={{ color: T.muted }}>
                <Led delay={i * 0.4} /> {f}
              </span>
            ))}
          </div>
        </div>
        <div className="landing-reveal" style={{ transitionDelay: '0.1s' }}>
          <SmartImg src="/landing/in-context.jpg" alt="Preview in Context — a real hero layout over the canvas" ratio="16/10" />
        </div>
      </section>

      {/* ── 06 · True to size ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="06" label="True to size" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-4 max-w-2xl" style={GROTESK}>
            Compose at the shape<br />it actually ships at.
          </h2>
          <p className="text-[15px] md:text-[16px] leading-relaxed mb-8 max-w-2xl" style={{ color: T.muted }}>
            Lock the canvas to the same standard ratios you frame with in Figma — desktop hero,
            square social, story, ultrawide — and design inside the real edges from the first
            second. No cropping surprises, no recomposing after export. What you see is the
            exact frame that lands in your file, at 1×, 2× or 4×.
          </p>
          <div className="flex flex-wrap gap-2 mb-10">
            {[
              ['16:9', 'Desktop hero'], ['21:9', 'Ultrawide'], ['4:3', 'Classic'],
              ['1:1', 'Square social'], ['9:16', 'Story'], ['Free', 'Anything else'],
            ].map(([ratio, label]) => (
              <span key={ratio} className="inline-flex items-baseline gap-2 px-3 py-[7px] rounded-lg text-[12px]"
                style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  boxShadow: '0 1px 0 rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
                }}>
                <span className="font-bold" style={{ ...MONO, color: T.text }}>{ratio}</span>
                <span className="font-medium" style={{ color: T.dim }}>{label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="landing-reveal" style={{ transitionDelay: '0.1s' }}>
          {/* Natural height — this screenshot is a wide toolbar strip, so no
              forced aspect box (SmartImg's object-cover would crop it). */}
          <img src="/landing/screen-sizes.jpg" alt="Canvas ratio selector — standard screen shapes"
            className="w-full h-auto rounded-xl" loading="lazy"
            style={{ border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(255,255,255,0.7)' }} />
        </div>
      </section>

      {/* ── 07 · Ship it ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="07" label="Ship it" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-12 max-w-2xl" style={GROTESK}>
            Canvas to Figma or Framer<br />in three moves.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            ['01', 'Compose', 'Drop in an image — or start from a gallery shot — and stack effects until it sings.'],
            ['02', 'Export', 'One click, up to 4K, as PNG, WebP or JPG. Sharp enough for a full-bleed hero.'],
            ['03', 'Drop it in', 'Drag the file straight into Figma, Framer, Webflow — anywhere that takes an image.'],
          ].map(([n, title, body], i) => (
            <div key={n} className="landing-reveal border-t pt-5" style={{ borderColor: T.borderDk, transitionDelay: `${i * 0.08}s` }}>
              <span className="text-[13px] font-bold" style={{ ...MONO, color: T.accent }}>{n}</span>
              <h3 className="text-[19px] font-bold mt-2 mb-2" style={GROTESK}>{title}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: T.muted }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 08 · The early word ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="08" label="The early word" />
          <h2 className="text-[30px] md:text-[42px] font-bold leading-tight mt-5 mb-12 max-w-2xl" style={GROTESK}>
            Designers and developers are<br />already putting it to work.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {/* Vlad — the long quote, so it leads */}
          <figure className="control-panel landing-reveal flex flex-col justify-between"
            style={{ padding: '34px 30px 28px', transform: 'rotate(-0.4deg)' }}>
            <div>
              <span aria-hidden className="block text-[64px] leading-none font-bold mb-2"
                style={{ ...GROTESK, color: T.accent }}>“</span>
              <blockquote className="text-[20px] md:text-[22px] font-bold leading-snug" style={GROTESK}>
                I close tools like this in about a minute. HeroKit I kept open.
                <br /><br />
                Came for one background. <span style={{ color: T.accent }}>Lost the evening to it.</span> Totally worth my time.
              </blockquote>
            </div>
            <figcaption className="flex items-center gap-3 mt-8">
              <Avatar src="/landing/vlad.jpg" alt="Vlad Arbatov" initial="V" />
              <div className="flex flex-col gap-[2px]">
                <span className="text-[13px] font-bold" style={GROTESK}>Vlad Arbatov</span>
                <a href="https://x.com/vladzima" target="_blank" rel="noreferrer"
                  className="text-[11px] underline underline-offset-2 transition-colors w-fit"
                  style={{ color: T.muted }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>@vladzima</a>
                <span className="text-[11px]" style={{ color: T.dim }}>
                  Founding Engineer, Loyal · ex-Yandex, Mapbox
                </span>
              </div>
            </figcaption>
          </figure>

          {/* Florent — a punchy one-liner */}
          <figure className="control-panel landing-reveal flex flex-col justify-between"
            style={{ padding: '34px 30px 28px', transform: 'rotate(0.3deg)', transitionDelay: '0.05s' }}>
            <div>
              <span aria-hidden className="block text-[64px] leading-none font-bold mb-2"
                style={{ ...GROTESK, color: T.accent }}>“</span>
              <blockquote className="text-[26px] md:text-[29px] font-bold leading-snug" style={GROTESK}>
                Absolute <span style={{ color: T.accent }}>banger</span> for quick edits, insane what you can do!
              </blockquote>
            </div>
            <figcaption className="flex items-center gap-3 mt-8">
              <Avatar src="/landing/florent.jpg" alt="Florent" initial="F" />
              <div className="flex flex-col gap-[2px]">
                <span className="text-[13px] font-bold" style={GROTESK}>Florent</span>
                <a href="https://x.com/HeyFlorent" target="_blank" rel="noreferrer"
                  className="text-[11px] underline underline-offset-2 transition-colors w-fit"
                  style={{ color: T.muted }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>@HeyFlorent</a>
                <span className="text-[11px]" style={{ color: T.dim }}>
                  Founder &amp; Design Director,{' '}
                  <a href="https://x.com/stunbound" target="_blank" rel="noreferrer"
                    className="underline underline-offset-2 transition-colors"
                    style={{ color: T.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>@stunbound</a> &amp;{' '}
                  <a href="https://x.com/getsuperstocks" target="_blank" rel="noreferrer"
                    className="underline underline-offset-2 transition-colors"
                    style={{ color: T.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>@getsuperstocks</a>
                </span>
              </div>
            </figcaption>
          </figure>

          {/* Wes — four words, so run them huge like a stamp */}
          <figure className="control-panel landing-reveal flex flex-col justify-between"
            style={{ padding: '34px 30px 28px', transform: 'rotate(0.5deg)', transitionDelay: '0.1s' }}>
            <div>
              <span aria-hidden className="block text-[64px] leading-none font-bold mb-2"
                style={{ ...GROTESK, color: T.accent }}>“</span>
              <blockquote className="text-[34px] md:text-[38px] font-bold leading-[1.05]" style={GROTESK}>
                Sick!<br />HeroKit<br />is <span style={{ color: T.accent }}>rad.</span>
              </blockquote>
            </div>
            <figcaption className="flex items-center gap-3 mt-8">
              <Avatar src="/landing/wes.jpg" alt="Wes Bancroft" initial="W" />
              <div className="flex flex-col gap-[2px]">
                <span className="text-[13px] font-bold" style={GROTESK}>Wes</span>
                <a href="https://x.com/WesleyBancroft" target="_blank" rel="noreferrer"
                  className="text-[11px] underline underline-offset-2 transition-colors w-fit"
                  style={{ color: T.muted }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>@WesleyBancroft</a>
                <span className="text-[11px]" style={{ color: T.dim }}>
                  Brand, Lunour.com
                </span>
              </div>
            </figcaption>
          </figure>
        </div>

      </section>

      {/* ── 09 · The maker's plate ───────────────────────────────────────── */}
      {/* Styled like the engraved nameplate on the back of a piece of
          hardware — "one person built this deliberately" as a design
          statement, not a bio essay. */}
      <section className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
        <div className="landing-reveal">
          <SectionTag number="09" label="The maker's plate" />
        </div>

        <div className="control-panel landing-reveal mt-10" style={{ padding: '34px 30px' }}>
          <div className="flex flex-col md:flex-row md:items-start gap-7 md:gap-10">
            <Avatar src="/landing/marc.jpg" alt="Marc Andrew" initial="M" size={96} />

            <div className="flex-1 max-w-2xl">
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase mb-3" style={{ ...MONO, color: T.dim }}>
                Designed &amp; built by
              </p>
              <h2 className="text-[26px] md:text-[34px] font-bold leading-tight mb-4" style={GROTESK}>
                Marc Andrew — <span style={{ color: T.accent }}>one designer,</span><br />not a growth team.
              </h2>
              <p className="text-[14.5px] leading-relaxed mb-6" style={{ color: T.muted }}>
                30+ years in design — and I started in <span style={{ color: T.text, fontWeight: 600 }}>print</span>,
                back when halftone screens and ink separations were the day job, not a filter menu.
                That's why every effect in HeroKit is built from the real technique.
                HeroKit is the tool I wanted on my own desk.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  '30+ yrs · print to product',
                  'Creator of Cabana',
                  'Solo-built · hand-tuned',
                ].map(chip => (
                  <span key={chip} className="inline-flex items-center gap-2 px-3 py-[7px] rounded-lg text-[12px] font-semibold"
                    style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      boxShadow: '0 1px 0 rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
                    }}>
                    <i className="ph-fill ph-seal-check text-sm" style={{ color: T.accent }} />
                    {chip}
                  </span>
                ))}
                <a href="https://x.com/mrcndrw" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-[7px] rounded-lg text-[12px] font-semibold transition-colors"
                  style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    boxShadow: '0 1px 0 rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
                    color: T.muted,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                  <i className="ph ph-x-logo text-sm" /> @mrcndrw
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="control-panel landing-reveal landing-float text-center"
          style={{ padding: '56px 24px 60px' }}>
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-4" style={{ ...MONO, color: T.muted }}>
            No signup · No uploads · No catch
          </p>
          <h2 className="text-[34px] md:text-[52px] font-bold leading-tight mb-8" style={GROTESK}>
            Ready when you are.
          </h2>
          <OpenCta onOpen={onOpen} />
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
            <a href="/teams"
              className="text-[11px] font-semibold transition-colors" style={{ color: T.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.dim)}>
              HeroKit for Teams
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

      {/* ── Lightbox — full-size view of a gallery image ─────────────────── */}
      {lightbox && (
        <div className="landing-lightbox fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 cursor-zoom-out"
          style={{ background: 'rgba(26,25,23,0.90)' }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Made with HeroKit — full size"
            className="max-w-full max-h-full rounded-xl object-contain"
            style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} title="Close" aria-label="Close full-size view"
            className="absolute top-5 right-5 flex items-center justify-center w-10 h-10 rounded-full transition-all"
            style={{
              background: 'rgba(242,240,235,0.92)', color: T.text,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
            <i className="ph-bold ph-x text-base" />
          </button>
        </div>
      )}

      {docsTab && <DocsPanel initialTab={docsTab} onClose={() => setDocsTab(null)} />}

    </div>
  );
};

export default LandingPage;
