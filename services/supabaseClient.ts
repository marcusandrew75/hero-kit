import { createClient } from '@supabase/supabase-js';

// Auth + entitlements only — no design state ever touches Supabase.
// BackgroundState stays purely local (localStorage/Looks/share-links), same
// as it always has; this client is exclusively for "who is signed in" and
// "what plan are they on."
const env = (import.meta as any).env; // eslint-disable-line @typescript-eslint/no-explicit-any -- same workaround RightPanel.tsx already uses for import.meta.env (no vite/client types in tsconfig's restricted `types` array)
const url = env?.VITE_SUPABASE_URL as string;
const anonKey = env?.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey);
