import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Entitlement, isPro } from '../services/entitlement';
import { T } from './ui/HardwareControls';
import { MONO, GROTESK } from './landing/shared';

// ─── Pro paywall ────────────────────────────────────────────────────────────
// A centred, multi-step modal (showcase → auth → payment → success), all kept
// inside the one modal so the flow never throws the user out to a separate
// page. Portaled to document.body — required, not a style choice: RightPanel
// sits inside a `transform: translateZ(0)` wrapper (App.tsx) that traps
// `position: fixed` descendants, same reason DocsPanel is portaled.
//
// The only step that leaves the modal is Google OAuth (a full-page redirect,
// Supabase's default). Before initiating it we drop a sessionStorage
// breadcrumb (PRO_INTENT_KEY) so that on return App reopens this modal and we
// resume straight at the payment step — matching the "OAuth pops out, then
// drops you back into checkout" feel.
//
// Payment is Stripe Embedded Checkout (ui_mode:embedded, redirect_on_completion
// :never — see api/stripe-checkout.ts): Stripe's card form renders in an iframe
// mounted into this modal, and onComplete fires client-side so we can show our
// own success state and refresh the entitlement (the webhook is the source of
// truth) without any page navigation.

export const PRO_INTENT_KEY = 'herokit-pro-intent';

const PRICE_LABEL = '$29';

type Step = 'showcase' | 'auth' | 'payment' | 'success' | 'proAlready';

interface PaywallPanelProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  entitlement: Entitlement;
  onPurchaseComplete: () => void;
  // Set by App when the modal is being reopened after an OAuth/magic-link
  // return, so we resume straight at the payment step. App owns the
  // sessionStorage breadcrumb (reads + clears it once) — the modal only
  // writes it, just before sending the user off to sign in.
  resumeCheckout: boolean;
}

// Google's own standard multi-colour "G" mark — Phosphor (this app's icon
// font) has no brand logos, so this is a small inline SVG.
const GoogleG: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: 'ph-sparkle',         title: 'New effects first', body: 'Every new effect lands in Pro first — yours before it reaches the free tier.' },
  { icon: 'ph-arrows-out',      title: '4K & 8K export',    body: 'Crisp, retina-ready heroes at up to 8K — free tops out at 1080p.' },
  { icon: 'ph-file-image',      title: 'WebP export',       body: 'Modern, high-quality format at a fraction of a PNG’s size.' },
  { icon: 'ph-bookmark-simple', title: 'Unlimited Looks',   body: 'Save as many Looks as you like — the free plan stops at three.' },
];

const PaywallPanel: React.FC<PaywallPanelProps> = ({ open, onClose, user, entitlement, onPurchaseComplete, resumeCheckout }) => {
  const [step, setStep] = useState<Step>('showcase');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const embeddedRef = useRef<{ destroy: () => void } | null>(null);
  const initedRef = useRef(false);

  // Step selection:
  //  • A Pro plan always wins — even if the entitlement resolves a moment
  //    after the modal opens (async fetch), we snap to the Pro confirmation.
  //    (Guarded so it never clobbers the just-purchased 'success' screen.)
  //  • Otherwise pick a starting step exactly once per open (initedRef) so a
  //    later entitlement/user refetch can't yank the user out of whatever step
  //    they've navigated to.
  useEffect(() => {
    if (!open) { initedRef.current = false; return; }
    if (isPro(entitlement)) {
      setStep(prev => (prev === 'success' ? prev : 'proAlready'));
      return;
    }
    if (initedRef.current) return;
    initedRef.current = true;
    setStep(resumeCheckout && user ? 'payment' : 'showcase');
    setPayError(null);
    setEmailSent(false);
    setAuthError(null);
  }, [open, entitlement, user, resumeCheckout]);

  // Mount Stripe Embedded Checkout whenever we enter the payment step.
  useEffect(() => {
    if (step !== 'payment' || !user) return;
    let cancelled = false;
    setPayError(null);
    setPayLoading(true);

    (async () => {
      try {
        const pk = (import.meta as { env?: Record<string, string> }).env?.VITE_STRIPE_PUBLISHABLE_KEY;
        if (!pk) throw new Error('Payments are not configured yet.');
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(pk);
        if (!stripe) throw new Error('Could not load Stripe.');

        const res = await fetch('/api/stripe-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, email: user.email }),
        });
        const data = await res.json();
        if (!res.ok || !data.clientSecret) throw new Error(data.error || 'Could not start checkout.');
        if (cancelled) return;

        const checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret: data.clientSecret,
          onComplete: () => { setStep('success'); onPurchaseComplete(); },
        });
        if (cancelled) { checkout.destroy(); return; }
        embeddedRef.current = checkout;
        if (checkoutMountRef.current) checkout.mount(checkoutMountRef.current);
        setPayLoading(false);
      } catch (err) {
        if (!cancelled) {
          setPayError(err instanceof Error ? err.message : 'Checkout failed.');
          setPayLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { embeddedRef.current?.destroy(); } catch { /* already gone */ }
      embeddedRef.current = null;
    };
  }, [step, user, onPurchaseComplete]);

  if (!open) return null;

  const goToCheckout = () => setStep(user ? 'payment' : 'auth');

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    // Breadcrumb so App reopens this modal at the payment step on return.
    sessionStorage.setItem(PRO_INTENT_KEY, '1');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (error) { sessionStorage.removeItem(PRO_INTENT_KEY); setAuthError(error.message); }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    // Email is a magic-link round-trip through a fresh tab, so drop the same
    // breadcrumb — on return the user lands back at the payment step.
    sessionStorage.setItem(PRO_INTENT_KEY, '1');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setSigningIn(false);
    if (error) { sessionStorage.removeItem(PRO_INTENT_KEY); setAuthError(error.message); }
    else setEmailSent(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  const showProgress = step === 'showcase' || step === 'auth' || step === 'payment';
  const progressIdx = step === 'showcase' ? 0 : step === 'auth' ? 1 : 2;

  // ── Reusable bits ──────────────────────────────────────────────────────────
  const BackButton = ({ to }: { to: Step }) => (
    <button onClick={() => setStep(to)} title="Back"
      className="w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0"
      style={{ color: T.muted, background: T.panel }}
      onMouseEnter={e => (e.currentTarget.style.color = T.text)}
      onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
      <i className="ph ph-arrow-left text-base" />
    </button>
  );

  const CloseButton = () => (
    <button onClick={onClose} title="Close"
      className="w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0"
      style={{ color: T.muted, background: T.panel }}
      onMouseEnter={e => (e.currentTarget.style.color = T.text)}
      onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
      <i className="ph ph-x text-base" />
    </button>
  );

  const LegalNote = () => (
    <p className="text-[10px] leading-relaxed text-center" style={{ color: T.dim }}>
      By continuing you agree to HeroKit's{' '}
      <a href="/terms" target="_blank" rel="noreferrer" style={{ color: T.muted, textDecoration: 'underline' }}>Terms</a>{' '}
      and{' '}
      <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: T.muted, textDecoration: 'underline' }}>Privacy Policy</a>.
    </p>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(20,18,16,0.55)', backdropFilter: 'blur(4px)', animation: 'herokit-backdrop-in 200ms ease' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[400px] max-h-[92vh] overflow-y-auto rounded-[20px] flex flex-col"
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.14)',
          animation: 'herokit-modal-pop 320ms cubic-bezier(0.22,1,0.36,1)',
          scrollbarWidth: 'none',
        }}
      >
        {/* Header — logo + progress + control */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          {step === 'auth'
            ? <BackButton to="showcase" />
            : step === 'payment'
              ? <BackButton to={user ? 'showcase' : 'auth'} />
              : <div className="flex items-center gap-2">
                  <img src="/herokit_logomark_dark.png" alt="" className="w-5 h-5 object-contain" />
                  <span className="text-[13px] font-bold tracking-wide" style={{ color: T.text }}>HeroKit</span>
                </div>}

          {showProgress && (
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-1 rounded-full transition-all duration-300"
                  style={{ width: i === progressIdx ? 18 : 6, background: i <= progressIdx ? T.accent : T.border }} />
              ))}
            </div>
          )}

          <CloseButton />
        </div>

        {/* ── Showcase ─────────────────────────────────────────────────────── */}
        {step === 'showcase' && (
          <div className="px-6 pb-6 flex flex-col">
            <div className="flex flex-col items-center text-center pt-2 pb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, #f05535 0%, #e84320 60%, #d43a1c 100%)', boxShadow: '0 6px 16px rgba(232,67,32,0.35), inset 0 1px 0 rgba(255,255,255,0.3)' }}>
                <img src="/herokit_logomark_light.png" alt="" className="w-7 h-7 object-contain"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <p className="text-[10px] font-semibold tracking-[0.22em] mb-2" style={{ ...MONO, color: T.accent }}>HEROKIT PRO</p>
              <h2 className="text-[23px] font-bold leading-tight mb-2" style={{ ...GROTESK, color: T.text }}>
                Unlock the full kit
              </h2>
              <p className="text-[13px] leading-relaxed max-w-[300px]" style={{ color: T.muted }}>
                One upgrade unlocks it all.<br />No subscription. No catch.
              </p>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              {FEATURES.map(f => (
                <div key={f.title} className="flex items-start gap-3 rounded-xl px-3.5 py-3"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: T.panel, color: T.accent }}>
                    <i className={`ph-bold ${f.icon} text-base`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold mb-0.5" style={{ color: T.text }}>{f.title}</p>
                    <p className="text-[11.5px] leading-snug" style={{ color: T.muted }}>{f.body}</p>
                  </div>
                </div>
              ))}

              {/* Support note — same white-card treatment, closing out the list */}
              <div className="flex items-start gap-3 rounded-xl px-3.5 py-3"
                style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: T.panel, color: T.accent }}>
                  <i className="ph-bold ph-hand-heart text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold mb-0.5" style={{ color: T.text }}>Support an independent maker</p>
                  <p className="text-[11.5px] leading-snug" style={{ color: T.muted }}>
                    HeroKit is built and maintained by one person. Your one-time $29 keeps it independent and funds every new effect.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center mb-4">
              <span className="text-[38px] font-bold leading-none" style={{ ...GROTESK, color: T.text }}>{PRICE_LABEL}</span>
              <span className="text-[12px] font-medium mt-1.5" style={{ color: T.dim }}>one-time · forever</span>
            </div>

            <button onClick={goToCheckout} className="hw-cta">
              <i className="ph-bold ph-lightning text-base" /> Get HeroKit Pro
            </button>

            <div className="flex items-center justify-center gap-1.5 mt-3 mb-3">
              <i className="ph-fill ph-lock-simple text-[11px]" style={{ color: T.dim }} />
              <span className="text-[10.5px]" style={{ color: T.dim }}>Secure checkout, powered by Stripe</span>
            </div>

            <LegalNote />

            {user && (
              <p className="text-[10.5px] text-center mt-4" style={{ color: T.dim }}>
                Signed in as {user.email} ·{' '}
                <button onClick={handleSignOut} className="underline underline-offset-2" style={{ color: T.muted }}>Sign out</button>
              </p>
            )}
          </div>
        )}

        {/* ── Auth ─────────────────────────────────────────────────────────── */}
        {step === 'auth' && (
          <div className="px-6 pb-6 flex flex-col">
            <div className="flex flex-col items-center text-center pt-2 pb-6">
              <h2 className="text-[21px] font-bold leading-tight mb-2" style={{ ...GROTESK, color: T.text }}>Get started</h2>
              <p className="text-[13px] leading-relaxed max-w-[280px]" style={{ color: T.muted }}>
                Create your account or sign in — it takes a moment, then you're straight to checkout.
              </p>
            </div>

            <button onClick={handleGoogleSignIn}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: T.text, color: '#fff' }}>
              <GoogleG /> Continue with Google
            </button>

            <div className="flex items-center gap-2 my-3">
              <div className="h-px flex-1" style={{ background: T.border }} />
              <span className="text-[10px]" style={{ color: T.dim }}>or</span>
              <div className="h-px flex-1" style={{ background: T.border }} />
            </div>

            {!emailSent ? (
              <form onSubmit={handleEmailSignIn} className="flex flex-col gap-2">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  className="w-full rounded-xl border px-3.5 py-3 text-[13px] focus:outline-none"
                  style={{ borderColor: T.border, color: T.text, background: T.surface }}
                />
                <button type="submit" disabled={signingIn || !email.trim()}
                  className="py-3 rounded-xl text-[13px] font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: T.panel, color: T.text, border: `1px solid ${T.border}` }}>
                  {signingIn ? 'Sending…' : 'Continue with Email'}
                </button>
              </form>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <i className="ph-fill ph-envelope-simple text-base shrink-0 mt-0.5" style={{ color: T.accent }} />
                <p className="text-[12px] leading-relaxed" style={{ color: T.muted }}>
                  Check <strong style={{ color: T.text }}>{email}</strong> for a sign-in link. Open it and you'll land back here at checkout.
                </p>
              </div>
            )}

            {authError && (
              <p className="text-[11px] font-medium leading-relaxed mt-3" style={{ color: T.accent }}>{authError}</p>
            )}

            <div className="mt-5"><LegalNote /></div>
          </div>
        )}

        {/* ── Payment (embedded Stripe) ────────────────────────────────────── */}
        {step === 'payment' && (
          <div className="px-6 pb-6 flex flex-col">
            <div className="flex flex-col items-center text-center pt-1 pb-4">
              <h2 className="text-[19px] font-bold leading-tight mb-1" style={{ ...GROTESK, color: T.text }}>Complete your purchase</h2>
              <p className="text-[12px]" style={{ color: T.muted }}>HeroKit Pro · <strong style={{ color: T.text }}>{PRICE_LABEL}</strong> one-time</p>
            </div>

            {payError ? (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(232,67,32,0.1)' }}>
                  <i className="ph-bold ph-warning text-lg" style={{ color: T.accent }} />
                </div>
                <p className="text-[12.5px] leading-relaxed max-w-[280px]" style={{ color: T.muted }}>{payError}</p>
                <button onClick={() => setStep('payment')}
                  className="mt-1 py-2 px-4 rounded-lg text-[12px] font-semibold" style={{ background: T.panel, color: T.text, border: `1px solid ${T.border}` }}>
                  Try again
                </button>
              </div>
            ) : (
              <>
                {payLoading && (
                  <div className="flex items-center justify-center gap-2 py-10" style={{ color: T.muted }}>
                    <i className="ph ph-spinner animate-spin text-lg" />
                    <span className="text-[12px]">Loading secure checkout…</span>
                  </div>
                )}
                {/* Stripe Embedded Checkout mounts here */}
                <div ref={checkoutMountRef} />
              </>
            )}
          </div>
        )}

        {/* ── Success ──────────────────────────────────────────────────────── */}
        {step === 'success' && (
          <div className="px-6 pb-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mt-4 mb-5"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, #f05535 0%, #e84320 60%, #d43a1c 100%)', boxShadow: '0 8px 20px rgba(232,67,32,0.4)' }}>
              <i className="ph-bold ph-check text-2xl" style={{ color: '#fff' }} />
            </div>
            <h2 className="text-[22px] font-bold leading-tight mb-2" style={{ ...GROTESK, color: T.text }}>You're on HeroKit Pro</h2>
            <p className="text-[13px] leading-relaxed max-w-[300px] mb-6" style={{ color: T.muted }}>
              High-res &amp; WebP export plus unlimited Looks are unlocked. Thanks for the support — go make something great.
            </p>
            <button onClick={onClose} className="hw-cta"><i className="ph-bold ph-lightning text-base" /> Start creating</button>
          </div>
        )}

        {/* ── Already Pro ──────────────────────────────────────────────────── */}
        {step === 'proAlready' && (
          <div className="px-6 pb-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mt-4 mb-5"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, #f05535 0%, #e84320 60%, #d43a1c 100%)', boxShadow: '0 8px 20px rgba(232,67,32,0.4)' }}>
              <i className="ph-bold ph-seal-check text-2xl" style={{ color: '#fff' }} />
            </div>
            <h2 className="text-[22px] font-bold leading-tight mb-2" style={{ ...GROTESK, color: T.text }}>You're on HeroKit Pro</h2>
            <p className="text-[13px] leading-relaxed max-w-[300px] mb-1" style={{ color: T.muted }}>
              Everything's unlocked — 2×/4× &amp; WebP export and unlimited Looks.
            </p>
            {user && <p className="text-[11px] mb-6" style={{ color: T.dim }}>Signed in as {user.email}</p>}
            <button onClick={onClose} className="hw-cta"><i className="ph-bold ph-lightning text-base" /> Back to HeroKit</button>
            {user && (
              <button onClick={handleSignOut} className="mt-3 text-[11px] underline underline-offset-2" style={{ color: T.muted }}>
                Sign out
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default PaywallPanel;
