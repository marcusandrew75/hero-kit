import { useEffect, useState } from 'react';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'number']);

// Tracks whether a text input anywhere in the app currently has focus (a
// reasonable proxy for "the iOS keyboard is open"). Used to reserve extra
// scroll room below the focused field — visualViewport.height already
// shrinks the sheet to fit above the keyboard itself, but doesn't know
// about the keyboard's own accessory bar (prev/next/Done toolbar) sitting
// above it, so without this the focused field can still end up hidden
// behind that toolbar even though the sheet otherwise resized correctly.
export const useKeyboardOpen = (): boolean => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isTextInput = (target: EventTarget | null) =>
      target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
    const onFocusIn = (e: FocusEvent) => { if (isTextInput(e.target)) setOpen(true); };
    const onFocusOut = (e: FocusEvent) => { if (isTextInput(e.target)) setOpen(false); };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return open;
};
