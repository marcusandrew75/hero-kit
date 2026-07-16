
import React, { useEffect, useRef, useState } from 'react';
import { ImageLayer } from '../types';

interface Props {
  layer: ImageLayer;
  onChange: (patch: Partial<ImageLayer>) => void;
  onDone: () => void;
}

const MIN_SIZE = 0.08; // relative — smallest a box can be dragged/resized to
const ROTATE_HANDLE_OFFSET = 30; // px, box top edge → rotate handle center

type Box = { x: number; y: number; width: number; height: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';

// Opposite corner stays fixed (the "anchor") while the dragged corner moves.
const OPPOSITE: Record<Corner, Corner> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };
// +1 if dragging this corner rightward/downward grows the box, -1 if the
// opposite (dragging it leftward/upward grows it instead).
const GROW_SIGN: Record<Corner, 1 | -1> = { br: 1, tl: -1, tr: 1, bl: -1 };

const anchorPointPx = (anchor: Corner, origin: Box, rect: { width: number; height: number }) => {
  const left = origin.x * rect.width, top = origin.y * rect.height;
  const right = (origin.x + origin.width) * rect.width, bottom = (origin.y + origin.height) * rect.height;
  switch (anchor) {
    case 'tl': return { x: left, y: top };
    case 'tr': return { x: right, y: top };
    case 'bl': return { x: left, y: bottom };
    case 'br': return { x: right, y: bottom };
  }
};

// Generalizes the original bottom-right-only resize to any corner: the
// opposite corner is the fixed anchor, width grows/shrinks along the drag
// axis (locked to `aspect`), and is capped so the free corner never crosses
// the container's edges — same clamping the br-only version already did.
const resizeFromCorner = (corner: Corner, origin: Box, dxLocal: number, rect: { width: number; height: number }, aspect: number): Box => {
  const anchor = OPPOSITE[corner];
  const a = anchorPointPx(anchor, origin, rect);
  const minWPx = MIN_SIZE * rect.width;

  let newWPx = Math.max(minWPx, origin.width * rect.width + GROW_SIGN[corner] * dxLocal);

  const capHorizontal = (anchor === 'tl' || anchor === 'bl') ? rect.width - a.x : a.x;
  const capVerticalPx = (anchor === 'tl' || anchor === 'tr') ? rect.height - a.y : a.y;
  newWPx = Math.max(minWPx, Math.min(newWPx, capHorizontal, capVerticalPx * aspect));

  const newHPx = newWPx / aspect;
  const x = (anchor === 'tl' || anchor === 'bl') ? a.x : a.x - newWPx;
  const y = (anchor === 'tl' || anchor === 'tr') ? a.y : a.y - newHPx;

  return { x: x / rect.width, y: y / rect.height, width: newWPx / rect.width, height: newHPx / rect.height };
};

// Direct-manipulation overlay for positioning/resizing/rotating a layer on
// the live canvas — drag anywhere in the box to move, drag a corner handle
// to resize (locked to the layer's own aspect ratio), drag the handle above
// the box to rotate freely (hold Shift to snap to 15°, double-click to
// reset). Local state drives the visible box/rotation during a drag; onChange
// (which triggers a full effects-pipeline re-run via App state) only fires
// once, on pointerup — dragging never touches app state mid-gesture, the same
// trap EffectMaskPad already routes around for the same reason (re-running
// ~40 effects per pointermove pixel would be unusable).
//
// Resize is done entirely in the box's LOCAL unrotated frame: the raw screen
// pointer delta is rotated by -rotation before being fed into the per-corner
// resize math, so the box's x/y/width/height stay defined pre-rotation just
// like the canvas compositor expects. Trade-off accepted: because rotation is
// re-applied around the (possibly-shifted) center after every resize step,
// dragging a corner of an ALREADY-rotated layer will visibly pivot around
// center rather than staying pinned exactly under the cursor. Full
// screen-anchored resize-under-rotation is solvable but not worth the extra
// complexity for this tool's scope — rotate is typically a "set it once"
// gesture, not interleaved with resizing.
const LayerTransformOverlay: React.FC<Props> = ({ layer, onChange, onDone }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({
    x: layer.x ?? 0, y: layer.y ?? 0,
    width: layer.width ?? 1, height: layer.height ?? 1,
  });
  const [rotation, setRotation] = useState(layer.rotation ?? 0);
  const dragRef = useRef<{ mode: 'move' | 'resize' | 'rotate'; corner?: Corner; startX: number; startY: number; origin: Box } | null>(null);
  const boxRef = useRef(box);
  boxRef.current = box;
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  // Re-sync if the caller switches which layer is being edited
  useEffect(() => {
    setBox({ x: layer.x ?? 0, y: layer.y ?? 0, width: layer.width ?? 1, height: layer.height ?? 1 });
    setRotation(layer.rotation ?? 0);
  }, [layer.id]);

  const aspect = layer.naturalAspect ?? 1;

  const commit = () => onChange({ ...boxRef.current, rotation: rotationRef.current });

  const handleMoveDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode: 'move', startX: e.clientX, startY: e.clientY, origin: boxRef.current };
  };

  const handleResizeDown = (corner: Corner) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode: 'resize', corner, startX: e.clientX, startY: e.clientY, origin: boxRef.current };
  };

  const handleRotateDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode: 'rotate', startX: e.clientX, startY: e.clientY, origin: boxRef.current };
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
    } else if (drag.mode === 'resize') {
      // Un-rotate the screen-space drag delta into the box's local frame
      // before resizing — see the file-level comment for why.
      const dxScreen = e.clientX - drag.startX, dyScreen = e.clientY - drag.startY;
      const rad = -rotationRef.current * Math.PI / 180;
      const dxLocal = dxScreen * Math.cos(rad) - dyScreen * Math.sin(rad);
      setBox(resizeFromCorner(drag.corner!, drag.origin, dxLocal, rect, aspect));
    } else {
      // Rotate: angle of the pointer relative to the box's own center,
      // measured from straight up, increasing clockwise.
      const b = boxRef.current;
      const cx = rect.left + (b.x + b.width / 2) * rect.width;
      const cy = rect.top + (b.y + b.height / 2) * rect.height;
      let deg = Math.atan2(e.clientX - cx, cy - e.clientY) * 180 / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      setRotation(deg);
    }
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    commit();
  };

  const resetRotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation(0);
    onChange({ rotation: 0 });
  };

  // Escape exits edit mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const CORNERS: { corner: Corner; className: string; cursor: string }[] = [
    { corner: 'tl', className: '-top-2 -left-2', cursor: 'cursor-nwse-resize' },
    { corner: 'tr', className: '-top-2 -right-2', cursor: 'cursor-nesw-resize' },
    { corner: 'bl', className: '-bottom-2 -left-2', cursor: 'cursor-nesw-resize' },
    { corner: 'br', className: '-bottom-2 -right-2', cursor: 'cursor-nwse-resize' },
  ];

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

      {/* Bounding box — CSS-rotated around its own center, which lines up
          exactly with the canvas compositor's rotation pivot (lx+lw/2,
          ly+lh/2) since this overlay shares the same pixel rect as the
          canvas. Rotating this div also rotates every child handle for
          free, so handle positions below stay defined in simple unrotated
          local coordinates. */}
      <div
        onPointerDown={handleMoveDown}
        className="absolute cursor-move"
        style={{
          left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: `${box.width * 100}%`, height: `${box.height * 100}%`,
          border: '1.5px dashed rgba(232,67,32,0.9)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.4)',
          background: 'rgba(232,67,32,0.06)',
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {/* Rotate handle + stem */}
        <div
          className="absolute left-1/2 pointer-events-none"
          style={{ top: -ROTATE_HANDLE_OFFSET, width: 1, height: ROTATE_HANDLE_OFFSET, background: 'rgba(232,67,32,0.7)', transform: 'translateX(-50%)' }}
        />
        <div
          onPointerDown={handleRotateDown}
          onDoubleClick={resetRotation}
          title="Drag to rotate — hold Shift to snap, double-click to reset"
          className="absolute left-1/2 w-4 h-4 rounded-full cursor-grab active:cursor-grabbing"
          style={{
            top: -ROTATE_HANDLE_OFFSET - 8,
            transform: 'translateX(-50%)',
            background: '#f2f0eb',
            border: '2px solid #e84320',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        />

        {/* Resize handles — one per corner, each locked to the layer's natural aspect */}
        {CORNERS.map(({ corner, className, cursor }) => (
          <div
            key={corner}
            onPointerDown={handleResizeDown(corner)}
            className={`absolute w-4 h-4 rounded-full ${className} ${cursor}`}
            style={{
              background: '#e84320',
              border: '2px solid #f2f0eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default LayerTransformOverlay;
