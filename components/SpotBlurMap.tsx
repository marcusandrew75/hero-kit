
import React, { useRef, useState, useCallback } from 'react';
import { BlurSpot } from '../types';

interface Props {
  spots: BlurSpot[];
  onChange: (spots: BlurSpot[]) => void;
}

const MAX_SPOTS = 4;

const SpotBlurMap: React.FC<Props> = ({ spots, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [dragging, setDragging]   = useState<string | null>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  // Convert pointer event to relative 0-1 coords
  const toRel = (e: React.PointerEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left)  / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't add if clicking on a dot
    if ((e.target as Element).closest('[data-spot]')) return;
    if (spots.length >= MAX_SPOTS) return;
    const r = containerRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left)  / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const newSpot: BlurSpot = { id: crypto.randomUUID(), x, y, radius: 0.25 };
    onChange([...spots, newSpot]);
    setSelected(newSpot.id);
  };

  const handleDotPointerDown = (e: React.PointerEvent, spot: BlurSpot) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(spot.id);
    setDragging(spot.id);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: spot.x, oy: spot.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return;
    const r = containerRef.current!.getBoundingClientRect();
    const dx = (e.clientX - dragStart.current.mx) / r.width;
    const dy = (e.clientY - dragStart.current.my) / r.height;
    onChange(spots.map(s => s.id === dragging
      ? { ...s, x: Math.max(0, Math.min(1, dragStart.current!.ox + dx)), y: Math.max(0, Math.min(1, dragStart.current!.oy + dy)) }
      : s
    ));
  };

  const handlePointerUp = () => { setDragging(null); dragStart.current = null; };

  const deleteSelected = () => {
    if (!selected) return;
    onChange(spots.filter(s => s.id !== selected));
    setSelected(null);
  };

  const selectedSpot = spots.find(s => s.id === selected);

  return (
    <div className="space-y-2">
      {/* Mini map */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden cursor-crosshair select-none"
        style={{ height: 160, background: '#111', backgroundImage: 'radial-gradient(#2a2a2a 1px, transparent 1px)', backgroundSize: '16px 16px' }}
        onClick={handleContainerClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {spots.map(spot => {
          const isSelected = spot.id === selected;
          const pxLeft = `${spot.x * 100}%`;
          const pxTop  = `${spot.y * 100}%`;
          const glowSize = `${spot.radius * 100}%`;

          return (
            <React.Fragment key={spot.id}>
              {/* Soft glow showing radius */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: pxLeft, top: pxTop,
                  width: glowSize, height: glowSize,
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
                }}
              />
              {/* Drag handle */}
              <div
                data-spot
                onPointerDown={e => handleDotPointerDown(e, spot)}
                className={`absolute w-5 h-5 rounded-full border-2 transition-all cursor-move ${
                  isSelected ? 'border-white bg-white/30 scale-110' : 'border-white/60 bg-white/10'
                }`}
                style={{ left: pxLeft, top: pxTop, transform: 'translate(-50%, -50%)' }}
              />
            </React.Fragment>
          );
        })}

        {/* Count + hint */}
        <div className="absolute top-2 right-2 text-[10px] text-white/30 font-mono">{spots.length} / {MAX_SPOTS}</div>
        {spots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[11px] text-white/25 text-center leading-relaxed">
              Tap to add a focus point<br />Drag dots to reposition
            </p>
          </div>
        )}
      </div>

      {/* Controls for selected spot */}
      {selectedSpot && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] text-[#666] shrink-0">Size</span>
          <input
            type="range" min={0.05} max={0.6} step={0.01}
            value={selectedSpot.radius}
            onChange={e => onChange(spots.map(s => s.id === selected ? { ...s, radius: parseFloat(e.target.value) } : s))}
            className="heroken-slider flex-1"
          />
          <button
            onClick={deleteSelected}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-[#3a3a3a] text-[#666] hover:border-red-500/50 hover:text-red-400 transition-all"
            title="Remove spot"
          >
            <i className="ph ph-trash text-sm" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SpotBlurMap;
