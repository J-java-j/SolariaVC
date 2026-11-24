"""Confirm onboarding without an Owner password, cookie or invitation link."""
import json
import os
import subprocess
from datetime import datetime, timezone
from shutil import which
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PROJECT = "gen-lang-client-0188652481"
TENANT = "team-login-prod-drkt6"


def check():
    owner = os.environ["TEAM_OWNER_EMAIL"].strip().lower()
    expected_uid = os.environ["TEAM_EXPECTED_OWNER_UID"]
    sdk = which("gcloud") or "gcloud"
    token = subprocess.check_output([sdk, "auth", "print-access-token"], text=True).strip()
    def read(url, body):
        req = Request(url, json.dumps(body).encode(), headers={"Authorization": "Bearer " + token,
                      "Content-Type": "application/json", "x-goog-user-project": PROJECT})
        with urlopen(req, timeout=30) as resp:
            return json.load(resp)
    fields = "users(localId,email,customAttributes,disabled,lastLoginAt)"
    info = read(f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/tenants/{TENANT}/accounts:lookup?"
                + urlencode({"fields": fields}), {"email": [owner]})
    users = info.get("users", [])
    if len(users) != 1:
        raise SystemExit("Owner identity unavailable")
    user = users[0]
    if (user["email"] != owner or user.get("disabled") or user["localId"] != expected_uid
            or json.loads(user.get("customAttributes", "{}")).get("role") != "owner"):
        raise SystemExit("Owner identity does not have the expected active role")
    if not user.get("lastLoginAt"):
        print("Owner invitation issued; first sign-in pending.")
        return False
    q = {"structuredQuery": {"from": [{"collectionId": "teamBrowserSessions"}],
         "select": {"fields": [{"fieldPath": "expires"}]},
         "where": {"fieldFilter": {"field": {"fieldPath": "uid"}, "op": "EQUAL",
                                   "value": {"stringValue": user["localId"]}}}}}
    rows = read(f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/team-login-prod/documents:runQuery", q)
    for row in rows:
        expires = row.get("document", {}).get("fields", {}).get("expires", {}).get("timestampValue")
        if expires and datetime.fromisoformat(expires) > datetime.now(timezone.utc):
            print("Verified active Owner, completed Firebase sign-in and current production portal session.")
            return True
    print("Owner authenticated to Firebase; awaiting an active production portal session.")
    return False


if __name__ == "__main__":
    raise SystemExit(0 if check() else 3)
