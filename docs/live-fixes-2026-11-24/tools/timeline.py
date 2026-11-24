# Per-browser timeline of the website's request log, for the pages and files that matter here.
# Client addresses are replaced by a salted hash (salt kept next to the log, never printed);
# query values are dropped except a few harmless ones, so no sign-in or setup codes are shown.
import json, sys, os, hashlib, re
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit, parse_qsl

log = sys.argv[1]
since = sys.argv[2] if len(sys.argv) > 2 else ''
salt_path = os.path.join(os.path.dirname(log), '.salt')
if not os.path.exists(salt_path):
    with open(salt_path, 'w') as f:
        f.write(os.urandom(16).hex())
salt = open(salt_path).read().strip()
rows = json.load(open(log))

ET = timezone(timedelta(hours=-5))
KEEP = {'recover', 'section', 'launch', 'preview'}

def when(ts):
    return datetime.fromisoformat(ts.replace('Z', '+00:00')).astimezone(ET).strftime('%H:%M:%S')

def who(r):
    h = r.get('httpRequest', {})
    ip = h.get('remoteIp', '?')
    return hashlib.sha256((salt + ip).encode()).hexdigest()[:6]

def agent(ua):
    ua = ua or ''
    os_ = 'Mac' if 'Macintosh' in ua else 'iPhone' if 'iPhone' in ua else 'iPad' if 'iPad' in ua else 'Win' if 'Windows' in ua else 'Android' if 'Android' in ua else 'Linux' if 'Linux' in ua else '?'
    b = 'HeadlessChrome' if 'HeadlessChrome' in ua else 'Edge' if 'Edg/' in ua else 'Chrome' if 'Chrome/' in ua else 'Safari' if 'Safari/' in ua else 'Firefox' if 'Firefox' in ua else ua[:24]
    return os_ + ' ' + b

def path_of(url):
    u = urlsplit(url)
    q = [(k, v if k in KEEP else '…') for k, v in parse_qsl(u.query, keep_blank_values=True)]
    return u.path + ('?' + '&'.join(k + '=' + v for k, v in q) if q else '')

PAGE = re.compile(r'^/(staff/?|staff\.html|sign.*|)$')
FILE = re.compile(r'^/(service-worker\.js|sw\.js|serviceworker\.js|workbox.*|manifest.*|assets/(staff|ConnectedPortal|index)-[^/]+\.js)$')
API = re.compile(r'^/staff/local-api/(recovery|session|password.*|setup.*)')

clients = {}
for r in rows:
    if r.get('timestamp', '') < since:
        continue
    h = r.get('httpRequest', {})
    url = h.get('requestUrl', '')
    p = urlsplit(url).path
    c = clients.setdefault(who(r), {'ua': set(), 'n': 0, 'me': 0, 'first': r['timestamp'], 'last': r['timestamp'], 'events': []})
    c['ua'].add(agent(h.get('userAgent')))
    c['n'] += 1
    c['first'] = min(c['first'], r['timestamp']); c['last'] = max(c['last'], r['timestamp'])
    if p == '/staff/local-api/me':
        c['me'] += 1
    if PAGE.match(p) or FILE.match(p) or API.match(p):
        rev = r.get('resource', {}).get('labels', {}).get('revision_name', '').replace('solariavc-', '')
        c['events'].append((r['timestamp'], h.get('requestMethod'), path_of(url), h.get('status'), h.get('responseSize'), rev))

for k, c in sorted(clients.items(), key=lambda kv: kv[1]['first']):
    if not c['events'] and c['me'] == 0:
        continue
    print(f"client {k}  {', '.join(sorted(c['ua']))}  {when(c['first'])}–{when(c['last'])} ET  requests={c['n']}  /me={c['me']}")
    for ts, m, p, st, size, rev in sorted(c['events']):
        print(f"   {when(ts)}  {m:6} {p:44} {st}  {size or '-':>6}  {rev}")
