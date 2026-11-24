import { useEffect, useRef, useState } from 'react';
import { AccountManagement, Dashboard, PortalFrame, SignIn, type Page } from './PortalScreens';
import { createSampleAccounts, parsePreview, saveSampleAccount, toggleSampleStatus, type PreviewView } from './accounts';

const previewOptions: [PreviewView, string][] = [
  ['signin', 'Sign-in screen'], ['staff', 'Staff dashboard'],
  ['board-admin', 'Board Admin dashboard'], ['owner', 'Owner dashboard'],
];

function readLocation(): { view: PreviewView; page: Page } {
  const params = new URLSearchParams(window.location.search);
  const view = parsePreview(params.get('preview'));
  const section = params.get('section');
  const page = section === 'staff' && (view === 'board-admin' || view === 'owner')
    ? 'staff'
    : section === 'board-admins' && view === 'owner' ? 'board-admins' : 'dashboard';
  return { view, page };
}

export default function PortalPreview() {
  const [{ view, page }, setLocation] = useState(readLocation);
  const [accounts, setAccounts] = useState(createSampleAccounts);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const pop = () => setLocation(readLocation());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const navigate = (nextView: PreviewView, nextPage: Page = 'dashboard') => {
    const params = new URLSearchParams(window.location.search);
    params.set('preview', nextView);
    params.delete('section');
    if (nextPage !== 'dashboard') params.set('section', nextPage);
    window.history.pushState(null, '', `${window.location.pathname}?${params}`);
    setLocation(readLocation());
    window.scrollTo({ top: 0, behavior: 'instant' });
    mainRef.current?.focus();
  };
  return <PortalFrame previewControls={<label htmlFor="portal-preview-view">Development preview<select id="portal-preview-view" value={view} onChange={(event) => navigate(event.target.value as PreviewView)}>{previewOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>} view={view} page={page} navigate={navigate}>
    {view !== 'signin' ? <main id="portal-main" tabIndex={-1} ref={mainRef} className="container-x portal-main">
      {page === 'dashboard' ? <Dashboard role={view} onManage={(nextPage) => navigate(view, nextPage)} /> : <AccountManagement
        key={`${view}-${page}`}
        role={view}
        group={page === 'staff' ? 'staff' : 'board-admin'}
        accounts={accounts}
        onSave={(input, id) => setAccounts(saveSampleAccount(accounts, view, input, id))}
        onStatus={account => setAccounts(toggleSampleStatus(accounts, view, account.id))}
      />}
    </main> : <SignIn onPreview={() => navigate('staff')} />}
  </PortalFrame>;
}
