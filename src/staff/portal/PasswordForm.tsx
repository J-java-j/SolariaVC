import { useEffect, useState, type FormEvent } from 'react';
import Button from '../../components/ui/Button';
import { invitation } from './localApi';

type Props = { code: string; onSignIn: () => void } | { onChange: (current: string, next: string) => Promise<void> };

export default function PasswordForm(props: Props) {
  const setup = 'code' in props;
  const code = setup ? props.code : undefined;
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (code === undefined) return;
    let live = true;
    invitation(code).then(email => { if (live) setRecipient(email); }).catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [code]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const next = String(fields.get('new'));
    if (fields.get('confirm') !== next) {
      setMismatch(true);
      form.querySelector<HTMLInputElement>('[name="confirm"]')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (setup) await invitation(props.code, next);
      else await props.onChange(String(fields.get('current')), next);
      form.reset();
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <>{!setup && <div className="portal-page-intro"><h1>Settings</h1></div>}
    <section className={setup ? 'portal-signin-panel' : 'portal-signin-panel portal-settings-panel'}>
    {setup ? <><div className="portal-print" aria-hidden="true"><span /></div><h1>Set your password</h1></> : <h2>Change password</h2>}
    {done ? <><p role="status">{setup ? 'Your password is set.' : 'Your password has been changed.'}</p>
      {setup && <Button onClick={props.onSignIn}>Go to sign in</Button>}</>
      : <>
        {setup && recipient && <p>{recipient}</p>}
        {setup && !recipient && !error && <p role="status">Checking invitation…</p>}
        {(!setup || recipient) && <form onSubmit={submit}>
          {!setup && <label className="field-label">Current password<input className="field" type="password" name="current" autoComplete="current-password" required /></label>}
          <div><label className="field-label">New password<input className="field" type="password" name="new" autoComplete="new-password" minLength={6} aria-describedby="password-length" required onInput={() => setMismatch(false)} /></label>
          <p className="portal-fine-print" id="password-length">Use at least 6 characters.</p></div>
          <div><label className="field-label">Confirm password<input className="field" type="password" name="confirm" autoComplete="new-password" required
            aria-invalid={mismatch} aria-describedby={mismatch ? 'password-mismatch' : undefined} onInput={() => setMismatch(false)} /></label>
            {mismatch && <p id="password-mismatch" role="alert" className="form-error">Passwords don’t match</p>}</div>
          <Button type="submit" disabled={busy}>{setup ? 'Set password' : 'Save password'}</Button>
        </form>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {setup && error && <a className="portal-text-action" href="/staff?recover=1" target="_blank" rel="noopener noreferrer">Request a new invitation</a>}
      </>}
  </section></>;
}
