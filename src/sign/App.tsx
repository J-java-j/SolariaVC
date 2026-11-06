import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Envelope } from './api';
import Dashboard from './Dashboard';
import SignQueue from './SignQueue';
import Detail from './Detail';
import Editor from './Editor';
import { Login, LoginLanding } from './Login';
import { usePath } from './router';
import Signer from './Signer';
import Team from './Team';
import { Loading, PageMessage, Shell } from './ui';
import Verify from './Verify';

export type User = { name: string; email: string; owner: boolean };

function EnvelopePage({ id, user }: { id: string; user: User }) {
  const [env, setEnv] = useState<Envelope | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    api.get(id).then(setEnv).catch((e: ApiError) => setError(e.message));
  }, [id]);
  useEffect(reload, [reload]);

  if (error) return <Shell user={user}><PageMessage title={error} /></Shell>;
  if (!env) return <Loading />;
  if (env.status === 'draft') return <Editor key={env.id} env={env} user={user} onSent={setEnv} />;
  return <Shell user={user}><Detail key={env.id} env={env} onChange={setEnv} /></Shell>;
}

function SenderApp({ path }: { path: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <Loading />;
  if (!user) return <Login />;
  const envelope = /^\/sign\/e\/([0-9A-Z]{12})$/.exec(path);
  if (envelope) return <EnvelopePage key={envelope[1]} id={envelope[1]} user={user} />;
  if (path === '/sign/queue') return <Shell user={user}><SignQueue user={user} /></Shell>;
  if (path === '/sign/team' && user.owner) return <Shell user={user}><Team /></Shell>;
  return <Shell user={user}><Dashboard user={user} /></Shell>;
}

export default function App() {
  const path = usePath();
  if (path === '/s') return <Signer />;
  if (path === '/sign/verify') return <Verify />;
  if (path === '/sign/login') return <LoginLanding />;
  return <SenderApp path={path} />;
}
