import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachDragScroll, DRAG_THRESHOLD_PX } from '../src/hooks/useDragScroll.js';

// The rule: on the embed, a mouse drag scrolls the card like a finger would
// (the fridge sends taps as mouse events); a tap is still a tap; touch and pen
// are left to the browser.

function target() {
  const listeners = {};
  const classes = new Set();
  return {
    scrollTop: 300,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), has: (c) => classes.has(c) },
    addEventListener: (type, fn, capture) => (listeners[`${type}${capture ? ':c' : ''}`] = fn),
    removeEventListener: (type, _fn, capture) => delete listeners[`${type}${capture ? ':c' : ''}`],
    fire: (type, e = {}, capture = false) => listeners[`${type}${capture ? ':c' : ''}`]?.(e),
    listeners
  };
}
const ev = (over) => ({ pointerType: 'mouse', button: 0, pointerId: 1, clientY: 500, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...over });

test('a mouse drag scrolls by the distance dragged, both ways', () => {
  const el = target();
  const win = target();
  attachDragScroll(el, win);
  el.fire('pointerdown', ev());
  win.fire('pointermove', ev({ clientY: 400 })); // drag up 100: content moves up
  assert.equal(el.scrollTop, 400);
  assert.ok(el.classList.has('drag-scrolling'));
  win.fire('pointermove', ev({ clientY: 650 })); // back down past the start
  assert.equal(el.scrollTop, 150);
  win.fire('pointerup', ev({ clientY: 650 }));
  assert.ok(!el.classList.has('drag-scrolling'));
  win.fire('pointermove', ev({ clientY: 100 })); // released: no more scrolling
  assert.equal(el.scrollTop, 150);
});

test('a tap with a little jitter is still a tap, and its click goes through', () => {
  const el = target();
  const win = target();
  attachDragScroll(el, win);
  el.fire('pointerdown', ev());
  win.fire('pointermove', ev({ clientY: 500 - (DRAG_THRESHOLD_PX - 1) }));
  assert.equal(el.scrollTop, 300);
  win.fire('pointerup', ev());
  const click = ev();
  el.fire('click', click, true);
  assert.ok(!click.prevented && !click.stopped);
});

test('the click that ends a drag does not press what it ended on, and the next one does', () => {
  const el = target();
  const win = target();
  attachDragScroll(el, win);
  el.fire('pointerdown', ev());
  win.fire('pointermove', ev({ clientY: 500 - DRAG_THRESHOLD_PX }));
  assert.equal(el.scrollTop, 300 + DRAG_THRESHOLD_PX); // the threshold itself is a drag
  win.fire('pointerup', ev());
  const after = ev();
  el.fire('click', after, true);
  assert.ok(after.prevented && after.stopped);
  const next = ev();
  el.fire('click', next, true);
  assert.ok(!next.prevented && !next.stopped);
});

test('touch, pen, other buttons and other pointers are left alone', () => {
  for (const over of [{ pointerType: 'touch' }, { pointerType: 'pen' }, { button: 2 }]) {
    const el = target();
    const win = target();
    attachDragScroll(el, win);
    el.fire('pointerdown', ev(over));
    win.fire('pointermove', ev({ ...over, clientY: 100 }));
    assert.equal(el.scrollTop, 300, JSON.stringify(over));
  }
  const el = target();
  const win = target();
  attachDragScroll(el, win);
  el.fire('pointerdown', ev());
  win.fire('pointermove', ev({ pointerId: 2, clientY: 100 }));
  assert.equal(el.scrollTop, 300);
});

test('detaching removes every listener', () => {
  const el = target();
  const win = target();
  const detach = attachDragScroll(el, win);
  assert.ok(Object.keys(el.listeners).length > 0 && Object.keys(win.listeners).length > 0);
  detach();
  assert.deepEqual(Object.keys(el.listeners), []);
  assert.deepEqual(Object.keys(win.listeners), []);
});
