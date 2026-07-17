import { useEffect, useState } from 'react';

// Tailwind's default `md` breakpoint (768px), already live via the Play CDN
// with no config needed — this is a breakpoint check, not a continuous
// measurement, so matchMedia (fires only when the boolean flips) rather than
// a ResizeObserver (fires on every pixel, including height-only changes like
// the on-screen keyboard opening) is the right primitive here.
const QUERY = '(max-width: 768px)';

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};
