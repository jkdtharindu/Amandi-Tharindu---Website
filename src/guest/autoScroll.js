/**
 * The invitation page's slow drift down the page. It moves at one steady speed until the
 * very bottom. A touch, wheel, key or mouse press pauses it, and it carries on
 * `resumeMs` after the guest lets go - unless a pop-up is open or a field is being typed
 * in, in which case it keeps waiting.
 *
 * Kept free of the browser so it can be tested: everything it touches comes in through
 * `env` (page measurements and scrolling) and `timers` (frames and timeouts).
 *
 * @param {{
 *   env: { scrollY: () => number, viewportHeight: () => number, pageHeight: () => number, scrollTo: (y: number) => void, isBusy: () => boolean },
 *   timers: { raf: (cb: (now: number) => void) => number, caf: (id: number) => void, setTimeout: (cb: () => void, ms: number) => number, clearTimeout: (id: number) => void, now: () => number },
 *   resumeMs: number,
 *   speed: number,
 * }} options  `speed` is pixels per millisecond.
 */
export function createAutoScroller({ env, timers, resumeMs, speed }) {
  let frame = null;
  let resumeTimer = null;
  let ready = false;
  let paused = false;
  let touching = false;
  let position = 0;
  let lastFrame = 0;
  let currentSpeed = speed;

  const atBottom = () => env.scrollY() + env.viewportHeight() >= env.pageHeight() - 2;

  const step = (now) => {
    frame = null;
    if (paused || atBottom()) return;
    const elapsed = Math.min(now - lastFrame, 50);
    lastFrame = now;
    position += currentSpeed * elapsed;
    env.scrollTo(position);
    frame = timers.raf(step);
  };

  const begin = () => {
    if (frame !== null) return;
    position = env.scrollY();
    lastFrame = timers.now();
    frame = timers.raf(step);
  };

  const clearResume = () => {
    if (resumeTimer !== null) timers.clearTimeout(resumeTimer);
    resumeTimer = null;
  };

  const pause = () => {
    paused = true;
    if (frame !== null) timers.caf(frame);
    frame = null;
    clearResume();
  };

  const tryResume = () => {
    resumeTimer = null;
    if (touching || env.isBusy()) {
      resumeTimer = timers.setTimeout(tryResume, resumeMs);
      return;
    }
    paused = false;
    if (ready) begin();
  };

  const scheduleResume = () => {
    clearResume();
    resumeTimer = timers.setTimeout(tryResume, resumeMs);
  };

  return {
    /** The animation is over: start drifting (unless the guest is already touching). */
    start(pixelsPerMs) {
      if (pixelsPerMs > 0) currentSpeed = pixelsPerMs;
      ready = true;
      if (!paused) begin();
    },
    touchStart() {
      touching = true;
      pause();
    },
    /** @param {number} touchesLeft fingers still on the screen */
    touchEnd(touchesLeft = 0) {
      touching = touchesLeft > 0;
      if (!touching) scheduleResume();
    },
    mouseDown() {
      touching = true;
      pause();
    },
    mouseUp() {
      touching = false;
      scheduleResume();
    },
    /** A wheel turn or key press: pause now, carry on after resumeMs of quiet. */
    nudge() {
      pause();
      scheduleResume();
    },
    stop() {
      pause();
    },
  };
}
