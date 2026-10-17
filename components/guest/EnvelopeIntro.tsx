'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useSiteText } from '@/components/SiteTextProvider';

interface EnvelopeIntroProps {
  guestName: string;
  coupleNames: string;
  weddingDate: string;
}

interface Particle {
  x: number; // page coordinates, so pieces keep falling as the page scrolls
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  flip: number; // 3D tumble: the piece's tilt toward/away from the viewer
  flipSpeed: number;
  sway: number;
  swaySpeed: number;
  color: string;
  backColor: string;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const CONFETTI_COUNT = 150;
// Pieces keep drifting down the page for this long, then are gone.
const CONFETTI_MS = 30000;
const CONFETTI_FADE_MS = 3000;
const CONFETTI_DELAY_MS = 1500;
// The card finishes sliding out at ~1.9s; wait a beat, then drift down the page.
// The drift ends ~30s after load, at the RSVP section where names are entered.
const SCROLL_START_MS = 3000;
const SCROLL_END_MS = 30000;
const RSVP_ANCHOR_ID = 'rsvp-section';

/**
 * Envelope animation for the guest invitation page (Action 66, PRD §19).
 * The envelope sits in a tilted 3D scene: the flap swings open, the card slides
 * out and lifts toward the viewer, then paper confetti tumbles down the whole
 * page for ~30s while the page drifts slowly to the RSVP section. Colours come
 * from the admin theme variables. Plays on every load. With "reduce motion" on,
 * it shows the opened card and skips the confetti and the drift.
 */
export default function EnvelopeIntro({ guestName, coupleNames, weddingDate }: EnvelopeIntroProps) {
  const t = useSiteText();
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

    // The canvas covers the whole window (fixed), at the device's pixel density
    // so the pieces stay crisp on high-resolution phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    const fit = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);

    const css = getComputedStyle(stage);
    const accent = css.getPropertyValue('--color-accent').trim() || '#b45309';
    const surface = css.getPropertyValue('--color-surface').trim() || '#ffffff';
    const palette = [
      accent,
      surface,
      `color-mix(in srgb, ${accent} 60%, white)`,
      `color-mix(in srgb, ${accent} 70%, black)`,
    ];

    const rect = stage.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + window.scrollY + rect.height * 0.3;
    const particles: Particle[] = Array.from({ length: CONFETTI_COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      const speed = 5 + Math.random() * 8;
      const color = palette[Math.floor(Math.random() * palette.length)];
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 7,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.12,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: 0.04 + Math.random() * 0.1,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.04,
        color,
        backColor: `color-mix(in srgb, ${color} 62%, black)`,
      };
    });

    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      const elapsed = now - start;
      // 1 = one 60fps frame, so the fall looks the same on 120Hz screens.
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;
      const scrollY = window.scrollY;
      const pageBottom = document.documentElement.scrollHeight;
      const fade = Math.min(1, Math.max(0, (CONFETTI_MS - elapsed) / CONFETTI_FADE_MS));
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        // Light gravity capped by air drag, so pieces float down slowly.
        p.vy = Math.min(p.vy + 0.07 * dt, 1.5 + p.size * 0.05);
        p.vx *= Math.pow(0.985, dt);
        p.sway += p.swaySpeed * dt;
        p.x += (p.vx + Math.sin(p.sway) * 0.7) * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        if (p.y > pageBottom + 20) continue;
        const screenY = p.y - scrollY;
        if (screenY < -20 || screenY > height + 20) continue;
        // A piece turning toward the viewer shows its face, then its darker back.
        const tilt = Math.cos(p.flip);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, screenY);
        ctx.rotate(p.rotation);
        ctx.scale(1, Math.max(0.08, Math.abs(tilt)));
        ctx.fillStyle = tilt >= 0 ? p.color : p.backColor;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      }
      if (elapsed < CONFETTI_MS) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        window.removeEventListener('resize', fit);
        frameRef.current = null;
      }
    };
    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  // One burst, timed to land as the card finishes sliding out.
  useEffect(() => {
    stopConfetti();
    if (reducedMotion) return;
    timerRef.current = window.setTimeout(burst, CONFETTI_DELAY_MS);
    return stopConfetti;
  }, [reducedMotion, burst, stopConfetti]);

  // After the animation starts, drift slowly down to the RSVP section (where
  // names are entered) so the guest does not have to scroll. The target is
  // re-measured every frame because the page can grow while it loads. Any
  // touch, wheel or key press by the guest cancels it straight away.
  useEffect(() => {
    if (reducedMotion) return;
    let frame: number | null = null;
    let cancelled = false;

    const cancel = () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    events.forEach((name) => window.addEventListener(name, cancel, { passive: true }));

    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      const startY = window.scrollY;
      const startedAt = performance.now();
      const step = (now: number) => {
        if (cancelled) return;
        const target =
          document.getElementById(RSVP_ANCHOR_ID) ??
          stageRef.current?.closest('section')?.nextElementSibling;
        if (!target) return;
        const targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 24);
        const t = Math.min(1, (now - startedAt) / (SCROLL_END_MS - SCROLL_START_MS));
        const eased = -(Math.cos(Math.PI * t) - 1) / 2;
        window.scrollTo(0, startY + (targetY - startY) * eased);
        if (t < 1) frame = window.requestAnimationFrame(step);
      };
      frame = window.requestAnimationFrame(step);
    }, SCROLL_START_MS);

    return () => {
      window.clearTimeout(startTimer);
      cancel();
      events.forEach((name) => window.removeEventListener(name, cancel));
    };
  }, [reducedMotion]);

  return (
    <section aria-label="Your invitation" className="inv-env">
      <div
        ref={stageRef}
        className={`inv-env-stage${reducedMotion ? ' inv-env-static' : ''}`}
      >
        <div className="inv-env-shadow" aria-hidden="true" />
        <div className="inv-env-tilt">
          <div className="inv-env-body" aria-hidden="true" />
          <div className="inv-env-card">
            <p className="inv-env-kicker">{t('invitation.kicker')}</p>
            <p className="inv-env-names">{coupleNames}</p>
            {weddingDate && <p className="inv-env-date">{weddingDate}</p>}
            <p className="inv-env-guest">{guestName}</p>
          </div>
          <div className="inv-env-front" aria-hidden="true" />
          <div className="inv-env-seal" aria-hidden="true" />
          <div className="inv-env-flap" aria-hidden="true" />
        </div>
      </div>
      <canvas ref={canvasRef} className="inv-env-confetti" aria-hidden="true" />
      <style>{`
        .inv-env { padding: 0 0 8px; }
        .inv-env-stage {
          position: relative;
          width: min(100%, 360px);
          aspect-ratio: 360 / 230;
          margin: 150px auto 0;
          perspective: 1000px;
        }
        .inv-env-tilt {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          transform: rotateX(8deg);
          animation: inv-env-settle 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .inv-env-shadow {
          position: absolute;
          left: 6%;
          right: 6%;
          bottom: -26px;
          height: 30px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.38), transparent 70%);
          filter: blur(6px);
        }
        .inv-env-body, .inv-env-front, .inv-env-flap { position: absolute; left: 0; width: 100%; }
        .inv-env-body {
          inset: 0;
          background: linear-gradient(160deg,
            color-mix(in srgb, var(--color-accent, #b45309) 70%, black),
            color-mix(in srgb, var(--color-accent, #b45309) 55%, black));
          border-radius: 6px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.25), 0 18px 36px rgba(0,0,0,0.25);
        }
        .inv-env-front {
          inset: 0;
          background: linear-gradient(170deg,
            color-mix(in srgb, var(--color-accent, #b45309) 100%, white 8%),
            var(--color-accent, #b45309) 55%,
            color-mix(in srgb, var(--color-accent, #b45309) 85%, black));
          border-radius: 6px;
          clip-path: polygon(0 0, 50% 52%, 100% 0, 100% 100%, 0 100%);
          transform: translateZ(8px);
        }
        .inv-env-flap {
          top: 0;
          height: 56%;
          background: linear-gradient(180deg,
            color-mix(in srgb, var(--color-accent, #b45309) 80%, white),
            color-mix(in srgb, var(--color-accent, #b45309) 92%, white));
          clip-path: polygon(0 0, 100% 0, 50% 100%);
          transform-origin: top center;
          transform: translateZ(10px);
          animation: inv-env-flap-open 0.9s ease-in-out 0.3s both;
        }
        .inv-env-seal {
          position: absolute;
          top: 52%;
          left: 50%;
          width: 38px;
          height: 38px;
          margin: -19px 0 0 -19px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%,
            color-mix(in srgb, var(--color-brand, #7f1d1d) 60%, white),
            var(--color-brand, #7f1d1d) 55%,
            color-mix(in srgb, var(--color-brand, #7f1d1d) 70%, black));
          box-shadow: 0 3px 6px rgba(0,0,0,0.45), inset 0 -2px 3px rgba(0,0,0,0.3);
          transform: translateZ(14px);
          animation: inv-env-seal-lift 0.4s ease-in 0.25s both;
        }
        .inv-env-card {
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
          background: linear-gradient(160deg, var(--color-surface, #fff), color-mix(in srgb, var(--color-surface, #fff) 92%, black));
          color: var(--color-heading, #0f172a);
          border-radius: 4px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          transform: translateZ(3px);
          animation: inv-env-card-out 1.6s ease-out 1s both;
        }
        .inv-env-kicker { font-size: 0.7rem; letter-spacing: 0.25em; text-transform: uppercase; opacity: 0.7; margin: 0; }
        .inv-env-names { font-size: 1.5rem; font-weight: 700; line-height: 1.2; margin: 0; }
        .inv-env-date { font-size: 0.85rem; margin: 0; opacity: 0.85; }
        .inv-env-guest { font-size: 0.8rem; margin: 4px 0 0; opacity: 0.7; }
        .inv-env-confetti {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 40;
        }
        @keyframes inv-env-settle {
          0% { transform: rotateX(24deg) rotateY(-10deg) translateY(30px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: rotateX(8deg) rotateY(0deg) translateY(0); opacity: 1; }
        }
        @keyframes inv-env-flap-open {
          0% { transform: translateZ(10px) rotateX(0deg); }
          100% { transform: translateZ(10px) rotateX(180deg); }
        }
        @keyframes inv-env-seal-lift {
          0% { opacity: 1; transform: translateZ(14px) scale(1); }
          100% { opacity: 0; transform: translateZ(40px) translateY(-14px) scale(1.25); }
        }
        @keyframes inv-env-card-out {
          0% { transform: translate3d(0, 0, 3px); }
          55% { transform: translate3d(0, -62%, 3px); }
          100% { transform: translate3d(0, -62%, 34px) scale(1.04); box-shadow: 0 22px 36px rgba(0,0,0,0.3); }
        }
        .inv-env-static .inv-env-tilt { animation: none; }
        .inv-env-static .inv-env-flap { animation: none; transform: translateZ(10px) rotateX(180deg); }
        .inv-env-static .inv-env-seal { animation: none; opacity: 0; }
        .inv-env-static .inv-env-card { animation: none; transform: translate3d(0, -62%, 34px) scale(1.04); }
        @media (prefers-reduced-motion: reduce) {
          .inv-env-tilt { animation: none; }
          .inv-env-flap { animation: none; transform: translateZ(10px) rotateX(180deg); }
          .inv-env-seal { animation: none; opacity: 0; }
          .inv-env-card { animation: none; transform: translate3d(0, -62%, 34px) scale(1.04); }
        }
      `}</style>
    </section>
  );
}
