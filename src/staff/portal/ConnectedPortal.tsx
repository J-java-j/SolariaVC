import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import { AccountManagement, Dashboard, PortalFrame, SignIn, type Page } from './PortalScreens';
import type { Account, AccountInput, PreviewView, Role } from './accounts';
import { ApiError, currentAccount, login, changePassword, request, roster } from './localApi';
import PasswordForm from './PasswordForm';

type Workspace = { user: Account; page: Page; accounts: Account[] };

function permittedPage(role: Role): Page {
  const section = new URLSearchParams(location.search).get('section');
  if (section === 'settings') return 'settings';
  if (section === 'staff' && role !== 'staff') return 'staff';
  if (section === 'board-admins' && role === 'owner') return 'board-admins';
  return 'dashboard';
}

function setPage(page: Page, replace = false) {
  const url = new URL(location.href);
  url.searchParams.delete('preview');
  if (page === 'dashboard') url.searchParams.delete('section');
  else url.searchParams.set('section', page);
  if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

export default function ConnectedPortal() {
  const [code, setCode] = useState(() => new URLSearchParams(location.hash.slice(1)).get('invite'));
  useEffect(() => {
    const changed = () => setCode(new URLSearchParams(location.hash.slice(1)).get('invite'));
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  if (code !== null) {
    const finish = async () => {
      await request('/session', 'DELETE');
      history.replaceState(null, '', '/staff');
      setCode(null);
    };
    return <PortalFrame connected view="signin" page="dashboard" navigate={finish}>
      <main id="portal-main" className="container-x portal-main"><PasswordForm key={code} code={code} onSignIn={finish} /></main>
    </PortalFrame>;
  }
  if (new URLSearchParams(location.search).get('recover') === '1') return <RecoveryPage />;
  return <WorkspacePortal />;
}

function RecoveryPage() {
  const [status, setStatus] = useState<'ready' | 'sending' | 'sent' | 'error'>('ready');
  return <PortalFrame connected view="signin" page="dashboard" navigate={() => location.assign('/staff')}>
    <main id="portal-main" className="container-x portal-main"><section className="portal-signin-panel">
      <h1>Recover your Team Login</h1>
      {status === 'sent' ? <p role="status">If your account is eligible, check your inbox for a new password link.</p> :
        <form onSubmit={async event => {
          event.preventDefault();
          if (status === 'sending') return;
          const email = String(new FormData(event.currentTarget).get('email') || '').trim();
          setStatus('sending');
          try { await request('/recovery', 'POST', { email }); setStatus('sent'); }
          catch { setStatus('error'); }
        }}>
          <label className="field-label">Email<input className="field" type="email" name="email" required autoComplete="email" maxLength={254} /></label>
          {status === 'error' && <p className="form-error" role="alert">Could not send the request. Please try again in a few minutes.</p>}
          <Button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Requesting?' : 'Email me a password link'}</Button>
        </form>}
      <details><summary>Enter a setup code from your email</summary>
        <form onSubmit={event => {
          event.preventDefault();
          const code = String(new FormData(event.currentTarget).get('setup-code') || '').trim();
          const link = new URL('/staff', location.origin);
          link.hash = new URLSearchParams({ invite: code }).toString();
          location.assign(link.href);
        }}>
          <label className="field-label">Private setup code<input className="field" name="setup-code" type="password" required autoComplete="off" spellCheck={false} pattern="[A-Za-z0-9_\-]{16,2048}" /></label>
          <Button type="submit">Continue to password setup</Button>
        </form>
      </details>
      <a className="portal-text-action" href="/staff">Back to sign in</a>
    </section></main>
  </PortalFrame>;
}

function WorkspacePortal() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [checking, setChecking] = useState(true);
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState('');
  const version = useRef(0);

  const signOut = async () => {
    ++version.current;
    try {
      await request('/session', 'DELETE');
      ++version.current;
      setWorkspace(null);
      setOffline(false);
      setChecking(false);
      setMessage('');
      setPage('dashboard', true);
    } catch { setMessage('Could not sign out. Please try again.'); }
  };

  const refresh = useCallback(async () => {
    const revision = ++version.current;
    try {
      let user = await currentAccount();
      if (revision !== version.current) return;
      const resume = new URLSearchParams(location.search).get('launch');
      if (resume && /^[a-zA-Z0-9-]{1,64}$/.test(resume)) {
        // The server resolves the ID and checks current permissions in this tab.
        setWorkspace({ user, page: 'dashboard', accounts: [] });
        setOffline(false);
        const clean = new URL(location.href);
        clean.searchParams.delete('launch');
        history.replaceState(null, '', clean);
        location.assign('/staff/launch/' + resume);
        return;
      }
      let page = permittedPage(user.role);
      let accounts: Account[] = [];
      if (page === 'staff' || page === 'board-admins') {
        try { accounts = await roster(); }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 403) throw error;
          // Permissions may have changed between the profile and roster requests.
          user = await currentAccount();
          page = 'dashboard';
        }
      }
      if (revision !== version.current) return;
      const redirected = page === 'dashboard' && new URLSearchParams(location.search).has('section');
      setOffline(false);
      setPage(page, true);
      setMessage(redirected ? 'Your current role can access the dashboard.' : '');
      setWorkspace({ user, page, accounts });
    } catch (error) {
      if (revision !== version.current) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        setWorkspace(null);
        setOffline(false);
        setMessage(error.status === 401 ? '' : 'This account no longer has portal access.');
      } else {
        setWorkspace(null);
        setOffline(true);
        setMessage('Could not load your workspace. Check your connection and try again.');
      }
    } finally {
      if (revision === version.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    sessionStorage.removeItem('solaria.staff.local.idToken'); // Discard pre-cookie sessions.
    void refresh();
    const visible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('popstate', refresh);
    window.addEventListener('focus', visible);
    window.addEventListener('pageshow', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      ++version.current;
      window.removeEventListener('popstate', refresh);
      window.removeEventListener('focus', visible);
      window.removeEventListener('pageshow', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);

  async function signIn(email: string, password: string) {
    const token = await login(email, password);
    await request('/session', 'POST', undefined, token);
    setChecking(true);
    await refresh();
  }

  function navigate(view: PreviewView, page: Page = 'dashboard') {
    if (view === 'signin') { signOut(); return; }
    setPage(page);
    void refresh();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function mutate(id: string | undefined, fields: object) {
    try {
      await request(id ? '/accounts/' + encodeURIComponent(id) : '/accounts', id ? 'PATCH' : 'POST', fields);
    } finally {
      // Reconcile even on denial: the target may have moved, or the current
      // administrator may have lost management access in another session.
      await refresh();
    }
  }

  function save(input: AccountInput, id?: string) {
    const fields = { displayName: input.name, role: input.role };
    return mutate(id, id ? fields : { ...fields, email: input.username });
  }

  const user = workspace?.user;
  return <PortalFrame connected view={user?.role ?? 'signin'} page={workspace?.page ?? 'dashboard'} name={user?.name} navigate={navigate}>
    {checking ? <main id="portal-main" className="container-x portal-main"><div className="portal-signin-panel portal-loading" role="status">Opening your workspace…</div></main>
      : workspace ? <main id="portal-main" className="container-x portal-main" tabIndex={-1}>
        {message && <p className="portal-inline-notice" role="status">{message}</p>}
        {workspace.page === 'dashboard'
          ? <Dashboard role={workspace.user.role} onManage={page => navigate(workspace.user.role, page)} />
          : workspace.page === 'settings' ? <PasswordForm onChange={async (current, next) => {
              try {
                const token = await changePassword(workspace.user, current, next);
                await request('/session', 'POST', undefined, token);
              } finally { await refresh(); }
            }} />
          : <AccountManagement key={workspace.user.id + workspace.user.role + workspace.page} connected
              role={workspace.user.role} group={workspace.page === 'staff' ? 'staff' : 'board-admin'}
              accounts={workspace.accounts} onSave={save}
              onResend={async id => {
                try { await request('/accounts/' + encodeURIComponent(id) + '/invite', 'POST'); }
                finally { await refresh(); }
              }}
              onStatus={account => mutate(account.id, { active: account.status !== 'active' })} />}
      </main> : offline ? <main id="portal-main" className="container-x portal-main">
        <section className="portal-signin-panel"><h1>Workspace unavailable</h1><p role="alert">{message}</p>
        <div className="portal-dialog-actions"><Button variant="secondary" onClick={() => signOut()}>Sign out</Button>
        <Button onClick={() => void refresh()}>Try again</Button></div></section>
      </main> : <SignIn onLogin={signIn} message={message} />}
  </PortalFrame>;
}
