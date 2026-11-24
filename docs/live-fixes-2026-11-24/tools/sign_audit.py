# Read-only count of how Solaria Sign's open documents are set up (production Firestore, sign_envelopes).
# Prints counts and document titles with any personal part removed; never a name, an email or a field value.
import collections, json, re, ssl, subprocess, sys, urllib.request
P = 'gen-lang-client-0188652481'
token = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True, check=True).stdout.strip()
tls = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
def query(status):
    body = {'structuredQuery': {'from': [{'collectionId': 'sign_envelopes'}],
            'where': {'fieldFilter': {'field': {'fieldPath': 'status'}, 'op': 'EQUAL', 'value': {'stringValue': status}}}, 'limit': 2000}}
    req = urllib.request.Request(f'https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents:runQuery',
                                 data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, context=tls) as res:
        return [json.loads(r['document']['fields']['json']['stringValue']) for r in json.load(res) if 'document' in r]
def shape(title):
    title = re.split(r'\s[-–—:]\s|\(', title or '')[0]
    return re.sub(r'\d+', '#', title).strip()[:60] or '(untitled)'
rows = collections.Counter(); detail = collections.Counter()
statuses = collections.Counter()
for status in ('sent', 'draft', 'completed', 'voided', 'declined', 'expired'):
    try: envs = query(status)
    except Exception as e: print(status, 'query failed', type(e).__name__); continue
    statuses[status] = len(envs)
    if status != 'sent': continue
    for env in envs:
        if env.get('deletedAt'): rows['sent but in Deleted'] += 1; continue
        by = collections.defaultdict(lambda: {'loose': 0, 'grouped': 0, 'text': 0})
        for f in env.get('fields', []):
            if f.get('type') == 'checkbox':
                by[f.get('recipientId')]['grouped' if f.get('group') else ('loose' if f.get('required') else 'optional')] = by[f.get('recipientId')].get('grouped' if f.get('group') else ('loose' if f.get('required') else 'optional'), 0) + 1
            elif f.get('type') == 'text': by[f.get('recipientId')]['text'] += 1
        for rec in env.get('recipients', []):
            if rec.get('role') == 'cc': continue
            b = by.get(rec.get('id'), {'loose': 0, 'grouped': 0, 'text': 0})
            waiting = rec.get('status') != 'signed'
            key = (shape(env.get('title')), (env.get('sentAt') or env.get('createdAt') or '')[:10], 'waiting' if waiting else 'signed',
                   f"{b.get('loose', 0)} required boxes not linked", f"{b.get('grouped', 0)} choose-one boxes", f"{b.get('text', 0)} text blanks")
            detail[key] += 1
print('documents by status:', dict(statuses))
print('open documents, one line per kind of signer (title | sent | signer | boxes | blanks):')
for key, n in sorted(detail.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2])):
    print(f'{n:4} ×', ' | '.join(key))
print(dict(rows))
