
import React from 'react';

export type PreviewLayout = 'left' | 'center' | 'right';

interface Props { layout: PreviewLayout }

const Nav = () => (
  <div className="absolute top-0 inset-x-0 flex items-center justify-between px-8 py-6 z-10">
    <div className="flex items-center gap-2.5">
      <div className="w-6 h-6 rounded-full border-[1.5px] border-white/70" />
      <span className="text-white text-sm font-semibold tracking-widest uppercase opacity-90">Brand</span>
    </div>
    <div className="flex items-center gap-8 text-white/60 text-sm font-medium">
      {['Features', 'Pricing', 'About'].map(l => (
        <span key={l}>{l}</span>
      ))}
    </div>
    <button className="px-5 py-2 rounded-full border border-white/40 text-white text-sm font-semibold tracking-wide">
      Get Started
    </button>
  </div>
);

// ── Left ──────────────────────────────────────────────────────────────────────

const LeftLayout = () => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav />
    <div className="flex-1 flex flex-col justify-center px-[8%] gap-6 max-w-[55%]">
      <p className="text-[11px] tracking-[0.22em] uppercase text-white/50 font-semibold">
        ✦ &nbsp;The Platform for Creators
      </p>
      <h1
        className="text-[clamp(2.8rem,5.5vw,5.5rem)] font-semibold text-white leading-[1.05] tracking-tight"
        style={{ textShadow: '0 4px 40px rgba(0,0,0,0.5)' }}
      >
        Design that<br />drives results.
      </h1>
      <p className="text-[clamp(0.95rem,1.2vw,1.15rem)] text-white/65 leading-relaxed max-w-sm">
        We help ambitious brands turn their ideas into high-performing digital experiences.
      </p>
      <div className="flex items-center gap-5 mt-1">
        <button className="px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm shadow-lg">
          Start Your Project
        </button>
        <button className="text-white/80 font-semibold text-sm underline underline-offset-4 decoration-white/30">
          See Our Work →
        </button>
      </div>
    </div>
  </div>
);

// ── Centre ────────────────────────────────────────────────────────────────────

const CenterLayout = () => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav />
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-6">
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase text-white/55 border border-white/20 px-4 py-1.5 rounded-full backdrop-blur-sm">
        <span className="text-white/40">✦</span> New · Product Launch
      </span>
      <h1
        className="text-[clamp(3rem,7vw,6rem)] font-semibold text-white leading-[1.04] tracking-tight max-w-4xl"
        style={{ textShadow: '0 4px 32px rgba(0,0,0,0.4)' }}
      >
        Ideas that move<br />the world forward.
      </h1>
      <p className="text-[clamp(1rem,1.4vw,1.2rem)] text-white/65 max-w-xl leading-relaxed">
        Build, ship, and scale without limits. The platform built for ambitious creators.
      </p>
      <div className="flex items-center gap-4 mt-2">
        <button className="px-7 py-3.5 rounded-full bg-white text-black font-semibold text-sm tracking-wide shadow-lg">
          Start for free
        </button>
        <button className="px-7 py-3.5 rounded-full border border-white/35 text-white font-semibold text-sm tracking-wide backdrop-blur-sm">
          See how it works
        </button>
      </div>
    </div>
  </div>
);

// ── Right ─────────────────────────────────────────────────────────────────────

const RightLayout = () => (
  <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
    <Nav />
    <div className="flex-1 flex flex-col justify-center items-end px-[8%] gap-6 ml-auto max-w-[55%] text-right">
      <p className="text-[11px] tracking-[0.22em] uppercase text-white/50 font-semibold">
        The Platform for Creators &nbsp;✦
      </p>
      <h1
        className="text-[clamp(2.8rem,5.5vw,5.5rem)] font-semibold text-white leading-[1.05] tracking-tight"
        style={{ textShadow: '0 4px 40px rgba(0,0,0,0.5)' }}
      >
        Your brand.<br />Beautifully built.
      </h1>
      <p className="text-[clamp(0.95rem,1.2vw,1.15rem)] text-white/65 leading-relaxed max-w-sm">
        Premium digital experiences for forward-thinking teams who refuse to settle.
      </p>
      <div className="flex items-center gap-5 mt-1 justify-end">
        <button className="text-white/80 font-semibold text-sm underline underline-offset-4 decoration-white/30">
          ← See Our Work
        </button>
        <button className="px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm shadow-lg">
          Get Started
        </button>
      </div>
    </div>
  </div>
);

// ── Export ────────────────────────────────────────────────────────────────────

const PreviewOverlay: React.FC<Props> = ({ layout }) => {
  if (layout === 'left')   return <LeftLayout />;
  if (layout === 'center') return <CenterLayout />;
  if (layout === 'right')  return <RightLayout />;
  return null;
};

export default PreviewOverlay;
