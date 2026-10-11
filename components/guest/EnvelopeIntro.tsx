'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface EnvelopeIntroProps {
  guestName: string;
  coupleNames: string;
  weddingDate: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const CONFETTI_COUNT = 70;
const CONFETTI_MS = 3200;
const CONFETTI_DELAY_MS = 1500;

/**
 * Envelope animation for the guest invitation page (Action 66, PRD §19).
 * 2D flip of the flap (CSS 3D transform), the card sliding out, then a canvas
 * confetti burst. Colours come from the admin theme variables, so editing the
 * palette recolours the envelope. Plays on every load; the button replays it.
 * With "reduce motion" on, it shows the opened card and skips the confetti.
 */
export default function EnvelopeIntro({ guestName, coupleNames, weddingDate }: EnvelopeIntroProps) {
  const [playKey, setPlayKey] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopConfetti = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    timerRef.current = null;
    frameRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const burst = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !stage || !ctx) return;

    // Match the canvas to its on-screen size at the device's pixel density so
    // the pieces stay crisp on high-resolution phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(stage);
    const accent = css.getPropertyValue('--color-accent').trim() || '#b45309';
    const surface = css.getPropertyValue('--color-surface').trim() || '#ffffff';
    const palette = [
      accent,
      surface,
      `color-mix(in srgb, ${accent} 60%, white)`,
      `color-mix(in srgb, ${accent} 70%, black)`,
    ];

    const originX = width / 2;
    const originY = height * 0.55;
    const particles: Particle[] = Array.from({ length: CONFETTI_COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const speed = 4 + Math.random() * 7;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.4,
        color: palette[Math.floor(Math.random() * palette.length)],
      };
    });

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);
      const fade = Math.max(0, 1 - elapsed / CONFETTI_MS);
      for (const p of particles) {
        p.vy += 0.22;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (elapsed < CONFETTI_MS) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        frameRef.current = null;
      }
    };
    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  // Each play (first load and every replay) schedules one burst, timed to
  // land as the card finishes sliding out.
  useEffect(() => {
    stopConfetti();
    if (reducedMotion) return;
    timerRef.current = window.setTimeout(burst, CONFETTI_DELAY_MS);
    return stopConfetti;
  }, [playKey, reducedMotion, burst, stopConfetti]);

  return (
    <section aria-label="Your invitation" className="envelope-intro">
      <div
        key={playKey}
        ref={stageRef}
        className={`envelope-stage${reducedMotion ? ' envelope-static' : ''}`}
      >
        <div className="envelope-card">
          <p className="envelope-kicker">You are invited</p>
          <p className="envelope-names">{coupleNames}</p>
          {weddingDate && <p className="envelope-date">{weddingDate}</p>}
          <p className="envelope-guest">{guestName}</p>
        </div>
        <div className="envelope-body" aria-hidden="true" />
        <div className="envelope-front" aria-hidden="true" />
        <div className="envelope-flap" aria-hidden="true" />
        <canvas ref={canvasRef} className="envelope-confetti" aria-hidden="true" />
      </div>
      <div className="envelope-replay-row">
        <button type="button" className="button button-secondary" onClick={() => setPlayKey((n) => n + 1)}>
          Replay animation
        </button>
      </div>
      <style>{`
        .envelope-intro { padding: 0 0 8px; }
        .envelope-stage {
          position: relative;
          width: min(100%, 360px);
          aspect-ratio: 360 / 230;
          margin: 150px auto 0;
          perspective: 900px;
        }
        .envelope-body, .envelope-front, .envelope-flap { position: absolute; left: 0; width: 100%; }
        .envelope-body {
          inset: 0;
          background: color-mix(in srgb, var(--color-brand, #4a1525) 82%, black);
          border-radius: 6px;
          box-shadow: 0 18px 36px rgba(0,0,0,0.22);
          z-index: 0;
        }
        .envelope-front {
          inset: 0;
          background: var(--color-brand, #4a1525);
          border-radius: 6px;
          clip-path: polygon(0 0, 50% 52%, 100% 0, 100% 100%, 0 100%);
          filter: drop-shadow(0 -2px 3px rgba(0,0,0,0.18));
          z-index: 3;
        }
        .envelope-flap {
          top: 0;
          height: 56%;
          background: color-mix(in srgb, var(--color-brand, #4a1525) 84%, white);
          clip-path: polygon(0 0, 100% 0, 50% 100%);
          transform-origin: top center;
          z-index: 4;
          animation: envelope-flap-open 0.9s ease-in-out 0.3s both;
        }
        .envelope-card {
          position: absolute;
          left: 6%;
          width: 88%;
          top: 8%;
          height: 86%;
          box-sizing: border-box;
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          text-align: center;
          background: var(--color-surface, #fff);
          color: var(--color-heading, #0f172a);
          border-radius: 4px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          z-index: 2;
          animation: envelope-card-out 0.9s ease-out 1s both;
        }
        .envelope-kicker { font-size: 0.7rem; letter-spacing: 0.25em; text-transform: uppercase; opacity: 0.7; margin: 0; }
        .envelope-names { font-size: 1.5rem; font-weight: 700; line-height: 1.2; margin: 0; }
        .envelope-date { font-size: 0.85rem; margin: 0; opacity: 0.85; }
        .envelope-guest { font-size: 0.8rem; margin: 4px 0 0; opacity: 0.7; }
        .envelope-confetti {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 6;
        }
        .envelope-replay-row { display: flex; justify-content: center; margin-top: 16px; }
        @keyframes envelope-flap-open {
          0% { transform: rotateX(0deg); z-index: 4; }
          49% { z-index: 4; }
          50% { z-index: 0; }
          100% { transform: rotateX(180deg); z-index: 0; }
        }
        @keyframes envelope-card-out {
          0% { transform: translateY(0); z-index: 2; }
          100% { transform: translateY(-62%); z-index: 2; }
        }
        .envelope-static .envelope-flap { animation: none; transform: rotateX(180deg); z-index: 0; }
        .envelope-static .envelope-card { animation: none; transform: translateY(-62%); }
        @media (prefers-reduced-motion: reduce) {
          .envelope-flap { animation: none; transform: rotateX(180deg); z-index: 0; }
          .envelope-card { animation: none; transform: translateY(-62%); }
        }
      `}</style>
    </section>
  );
}
