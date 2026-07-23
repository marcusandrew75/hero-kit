import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Entitlement } from '../services/entitlement';
import { T } from './ui/HardwareControls';

// Slide-over from the left, portaled to document.body — required, not a
// style choice: RightPanel's wrapper has `transform: translateZ(0)`
// (App.tsx), which creates a containing block that traps `position: fixed`
// descendants, same reason DocsPanel is portaled. Backdrop + click-outside-
// to-close also mirrors DocsPanel; the slide-in motion is a CSS @keyframe
// (herokit-paywall-slide-in, index.html), matching the codebase's existing
// no-animation-library convention (see the Polaroid export flourish).
//
// Stage 2 scope: auth only (Google + email). The post-sign-in plan picker
// and Stripe Checkout land in Stage 4 — the signed-in state below is a
// placeholder until then.

interface PaywallPanelProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  entitlement: Entitlement;
}

// Google's own standard multi-colour "G" mark — Phosphor (this app's icon
// font) has no brand logos, so this is a small inline SVG rather than an
// icon-font glyph.
const GoogleG: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

const PaywallPanel: React.FC<PaywallPanelProps> = ({ open, onClose, user, entitlement }) => {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!open) return null;

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // window.location.href, not .origin — .origin drops the ?app query
      // (and any #look= hash), which would land a signed-in user back on
      // the marketing page instead of the tool they started in.
      options: { redirectTo: window.location.href },
    });
    if (error) setAuthError(error.message);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setSigningIn(false);
    if (error) setAuthError(error.message);
    else setEmailSent(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full max-w-[380px] flex flex-col overflow-y-auto"
        style={{
          background: T.bg,
          borderRight: `1px solid ${T.border}`,
          animation: 'herokit-paywall-slide-in 320ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/herokit_logomark_dark.png" alt="" className="w-5 h-5 object-contain" />
            <span className="text-sm font-bold tracking-wide" style={{ color: T.text }}>HeroKit Pro</span>
          </div>
          <button onClick={onClose} title="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: T.muted }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
            <i className="ph ph-x text-base" />
          </button>
        </div>

        <div className="flex-1 flex flex-col px-6 pb-6">
          {!user ? (
            <div className="flex flex-col gap-3 mt-4">
              <p className="text-[13px] leading-relaxed mb-1" style={{ color: T.muted }}>
                Sign in to unlock high-res export and unlimited synced Looks.
              </p>

              <button onClick={handleGoogleSignIn}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: T.text, color: '#fff' }}>
                <GoogleG /> Continue with Google
              </button>

              <div className="flex items-center gap-2 my-1">
                <div className="h-px flex-1" style={{ background: T.border }} />
                <span className="text-[10px]" style={{ color: T.dim }}>or</span>
                <div className="h-px flex-1" style={{ background: T.border }} />
              </div>

              {!emailSent ? (
                <form onSubmit={handleEmailSignIn} className="flex flex-col gap-2">
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email"
                    className="w-full rounded-xl border px-3 py-2.5 text-[13px] focus:outline-none"
                    style={{ borderColor: T.border, color: T.text, background: T.surface }}
                  />
                  <button type="submit" disabled={signingIn || !email.trim()}
                    className="py-2.5 rounded-xl text-[13px] font-semibold transition-opacity disabled:opacity-50"
                    style={{ background: T.panel, color: T.text, border: `1px solid ${T.border}` }}>
                    {signingIn ? 'Sending…' : 'Continue with Email'}
                  </button>
                </form>
              ) : (
                <p className="text-[12px] leading-relaxed" style={{ color: T.muted }}>
                  Check <strong style={{ color: T.text }}>{email}</strong> for a sign-in link.
                </p>
              )}

              {authError && (
                <p className="text-[11px] font-medium leading-relaxed" style={{ color: T.accent }}>{authError}</p>
              )}

              <p className="text-[10px] leading-relaxed mt-2" style={{ color: T.dim }}>
                By continuing, you agree to HeroKit's Terms and Privacy Policy.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-4">
              <p className="text-[13px]" style={{ color: T.text }}>
                Signed in as <strong>{user.email}</strong>
              </p>
              <p className="text-[12px]" style={{ color: T.muted }}>
                Current plan: <strong style={{ color: T.text }}>{entitlement.plan === 'pro' ? 'Pro' : 'Free'}</strong>
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: T.dim }}>
                Plan picker + checkout coming next.
              </p>
              <button onClick={handleSignOut}
                className="mt-2 py-2 px-4 rounded-xl text-[12px] font-medium self-start transition-all"
                style={{ background: T.panel, color: T.muted, border: `1px solid ${T.border}` }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PaywallPanel;
