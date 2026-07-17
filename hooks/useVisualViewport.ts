import { useEffect, useState } from 'react';

interface VisualViewportState {
  height: number;
  offsetTop: number;
}

// iOS Safari's `position: fixed` elements are notoriously positioned
// relative to the LAYOUT viewport, not what's actually visible — as
// Safari's own address bar/toolbar collapses and expands (which happens
// mid-transition while scrolling, not just as a one-time state), the real
// visible top edge shifts without any of that showing up in window.innerHeight
// or a plain resize listener. `visualViewport.offsetTop` is the one API that
// reports the true shift, so UI that needs to stay pinned to the actual
// visible top edge (not just some fixed CSS `top` value) needs to read it
// reactively rather than assume `top: 0` means the top of what's on screen.
export const useVisualViewport = (): VisualViewportState => {
  const [state, setState] = useState<VisualViewportState>(() => ({
    height: typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 800,
    offsetTop: typeof window !== 'undefined' ? (window.visualViewport?.offsetTop ?? 0) : 0,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setState({
      height: vv?.height ?? window.innerHeight,
      offsetTop: vv?.offsetTop ?? 0,
    });
    update();
    (vv ?? window).addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      (vv ?? window).removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, []);

  return state;
};
