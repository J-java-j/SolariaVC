# Aggregate a Cloud Run request-log export: answers by path and status, with times. Prints no client
# address and no query values (a path's own ids are shortened to <id>).
import collections, json, re, statistics, sys
rows = json.load(open(sys.argv[1])); floor = int(sys.argv[2]) if len(sys.argv) > 2 else 400
def shape(url):
    path = '/' + url.split('://', 1)[-1].split('/', 1)[-1].split('?')[0]
    path = re.sub(r'/[A-Za-z0-9_-]{20,}', '/<id>', path)
    path = re.sub(r'/assets/[^/]+\.(js|css)$', r'/assets/*.\1', path)
    path = re.sub(r'^/(team|investment-portfolio)/[^/]+\.(png|jpg|webp|svg)$', r'/\1/*.\2', path)
    return path if len(path) < 60 else path[:57] + '...'
by = collections.defaultdict(list); total = collections.Counter()
for r in rows:
    h = r.get('httpRequest', {}); status = h.get('status') or 0
    total[status] += 1
    if status >= floor:
        by[(status, h.get('requestMethod'), shape(h.get('requestUrl', '')), r['resource']['labels'].get('revision_name', '')[-22:])].append(
            (r['timestamp'], float((h.get('latency') or '0s').rstrip('s') or 0)))
print('all answers:', dict(sorted(total.items())))
for (status, method, path, rev), hits in sorted(by.items(), key=lambda kv: (-len(kv[1]), kv[0])):
    times = sorted(t for t, _ in hits); lats = [l for _, l in hits]
    print(f'{len(hits):5} {status} {method:6} {path:44} {rev:22} {times[0][5:16]}..{times[-1][5:16]} med {statistics.median(lats):.3f}s')
