
import React, { useRef, useState } from 'react';
import { BackgroundState } from '../types';

interface Props {
  onChange: (patch: Partial<BackgroundState>) => void;
}

// Single curated "HeroKit Demo" — image 029 + golden-hour grade + dispersion + spot blur
const DEMO: Partial<BackgroundState> = {
  bgColor: '#050508',
  imageUrl: '/super-visuals-ahmed-hassan/AI_Bg_029.jpg',
  videoUrl: undefined,
  imageFilter: 'none', imageBlur: 0, imageMask: 'radial',
  imageOpacity: 1, tintColor: '#6366f1',
  chromaticAberration: 0, ditherStyle: 'none', ditherScale: 1,
  atmosphereStyle: 'none',
  noiseOpacity: 0.20, noiseColor: '#ffffff',
  patternStyle: 'plus', patternOpacity: 0.15,
  patternColor: '#ffffff', patternBlendMode: 'overlay',
  overlayOpacity: 0, vignetteStrength: 0.35, effectsOpacity: 1,
  ambientLightIntensity: 0, ambientLightColor: '#6366f1', ambientLightPosition: 'tr',
  colorGradeEnabled: true, colorGradePreset: 'golden-hour', colorGradeStrength: 1,
  dispersionEnabled: true, dispersionStrength: 142, dispersionThreshold: 26,
  dispersionDirection: 'up', dispersionSpread: 0.34,
  spotBlurEnabled: true, spotBlurRadius: 18,
  blurSpots: [
    { id: 'demo-spot-1', x: 0.486, y: 0.477, radius: 0.6 },
    { id: 'demo-spot-2', x: 0.642, y: 0.880, radius: 0.6 },
    { id: 'demo-spot-3', x: 0.277, y: 0.888, radius: 0.48 },
  ],
  halftoneEnabled: false, pixelSortEnabled: false,
  channelSmearEnabled: false, warpEnabled: false, motionBlurEnabled: false,
};

const CanvasDropZone: React.FC<Props> = ({ onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = e => onChange({ imageUrl: e.target?.result as string, videoUrl: undefined });
      r.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      onChange({ videoUrl: URL.createObjectURL(file), imageUrl: undefined });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDemo = () => onChange(DEMO);

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

      {/* Icon */}
      <div className={`transition-all duration-200 ${dragging ? 'scale-110 opacity-50' : 'opacity-20'}`}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="12" width="56" height="48" rx="6" stroke="#1a1917" strokeWidth="2.5"/>
          <circle cx="24" cy="28" r="5" stroke="#1a1917" strokeWidth="2.5"/>
          <path d="M8 50 L22 36 L34 46 L46 34 L64 50" stroke="#1a1917" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2 pointer-events-none">
        <p className="text-[#1a1917]/60 text-xl font-medium tracking-tight">
          {dragging ? 'Drop to load' : 'Drop an image here'}
        </p>
        <p className="text-[#6b6860] text-sm">
          or click to browse / paste from clipboard
        </p>
      </div>

      {/* Inspire Me */}
      <button
        onClick={e => { e.stopPropagation(); handleDemo(); }}
        className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-black/12 text-[#6b6860] text-sm font-medium hover:text-[#1a1917] hover:border-black/25 hover:bg-black/4 transition-all"
      >
        <i className="ph ph-sparkle text-base" />
        Show me what's possible
      </button>

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
