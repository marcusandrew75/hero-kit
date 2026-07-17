
import React, { useState, useEffect, useRef } from 'react';
import { BackgroundState } from '../types';
import { DEFAULT } from '../defaultState';
import { T, TabBar } from './ui/HardwareControls';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedLook {
  id: string;
  name: string;
  state: Partial<BackgroundState>;  // never includes imageUrl/videoUrl
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  state: Partial<BackgroundState>;
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Keeps only the fields that differ from DEFAULT. BackgroundState has 150+
 *  fields now (every effect's parameters); a saved Look typically changes a
 *  handful of them and leaves the rest at default, but without this every
 *  field gets stored/shared regardless. That's what was making share links
 *  (which base64-encode the whole state into the URL) so large X choked on
 *  them — this typically cuts a link by an order of magnitude. Bonus: also
 *  shrinks each look's localStorage footprint. */
const diffFromDefault = (s: Partial<BackgroundState>): Partial<BackgroundState> => {
  const out: Record<string, unknown> = {};
  (Object.keys(s) as (keyof BackgroundState)[]).forEach(key => {
    const value = s[key];
    const defaultValue = (DEFAULT as unknown as Record<string, unknown>)[key];
    // Reference/primitive equality first (cheap, covers most fields);
    // JSON comparison as a fallback for arrays/objects (layers, blurSpots,
    // effectMaskStrokes, meshColors) where reference equality never matches.
    const same = value === defaultValue || JSON.stringify(value) === JSON.stringify(defaultValue);
    if (!same) out[key] = value;
  });
  return out as Partial<BackgroundState>;
};

/** Strip large binary data before saving — keeps localStorage lean.
 *  Layer images are base64 data-URIs; leaving them in a saved Look can push a
 *  single entry to several MB, which silently exhausts the origin's storage
 *  quota after a handful of saves and blocks all further localStorage writes.
 *  Also strips imageAttribution/layer.attribution alongside their images —
 *  otherwise a photographer's name/profile URL would get baked into every
 *  saved Look, disconnected from any actual photo since the image itself is
 *  stripped here anyway. */
const stripMedia = (s: BackgroundState): Partial<BackgroundState> => {
  const { imageUrl: _i, videoUrl: _v, imageAttribution: _a, layers, ...rest } = s;
  const strippedLayers = layers?.map(({ imageUrl: _li, attribution: _la, ...l }) => l);
  return diffFromDefault({ ...rest, layers: strippedLayers });
};

const loadLooks = (): SavedLook[] => {
  try { return JSON.parse(localStorage.getItem('herokit-looks') || '[]'); } catch { return []; }
};

export const loadHistory = (): HistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem('herokit-history') || '[]'); } catch { return []; }
};

const relativeTime = (ts: number): string => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  state: BackgroundState;
  onApply: (patch: Partial<BackgroundState>) => void;
  onClose: () => void;
}

const LooksPanel: React.FC<Props> = ({ state, onApply, onClose }) => {
  const [looks,   setLooks]   = useState<SavedLook[]>(loadLooks);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [name,    setName]    = useState('');
  const [copied,  setCopied]  = useState<string | null>(null);
  const [tab,     setTab]     = useState<'looks' | 'history'>('looks');
  const [saveError, setSaveError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Refresh history when tab is opened
  useEffect(() => {
    if (tab === 'history') setHistory(loadHistory());
  }, [tab]);

  // ── Save look ──────────────────────────────────────────────────────────────
  const saveLook = () => {
    const look: SavedLook = {
      id: crypto.randomUUID(),
      name: name.trim() || `Look ${looks.length + 1}`,
      state: stripMedia(state),
      createdAt: Date.now(),
    };
    const updated = [look, ...looks];
    try {
      // Persist first — if this throws, React state below never updates, so
      // the UI won't show a "saved" Look that didn't actually make it to disk.
      localStorage.setItem('herokit-looks', JSON.stringify(updated));
      setLooks(updated);
      setName('');
      setSaveError(null);
    } catch {
      setSaveError('Storage is full — delete a few old Looks or clear History, then try again.');
    }
  };

  const deleteLook = (id: string) => {
    const updated = looks.filter(l => l.id !== id);
    setLooks(updated);
    localStorage.setItem('herokit-looks', JSON.stringify(updated));
  };

  const clearHistory = () => {
    localStorage.removeItem('herokit-history');
    setHistory([]);
    setSaveError(null);
  };

  // ── URL share ──────────────────────────────────────────────────────────────
  const copyLink = (look: SavedLook) => {
    // Re-diff defensively — Looks saved before this fix still have the full,
    // bloated state stored, so this keeps the share link compact regardless
    // of when the Look was originally saved.
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(diffFromDefault(look.state)))));
    const url = `${location.origin}${location.pathname}#look=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(look.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── Per-look JSON export ──────────────────────────────────────────────────
  const exportLook = (look: SavedLook) => {
    const payload = {
      version: '1.0',
      name: look.name,
      exportedAt: new Date().toISOString(),
      state: look.state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${look.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
  };

  const importJson = (file: File) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const patch = data.state ?? data;
        if (typeof patch === 'object') onApply(patch);
      } catch {
        alert('Could not parse this file.');
      }
    };
    r.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="control-panel rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)' }}
      >

        {/* Header — hatch mark + label, matching the sidebar section headers */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 rounded-sm" style={{
              width: 22, height: 13,
              background: 'repeating-linear-gradient(-45deg, rgba(26,25,23,0.28) 0, rgba(26,25,23,0.28) 1.5px, transparent 1.5px, transparent 5.5px)',
            }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: T.text }}>Looks &amp; History</span>
          </div>
          <button onClick={onClose} className="transition-colors" style={{ color: T.muted }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
            <i className="ph ph-x text-lg" />
          </button>
        </div>

        {/* Save + Import row */}
        <div className="px-5 py-4 border-b space-y-2.5 shrink-0" style={{ borderColor: T.border }}>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Name this Look…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveLook()}
              className="flex-1 rounded-lg px-3 text-sm outline-none border transition-colors"
              style={{ background: T.panel, borderColor: T.border, color: T.text, height: 44, boxSizing: 'border-box' }}
            />
            {/* Primary action — orange tactile CTA, same treatment as Export.
                .hw-cta's raised bottom-edge shadow (0 4px 0 …) reads as extra
                visual height beyond its actual box, so the input is set a few
                px taller than the button's real height to compensate — matching
                what the eye sees, not just what the box model measures.        */}
            <button onClick={saveLook} className="hw-cta shrink-0"
              style={{ width: 'auto', height: 40, padding: '0 18px', boxSizing: 'border-box' }}>
              Save
            </button>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <i className="ph ph-warning-circle text-sm shrink-0 mt-0.5" style={{ color: '#b91c1c' }} />
              <div className="flex-1">
                <p className="text-[11px] leading-relaxed" style={{ color: '#991b1b' }}>{saveError}</p>
                <button onClick={clearHistory} className="text-[10px] font-semibold underline underline-offset-2 mt-1" style={{ color: '#b91c1c' }}>
                  Clear History now
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => importRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed text-xs font-medium transition-all"
            style={{ borderColor: T.border, color: T.muted }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = T.text)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
          >
            <i className="ph ph-upload-simple" />
            Import Look JSON
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>

        {/* Tab bar */}
        <div className="px-5 py-3 border-b shrink-0" style={{ borderColor: T.border }}>
          <TabBar
            options={[
              { id: 'looks',   label: `Saved Looks (${looks.length})` },
              { id: 'history', label: 'History' },
            ]}
            value={tab}
            onChange={v => setTab(v as 'looks' | 'history')}
          />
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 py-2" style={{ scrollbarWidth: 'none' }}>

          {/* ── Looks ── */}
          {tab === 'looks' && (
            looks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
                <i className="ph ph-bookmark-simple text-3xl" style={{ color: T.border }} />
                <p className="text-[11px] leading-relaxed" style={{ color: T.dim }}>
                  Save your current settings as a Look to reuse or share them later.
                </p>
              </div>
            ) : (
              <div>
                {looks.map(look => (
                  <div key={look.id} className="group flex items-center gap-3 px-5 py-3.5 transition-colors border-b last:border-b-0"
                    style={{ borderColor: T.border }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.panel)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <button className="flex-1 text-left" onClick={() => { onApply(look.state); onClose(); }}>
                      <p className="text-sm font-semibold" style={{ color: T.text }}>{look.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: T.dim }}>{relativeTime(look.createdAt)}</p>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Share link — hidden for now, URLs were still too long
                          for platforms like X even after the diff-from-default
                          fix. Keeping copyLink intact for when this comes back,
                          likely backed by a real short-link service next time. */}
                      {false && (
                        <button
                          onClick={() => copyLink(look)}
                          title="Copy share link"
                          className="w-7 h-7 flex items-center justify-center rounded-lg border transition-all"
                          style={{
                            borderColor: copied === look.id ? '#16a34a' : T.border,
                            color: copied === look.id ? '#16a34a' : T.muted,
                          }}>
                          <i className={`ph ${copied === look.id ? 'ph-check' : 'ph-link-simple'} text-sm`} />
                        </button>
                      )}
                      <button
                        onClick={() => exportLook(look)}
                        title="Export this Look as JSON"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border transition-all"
                        style={{ borderColor: T.border, color: T.muted }}>
                        <i className="ph ph-download-simple text-sm" />
                      </button>
                      <button
                        onClick={() => deleteLook(look.id)}
                        title="Delete look"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border transition-all"
                        style={{ borderColor: T.border, color: T.muted }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                        <i className="ph ph-trash text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── History ── */}
          {tab === 'history' && (
            history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
                <i className="ph ph-clock-clockwise text-3xl" style={{ color: T.border }} />
                <p className="text-[11px] leading-relaxed" style={{ color: T.dim }}>
                  History auto-saves your state every few seconds. Come back here to restore any previous version.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex justify-end px-5 pb-2">
                  <button onClick={clearHistory} className="text-[10px] font-medium transition-colors" style={{ color: T.dim }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.dim)}>
                    Clear History
                  </button>
                </div>
                {history.map((entry, i) => (
                  <button
                    key={entry.id}
                    className="group w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left border-b last:border-b-0"
                    style={{ borderColor: T.border }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.panel)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { onApply(entry.state); onClose(); }}
                  >
                    <i className="ph ph-clock-clockwise text-base shrink-0" style={{ color: T.border }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: T.muted }}>
                        {i === 0 ? 'Latest snapshot' : `Snapshot ${history.length - i}`}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: T.dim }}>{relativeTime(entry.timestamp)}</p>
                    </div>
                    <i className="ph ph-arrow-counter-clockwise text-sm" style={{ color: T.border }} />
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default LooksPanel;
