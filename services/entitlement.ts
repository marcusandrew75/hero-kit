import { supabase } from './supabaseClient';

export interface Entitlement {
  plan: 'free' | 'pro';
  billingType: 'subscription' | 'lifetime' | null;
  status: string | null;
  currentPeriodEnd: string | null;
}

export const FREE_ENTITLEMENT: Entitlement = {
  plan: 'free', billingType: null, status: null, currentPeriodEnd: null,
};

// Cached separately from Supabase's own session token (which it manages
// itself under its own sb-<project-ref>-auth-token key) purely so the
// export/Looks gates read a plan instantly on load instead of flashing
// "free" for a frame while the real Supabase round-trip resolves.
const CACHE_KEY = 'herokit-entitlement-cache';

export function getCachedEntitlement(): Entitlement {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : FREE_ENTITLEMENT;
  } catch {
    return FREE_ENTITLEMENT;
  }
}

function cacheEntitlement(e: Entitlement) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(e)); } catch { /* quota — non-fatal, just skip caching */ }
}

export function clearEntitlementCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to clear */ }
}

export async function fetchEntitlement(userId: string): Promise<Entitlement> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('plan, billing_type, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    cacheEntitlement(FREE_ENTITLEMENT);
    return FREE_ENTITLEMENT;
  }
  const entitlement: Entitlement = {
    plan: data.plan === 'pro' ? 'pro' : 'free',
    billingType: data.billing_type ?? null,
    status: data.status ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
  };
  cacheEntitlement(entitlement);
  return entitlement;
}

export const isPro = (e: Entitlement): boolean => e.plan === 'pro';
