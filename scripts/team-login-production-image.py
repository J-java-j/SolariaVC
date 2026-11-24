"""Build the Owner-onboarding image. Does not update a Cloud Run service."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PROJECT = "gen-lang-client-0188652481"
NUMBER = "183999986614"
TENANT = "team-login-prod-drkt6"
REGISTRY = "europe-west1-docker.pkg.dev"
GCLOUD = shutil.which("gcloud") or "gcloud"
DOCKER = shutil.which("docker") or "docker"


def browser_key(token):
    def request(path, body=None):
        req = Request("https://apikeys.googleapis.com/v2/" + path,
                      data=None if body is None else json.dumps(body).encode(),
                      headers={"Authorization": "Bearer " + token, "x-goog-user-project": PROJECT,
                               "Content-Type": "application/json"})
        with urlopen(req, timeout=45) as response:
            return json.load(response)

    collection = f"projects/{NUMBER}/locations/global/keys"
    name = collection + "/solaria-team-login-prod"
    restrictions = {"browserKeyRestrictions": {"allowedReferrers": ["https://solariavc.com/*"]},
                    "apiTargets": [{"service": "identitytoolkit.googleapis.com"}]}
    try:
        key = request(name)
    except HTTPError as exc:
        if exc.code != 404:
            raise
        operation = request(collection + "?keyId=solaria-team-login-prod",
                            {"displayName": "solaria-team-login-prod", "restrictions": restrictions})
        for _ in range(60):
            if operation.get("done"):
                break
            time.sleep(3)
            operation = request(operation["name"])
        key = operation.get("response", {})
    if key.get("name") != name or key.get("restrictions") != restrictions or key.get("deleteTime"):
        raise SystemExit("Production browser key or restrictions could not be verified.")
    return request(name + "/keyString")["keyString"]


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--tag", required=True, help="New Artifact Registry image tag for this release")
    args.add_argument("--push", action="store_true", help="Publish the built and smoke-tested image")
    options = args.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}", options.tag):
        args.error("invalid image tag")
    image = f"{REGISTRY}/{PROJECT}/cloud-run-source-deploy/solariavc/team-login:{options.tag}"
    root = Path(__file__).resolve().parents[1]
    token = subprocess.check_output([GCLOUD, "auth", "print-access-token",
                                     "--project=" + PROJECT, "--quiet"], text=True).strip()
    key = browser_key(token)
    with tempfile.TemporaryDirectory() as conf:
        if os.name == "nt":
            (Path(conf) / "config.json").write_text(json.dumps({
                "cliPluginsExtraDirs": [str(Path(DOCKER).parents[1] / "cli-plugins")]}), encoding="utf-8")
        env = {**os.environ, "DOCKER_CONFIG": conf, "VITE_TEAM_FIREBASE_API_KEY": key,
               "VITE_TEAM_FIREBASE_TENANT": TENANT}
        env["PATH"] = str(Path(DOCKER).parent) + os.pathsep + env["PATH"]
        subprocess.run([DOCKER, "login", "-u", "oauth2accesstoken", "--password-stdin", REGISTRY],
                       input=token, text=True, env=env, check=True)
        subprocess.run([DOCKER, "build", "--quiet", "--platform=linux/amd64", "--provenance=false", "-t", image,
                        "--build-arg", "VITE_TEAM_PORTAL_ENABLED=true", "--build-arg", "VITE_TEAM_FIREBASE_API_KEY",
                        "--build-arg", "VITE_TEAM_FIREBASE_TENANT", str(root)], env=env, check=True)
        subprocess.run([DOCKER, "run", "--rm", "--network=none", image, "sh", "-ec",
                        "test $(id -u) -ne 0 && test -r staff-service/owner-setup.js && "
                        "node --check staff-service/provider.js && node --check staff-service/api.js && "
                        "grep -ql team-login-prod-drkt6 dist/assets/*.js"], env=env, check=True)
        if options.push:
            subprocess.run([DOCKER, "push", image], env=env, check=True)


if __name__ == "__main__":
    main()
