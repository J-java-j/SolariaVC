"""Read effective deployment permissions of the active Google Cloud CLI account."""
import json
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PROJECT = "gen-lang-client-0188652481"
COMPUTE = "183999986614-compute@developer.gserviceaccount.com"
TERMINAL = f"solaria-terminal@{PROJECT}.iam.gserviceaccount.com"


def main():
    account = subprocess.check_output(
        ["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], text=True
    ).strip()
    if not account:
        raise SystemExit("Select an active Google Cloud CLI account.")
    token = subprocess.check_output(["gcloud", "auth", "print-access-token", "--account", account], text=True).strip()
    resources = [
        (f"https://run.googleapis.com/v2/projects/{PROJECT}/locations/us-east4/services/solaria-terminal",
         ["run.services.get", "run.services.update"]),
        (f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}",
         ["cloudbuild.builds.create", "cloudbuild.builds.get", "serviceusage.services.use"]),
        (f"https://artifactregistry.googleapis.com/v1/projects/{PROJECT}/locations/us-east4/repositories/cloud-run-source-deploy",
         ["artifactregistry.repositories.downloadArtifacts"]),
        *[(f"https://iam.googleapis.com/v1/projects/{PROJECT}/serviceAccounts/{sa}", ["iam.serviceAccounts.actAs"])
          for sa in [TERMINAL, COMPUTE]],
        (f"https://storage.googleapis.com/storage/v1/b/run-sources-{PROJECT}-us-east4",
         ["storage.buckets.get", "storage.objects.create", "storage.objects.get"]),
    ]
    for resource, perms in resources:
        if resource.startswith("https://storage.googleapis.com/"):
            url = resource + "/iam/testPermissions?" + urlencode({"permissions": perms}, doseq=True)
            data = None
        else:
            url = resource + ":testIamPermissions"
            data = json.dumps({"permissions": perms}).encode()
        req = Request(url, data=data, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        try:
            with urlopen(req, timeout=20) as response:
                granted = json.load(response).get("permissions", [])
            for perm in perms:
                print("GRANTED" if perm in granted else "NOT RETURNED", perm, resource)
        except HTTPError as error:
            print("UNVERIFIED", error.code, resource, ", ".join(perms))


if __name__ == "__main__":
    main()
