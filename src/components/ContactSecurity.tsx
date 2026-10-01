import { useEffect, useRef, useState } from 'react';
import { loadTurnstile } from '../lib/turnstile';

export default function ContactSecurity({ siteKey, onToken }: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('Loading security check…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let removeWidget: (() => void) | undefined;
    onToken('');
    setFailed(false);
    setStatus('Loading security check…');
    loadTurnstile().then((api) => {
      if (!active || !container.current) return;
      const invalidate = (message: string) => {
        if (!active) return;
        onToken('');
        setStatus(message);
        setFailed(true);
      };
      setStatus('Please complete the security check.');
      const id = api.render(container.current, {
        sitekey: siteKey,
        action: 'contact',
        theme: 'light',
        size: 'flexible',
        'response-field': false,
        callback: (token) => {
          if (!active) return;
          onToken(token);
          setStatus('Security check complete.');
          setFailed(false);
        },
        'expired-callback': () => invalidate('The security check expired. Please complete it again.'),
        'error-callback': () => invalidate('The security check failed. Please try again.'),
        'timeout-callback': () => invalidate('The security check timed out. Please try again.'),
      });
      removeWidget = () => api.remove(id);
    }).catch((err) => {
      if (!active) return;
      setStatus(err instanceof Error ? err.message : 'The security check is unavailable.');
      setFailed(true);
    });
    return () => {
      active = false;
      removeWidget?.();
    };
  }, [siteKey, onToken, attempt]);

  return (
    <div aria-label="Security check">
      <div ref={container} />
      <p className="mt-2 text-[15px] text-[var(--fg)]" role="status">{status}</p>
      {failed && (
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-2 text-[15px] underline underline-offset-4">
          Retry security check
        </button>
      )}
    </div>
  );
}
