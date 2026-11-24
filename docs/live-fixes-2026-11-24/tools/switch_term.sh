#!/bin/bash
# switch_term.sh NEW BACK: move all of solaria-terminal's traffic to revision NEW (tags stay where they are), then
# watch NEW for 150 s: its own log for a crash sign, and its request log for answers of 500 or more. On either,
# traffic goes back to BACK at once. Refuses to switch unless NEW is the newest revision and ready.
P=gen-lang-client-0188652481; R=us-east4; SVC=solaria-terminal; NEW=$1; BACK=$2
latest=$(gcloud run services describe $SVC --region $R --project $P --format='value(status.latestCreatedRevisionName)')
ready=$(gcloud run revisions describe "$NEW" --region $R --project $P --format=json | python3 -I -c "import json,sys; print(next((c['status'] for c in json.load(sys.stdin)['status']['conditions'] if c['type'] == 'Ready'), 'missing'))")
echo "latest=$latest ready=$ready"
[ "$latest" = "$NEW" ] || { echo "ABORT: newest revision is $latest, not $NEW"; exit 3; }
[ "$ready" = "True" ] || { echo "ABORT: $NEW is not ready"; exit 3; }
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gcloud run services update-traffic $SVC --region $R --project $P --to-revisions "$NEW=100" --quiet >/dev/null 2>&1 || { echo "SWITCH FAILED"; exit 4; }
gcloud run services describe $SVC --region $R --project $P --format=json | python3 -I -c "import json,sys; [print('  ', t.get('percent',0), t.get('revisionName'), t.get('tag','')) for t in json.load(sys.stdin)['status']['traffic'] if t.get('percent') or t.get('tag')]"
echo "switched at $(date -u +%H:%M:%S)"
back() { gcloud run services update-traffic $SVC --region $R --project $P --to-revisions "$BACK=100" --quiet >/dev/null 2>&1 && echo "ROLLED BACK to $BACK" || echo "ROLLBACK FAILED"; exit 1; }
for i in $(seq 1 15); do
  sleep 10
  base="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SVC\" AND resource.labels.revision_name=\"$NEW\" AND timestamp>=\"$since\""
  app=$(gcloud logging read "$base AND NOT httpRequest:*" --project $P --order=asc --limit=80 --format='value(textPayload)' 2>/dev/null)
  if echo "$app" | grep -qE "Traceback|Container called exit|failed to start|probe failed|ModuleNotFoundError|ImportError|SyntaxError|NameError"; then
    echo "$app" | grep -E "Traceback|Error|exit|failed" | sed -E 's/[0-9]{1,3}(\.[0-9]{1,3}){3}/<address>/g' | tail -12
    echo "CRASH SIGN"; back
  fi
  answers=$(gcloud logging read "$base AND httpRequest:*" --project $P --limit=500 --format='value(httpRequest.status)' 2>/dev/null)
  total=$(echo "$answers" | grep -c .); bad=$(echo "$answers" | grep -cE "^5")
  echo "  +$((i*10)) s: $total answers, $bad of them 500 or more"
  [ "$bad" -ge 3 ] && { echo "SERVER ERRORS"; back; }
done
echo "WATCH DONE: no crash sign, fewer than 3 server errors"
exit 0
