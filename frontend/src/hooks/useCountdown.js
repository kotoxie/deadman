import { useState, useEffect } from 'react';

export function useCountdown(targetDateStr) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!targetDateStr) return;

    function update() {
      const target = new Date(targetDateStr + (targetDateStr.endsWith('Z') ? '' : 'Z')).getTime();
      const diff = Math.max(0, target - Date.now());
      setRemaining(diff);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr]);

  if (remaining === null) return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, totalMs: 0 };

  const totalSec = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    isExpired: remaining <= 0,
    totalMs: remaining,
  };
}
