import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Mark } from '../../components/primitives';
import Button from '../../components/ui/Button';
import { tools } from '../Staff';
import {
  roleLabels,
  type Account, type AccountInput, type PreviewView, type Role,
} from './accounts';
import './portal.css';

import destinations from '../../../staff-service/destinations.json';

const CheckedLinks = createContext(false);
const shortcuts = new Map(Object.entries(destinations).map(([id, item]) => [item.href, { id, web: !('action' in item) }]));

function shortcut(href: string, checked: boolean, download = false) {
  const item = shortcuts.get(href);
  if (checked && !item) throw new Error('Unregistered team shortcut.');
  const newTab = checked ? item!.web : href.startsWith('http');
  return {
    href: checked ? '/staff/launch/' + item!.id : href,
    ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    ...(download && !checked ? { download: '' } : {}),
  };
}

export type Page = 'dashboard' | 'staff' | 'board-admins' | 'settings';
type Shortcut = (typeof tools)[number]['links'][number];
const [sign, terminal, ...secondaryTools] = tools;
const sampleUsers: Record<Role, { name: string; initials: string }> = {
  staff: { name: 'Avery Morgan', initials: 'AM' },
  'board-admin': { name: 'Riley Chen', initials: 'RC' },
  owner: { name: 'Alex Rowan', initials: 'AR' },
};
function Arrow({ external = false, download = false }: { external?: boolean; download?: boolean }) {
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={download ? 'M8 2v9M4.5 7.5L8 11l3.5-3.5M3 14h10' : external ? 'M4 12L12 4M5 4h7v7' : 'M3 8h10M9 4l4 4-4 4'} />
  </svg>;
}

function ToolButton({ link, label }: { link: Shortcut; label?: string }) {
  const props = shortcut(link.href, useContext(CheckedLinks), link.download);
  const external = Boolean(props.target);
  return <Button {...props} variant="primary" icon={external ? 'external' : 'arrow'}>
    {label ?? link.label}{external && <span className="sr-only"> (opens in a new tab)</span>}
  </Button>;
}

function QuickLinks() {
  const checked = useContext(CheckedLinks);
  return <section className="portal-quick" aria-labelledby="quick-heading">
    <div className="portal-section-heading"><h2 id="quick-heading">Quick Links</h2></div>
    <div className="portal-quick-grid">
      {secondaryTools.map((tool) => <div key={tool.name}>
        <h3>{tool.icon}{tool.name}</h3>
        <ul>{tool.links.map((link) => {
          const props = shortcut(link.href, checked, link.download);
          const external = Boolean(props.target);
          return <li key={link.href}><a {...props}>
            <span>{link.label}</span><Arrow external={external} download={link.download} />
            {external && <span className="sr-only">(opens in a new tab)</span>}
          </a></li>;
        })}</ul>
      </div>)}
    </div>
  </section>;
}

function NavIcon({ kind }: { kind: 'dashboard' | 'people' | 'board' | 'settings' }) {
  const paths = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    people: 'M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2 M12.5 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0 M16 4a3 3 0 0 1 0 6 M17 14a4 4 0 0 1 4 4v2',
    board: 'M12 2l8 4v6c0 5-5 8-8 10-3-2-8-5-8-10V6z M8.5 12l2.5 2.5 4.5-5',
    settings: 'M4 7h7m5 0h4M4 17h2m5 0h9 M16 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M11 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden><path d={paths[kind]} /></svg>;
}

function MarketChart() {
  return <svg className="portal-market-chart" viewBox="0 0 420 140" fill="none" aria-hidden>
    <defs><linearGradient id="market-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#a5c7a1" stopOpacity=".25"/><stop offset="1" stopColor="#a5c7a1" stopOpacity="0"/></linearGradient></defs>
    <path className="chart-grid" d="M0 20h420M0 50h420M0 80h420M0 110h420 M40 0v140m60-140v140m60-140v140m60-140v140m60-140v140m60-140v140m60-140v140" />
    <path d="M0 117l30-7 14 5 31-24 21 8 31-25 11 3 17-15 13 12 31-9 17 13 22-26 20 6 16-23 24 10 24-18 22 7 22-20 18 4 16-10v132H0Z" fill="url(#market-fill)"/>
    <path d="M0 117l30-7 14 5 31-24 21 8 31-25 11 3 17-15 13 12 31-9 17 13 22-26 20 6 16-23 24 10 24-18 22 7 22-20 18 4 16-10" stroke="#bcd2aa" strokeWidth="2"/>
  </svg>;
}

export function Dashboard({ role, onManage }: { role: Role; onManage: (page: Page) => void }) {
  const checked = useContext(CheckedLinks);
  return <>
    <div className="portal-page-intro"><h1>{roleLabels[role]} dashboard</h1></div>
    <section className="portal-terminal" aria-labelledby="terminal-heading">
      <div className="portal-terminal-content"><span className="portal-tool-symbol">{terminal.icon}</span>
        <h2 id="terminal-heading">Solaria Terminal</h2><p>Options flow, prices and charts for the trading desk.</p>
        <ToolButton link={terminal.links[0]} label="Open Terminal" />
      </div>
      <MarketChart />
    </section>
    <section className="portal-sign" aria-labelledby="sign-heading">
      <div className="portal-tool-icon" aria-hidden>{sign.icon}</div>
      <div className="portal-sign-copy"><h2 id="sign-heading">Solaria Sign</h2><p>Send, track and verify signed documents.</p>
        <div className="portal-sign-actions">
          <a className="portal-text-action" {...shortcut(sign.links[1].href, checked)}>{sign.links[1].label}<Arrow external={checked} /></a>
          {role === 'owner' && <a className="portal-text-action" {...shortcut(sign.links[2].href, checked)} aria-label="Solaria Sign → Team">{sign.links[2].label}<Arrow external={checked} /></a>}
        </div>
      </div>
      <ToolButton link={sign.links[0]} />
    </section>
    {role !== 'staff' && <section className="portal-admin" aria-labelledby="admin-heading">
      <h2 id="admin-heading">Administration</h2>
      <div className="portal-admin-grid">
        <button onClick={() => onManage('staff')}><NavIcon kind="people" /><span>Manage Staff</span><Arrow /></button>
        {role === 'owner' && <button onClick={() => onManage('board-admins')}><NavIcon kind="board" /><span>Manage Board Admins</span><Arrow /></button>}
        <a {...shortcut(terminal.links[1].href, checked)}>{terminal.icon}<span>Terminal Admin</span><Arrow external /></a>
      </div>
    </section>}
    <QuickLinks />
  </>;
}

export function SignIn({ onPreview, onLogin, message }: {
  onPreview?: () => void; onLogin?: (email: string, password: string) => Promise<void>; message?: string;
}) {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!onLogin) {
      form.reset();
      setNotice('Authentication will be connected later. No credentials were sent. Choose a preview view above to explore.');
      return;
    }
    const values = new FormData(form);
    setBusy(true);
    setNotice('');
    try {
      const password = String(values.get('password'));
      await onLogin(String(values.get('email')).trim(), password);
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  return <main id="portal-main" className="container-x portal-signin" tabIndex={-1}>
    <section className="portal-signin-panel" aria-labelledby="signin-heading">
      <div className="portal-print" aria-hidden="true"><span /></div>
      <h1 id="signin-heading">Team sign-in</h1>
      <form onSubmit={submit} noValidate={!onLogin} autoComplete={onLogin ? "on" : "off"}>
        {onLogin ? <div><label className="field-label" htmlFor="portal-email">Email</label><input className="field" id="portal-email" name="email" type="email" required placeholder="Your email" autoComplete="username" /></div> : <div><label className="field-label" htmlFor="portal-username">Username</label><input className="field" id="portal-username" name="username" placeholder="Your username" autoComplete="off" /></div>}
        <div><label className="field-label" htmlFor="portal-password">Password</label><input className="field" id="portal-password" name="password" type="password" placeholder="Your password" required={Boolean(onLogin)} autoComplete={onLogin ? "current-password" : "off"} /></div>
        <Button type="submit" size="lg" icon="arrow" className="portal-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      {(notice || message) && <p role="alert" className="form-error">{notice || message}</p>}
      {onLogin && <a className="portal-text-action" href="/staff?recover=1">Request password recovery</a>}
      {onPreview && <div className="portal-signin-demo"><button className="portal-text-action" onClick={onPreview}>Explore the Staff preview<Arrow /></button></div>}
      <p className="portal-fine-print">{onLogin ? (import.meta.env.DEV ? 'Local emulator · Use a fictional account.' : '') : 'Development preview. Use fictional details only.'}</p>
    </section>
  </main>;
}

function Modal({ title, children, onClose, fallbackFocus }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  fallbackFocus: RefObject<HTMLDivElement>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-focus]')?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const fitViewport = () => {
      if (!viewport) return;
      dialog.style.setProperty('--dialog-height', Math.max(1, viewport.height - 24) + 'px');
      dialog.style.top = viewport.offsetTop + 'px';
      dialog.style.bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) + 'px';
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    return () => {
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      dialog.close();
      // A role change or status filter can remove the row that opened the dialog.
      const target = previous?.isConnected ? previous : fallbackFocus.current;
      target?.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);
  return <dialog ref={ref} className="portal-dialog theme-light" aria-labelledby="account-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="portal-dialog-inner"><div className="portal-dialog-heading"><h2 id="account-dialog-title">{title}</h2><button type="button" className="portal-icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</div>
  </dialog>;
}

function AccountEditor({ account, defaultRole, actor, onSave, onClose, fallbackFocus, connected }: {
  account?: Account; defaultRole: 'staff' | 'board-admin'; actor: Role;
  connected: boolean; onSave: (input: AccountInput, id?: string) => Promise<void>; onClose: () => void;
  fallbackFocus: RefObject<HTMLDivElement>;
}) {
  const [input, setInput] = useState<AccountInput>(account ?? { name: '', username: '', role: defaultRole });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (field: 'name' | 'username', value: string) => setInput((current) => ({ ...current, [field]: value }));
  return <Modal title={connected ? (account ? 'Edit account' : 'Invite account') : account ? 'Edit sample account' : defaultRole === 'board-admin' ? 'Add a sample board admin' : 'Add a sample staff account'} onClose={() => { if (!busy) onClose(); }} fallbackFocus={fallbackFocus}>
    <p className="portal-muted">{connected ? (account ? 'The sign-in email stays with this account.' : 'The recipient sets their own password using the invitation link.') : 'Fictional accounts for this preview. Changes reset when you refresh.'}</p>
    <form className="portal-account-form" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      try { await onSave(input, account?.id); } catch (err) { setError(err instanceof Error ? err.message : 'Please check the account details.'); } finally { setBusy(false); }
    }}>
      <div><label className="field-label" htmlFor="sample-name">Name</label><input data-dialog-focus required maxLength={120} id="sample-name" className="field" value={input.name} autoComplete="off" onChange={(event) => update('name', event.target.value)} /></div>
      {connected ? <div><label className="field-label" htmlFor="account-email">Email</label><input required type="email" readOnly={Boolean(account)} id="account-email" className="field" value={input.username} placeholder={import.meta.env.DEV ? "name@example.test" : "Email address"} onChange={event => update("username", event.target.value)} /></div> : <div><label className="field-label" htmlFor="sample-username">Username</label><input required maxLength={32} minLength={3} id="sample-username" className="field" value={input.username} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby="username-hint" onChange={(event) => update('username', event.target.value)} /><p id="username-hint" className="portal-fine-print">3–32 characters. Letters, numbers, dots, underscores or hyphens.</p></div>}
      <div><label className="field-label" htmlFor="sample-role">Role</label><select className="field" id="sample-role" value={input.role} disabled={actor !== 'owner'} onChange={(event) => setInput((current) => ({ ...current, role: event.target.value as Role }))}><option value="staff">Staff</option>{actor === 'owner' && <option value="board-admin">Board Admin</option>}</select></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="portal-dialog-actions"><Button disabled={busy} variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{connected ? (account ? "Save changes" : "Send invitation") : account ? 'Save sample changes' : 'Add sample account'}</Button></div>
    </form>
  </Modal>;
}

export function AccountManagement({ role, group, accounts, onSave, onStatus, onResend, connected = false }: {
  role: Role; group: 'staff' | 'board-admin'; accounts: Account[];
  onSave: (input: AccountInput, id?: string) => void | Promise<void>;
  onResend?: (id: string) => Promise<void>;
  onStatus: (account: Account) => void | Promise<void>; connected?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<Account | 'new' | null>(null);
  const [statusAccount, setStatusAccount] = useState<Account | null>(null);
  const [notice, setNotice] = useState('');
  const [invited, setInvited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);
  const people = accounts.filter((account) => account.role === group);
  const query = search.trim().toLowerCase();
  const visible = people.filter((account) => `${account.name} ${account.username}`.toLowerCase().includes(query) && (filter === 'all' || account.status === filter));
  const title = group === 'staff' ? 'Manage Staff' : 'Manage Board Admins';

  function openEditor(account: Account | 'new') {
    setNotice('');
    setInvited(false);
    setEditor(account);
  }

  async function saveAccount(input: AccountInput, id?: string) {
    await onSave(input, id);
    setInvited(connected && !id);
    setEditor(null);
    if (input.role !== group) {
      const destination = input.role === 'staff' ? 'Manage Staff' : 'Manage Board Admins';
      setNotice(id ? `Account moved to ${destination}.` : `Account added to ${destination}.`);
    } else {
      setNotice(connected ? (id ? 'Account updated.' : `Invitation created for ${input.username}.`) : (id ? 'Sample account updated.' : 'Sample account added.'));
    }
  }

  async function confirmStatus(account: Account) {
    setBusy(true);
    try {
      await onStatus(account);
      setStatusAccount(null);
      const subject = connected ? 'Account' : 'Sample account';
      setNotice(subject + (account.status === 'active' ? ' deactivated.' : ' reactivated.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update account status.');
    } finally { setBusy(false); }
  }

  return <>
    <div className="portal-page-intro portal-manage-title"><h1>{title}</h1>
      <Button onClick={() => openEditor('new')}><span aria-hidden>＋</span>{group === 'staff' ? 'Add staff' : 'Add board admin'}</Button>
    </div>
    <section className="portal-roster" aria-label={title}>
      <div className="portal-roster-toolbar">
        <div className="portal-roster-filters"><label className="sr-only" htmlFor="account-search">{connected ? "Search accounts" : "Search sample accounts"}</label><input type="search" id="account-search" placeholder="Search accounts" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="sr-only" htmlFor="account-filter">Filter by account status</label><select id="account-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </div>
      <div className="portal-roster-feedback" data-confirmed={Boolean(notice)}>
        <p role="status">{notice || (visible.length + (visible.length === 1 ? ' account' : ' accounts'))} {import.meta.env.DEV && invited && <a className="portal-text-action" {...shortcut('/staff/outbox', true)}>Open local outbox ↗</a>}</p>
      </div>
      <div className="portal-table-scroll" ref={tableRef} tabIndex={-1} role="region" aria-label="Account table">
        <table className="portal-table"><caption className="sr-only">{roleLabels[group]} accounts</caption><thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col" className="actions-heading">Actions</th></tr></thead>
          <tbody>{visible.map((account) => {
            const active = account.status === 'active';
            const action = active ? 'Deactivate' : 'Reactivate';
            return <tr key={account.id}>
              <th scope="row"><span className="portal-person"><span className="portal-avatar" aria-hidden>{account.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{account.name}</strong><small>{account.username}</small></span></span></th>
              <td className="portal-table-role">{roleLabels[account.role]}</td>
              <td><span className={`portal-status portal-status--${account.status}`}><span />{active ? 'Active' : 'Inactive'}</span></td>
              <td><div className="portal-table-actions">
                <button onClick={() => openEditor(account)} aria-label={`Edit ${account.name}`}>Edit</button>
                {onResend && active && account.awaitingSetup && <button disabled={busy} onClick={async () => {
                  setBusy(true);
                  try { await onResend(account.id); setNotice('New invitation prepared for ' + account.username + '.'); setInvited(true); }
                  catch (err) { setInvited(false); setNotice(err instanceof Error ? err.message : 'Could not resend invitation.'); }
                  finally { setBusy(false); }
                }}>Resend invitation</button>}
                <button className={active ? 'portal-deactivate' : ''} onClick={() => {
                  setNotice('');
                  setError('');
                  setInvited(false);
                  setStatusAccount(account);
                }} aria-label={`${action} ${account.name}`}>{action}</button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!visible.length && <div className="portal-empty"><h3>{connected ? "No accounts found." : "No sample accounts found."}</h3><p>{people.length ? 'Try another name or status.' : 'Add the first account to this list.'}</p>{people.length > 0 && <Button variant="secondary" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</Button>}</div>}
    </section>
    {!connected && <p className="portal-fine-print portal-roster-note">{role === 'owner' ? 'Owner preview · manage staff and board admins. The owner account stays fixed.' : 'Board Admin preview · manage staff accounts.'}</p>}
    {editor && <AccountEditor connected={connected}
      account={editor === 'new' ? undefined : editor}
      actor={role}
      defaultRole={group}
      onClose={() => setEditor(null)}
      onSave={saveAccount}
      fallbackFocus={tableRef}
    />}
    {statusAccount && <Modal title={`${statusAccount.status === 'active' ? 'Deactivate' : 'Reactivate'} ${connected ? 'account' : 'sample account'}?`} onClose={() => { if (!busy) setStatusAccount(null); }} fallbackFocus={tableRef}>
      <p className="portal-muted">{statusAccount.name} will be marked {statusAccount.status === 'active' ? 'inactive' : 'active'}{connected ? ' in the team portal.' : ' in this preview. This affects sample data only and resets on refresh.'}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="portal-dialog-actions">
        <Button variant="secondary" data-dialog-focus disabled={busy} onClick={() => setStatusAccount(null)}>Cancel</Button>
        <Button className={statusAccount.status === 'active' ? 'portal-danger' : undefined} disabled={busy} onClick={() => confirmStatus(statusAccount)}>{statusAccount.status === 'active' ? 'Deactivate' : 'Reactivate'}{!connected && ' sample'}</Button>
      </div>
    </Modal>}
  </>;
}

export function PortalFrame({ view, page, name, navigate, children, previewControls, connected = false }: {
  view: PreviewView; page: Page; name?: string; navigate: (view: PreviewView, page?: Page) => void;
  children: ReactNode; previewControls?: ReactNode; connected?: boolean;
}) {
  const [userMenu, setUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenu) return;
    const close = (event: PointerEvent) => { if (!userMenuRef.current?.contains(event.target as Node)) setUserMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setUserMenu(false); userMenuRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [userMenu]);
  useEffect(() => {
    const section = page === 'settings' ? 'Settings' : page === 'staff' ? 'Manage Staff' : 'Manage Board Admins';
    document.title = view === 'signin' ? 'Solaria Team Portal' :
      (page === 'dashboard' ? roleLabels[view] + ' dashboard' : section) + ' — Solaria Team Portal';
  }, [view, page]);

  useEffect(() => { setUserMenu(false); }, [view, page]);
  const displayName = name ?? (view === 'signin' ? '' : sampleUsers[view].name);
  const initials = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  const signedInPreview = view !== 'signin';
  const checked = connected && signedInPreview;
  return <CheckedLinks.Provider value={checked}><div className="portal theme-light">
    <a className="portal-skip" href="#portal-main">Skip to content</a>
    {previewControls && <div className="portal-preview-bar"><span>Sample accounts</span>{previewControls}</div>}
    <div className={signedInPreview ? 'portal-layout' : 'portal-auth-layout'}>
      <header className="portal-header">
        <a {...shortcut('/', checked)} className="portal-brand"><Mark size={34} /><span>Solaria Capital<small>Team portal</small></span></a>
        {signedInPreview && <nav className="portal-nav" aria-label="Solaria Team Portal">
          <button aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => navigate(view)}><NavIcon kind="dashboard" />Dashboard</button>
          {view !== 'staff' && <button aria-current={page === 'staff' ? 'page' : undefined} onClick={() => navigate(view, 'staff')}><NavIcon kind="people" />Manage Staff</button>}
          {view === 'owner' && <button aria-current={page === 'board-admins' ? 'page' : undefined} onClick={() => navigate(view, 'board-admins')}><NavIcon kind="board" />Board Admins</button>}
        </nav>}
        <div className="portal-header-end">
          <a {...shortcut('/', checked)} className="portal-site-link">Back to the site<Arrow external /></a>
          {signedInPreview && <div className="portal-user" ref={userMenuRef}>
            <button className="portal-user-trigger" aria-label={'Account menu for ' + displayName} aria-expanded={userMenu} aria-controls="portal-user-panel" onClick={() => setUserMenu(!userMenu)}>
              <span className="portal-avatar">{initials}</span><span className="portal-user-name">{displayName}<small>{roleLabels[view]}</small></span><span aria-hidden>⌄</span>
            </button>
            {userMenu && <div className="portal-user-panel" id="portal-user-panel">
              {connected && <button onClick={() => { setUserMenu(false); navigate(view, 'settings'); }}><NavIcon kind="settings" />Settings</button>}
              <button onClick={() => navigate('signin')}>{connected ? 'Sign out' : 'Return to sign-in preview'}<Arrow /></button>
            </div>}
          </div>}
        </div>
      </header>
      <div className="portal-workarea">{children}
        <footer className="portal-footer"><span>Solaria Capital · UC San Diego</span><a {...shortcut('mailto:contact@solariavc.com', checked)}>contact@solariavc.com</a></footer>
      </div>
    </div>
  </div></CheckedLinks.Provider>;
}
