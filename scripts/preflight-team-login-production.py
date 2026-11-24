"""Read production traffic and aggregate Identity Platform role counts. No cloud writes."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PROJECT = "gen-lang-client-0188652481"
SERVICES = {"solariavc", "solaria-terminal"}


def traffic_record(services):
    records = {}
    for item in services:
        name = item["metadata"]["name"]
        if name not in SERVICES:
            continue
        region = item["metadata"]["labels"]["cloud.googleapis.com/location"]
        traffic = item["status"]["traffic"]
        if (name in records or not all(t.get("revisionName") for t in traffic if t.get("percent"))
                or sum(t.get("percent", 0) for t in traffic) != 100):
            raise ValueError(f"Cannot establish a unique rollback allocation for {name}.")
        records[name] = {"region": region, "serving": traffic, "configured": item["spec"].get("traffic", []),
                         "serviceAccount": item["spec"]["template"]["spec"].get("serviceAccountName")}
    if records.keys() != SERVICES:
        raise ValueError(f"Missing services: {sorted(SERVICES - records.keys())}")
    return records


def pages(url, headers, params, items, token_param="pageToken"):
    while True:
        request = Request(url + "?" + urlencode(params), headers=headers)
        try:
            with urlopen(request, timeout=45) as response:
                data = json.load(response)
        except HTTPError as error:
            message = json.loads(error.read()).get("error", {}).get("message", error.reason)
            raise SystemExit(f"HTTP {error.code} on {url}: {message}") from None
        yield from data.get(items, [])
        if not data.get("nextPageToken"):
            return
        params[token_param] = data["nextPageToken"]


def role_counts(users):
    counts = Counter()
    for user in users:
        counts["accounts"] += 1
        if user.get("disabled"):
            counts["disabled"] += 1
            continue
        claims = json.loads(user.get("customAttributes") or "{}")
        role = claims.get("role")
        if role in ("staff", "board-admin", "owner"):
            counts[role] += 1
        else:
            counts["without_portal_role"] += 1
    return dict(counts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gcloud", default="gcloud")
    parser.add_argument("--output-dir", type=Path, default=Path.home())
    args = parser.parse_args()

    def cloud(*cmd):
        return subprocess.check_output([args.gcloud, *cmd, "--project=" + PROJECT, "--quiet"], text=True)

    records = traffic_record(json.loads(cloud("run", "services", "list", "--platform=managed",
                                              "--format=json(metadata.name,metadata.labels,status.traffic,spec.traffic,spec.template.spec.serviceAccountName)")))
    now = datetime.now(timezone.utc)
    path = args.output_dir / now.strftime("solaria-rollback-%Y%m%dT%H%M%S%fZ.json")
    with path.open("x", encoding="utf-8") as out:
        json.dump({"project": PROJECT, "capturedAt": now.isoformat(), "services": records}, out, indent=2)
    print(f"Rollback record saved to {path}", flush=True)
    for service, record in records.items():
        for target in record["serving"]:
            print(service, record["region"], target.get("revisionName"), f"{target.get('percent', 0)}%", flush=True)
    headers = {"Authorization": "Bearer " + cloud("auth", "print-access-token").strip(),
               "x-goog-user-project": PROJECT}
    host = "https://identitytoolkit.googleapis.com"
    tenants = pages(f"{host}/v2/projects/{PROJECT}/tenants", headers,
                    {"pageSize": 100, "fields": "tenants(name),nextPageToken"}, "tenants")
    for resource in [f"projects/{PROJECT}", *(t["name"] for t in tenants)]:
        users = pages(f"{host}/v1/{resource}/accounts:batchGet", headers,
                      {"maxResults": 1000, "fields": "users(customAttributes,disabled,localId),nextPageToken"},
                      "users", "nextPageToken")
        print(resource, role_counts(users) or {"accounts": 0}, flush=True)
    print(cloud("firestore", "databases", "list", "--format=value(name)").strip(), flush=True)


if __name__ == "__main__":
    main()
