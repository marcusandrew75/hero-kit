import React, { useEffect, useRef } from 'react';
import { T } from './ui/HardwareControls';
import { MONO, GROTESK } from './landing/shared';

// ─── Privacy Policy ─────────────────────────────────────────────────────────
// Plain-language, written to accurately describe what HeroKit actually does
// today (client-side effects pipeline, Pexels/Unsplash proxy search, local-
// only Looks/History, Supabase auth) plus the Pro tier being built (Stripe
// billing, synced Looks) — not generic boilerplate. Not a substitute for
// real legal review once this is actually load-bearing.

const TITLE = 'Privacy Policy — HeroKit';
const LAST_UPDATED = '22 July 2026';

const Section: React.FC<{ heading: string; children: React.ReactNode }> = ({ heading, children }) => (
  <section className="mb-8">
    <h2 className="text-[17px] font-bold mb-2.5" style={{ ...GROTESK, color: T.text }}>{heading}</h2>
    <div className="text-[13.5px] leading-relaxed flex flex-col gap-2.5" style={{ color: T.muted }}>
      {children}
    </div>
  </section>
);

const PrivacyPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = TITLE;
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen" style={{ background: T.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <a href="/?app" className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-10 hover:opacity-70 transition-opacity"
          style={{ color: T.muted, textDecoration: 'none' }}>
          <i className="ph ph-arrow-left text-sm" /> Back to HeroKit
        </a>

        <div className="flex items-center gap-2 mb-2">
          <img src="/herokit_logomark_dark.png" alt="" className="w-5 h-5 object-contain" />
          <span className="text-sm font-bold" style={{ ...GROTESK, color: T.text }}>HeroKit</span>
        </div>
        <h1 className="text-[28px] font-bold mb-1.5" style={{ ...GROTESK, color: T.text }}>Privacy Policy</h1>
        <p className="text-[11px] mb-10" style={{ ...MONO, color: T.dim }}>Last updated {LAST_UPDATED}</p>

        <Section heading="The short version">
          <p>
            HeroKit's core tool runs entirely in your browser — the photo you upload and every effect you apply never
            leaves your device. We don't require an account to use it. Signing in is only needed to unlock Pro features
            (higher-resolution export, Looks synced across your devices), and at that point we store the minimum needed
            to run that: your email, your plan status, and — if you subscribe — billing details handled by Stripe, not us.
          </p>
        </Section>

        <Section heading="What stays on your device">
          <p>
            Your uploaded photos, the effects and settings you apply, your Layers, and your Looks and edit history are
            stored in your browser's local storage. None of this is uploaded to or processed on our servers unless you
            explicitly search a photo gallery (below) or sign in for Pro. If you clear your browser data, this
            information is gone — we don't have a copy.
          </p>
        </Section>

        <Section heading="Photo search (Pexels &amp; Unsplash)">
          <p>
            Searching the built-in Gallery sends your search text to Pexels and/or Unsplash through our own server, so
            our API credentials never reach your browser. We don't attach your identity to these searches. Downloading
            an Unsplash photo also triggers Unsplash's own required download tracking, per their API terms — that's
            between your request and Unsplash, not something we separately log.
          </p>
        </Section>

        <Section heading="Signing in and Pro accounts">
          <p>
            Signing in is handled by Supabase, our authentication provider, via Google sign-in or an emailed sign-in
            link. We store your email address, your account identifier, and — once billing is live — your plan status
            and Stripe customer/subscription identifiers, so we know what you're entitled to. We do not see or store
            your card details; those are handled entirely by Stripe.
          </p>
          <p>
            If you're on the free plan, none of your design work is required to be sent to us. If you upgrade, your
            saved Looks may be synced to our database so they follow you across devices — that's the entire purpose
            of that sync, and it's limited to the Look data itself (your effect settings), not your source photos.
          </p>
        </Section>

        <Section heading="Analytics">
          <p>
            We use Vercel Analytics for aggregate, anonymized usage data (which pages get used, roughly how much
            traffic we get) — it's not designed to track you individually across sites and doesn't use the kind of
            invasive tracking cookies that ad networks do.
          </p>
        </Section>

        <Section heading="Third parties this involves">
          <p>
            Pexels and Unsplash (photo search), Supabase (authentication and our database), Stripe (payment
            processing), Vercel (hosting and analytics), and — if you use it — Replicate (AI image generation, when
            that feature is enabled). Each has its own privacy policy governing what they do with data passed to
            them; we only send what's needed for the feature you're actively using.
          </p>
        </Section>

        <Section heading="Your rights">
          <p>
            You can ask us to tell you what we hold on you, correct it, or delete your account and associated data —
            email <a href="mailto:privacy@herokit.app" style={{ color: T.text }}>privacy@herokit.app</a> and we'll
            action it. If you're in the UK, EU, or California, you have specific statutory rights over your personal
            data under GDPR/UK GDPR or the CCPA respectively — the request process is the same either way.
          </p>
        </Section>

        <Section heading="Changes to this policy">
          <p>
            If what we collect changes materially (e.g. a new feature that sends more data somewhere new), we'll
            update this page and the "last updated" date above. We don't send an email for every wording tweak, but
            we won't quietly expand what we collect without updating this.
          </p>
        </Section>

        <Section heading="Contact">
          <p>
            Questions about any of this: <a href="mailto:privacy@herokit.app" style={{ color: T.text }}>privacy@herokit.app</a>.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default PrivacyPage;
