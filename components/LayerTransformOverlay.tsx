
import React, { useEffect, useRef, useState } from 'react';
import { ImageLayer } from '../types';

interface Props {
  layer: ImageLayer;
  onChange: (patch: Partial<ImageLayer>) => void;
  onDone: () => void;
}

const MIN_SIZE = 0.08; // relative — smallest a box can be dragged/resized to

type Box = { x: number; y: number; width: number; height: number };

// Direct-manipulation overlay for positioning/resizing a layer on the live
// canvas — drag anywhere in the box to move, drag the bottom-right handle to
// resize (locked to the layer's own aspect ratio). Local state drives the
// visible box during a drag; onChange (which triggers a full effects-pipeline
// re-run via App state) only fires once, on pointerup — dragging never
// touches app state mid-gesture, the same trap EffectMaskPad already routes
// around for the same reason (re-running ~40 effects per pointermove pixel
// would be unusable).
const LayerTransformOverlay: React.FC<Props> = ({ layer, onChange, onDone }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({
    x: layer.x ?? 0, y: layer.y ?? 0,
    width: layer.width ?? 1, height: layer.height ?? 1,
  });
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; origin: Box } | null>(null);
  const boxRef = useRef(box);
  boxRef.current = box;

  // Re-sync if the caller switches which layer is being edited
  useEffect(() => {
    setBox({ x: layer.x ?? 0, y: layer.y ?? 0, width: layer.width ?? 1, height: layer.height ?? 1 });
  }, [layer.id]);

  const aspect = layer.naturalAspect ?? 1;

  const commit = () => onChange(boxRef.current);

  const handleMoveDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode: 'move', startX: e.clientX, startY: e.clientY, origin: boxRef.current };
  };

  const handleResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode: 'resize', startX: e.clientX, startY: e.clientY, origin: boxRef.current };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;

    if (drag.mode === 'move') {
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      const { width, height } = drag.origin;
      setBox({
        width, height,
        x: Math.max(0, Math.min(1 - width, drag.origin.x + dx)),
        y: Math.max(0, Math.min(1 - height, drag.origin.y + dy)),
      });
    } else {
      // Resize in pixel space (the drag itself is a screen-pixel gesture),
      // then convert back to relative once clamped.
      const dxPx = e.clientX - drag.startX;
      const { x, y } = drag.origin;
      const xPx = x * rect.width, yPx = y * rect.height;
      const minWPx = MIN_SIZE * rect.width;

      let newWPx = Math.max(minWPx, drag.origin.width * rect.width + dxPx);
      newWPx = Math.min(newWPx, rect.width - xPx);
      let newHPx = newWPx / aspect;
      if (yPx + newHPx > rect.height) {
        newHPx = rect.height - yPx;
        newWPx = newHPx * aspect;
      }
      setBox({ x, y, width: newWPx / rect.width, height: newHPx / rect.height });
    }
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    commit();
  };

  // Escape exits edit mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-[105] cursor-default"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={e => { if (e.target === e.currentTarget) onDone(); }}
    >
      {/* Done chip */}
      <button
        onClick={e => { e.stopPropagation(); onDone(); }}
        className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
        style={{ background: 'rgba(26,25,23,0.85)', color: '#f2f0eb', backdropFilter: 'blur(4px)' }}
      >
        <i className="ph ph-check text-sm" /> Done positioning
      </button>

      {/* Bounding box */}
      <div
        onPointerDown={handleMoveDown}
        className="absolute cursor-move"
        style={{
          left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: `${box.width * 100}%`, height: `${box.height * 100}%`,
          border: '1.5px dashed rgba(232,67,32,0.9)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.4)',
          background: 'rgba(232,67,32,0.06)',
        }}
      >
        {/* Resize handle — bottom-right, locked to the layer's natural aspect */}
        <div
          onPointerDown={handleResizeDown}
          className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full cursor-nwse-resize"
          style={{
            background: '#e84320',
            border: '2px solid #f2f0eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        />
      </div>
    </div>
  );
};

export default LayerTransformOverlay;
