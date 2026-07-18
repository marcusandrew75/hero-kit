import React from 'react';
import { createPortal } from 'react-dom';
import { T } from './ui/HardwareControls';

// Bottom-right so it never collides with the bottom-center "Preview in
// context" pill or the mobile BottomSheet — sits above both regardless
// (z-[300], above every existing modal's z-[200]). Purely decorative: the
// 4s lifetime is owned by App's own setTimeout, this CSS animation just
// needs to stay inside that window so it never gets cut off mid-fade.
const EggToast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return createPortal(
    <div
      className="fixed bottom-5 right-5 z-[300] pointer-events-none px-4 py-2.5 rounded-lg text-[12px] font-medium max-w-[280px]"
      style={{
        background: T.text,
        color: T.bg,
        boxShadow: '0 12px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
        animation: 'herokit-egg-toast 4s ease forwards',
      }}
    >
      {message}
    </div>,
    document.body,
  );
};

export default EggToast;
