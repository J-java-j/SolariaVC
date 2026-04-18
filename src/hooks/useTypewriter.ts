import { useEffect, useState } from 'react';

/**
 * Reveals a string character-by-character once `trigger` is true.
 * Speed is ms-per-character; startDelay defers the typing.
 */
export function useTypewriter(
  text: string,
  trigger: boolean,
  speed = 50,
  startDelay = 0
): string {
  const [out, setOut] = useState('');

  useEffect(() => {
    if (!trigger) {
      setOut('');
      return;
    }
    let i = 0;
    let intervalId: number | null = null;
    const startId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        i += 1;
        setOut(text.slice(0, i));
        if (i >= text.length && intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }, speed);
    }, startDelay);
    return () => {
      window.clearTimeout(startId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [text, trigger, speed, startDelay]);

  return out;
}
