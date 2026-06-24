
import React, { useState, useEffect, useRef } from 'react';
import { BackgroundState } from '../types';

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

/** Strip large binary data before saving — keeps localStorage lean */
const stripMedia = (s: BackgroundState): Partial<BackgroundState> => {
  const { imageUrl: _i, videoUrl: _v, ...rest } = s;
  return rest;
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
    setLooks(updated);
    localStorage.setItem('herokit-looks', JSON.stringify(updated));
    setName('');
  };

  const deleteLook = (id: string) => {
    const updated = looks.filter(l => l.id !== id);
    setLooks(updated);
    localStorage.setItem('herokit-looks', JSON.stringify(updated));
  };

  // ── URL share ──────────────────────────────────────────────────────────────
  const copyLink = (look: SavedLook) => {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(look.state))));
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#161616] border border-[#252525] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] shrink-0">
          <div className="flex items-center gap-3">
            <i className="ph ph-bookmark-simple text-white text-lg" />
            <span className="text-sm font-semibold text-white">Looks</span>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <i className="ph ph-x text-lg" />
          </button>
        </div>

        {/* Save + Export row */}
        <div className="px-5 py-4 border-b border-[#1e1e1e] space-y-3 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name this Look…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveLook()}
              className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] outline-none focus:border-[#444] transition-colors"
            />
            <button
              onClick={saveLook}
              className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            >
              Save
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => importRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-all"
            >
              <i className="ph ph-upload-simple" />
              Import Look JSON
            </button>
            <input ref={importRef} type="file" accept=".json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#1e1e1e] shrink-0">
          {(['looks', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-all ${
                tab === t ? 'text-white border-b border-white' : 'text-[#555] hover:text-[#888]'
              }`}
            >
              {t === 'looks' ? `Saved Looks (${looks.length})` : 'History'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 py-2" style={{ scrollbarWidth: 'none' }}>

          {/* ── Looks ── */}
          {tab === 'looks' && (
            looks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
                <i className="ph ph-bookmark-simple text-3xl text-[#333]" />
                <p className="text-[11px] text-[#444] leading-relaxed">
                  Save your current settings as a Look to reuse or share them later.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1e1e1e]">
                {looks.map(look => (
                  <div key={look.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <button
                      className="flex-1 text-left"
                      onClick={() => { onApply(look.state); onClose(); }}
                    >
                      <p className="text-sm text-white font-medium group-hover:text-white/90">{look.name}</p>
                      <p className="text-[10px] text-[#444] mt-0.5">{relativeTime(look.createdAt)}</p>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyLink(look)}
                        title="Copy share link"
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                          copied === look.id
                            ? 'border-green-500/50 text-green-400'
                            : 'border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-white'
                        }`}
                      >
                        <i className={`ph ${copied === look.id ? 'ph-check' : 'ph-link-simple'} text-sm`} />
                      </button>
                      <button
                        onClick={() => exportLook(look)}
                        title="Export this Look as JSON"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-white transition-all"
                      >
                        <i className="ph ph-download-simple text-sm" />
                      </button>
                      <button
                        onClick={() => deleteLook(look.id)}
                        title="Delete look"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#555] hover:border-red-500/40 hover:text-red-400 transition-all"
                      >
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
                <i className="ph ph-clock-clockwise text-3xl text-[#333]" />
                <p className="text-[11px] text-[#444] leading-relaxed">
                  History auto-saves your state every few seconds. Come back here to restore any previous version.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1e1e1e]">
                {history.map((entry, i) => (
                  <button
                    key={entry.id}
                    className="group w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
                    onClick={() => { onApply(entry.state); onClose(); }}
                  >
                    <i className="ph ph-clock-clockwise text-[#444] group-hover:text-[#888] text-base shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-[#888] group-hover:text-white transition-colors">
                        {i === 0 ? 'Latest snapshot' : `Snapshot ${history.length - i}`}
                      </p>
                      <p className="text-[10px] text-[#444] mt-0.5">{relativeTime(entry.timestamp)}</p>
                    </div>
                    <i className="ph ph-arrow-counter-clockwise text-[#333] group-hover:text-[#666] text-sm" />
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
