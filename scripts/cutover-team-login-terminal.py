"""Switch the tested Terminal gate only after the production Owner has signed in."""
import json
import os
from pathlib import Path
import runpy
import re
import shutil
import subprocess
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, build_opener

PROJECT = "gen-lang-client-0188652481"
WEB = "solariavc"
TERM = "solaria-terminal"
REGIONS = {WEB: "europe-west1", TERM: "us-east4"}
SDK = shutil.which("gcloud") or "gcloud"
HERE = Path(__file__).resolve().parent


def cloud(service, *cmd):
    return subprocess.check_output([SDK, "run", *cmd, "--region=" + REGIONS[service],
                                    "--project=" + PROJECT, "--quiet"], text=True).strip()


def state(service):
    return json.loads(cloud(service, "services", "describe", service, "--format=json(status)"))["status"]


def allocation(service):
    return {t["revisionName"]: t["percent"] for t in state(service)["traffic"] if t.get("percent")}


def switch(service, rev):
    cloud(service, "services", "update-traffic", service, "--to-revisions=" + rev + "=100", "--format=none")
    if allocation(service) != {rev: 100}:
        raise RuntimeError("Could not verify traffic for " + service)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def check_terminal(origin):
    client = build_opener(NoRedirect())
    for entry, dest in (("/", "terminal"), ("/admin", "terminal-admin")):
        try:
            client.open(origin + entry, timeout=30).close()
        except HTTPError as error:
            if error.code in (302, 303, 307) and error.headers.get("Location") == "https://solariavc.com/staff/launch/" + dest:
                continue
        raise RuntimeError("Unexpected signed-out response at " + origin + entry)
    for path in ("/api/evidence", "/api/admin/state"):
        try:
            client.open(origin + path, timeout=30).close()
        except HTTPError as error:
            if error.code == 401:
                continue
        raise RuntimeError("Unexpected private API response at " + path)


def prepare(service, settings, baseline):
    tag = "team-login-gate"
    cloud(service, "services", "update", service, "--no-traffic", "--tag=" + tag, *settings, "--format=none")
    statuses = state(service)
    target, = (t for t in statuses["traffic"] if t.get("tag") == tag)
    if target.get("percent") or target["revisionName"] != statuses["latestReadyRevisionName"]:
        raise RuntimeError("Expected a ready revision receiving no traffic: " + service)
    def spec(rev):
        result = json.loads(cloud(service, "revisions", "describe", rev, "--format=json(spec)"))["spec"]
        c = result["containers"][0]
        c.pop("image", None)
        c["env"] = {e["name"]: e for e in c.get("env", []) if not e["name"].startswith("TEAM_")}
        return result
    if spec(target["revisionName"]) != spec(baseline):
        raise RuntimeError("Existing service configuration changed: " + service)
    return target


def main():
    baseline = {WEB: os.environ["TEAM_EXPECTED_WEB_REVISION"], TERM: os.environ["TEAM_EXPECTED_TERMINAL_REVISION"]}
    image = os.environ["TEAM_EXPECTED_TERMINAL_IMAGE"]
    if not re.fullmatch(r"us-east4-docker\.pkg\.dev/" + PROJECT + r"/cloud-run-source-deploy/solaria-terminal@sha256:[a-f0-9]{64}", image):
        raise SystemExit("Expected a production Terminal image pinned by digest.")
    if not runpy.run_path(str(HERE / "check-production-owner-session.py"))["check"]():
        raise SystemExit("Terminal cutover held until Owner sign-in.")
    for svc, old in baseline.items():
        if allocation(svc) != {old: 100}:
            raise SystemExit("Live traffic changed for " + svc)
    terminal = prepare(TERM, ["--image=" + image, "--update-env-vars=TEAM_PORTAL_ORIGIN=https://solariavc.com,"
                              "TEAM_VERIFIER_ORIGIN=https://solaria-team-prod-verifier-183999986614.us-east4.run.app"], baseline[TERM])
    # Terminal accepts only its configured custom domain. The tagged hostname
    # must be rejected; exercise the real redirect on that domain after cutover.
    try:
        build_opener(NoRedirect()).open(terminal["url"] + "/", timeout=30).close()
    except HTTPError as error:
        if error.code != 421 or error.read(32) != b"wrong host":
            raise
    else:
        raise RuntimeError("Terminal accepted the unconfigured revision hostname")
    web = prepare(WEB, ["--update-env-vars=TEAM_TERMINAL_HANDOFF=on"], baseline[WEB])
    updates = [(WEB, web["revisionName"]), (TERM, terminal["revisionName"])]
    try:
        for service, revision in updates:
            if allocation(service) != {baseline[service]: 100}:
                raise RuntimeError("Concurrent traffic change: " + service)
            switch(service, revision)
        check_terminal("https://terminal.solariavc.com")
        subprocess.run(["node", str(HERE / "check-production-onboarding.cjs"), "https://solariavc.com",
                        "--terminal-live"], check=True)
    except BaseException:
        for service, revision in reversed(updates):
            if allocation(service) == {revision: 100}:
                switch(service, baseline[service])
                print("Restored", service, baseline[service], flush=True)
        raise
    print("Signed-out live checks passed.", updates, flush=True)


if __name__ == "__main__":
    main()
