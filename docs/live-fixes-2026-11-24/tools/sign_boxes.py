# Read-only: board confirmations where a signer's two boxes are both ticked (signed before the 2026-11-14 repair),
# open or completed. Prints counts and document ids only; never a name, an email or a typed answer.
import collections, json, ssl, subprocess, urllib.request
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
for status in ('sent', 'completed'):
    tally = collections.Counter(); both = []
    for env in query(status):
        if env.get('deletedAt') or 'board position confirmation' not in (env.get('title') or '').lower(): continue
        tally['documents'] += 1
        for rec in env.get('recipients', []):
            boxes = [f for f in env.get('fields', []) if f.get('type') == 'checkbox' and f.get('recipientId') == rec.get('id')]
            if len(boxes) != 2: continue
            ticked = [f.get('value') is True for f in boxes]
            if rec.get('status') == 'signed':
                tally['signers who signed, both boxes ticked' if all(ticked) else 'signers who signed, one box ticked' if any(ticked) else 'signers who signed, no box ticked'] += 1
                if all(ticked): both.append((env['id'], (env.get('sentAt') or env.get('createdAt') or '')[:10]))
            else:
                tally['signers still waiting, choose-one' if all(f.get('group') for f in boxes) else 'signers still waiting, BOTH REQUIRED'] += 1
    print(status + ':', dict(tally))
    print('   documents with both boxes ticked (id, sent):', sorted(both, key=lambda x: x[1]))
