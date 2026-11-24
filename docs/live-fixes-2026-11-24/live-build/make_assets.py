# Writes the three changed sign-in page files from the live image's originals.
#   python3 -I make_assets.py ORIGINAL_DIST OUT_DIST
# Byte-level replacements, each with its expected count checked first.
import os
import sys

orig, out = sys.argv[1], sys.argv[2]
OLD_STAFF, NEW_STAFF = 'staff-D8cCkydr.js', 'staff-RcvLnk01.js'
OLD_PORTAL, NEW_PORTAL = 'ConnectedPortal-XbvD2RiI.js', 'ConnectedPortal-RcvLnk01.js'
MAIL = 'href:"mailto:contact@solariavc.com?subject=Team%20Portal%20password%20recovery",children:"Request password recovery"'
PAGE = 'href:"/staff?recover=1",children:"Request password recovery"'


def edit(src, dst, old, new, expected):
    with open(os.path.join(orig, src), 'rb') as f:
        data = f.read()
    found = data.count(old.encode())
    if found != expected:
        sys.exit(f'{src}: expected {expected} of {old!r}, found {found}')
    path = os.path.join(out, dst)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data.replace(old.encode(), new.encode()))
    os.chmod(path, 0o644)
    print('wrote', dst)


edit('staff.html', 'staff.html', '/assets/' + OLD_STAFF, '/assets/' + NEW_STAFF, 1)
edit('assets/' + OLD_STAFF, 'assets/' + NEW_STAFF, OLD_PORTAL, NEW_PORTAL, 2)
edit('assets/' + OLD_PORTAL, 'assets/' + NEW_PORTAL, MAIL, PAGE, 1)
