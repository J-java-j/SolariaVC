import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, type TeamMember } from './api';
import { Link } from './router';
import { formatDate, Notice, Sheet, useBusy } from './ui';

const BLANK = { name: '', email: '', title: '' };

function RemoveSheet({ person, onClose, onDone }: { person: TeamMember; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useBusy();
  const remove = () => run(async () => {
    await api.removeAdmin(person.email);
    onDone();
  });
  return (
    <Sheet title={`Remove ${person.name}?`} onClose={onClose}>
      <p>They lose access right away. Documents they already sent stay in place and can still be signed.</p>
      {error && <Notice>{error}</Notice>}
      <div className="actions">
        <button type="button" className="danger" disabled={busy} onClick={remove}>Remove</button>
        <button type="button" className="quiet" onClick={onClose}>Keep them</button>
      </div>
    </Sheet>
  );
}

export default function Team() {
  const [people, setPeople] = useState<TeamMember[] | null>(null);
  const [form, setForm] = useState(BLANK);
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const { busy, error, run, setError } = useBusy();

  const load = useCallback(
    () => api.team().then((r) => setPeople(r.people)).catch((e: Error) => setError(e.message)),
    [setError],
  );
  useEffect(() => {
    load();
  }, [load]);

  const edit = (key: keyof typeof BLANK) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const add = (e: FormEvent) => {
    e.preventDefault();
    setNotice('');
    run(async () => {
      const { admin, invited } = await api.addAdmin(form);
      setForm(BLANK);
      setNotice(invited
        ? `${admin.name} can sign in now. We emailed ${admin.email}.`
        : `${admin.name} can sign in now, but the email to ${admin.email} did not send. Send them solariavc.com/sign yourself.`);
      await load();
    });
  };

  return (
    <main className="ledger-page">
      <div className="ledger">
        <header className="ledger-head">
          <h1>Team</h1>
          <Link to="/sign" className="link">All documents</Link>
        </header>
        <p className="muted">Admins can send documents and see everything the firm has sent. Only you can add or remove them.</p>
        {error && <Notice>{error}</Notice>}

        <h2>People</h2>
        <ul>
          {people?.map((person) => (
            <li key={person.email} className="member">
              <div>
                <strong>{person.name}</strong>
                <span className="muted">{[person.title, person.email].filter(Boolean).join(', ')}</span>
              </div>
              <span className="muted">{person.owner ? 'Owner' : `Admin since ${formatDate(person.addedAt)}`}</span>
              {!person.owner && <button type="button" className="quiet quiet-danger" onClick={() => setRemoving(person)}>Remove</button>}
            </li>
          ))}
        </ul>

        <h2>Add an admin</h2>
        <form onSubmit={add} className="team-form stack">
          <label className="field">
            Name
            <input required maxLength={120} autoComplete="off" value={form.name} onChange={edit('name')} />
          </label>
          <label className="field">
            Email
            <input type="email" required maxLength={200} autoComplete="off" value={form.email} onChange={edit('email')} />
          </label>
          <label className="field">
            Title (optional)
            <input maxLength={120} autoComplete="off" value={form.title} onChange={edit('title')} />
          </label>
          <button className="primary" disabled={busy}>{busy ? 'Adding' : 'Add admin'}</button>
          {notice && <Notice tone="quiet">{notice}</Notice>}
        </form>
      </div>

      {removing && <RemoveSheet person={removing} onClose={() => setRemoving(null)} onDone={() => {
        setRemoving(null);
        load();
      }} />}
    </main>
  );
}
