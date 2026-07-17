
import React, { useRef, useState } from 'react';
import { BackgroundState } from '../types';

interface Props {
  onChange: (patch: Partial<BackgroundState>) => void;
  // True when an atmosphere effect is already rendering behind this overlay
  // with no source image — the drop zone stays fully functional but hides
  // its icon/text/CTA so the effect underneath isn't hidden.
  minimal?: boolean;
}

const CanvasDropZone: React.FC<Props> = ({ onChange, minimal = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = e => onChange({ imageUrl: e.target?.result as string, videoUrl: undefined, imageAttribution: undefined });
      r.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      onChange({ videoUrl: URL.createObjectURL(file), imageUrl: undefined, imageAttribution: undefined });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 cursor-pointer"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      {/* Subtle drag highlight ring */}
      {dragging && (
        <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-black/20 pointer-events-none" />
      )}

      {/* Icon — hidden in minimal mode (atmosphere already filling the
          canvas) unless actively dragging a file over it, so the effect
          underneath stays fully visible the rest of the time. */}
      {(!minimal || dragging) && (
        <div className={`transition-all duration-200 ${dragging ? 'scale-110 opacity-50' : 'opacity-20'}`}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="12" width="56" height="48" rx="6" stroke="#1a1917" strokeWidth="2.5"/>
            <circle cx="24" cy="28" r="5" stroke="#1a1917" strokeWidth="2.5"/>
            <path d="M8 50 L22 36 L34 46 L46 34 L64 50" stroke="#1a1917" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Instructions */}
      {(!minimal || dragging) && (
        <div className="text-center space-y-2 pointer-events-none">
          <p className="text-[#1a1917]/60 text-xl font-medium tracking-tight">
            {dragging ? 'Drop to load' : 'Drop an image here'}
          </p>
          <p className="text-[#6b6860] text-sm">
            or click to browse / paste from clipboard
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
};

export default CanvasDropZone;
