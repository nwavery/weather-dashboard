import { useEffect } from 'react';

// Mouse-drag scrolling for the ?view=card embed. The Avery Home fridge turns
// taps into mouse events, and a mouse drag doesn't scroll a page, so without
// this a card taller than its frame can't be scrolled by finger. Touch and pen
// keep the browser's own scrolling; a wheel scrolls as usual.

// Movement under this many px is a tap, not a drag.
export const DRAG_THRESHOLD_PX = 6;
// How long after its last move a drag can still swallow a click, for a drag
// whose release never reaches us (let go outside the frame).
export const CLICK_GRACE_MS = 500;

// Wires `el` (the scrolling element) to `win` (for moves that leave it) and
// returns a function that undoes it.
//
// A drag that ends on a button doesn't also press it: the click that the
// release produces is swallowed. Only that one: the flag is cleared right
// after any pointerup or pointercancel (once its click has been dispatched),
// and CLICK_GRACE_MS after the last drag move in case the release went
// elsewhere. A keyboard click (detail 0) is never swallowed.
export function attachDragScroll(el, win) {
  let start = null;
  let dragged = false;
  let clearTimer = null;
  const clearDraggedIn = (ms) => {
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      dragged = false;
    }, ms);
  };
  const end = () => {
    start = null;
    el.classList.remove('drag-scrolling');
  };
  const down = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    start = { id: e.pointerId, y: e.clientY, top: el.scrollTop };
    dragged = false;
  };
  const move = (e) => {
    if (!start || e.pointerId !== start.id) return;
    // No button held: the release was lost (outside the frame). Stop, so
    // the next hover doesn't scroll the card.
    if (e.buttons === 0) {
      end();
      clearDraggedIn(0);
      return;
    }
    const dy = e.clientY - start.y;
    if (!dragged && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    if (!dragged) el.classList.add('drag-scrolling');
    dragged = true;
    clearDraggedIn(CLICK_GRACE_MS);
    el.scrollTop = start.top - dy;
  };
  // Any release or cancel, ours or not, ends the drag; the flag outlives it
  // only until the release's own click has gone by.
  const up = () => {
    end();
    if (dragged) clearDraggedIn(0);
  };
  // Capture phase, so it runs before the button's own click handler.
  const click = (e) => {
    if (!dragged || e.detail === 0) return;
    dragged = false;
    clearTimeout(clearTimer);
    e.preventDefault();
    e.stopPropagation();
  };
  el.addEventListener('pointerdown', down);
  win.addEventListener('pointermove', move);
  win.addEventListener('pointerup', up);
  win.addEventListener('pointercancel', up);
  el.addEventListener('click', click, true);
  return () => {
    clearTimeout(clearTimer);
    el.removeEventListener('pointerdown', down);
    win.removeEventListener('pointermove', move);
    win.removeEventListener('pointerup', up);
    win.removeEventListener('pointercancel', up);
    el.removeEventListener('click', click, true);
  };
}

// Mouse-drag scrolling on `ref`'s element while `on` is true.
export function useDragScroll(ref, on) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return undefined;
    return attachDragScroll(el, window);
  }, [ref, on]);
}
