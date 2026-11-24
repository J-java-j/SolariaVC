# build_like_live.py OUT_DIR: build the website the way the live image was built (Team Portal on), taking the
# public Firebase web key and tenant from the live page files. Neither value is printed.
import glob, os, re, subprocess, sys
live = sys.argv[2] if len(sys.argv) > 2 else None
out = sys.argv[1]
text = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(os.path.join(live, 'assets', 'ConnectedPortal-*.js')) + glob.glob(os.path.join(live, 'assets', 'staff-*.js')))
key = re.search(r'AIza[0-9A-Za-z_-]{35}', text)
tenant = re.search(r'team-login-prod-[a-z0-9]+', text)
assert key and tenant, 'key or tenant not found in the live page files'
env = {**os.environ, 'VITE_TEAM_PORTAL_ENABLED': 'true', 'VITE_TEAM_FIREBASE_API_KEY': key.group(0), 'VITE_TEAM_FIREBASE_TENANT': tenant.group(0)}
run = subprocess.run(['npx', 'vite', 'build', '--outDir', out, '--emptyOutDir'], env=env, capture_output=True, text=True)
print('vite exit', run.returncode)
for line in (run.stdout + run.stderr).splitlines():
    if re.search(r'assets/(sign|staff|ConnectedPortal|client|preload-helper|main|styles|Button)-|built in|rror', line):
        print('  ', line.strip().replace(key.group(0), '<key>')[:120])
