
import React, { useEffect, useRef, useState } from 'react';
import { T } from './ui/HardwareControls';

// Handle bar (~30px) + RightPanel's own header row (logo lockup + Reset/
// Looks/Info, px-5 pt-4 pb-7 ≈ 76px) — needs to actually clear that header,
// not just approximate it, or the "ヒーロー" subtitle and icon row get
// clipped mid-way (confirmed on a real device at the previous, shorter value).
export const PEEK_HEIGHT = 112;
const EXPANDED_VH = 0.86;  // leaves a sliver of canvas visible at the top
const TAP_THRESHOLD = 6;   // px of movement below which a gesture counts as a tap, not a drag

interface Props {
  state: 'peek' | 'expanded';
  onStateChange: (s: 'peek' | 'expanded') => void;
  children: React.ReactNode;
}

// Generic peek/expanded drag sheet — the mobile stand-in for the desktop
// sidebar. Rendered as a fixed overlay over a full-bleed canvas (not a
// reflow like the sidebar's own width animation) since a sheet is expected
// to float over content, the same way it does in any maps-style app.
//
// Drag is bound only to the handle, never the body, so it never fights the
// scrollable content underneath (RightPanel keeps managing its own scroll).
// A short, mostly-stationary gesture is treated as a tap (toggles state);
// anything past TAP_THRESHOLD of movement is treated as a real drag and
// snaps to whichever of the two known positions is closer on release —
// live position-based snapping, not velocity/momentum physics (that's a
// later polish pass, not needed for this to feel like a real sheet).
const BottomSheet: React.FC<Props> = ({ state, onStateChange, children }) => {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragRef = useRef<{ startClientY: number; startOffset: number; moved: boolean } | null>(null);

  // iOS Safari's address bar can collapse/expand as the sheet's content
  // scrolls, changing the true visible height mid-session — window.innerHeight
  // read once per render can go stale, so this tracks visualViewport (the
  // most accurate signal iOS exposes) with a plain resize fallback, and
  // recomputes reactively rather than only whenever some other state change
  // happens to trigger a re-render.
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 600);
  useEffect(() => {
    const update = () => setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
    update();
    const vv = window.visualViewport;
    (vv ?? window).addEventListener('resize', update);
    return () => (vv ?? window).removeEventListener('resize', update);
  }, []);

  const expandedHeight = viewportHeight * EXPANDED_VH;
  const travel = Math.max(0, expandedHeight - PEEK_HEIGHT);
  const restOffset = state === 'expanded' ? 0 : travel;

  const clamp = (v: number) => Math.min(travel, Math.max(0, v));

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startClientY: e.clientY, startOffset: dragOffset ?? restOffset, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = e.clientY - drag.startClientY;
    if (Math.abs(delta) > TAP_THRESHOLD) drag.moved = true;
    setDragOffset(clamp(drag.startOffset + delta));
  };

  const handlePointerEnd = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (!drag.moved) {
      // Tap on the handle — toggle, ignoring whatever negligible offset accrued.
      setDragOffset(null);
      onStateChange(state === 'expanded' ? 'peek' : 'expanded');
      return;
    }
    const current = dragOffset ?? drag.startOffset;
    setDragOffset(null);
    onStateChange(current < travel * 0.5 ? 'expanded' : 'peek');
  };

  const translateY = dragOffset ?? restOffset;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[150] flex flex-col rounded-t-2xl overflow-hidden"
      style={{
        height: expandedHeight,
        transform: `translateY(${translateY}px)`,
        transition: dragRef.current ? 'none' : 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
        background: T.bg,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.2), 0 -1px 0 rgba(0,0,0,0.06)',
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="shrink-0 flex items-center justify-center py-3 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div className="w-10 h-1.5 rounded-full" style={{ background: T.borderDk }} />
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
