"use client";

import { useEffect, useState } from "react";

/**
 * Ports the inline <script> countdown from the prototype's `/home` route
 * (src/server.js). Same target date and same arithmetic.
 *
 * Note: the default has no timezone suffix, so it parses as *local* time.
 * That matches the prototype exactly and is deliberate — do not "fix" it to
 * UTC without deciding what the couple actually wants. `theme_settings.wedding_date`
 * is a bare date with no time-of-day column, so the "T15:00:00" ceremony start
 * time is still fixed here, not admin-configurable — only the date comes from
 * the theme settings the caller passes in.
 *
 * Starts at zeroes so the server-rendered markup matches the first client
 * render (the prototype also shipped 0s and let script fill them in); the real
 * values land on the first post-mount tick.
 */
const DEFAULT_TARGET_DATE = "2026-12-14T15:00:00";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

const ZERO: Remaining = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function remainingUntil(targetDate: string): Remaining {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return ZERO;
  return {
    days: Math.floor(diff / 1000 / 60 / 60 / 24),
    hours: Math.floor(diff / 1000 / 60 / 60) % 24,
    minutes: Math.floor(diff / 1000 / 60) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

export default function Countdown({
  targetDate = DEFAULT_TARGET_DATE,
}: {
  targetDate?: string;
}) {
  const [remaining, setRemaining] = useState<Remaining>(ZERO);

  useEffect(() => {
    setRemaining(remainingUntil(targetDate));
    const timer = setInterval(() => setRemaining(remainingUntil(targetDate)), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

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
