# Read a built image back from Artifact Registry and compare it with its base image:
# the base's layers must come first and unchanged, the image settings must be equal, and the
# extra layers' files are listed with owner, mode and SHA-256. The access token stays in this
# process and is never printed.
import gzip, hashlib, io, json, subprocess, sys, tarfile, urllib.request

import os
HOST = os.environ.get('READBACK_HOST', 'https://europe-west1-docker.pkg.dev')
REPO = os.environ.get('READBACK_REPO', 'gen-lang-client-0188652481/cloud-run-source-deploy/solariavc/team-login')
ACCEPT = ', '.join([
    'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json',
    'application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'])
token = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True, check=True).stdout.strip()

class Keep(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and 'pkg.dev' not in newurl:
            new.headers.pop('Authorization', None)   # never send the token to the storage redirect
            new.unredirected_hdrs.pop('Authorization', None)
        return new
import ssl, os
tls = ssl.create_default_context(cafile='/etc/ssl/cert.pem' if os.path.exists('/etc/ssl/cert.pem') else None)
opener = urllib.request.build_opener(Keep, urllib.request.HTTPSHandler(context=tls))

def get(path, accept=ACCEPT):
    req = urllib.request.Request(f'{HOST}/v2/{REPO}/{path}', headers={'Authorization': 'Bearer ' + token, 'Accept': accept})
    with opener.open(req) as res:
        return res.read(), res.headers.get('Docker-Content-Digest')

def manifest(ref):
    body, digest = get('manifests/' + ref)
    m = json.loads(body)
    if 'manifests' in m:   # an index: take the linux/amd64 image
        pick = next(x for x in m['manifests'] if x.get('platform', {}).get('architecture') == 'amd64')
        return manifest(pick['digest'])
    return m, digest or 'sha256:' + hashlib.sha256(body).hexdigest()

base_ref, new_ref = sys.argv[1], sys.argv[2]
local = dict(line.split()[::-1] for line in open(sys.argv[3]).read().splitlines() if line.strip()) if len(sys.argv) > 3 else {}
bm, bd = manifest(base_ref)
nm, nd = manifest(new_ref)
print('base  ', bd)
print('new   ', nd)
bl = [l['digest'] for l in bm['layers']]
nl = [l['digest'] for l in nm['layers']]
print('base layers', len(bl), '| new layers', len(nl), '| base layers first and unchanged:', nl[:len(bl)] == bl)
bc = json.loads(get('blobs/' + bm['config']['digest'], '*/*')[0])['config']
nc = json.loads(get('blobs/' + nm['config']['digest'], '*/*')[0])['config']
for k in sorted(set(bc) | set(nc)):
    print(f'  config {k:12} equal: {bc.get(k) == nc.get(k)}')
print('  config Image (the build\'s parent-image record):', repr(bc.get('Image'))[:80], '->', repr(nc.get('Image'))[:80])
ok = nl[:len(bl)] == bl and {k: v for k, v in bc.items() if k != 'Image'} == {k: v for k, v in nc.items() if k != 'Image'}
for layer in nm['layers'][len(bl):]:
    blob = get('blobs/' + layer['digest'], '*/*')[0]
    print('extra layer', layer['digest'][:19], 'size', len(blob), 'digest matches:', 'sha256:' + hashlib.sha256(blob).hexdigest() == layer['digest'])
    with tarfile.open(fileobj=io.BytesIO(gzip.decompress(blob))) as tar:
        for m in tar.getmembers():
            line = f'  {m.name:42} {"dir " if m.isdir() else "file"} uid={m.uid} gid={m.gid} mode={oct(m.mode)}'
            if m.isfile():
                h = hashlib.sha256(tar.extractfile(m).read()).hexdigest()
                want = local.get(m.name.removeprefix('app/').removeprefix('./')) or local.get('app/' + m.name.removeprefix('app/'))
                line += f' sha256={h[:12]}… local={"same" if want == h else "DIFFERENT" if want else "?"}'
                ok &= want == h and m.uid == 0 and m.gid == 0 and (m.mode & 0o7777) == 0o644
            print(line)
print('RESULT', 'OK' if ok else 'CHECK FAILED')
