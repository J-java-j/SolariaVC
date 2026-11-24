# web_revision.py DIGEST SUFFIX: create a no-traffic revision of the website from the live template with this image,
# TEAM_SIGN_GATE=off, and "*" added to TEAM_INVITE_EMAILS (the addresses already there are kept and never printed).
import json, subprocess, sys
P, R, SVC = 'gen-lang-client-0188652481', 'europe-west1', 'solariavc'
IMG = 'europe-west1-docker.pkg.dev/gen-lang-client-0188652481/cloud-run-source-deploy/solariavc/team-login@'
digest, suffix, expect = sys.argv[1], sys.argv[2], sys.argv[3]
svc = json.loads(subprocess.run(['gcloud', 'run', 'services', 'describe', SVC, '--region', R, '--project', P, '--format=json'],
                                capture_output=True, text=True, check=True).stdout)
latest = svc['status']['latestCreatedRevisionName']
live = [t['revisionName'] for t in svc['status']['traffic'] if t.get('percent') == 100]
print('latest', latest, '| 100% on', live)
if latest != expect or live != [expect]:
    sys.exit(f'ABORT: expected {expect} to be the newest revision and to hold all traffic')
env = {e['name']: e.get('value') for e in svc['spec']['template']['spec']['containers'][0]['env']}
emails = [e.strip() for e in (env.get('TEAM_INVITE_EMAILS') or '').split(',') if e.strip() and e.strip() != '*']
value = ','.join(['*'] + emails)
assert '|' not in value
print('TEAM_INVITE_EMAILS: "*" plus', len(emails), 'named addresses kept | TEAM_SIGN_GATE: off')
run = subprocess.run(['gcloud', 'run', 'services', 'update', SVC, '--region', R, '--project', P, '--image', IMG + digest, '--no-traffic',
                      '--revision-suffix', suffix, '--update-env-vars', f'^|^TEAM_INVITE_EMAILS={value}|TEAM_SIGN_GATE=off', '--quiet'],
                     capture_output=True, text=True)
print('exit', run.returncode)
for line in (run.stderr or run.stdout).splitlines()[-4:]:
    print('  ', line.replace(value, '<list>'))
