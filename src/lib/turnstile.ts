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
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: Turnstile }
}

let loading: Promise<Turnstile> | null = null;

export function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) {
    return new Promise((resolve) => window.turnstile!.ready(() => resolve(window.turnstile!)));
  }
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.remove();
      loading = null;
      reject(new Error('The security check could not load. Check your connection and try again.'));
    };
    const timeout = window.setTimeout(fail, 15_000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      if (!window.turnstile) return fail();
      window.turnstile.ready(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(window.turnstile!);
      });
    };
    document.head.append(script);
  });
  return loading;
}
