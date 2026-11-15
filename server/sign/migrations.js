// One-off corrections to documents already out for signature, run once by the
// server that holds the production credentials. Each is safe to repeat: a
// document already corrected, or already signed, is left as it is.
const BOARD_CHOOSE_ONE = {
  id: '2026-11-14-board-choose-one',
  // Executive Board Position Confirmation, section 4.1 "Officer checks one":
  // sent with both boxes required, so signers were made to tick both.
  title: /executive board position confirmation/i,
  reason: 'Section 4.1 asks the officer to check one box; the two boxes were set up as both required.',
};

export async function runMigrations(svc, store, log = console) {
  const done = await store.getRecord('migrations', BOARD_CHOOSE_ONE.id).catch(() => null);
  if (done) return;
  const envs = await store.listEnvelopes(500);
  const results = [];
  for (const env of envs) {
    if (env.status !== 'sent' || env.deletedAt || !BOARD_CHOOSE_ONE.title.test(env.title ?? '')) continue;
    const byRecipient = new Map();
    for (const f of env.fields) if (f.type === 'checkbox' && !f.group) byRecipient.set(f.recipientId, [...(byRecipient.get(f.recipientId) ?? []), f.id]);
    for (const [recipientId, ids] of byRecipient) {
      const rec = env.recipients.find((r) => r.id === recipientId);
      if (ids.length !== 2 || rec?.status === 'signed') continue;
      try {
        const { changed } = await svc.makeChoiceGroup(env.id, ids, { reason: BOARD_CHOOSE_ONE.reason });
        results.push({ id: env.id, changed });
      } catch (e) {
        results.push({ id: env.id, error: e.message });
      }
    }
  }
  log.log?.('[sign] migration', BOARD_CHOOSE_ONE.id, JSON.stringify(results));
  await store.putRecord('migrations', BOARD_CHOOSE_ONE.id, { at: new Date().toISOString(), results });
}
