#!/bin/bash
# switch_watch.sh NEW BACK: move all of solariavc's traffic to revision NEW, then watch NEW's own
# log for 150 s. On a crash sign, move the traffic back to BACK at once. Refuses to switch if NEW
# is not the newest revision (someone else deployed in between).
P=gen-lang-client-0188652481; NEW=$1; BACK=$2
latest=$(gcloud run services describe solariavc --region europe-west1 --project $P --format='value(status.latestCreatedRevisionName)')
echo "latest=$latest"
[ "$latest" = "$NEW" ] || { echo "ABORT: newest revision is $latest, not $NEW"; exit 3; }
since=$(date -u -v-30S +%Y-%m-%dT%H:%M:%SZ)
gcloud run services update-traffic solariavc --region europe-west1 --project $P --to-revisions "$NEW=100" --quiet >/dev/null 2>&1 || { echo "SWITCH FAILED"; exit 4; }
gcloud run services describe solariavc --region europe-west1 --project $P --format=json | python3 -I -c "import json,sys; [print('  ', t.get('percent',0), t.get('revisionName'), t.get('tag','')) for t in json.load(sys.stdin)['status']['traffic'] if t.get('percent') or t.get('tag')]"
echo "switched at $(date -u +%H:%M:%S)"
for i in $(seq 1 15); do
  sleep 10
  out=$(gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"solariavc\" AND resource.labels.revision_name=\"$NEW\" AND timestamp>=\"$since\" AND NOT logName:\"run.googleapis.com%2Frequests\"" --project $P --order=asc --limit=60 --format='value(timestamp,severity,textPayload)' 2>/dev/null)
  if echo "$out" | grep -qE "Container called exit|failed to start|probe failed|SyntaxError|Cannot find module|Uncaught|ERR_"; then
    echo "$out" | tail -20
    echo "CRASH SIGN -> moving traffic back to $BACK"
    gcloud run services update-traffic solariavc --region europe-west1 --project $P --to-revisions "$BACK=100" --quiet >/dev/null 2>&1 && echo "ROLLED BACK" || echo "ROLLBACK FAILED"
    exit 1
  fi
  if echo "$out" | grep -q "server listening"; then
    echo "$out" | tail -8
    echo "STARTED (seen at $(date -u +%H:%M:%S))"
    exit 0
  fi
done
echo "$out" | tail -8
echo "NO START LINE YET after 150 s (no crash sign either)"
exit 2
