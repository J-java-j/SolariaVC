type TurnstileOptions = {
  sitekey: string;
  action: 'contact';
  theme: 'light' | 'dark' | 'auto';
  size: 'flexible';
  'response-field': boolean;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  'timeout-callback': () => void;
};

type Turnstile = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: Turnstile }
}

let loading: Promise<Turnstile> | null = null;
let loadAttempt = 0;

export function loadTurnstile(): Promise<Turnstile> {
  if (loading) return loading;
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const callbackName = `solariaTurnstileLoaded${++loadAttempt}`;
    const callbacks = window as unknown as Record<string, unknown>;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete callbacks[callbackName];
      script.remove();
      loading = null;
      reject(new Error('The security check could not load. Check your connection and try again.'));
    };
    const timeout = window.setTimeout(fail, 15_000);
    // Cloudflare's load callback supports async scripts; ready() does not.
    callbacks[callbackName] = () => {
      if (settled) return;
      if (!window.turnstile) return fail();
      settled = true;
      window.clearTimeout(timeout);
      delete callbacks[callbackName];
      resolve(window.turnstile);
    };
    script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${callbackName}`;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
