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
        <p>If {email.trim()} has documents with us, a link is on its way. It works once and expires in 15 minutes.</p>
        <button type="button" className="quiet" onClick={() => setSent(false)}>Use a different address</button>
      </PageMessage>
    );
  }
  return (
    <PageMessage title="Solaria Sign">
      <p>Enter your email address. We'll send you a link to every document waiting for your signature. Solaria team members get their full documents page.</p>
      <form onSubmit={submit} className="stack">
        <label className="field">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && <Notice>{error}</Notice>}
        <button className="primary" disabled={busy}>{busy ? 'Sending' : 'Email me a link'}</button>
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
