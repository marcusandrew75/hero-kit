// ─── Pro early access ───────────────────────────────────────────────────────
// New effects launch Pro-only, then graduate to free for everyone on the
// listed date. To ship a new effect this way: add its dice.ts id here with a
// graduation date. To make an effect free immediately, delete its entry (or
// just let the date pass — nothing else needs to change).
export const EARLY_ACCESS: Record<string, string> = {
  sumie: '2026-08-15',
  newspaper: '2026-08-15',
};

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
