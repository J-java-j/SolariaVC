"""Run the single-recipient Owner bootstrap using the verified website image and mail settings."""
import json
import os
import re
from shutil import which
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PROJECT = "gen-lang-client-0188652481"
REGION = "europe-west1"
JOB = "solaria-team-login-first-owner"


def main():
    owner = os.environ["TEAM_OWNER_EMAIL"].strip().lower()
    revision = os.environ["TEAM_EXPECTED_WEB_REVISION"]
    image = os.environ["TEAM_EXPECTED_WEB_IMAGE"]
    if not re.fullmatch(r"europe-west1-docker\.pkg\.dev/" + PROJECT + r"/cloud-run-source-deploy/solariavc/team-login@sha256:[a-f0-9]{64}", image):
        raise SystemExit("Specify the approved website image by digest.")
    sdk = which("gcloud") or "gcloud"
    token = subprocess.check_output([sdk, "auth", "print-access-token"], text=True).strip()
    def api(path, body=None):
        request = Request("https://run.googleapis.com/v2/" + path,
                          data=None if body is None else json.dumps(body).encode(),
                          headers={"Authorization": "Bearer " + token, "Content-Type": "application/json",
                                   "x-goog-user-project": PROJECT})
        with urlopen(request, timeout=45) as response:
            return json.load(response)

    region = f"projects/{PROJECT}/locations/{REGION}"
    service = region + "/services/solariavc"
    live = api(service)
    if not any(t.get("revision") == revision and t.get("percent") == 100 for t in live["trafficStatuses"]):
        raise SystemExit("Serving website revision does not match the approved revision.")
    rev = api(service + "/revisions/" + revision)
    container = rev["containers"][0]
    if container["image"] != image:
        raise SystemExit("Serving image differs from the approved image digest.")
    env = {e["name"]: e for e in container["env"]}
    if env["TEAM_FIREBASE_TENANT"]["value"] != "team-login-prod-drkt6" or env["TEAM_INVITE_EMAILS"]["value"] != owner:
        raise SystemExit("Expected the production tenant and a single approved recipient.")
    job_env = [env[k] for k in ("TEAM_AUTH_MODE", "TEAM_FIREBASE_PROJECT", "TEAM_FIREBASE_TENANT",
                                "TEAM_PORTAL_ORIGIN", "TEAM_SESSION_DATABASE", "TEAM_INVITE_EMAILS",
                                "CONTACT_FROM_EMAIL", "RESEND_API_KEY")]
    job_env.append({"name": "TEAM_OWNER_EMAIL", "value": owner})
    task = {"serviceAccount": rev["serviceAccount"], "timeout": "120s", "maxRetries": 0,
            "containers": [{"image": image, "command": ["node"],
                            "args": ["staff-service/owner-setup.js", "--project", PROJECT, "--email", owner],
                            "env": job_env}]}
    path = region + "/jobs/" + JOB
    try:
        api(path)
    except HTTPError as error:
        if error.code != 404:
            raise
    else:
        raise SystemExit("Bootstrap job already exists. Inspect its execution before sending another invitation.")
    op = api(region + "/jobs?jobId=" + JOB, {"template": {"taskCount": 1, "parallelism": 1, "template": task}})
    for _ in range(50):
        if op.get("done"):
            break
        time.sleep(2)
        op = api(op["name"])
    if not op.get("done") or op.get("error"):
        raise SystemExit("Bootstrap job creation did not complete successfully.")
    subprocess.run([sdk, "run", "jobs", "execute", JOB, "--region=" + REGION, "--project=" + PROJECT,
                    "--wait", "--quiet"], check=True)


if __name__ == "__main__":
    main()
