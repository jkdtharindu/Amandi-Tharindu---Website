"use client";

import { useEffect, useState } from "react";

/**
 * Ports the inline <script> countdown from the prototype's `/home` route
 * (src/server.js). Same target date and same arithmetic.
 *
 * Note: '2026-12-14T15:00:00' has no timezone suffix, so it parses as *local*
 * time. That matches the prototype exactly and is deliberate — do not "fix" it
 * to UTC without deciding what the couple actually wants.
 *
 * Starts at zeroes so the server-rendered markup matches the first client
 * render (the prototype also shipped 0s and let script fill them in); the real
 * values land on the first post-mount tick.
 */
const WEDDING_DATE = "2026-12-14T15:00:00";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

const ZERO: Remaining = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function remainingUntilWedding(): Remaining {
  const diff = new Date(WEDDING_DATE).getTime() - Date.now();
  if (diff <= 0) return ZERO;
  return {
    days: Math.floor(diff / 1000 / 60 / 60 / 24),
    hours: Math.floor(diff / 1000 / 60 / 60) % 24,
    minutes: Math.floor(diff / 1000 / 60) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

export default function Countdown() {
  const [remaining, setRemaining] = useState<Remaining>(ZERO);

  useEffect(() => {
    setRemaining(remainingUntilWedding());
    const timer = setInterval(() => setRemaining(remainingUntilWedding()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="countdown" id="countdown">
      <div className="countdown-item">
        <strong>{remaining.days}</strong>Days
      </div>
      <div className="countdown-item">
        <strong>{remaining.hours}</strong>Hours
      </div>
      <div className="countdown-item">
        <strong>{remaining.minutes}</strong>Minutes
      </div>
      <div className="countdown-item">
        <strong>{remaining.seconds}</strong>Seconds
      </div>
    </div>
  );
}
