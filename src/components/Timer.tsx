"use client";

import { useEffect, useMemo, useState } from "react";

type TimerProps = {
  endsAt: number | null;
  limitSeconds: number;
  closed: boolean;
};

export function Timer({ endsAt, limitSeconds, closed }: TimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endsAt || closed) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [closed, endsAt]);

  const remainingSeconds = useMemo(() => {
    if (!endsAt || closed) {
      return 0;
    }

    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  }, [closed, endsAt, now]);

  const progress = limitSeconds > 0 ? Math.max(0, Math.min(100, (remainingSeconds / limitSeconds) * 100)) : 0;

  return (
    <div className="timer" aria-label="Таймер вопроса">
      <div className="timer-top">
        <span>Таймер</span>
        <strong>{`00:${String(remainingSeconds).padStart(2, "0")}`}</strong>
      </div>
      <div className="timer-track">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
