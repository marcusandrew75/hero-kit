import React, { useEffect, useRef } from 'react';
import { T } from './ui/HardwareControls';
import { MONO, GROTESK } from './landing/shared';

// ─── Terms of Service ───────────────────────────────────────────────────────
// Same approach as PrivacyPage — plain language, describes what HeroKit
// actually does, not generic boilerplate. Not a substitute for real legal
// review once this is actually load-bearing.

const TITLE = 'Terms of Service — HeroKit';
const LAST_UPDATED = '22 July 2026';

const Section: React.FC<{ heading: string; children: React.ReactNode }> = ({ heading, children }) => (
  <section className="mb-8">
    <h2 className="text-[17px] font-bold mb-2.5" style={{ ...GROTESK, color: T.text }}>{heading}</h2>
    <div className="text-[13.5px] leading-relaxed flex flex-col gap-2.5" style={{ color: T.muted }}>
      {children}
    </div>
  </section>
);

const TermsPage: React.FC = () => {
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
        <h1 className="text-[28px] font-bold mb-1.5" style={{ ...GROTESK, color: T.text }}>Terms of Service</h1>
        <p className="text-[11px] mb-10" style={{ ...MONO, color: T.dim }}>Last updated {LAST_UPDATED}</p>

        <Section heading="Using HeroKit">
          <p>
            HeroKit is a browser-based tool for generating and stylizing hero background images. The core tool — every
            effect, layers, export at standard resolution — is free to use, with no account required. By using it, you
            agree to these terms.
          </p>
        </Section>

        <Section heading="Your content">
          <p>
            You keep all rights to the photos you upload and the images you export from HeroKit. We don't claim any
            ownership over your work, and — for the free tool — we generally never see it at all, since processing
            happens in your browser. You're responsible for having the rights to any photo you upload or export,
            including photos sourced through the built-in Pexels/Unsplash search, which carry those services' own
            licensing terms.
          </p>
        </Section>

        <Section heading="Pro accounts and billing">
          <p>
            Pro unlocks higher-resolution export and Looks synced across your devices, via a monthly subscription,
            annual subscription, or one-time lifetime purchase, processed by Stripe. Subscriptions renew automatically
            until cancelled; you can cancel any time and retain access through the end of the period you've already
            paid for. Lifetime purchases are a one-time payment with no recurring charge and no expiry.
          </p>
          <p>
            Refunds are handled case-by-case — email <a href="mailto:support@herokit.app" style={{ color: T.text }}>support@herokit.app</a> if
            something's gone wrong with a payment.
          </p>
        </Section>

        <Section heading="Acceptable use">
          <p>
            Don't use HeroKit to generate or distribute content that's illegal, infringing, or intended to deceive or
            harm others. Don't attempt to abuse, scrape, or overload the service, or circumvent any plan limits by
            technical means. We reserve the right to suspend accounts that do.
          </p>
        </Section>

        <Section heading="No warranty">
          <p>
            HeroKit is provided as-is. We work to keep it reliable, but we don't guarantee it'll be error-free,
            available every moment, or fit for any particular purpose beyond what it plainly does. Effects, export
            quality, and third-party services (Pexels, Unsplash, Stripe, Replicate) may change or become unavailable
            without notice from us, since we don't control them.
          </p>
        </Section>

        <Section heading="Limitation of liability">
          <p>
            To the extent permitted by law, HeroKit isn't liable for indirect, incidental, or consequential damages
            arising from your use of the tool. Our total liability for any claim is limited to the amount you've paid
            us in the twelve months before the claim, if any.
          </p>
        </Section>

        <Section heading="Changes">
          <p>
            We may update these terms as the product changes — the "last updated" date above will reflect that. Continued
            use after a change means you accept the update.
          </p>
        </Section>

        <Section heading="Contact">
          <p>
            Questions: <a href="mailto:support@herokit.app" style={{ color: T.text }}>support@herokit.app</a>. See also
            our <a href="/privacy" style={{ color: T.text }}>Privacy Policy</a>.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default TermsPage;
