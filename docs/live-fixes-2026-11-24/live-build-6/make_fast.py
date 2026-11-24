# Instant portal clicks, as byte-level edits of the live built bundle (Daniel's 00187 build):
#   python3 -I make_fast.py ORIG_DIST OUT_DIST
# Writes staff.html, assets/staff-Fast02.js and assets/ConnectedPortal-Fast02.js (mode 0644).
# New names, because the website serves /assets/* as immutable for a year. Every edit must match
# exactly once (twice for the chunk name in the staff entry). The chunk keeps the recovery-link fix.
# Names in the minified code, from src/staff/portal/ConnectedPortal.tsx: Le = WorkspacePortal,
# s = setWorkspace, o = setMessage, u = version, g = signOut, f = refresh, w = signIn,
# b = navigate, G = currentAccount, Me = roster, Te = permittedPage, $ = setPage, E = request.
import json, os, sys
OLD_STAFF, NEW_STAFF = 'staff-D8cCkydr.js', 'staff-Fast02.js'
OLD_PORTAL, NEW_PORTAL = 'ConnectedPortal-XbvD2RiI.js', 'ConnectedPortal-Fast02.js'

EDITS = [
    # the recovery page's button while it sends: the source has a "?" where the ellipsis was lost
    ('"Requesting?"', '"Requesting\u2026"'),
    # the recovery link (as in RcvLnk01): open the self-service page, not an email
    ('href:"mailto:contact@solariavc.com?subject=Team%20Portal%20password%20recovery",children:"Request password recovery"',
     'href:"/staff?recover=1",children:"Request password recovery"'),
    # E1: a place for the last account list this tab loaded; signing out forgets it
    ('u=l.useRef(0),g=async()=>{++u.current;try{await E("/session","DELETE"),++u.current,s(null),',
     'u=l.useRef(0),portalKept=l.useRef(null),g=async()=>{++u.current;try{await E("/session","DELETE"),++u.current,portalKept.current=null,s(null),'),
    # E2: keep each list a management page loads; a refusal (lost access) forgets it
    ('if(y==="staff"||y==="board-admins")try{T=await Me()}catch(k){if(!(k instanceof P)||k.status!==403)throw k;p=await G(),y="dashboard"}',
     'if(y==="staff"||y==="board-admins")try{T=await Me(),portalKept.current={id:p.id,list:T}}catch(k){if(!(k instanceof P)||k.status!==403)throw k;portalKept.current=null,p=await G(),y="dashboard"}'),
    # E3: after showing another page, load the list ahead of the first click (not for staff,
    # who have no management pages; only once per person; dropped if a newer refresh started)
    ('s({user:p,page:y,accounts:T})}catch(p){',
     's({user:p,page:y,accounts:T}),y!=="staff"&&y!=="board-admins"&&p.role!=="staff"&&!(portalKept.current&&portalKept.current.id===p.id)&&Me().then(k=>{n===u.current&&(portalKept.current={id:p.id,list:k})}).catch(()=>{})}catch(p){'),
    # E4: signing in starts with nothing kept
    ('await E("/session","POST",void 0,j),r(!0),await f()}',
     'await E("/session","POST",void 0,j),portalKept.current=null,r(!0),await f()}'),
    # E5: a click shows the new page at once from what this tab has; refresh() then brings it
    # up to date. A management page without a kept list for this person waits, as before.
    ('function b(n,p="dashboard"){if(n==="signin"){g();return}$(p),f(),window.scrollTo(',
     'function b(n,p="dashboard"){if(n==="signin"){g();return}$(p),o(""),s(q=>{if(!q||!q.user)return q;const y0=Te(q.user.role),k0=portalKept.current,w0=y0==="staff"||y0==="board-admins";return w0&&!(k0&&k0.id===q.user.id)?q:{user:q.user,page:y0,accounts:w0?k0.list:[]}}),f(),window.scrollTo('),
]

if sys.argv[1:] == ['--print-edits']:
    print(json.dumps({'staff': [OLD_STAFF, NEW_STAFF], 'portal': [OLD_PORTAL, NEW_PORTAL], 'edits': EDITS}))
    sys.exit(0)
orig, out = sys.argv[1], sys.argv[2]

def edit(src, dst, pairs, counts):
    data = open(os.path.join(orig, src), encoding='utf-8', newline='').read()   # keep line endings as built
    for (old, new), want in zip(pairs, counts):
        got = data.count(old)
        if got != want:
            sys.exit(f'{src}: expected {want} of {old[:60]!r}, found {got}')
        data = data.replace(old, new)
    path = os.path.join(out, dst)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(data)
    os.chmod(path, 0o644)
    print('wrote', dst)

for name in (NEW_STAFF, NEW_PORTAL):
    if os.path.exists(os.path.join(orig, 'assets', name)):
        sys.exit(name + ' is already taken')
edit('staff.html', 'staff.html', [('/assets/' + OLD_STAFF, '/assets/' + NEW_STAFF)], [1])
edit('assets/' + OLD_STAFF, 'assets/' + NEW_STAFF, [(OLD_PORTAL, NEW_PORTAL)], [2])
edit('assets/' + OLD_PORTAL, 'assets/' + NEW_PORTAL, EDITS, [1] * len(EDITS))
