// ─── Pro early access ───────────────────────────────────────────────────────
// Effect gating retired 27 Jul 2026 — all effects are free for everyone, no
// exceptions. This map and the three enforcement points it feeds (RightPanel's
// locked badge, dice.ts's pool filter, Canvas.tsx's render backstop) are left
// in place, dormant, in case a future launch wants the same early-access
// pattern again. To gate an effect: add its dice.ts id here with a graduation
// date. To make an effect free immediately, delete its entry (or let the date
// pass) — nothing else needs to change.
export const EARLY_ACCESS: Record<string, string> = {};

export function isEarlyAccessLocked(effectId: string, pro: boolean): boolean {
  if (pro) return false;
  const graduates = EARLY_ACCESS[effectId];
  if (!graduates) return false;
  return Date.now() < new Date(graduates).getTime();
}

/** All effect ids currently locked for this user — passed to Canvas (render-
 *  level backstop) and to dice.ts (keeps the roll from picking a locked look). */
export function lockedEffectIds(pro: boolean): string[] {
  if (pro) return [];
  return Object.keys(EARLY_ACCESS).filter(id => isEarlyAccessLocked(id, pro));
}
