import test from 'node:test';
import assert from 'node:assert/strict';

import { createAutoScroller } from '../src/guest/autoScroll.js';

// A fake page and a fake clock: `tick(ms)` moves time forward in 16ms frames, running
// any animation frame or timeout that falls due, the way a browser would.
function setup({ pageHeight = 3000, viewport = 800, busy = false } = {}) {
  const state = { y: 0, now: 0, busy, frames: [], timeouts: [], nextId: 1 };
  const env = {
    scrollY: () => state.y,
    viewportHeight: () => viewport,
    pageHeight: () => pageHeight,
    scrollTo: (y) => {
      state.y = Math.min(y, pageHeight - viewport);
    },
    isBusy: () => state.busy,
  };
  const timers = {
    raf: (cb) => {
      const id = state.nextId++;
      state.frames.push({ id, cb });
      return id;
    },
    caf: (id) => {
      state.frames = state.frames.filter((frame) => frame.id !== id);
    },
    setTimeout: (cb, ms) => {
      const id = state.nextId++;
      state.timeouts.push({ id, cb, at: state.now + ms });
      return id;
    },
    clearTimeout: (id) => {
      state.timeouts = state.timeouts.filter((timeout) => timeout.id !== id);
    },
    now: () => state.now,
  };
  const tick = (ms) => {
    for (let spent = 0; spent < ms; spent += 16) {
      state.now += 16;
      const due = state.timeouts.filter((timeout) => timeout.at <= state.now);
      state.timeouts = state.timeouts.filter((timeout) => timeout.at > state.now);
      due.forEach((timeout) => timeout.cb());
      const frames = state.frames;
      state.frames = [];
      frames.forEach((frame) => frame.cb(state.now));
    }
  };
  const scroller = createAutoScroller({ env, timers, resumeMs: 3000, speed: 0.1 });
  return { state, scroller, tick };
}

test('it drifts down at one steady speed', () => {
  const { state, scroller, tick } = setup();
  scroller.start(0.1);
  tick(1000);
  const afterOneSecond = state.y;
  tick(1000);
  assert.ok(Math.abs(afterOneSecond - 100) < 8, `about 100px in a second, got ${afterOneSecond}`);
  assert.ok(Math.abs(state.y - 2 * afterOneSecond) < 8, 'the second second moves the same distance');
});

test('it keeps going to the very bottom of the page, then stops', () => {
  const { state, scroller, tick } = setup({ pageHeight: 1500, viewport: 800 });
  scroller.start(0.5);
  tick(5000);
  assert.equal(state.y, 700);
  tick(2000);
  assert.equal(state.y, 700);
});

test('a touch stops it at once and it stays stopped while the finger is down', () => {
  const { state, scroller, tick } = setup();
  scroller.start(0.1);
  tick(1000);
  scroller.touchStart();
  const held = state.y;
  tick(10000);
  assert.equal(state.y, held);
});

test('it carries on 3 seconds after the finger lifts, not before', () => {
  const { state, scroller, tick } = setup();
  scroller.start(0.1);
  tick(1000);
  scroller.touchStart();
  tick(500);
  scroller.touchEnd(0);
  const lifted = state.y;
  tick(2800);
  assert.equal(state.y, lifted, 'still waiting just before 3 seconds');
  tick(1500);
  assert.ok(state.y > lifted + 5, 'moving again after 3 seconds');
});

test('touching again before the 3 seconds are up restarts the wait', () => {
  const { state, scroller, tick } = setup();
  scroller.start(0.1);
  scroller.touchStart();
  scroller.touchEnd(0);
  tick(2000);
  scroller.touchStart();
  scroller.touchEnd(0);
  const y = state.y;
  tick(2000);
  assert.equal(state.y, y, 'only 2s since the last release');
  tick(2000);
  assert.ok(state.y > y);
});

test('a second finger still down keeps it paused', () => {
  const { state, scroller, tick } = setup();
  scroller.start(0.1);
  scroller.touchStart();
  scroller.touchEnd(1);
  tick(8000);
  assert.equal(state.y, 0);
});

test('wheel and key presses pause it and it resumes after 3 quiet seconds', () => {
  const { state, scroller, tick } = setup();
  scroller.start(0.1);
  tick(500);
  scroller.nudge();
  const y = state.y;
  tick(2900);
  assert.equal(state.y, y);
  tick(1500);
  assert.ok(state.y > y);
});

test('it keeps waiting while a pop-up is open or a field is being typed in', () => {
  const { state, scroller, tick } = setup({ busy: true });
  scroller.start(0.1);
  scroller.touchStart();
  scroller.touchEnd(0);
  tick(9000);
  assert.equal(state.y, 0, 'busy: still waiting');
  state.busy = false;
  tick(4000);
  assert.ok(state.y > 0, 'moves once the pop-up is gone');
});

test('a touch before the animation ends delays the start until 3 seconds after release', () => {
  const { state, scroller, tick } = setup();
  scroller.touchStart();
  scroller.touchEnd(0);
  scroller.start(0.1);
  tick(2800);
  assert.equal(state.y, 0);
  tick(1500);
  assert.ok(state.y > 0);
});
