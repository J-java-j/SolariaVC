import { useState, type FormEvent } from 'react';
import { api } from './api';
import { Notice, PageMessage, useBusy } from './ui';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useBusy();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.requestLogin(email);
      setSent(true);
    });
  };

  if (sent) {
    return (
      <PageMessage title="Check your email">
        <p>If {email} can send documents, a sign-in link is on its way. It works once and expires soon.</p>
      </PageMessage>
    );
  }
  return (
    <PageMessage title="Sign in to send documents">
      <form onSubmit={submit} className="stack">
        <label className="field">
          Work email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && <Notice>{error}</Notice>}
        <button className="primary" disabled={busy}>{busy ? 'Sending' : 'Email me a sign-in link'}</button>
      </form>
    </PageMessage>
  );
}

// A button rather than an automatic sign-in, because mail scanners open links and
// would spend this one-time token before the person ever saw it.
export function LoginLanding() {
  const { busy, error, run } = useBusy();
  const token = window.location.hash.slice(1);

  const finish = () => run(async () => {
    await api.verifyLogin(token);
    window.location.replace('/sign');
  });

  return (
    <PageMessage title="Finish signing in">
      {error && <Notice>{error}</Notice>}
      {!error && <p>Continue to open your documents on this device.</p>}
      {error
        ? <a className="primary" href="/sign">Get a new link</a>
        : <button type="button" className="primary" disabled={busy || !token} onClick={finish}>{busy ? 'Signing in' : 'Continue'}</button>}
    </PageMessage>
  );
}
