"""Deploy and verify the staging-only sources bundled alongside this script."""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

PROJECT = "gen-lang-client-0188652481"
NUMBER = "183999986614"
ACCOUNT = os.environ.get("STAGING_OPERATOR_ACCOUNT")
REGION = "us-east4"
STEM = "solaria-team-staging"
DB = "team-login-staging"
ROOT = Path(__file__).resolve().parent
SERVICES = {kind: f"{STEM}-{kind}" for kind in ("web", "terminal", "verifier")}
ORIGINS = {kind: f"https://{name}-{NUMBER}.{REGION}.run.app" for kind, name in SERVICES.items()}
IDENTITIES = {kind: f"{name}@{PROJECT}.iam.gserviceaccount.com" for kind, name in SERVICES.items()}
IDENTITY_HOST = "https://identitytoolkit.googleapis.com"
IDENTITY_API = f"{IDENTITY_HOST}/v2/projects/{PROJECT}"
IDENTITY_ADMIN_API = f"{IDENTITY_HOST}/admin/v2/projects/{PROJECT}"


class CloudApiError(Exception):
    def __init__(self, status, reason, message, diagnostic):
        super().__init__(diagnostic)
        self.status = status
        self.reason = reason
        self.message = message


def command(*args, capture=False, data=None, env=None):
    result = subprocess.run(args, input=data, text=True, env=env,
                            stdout=subprocess.PIPE if capture else None, check=True)
    return result.stdout.strip() if capture else None


def gcloud(*args, capture=False, data=None):
    return command("gcloud", *args, f"--project={PROJECT}", f"--account={ACCOUNT}", "--quiet",
                   capture=capture, data=data)


def cloud_api(url, permission, *, token, body=None, method=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "x-goog-user-project": PROJECT,
    }
    request = Request(url, json.dumps(body).encode() if body is not None else None, headers, method=method)
    try:
        with urlopen(request, timeout=30) as response:
            data = response.read()
            return json.loads(data) if data.strip() else {}
    except HTTPError as error:
        try:
            details = json.loads(error.read()).get("error", {})
        except ValueError:
            details = {}
        info = next((item for item in details.get("details", [])
                     if item.get("@type") == "type.googleapis.com/google.rpc.ErrorInfo"), {})
        denied = info.get("metadata", {}).get("permission")
        reason = info.get("reason")
        if not denied and reason == "USER_PROJECT_DENIED":
            denied = "serviceusage.services.use"
        diagnostic = f"Permission reported: {denied}." if denied else f"Endpoint requires {permission}."
        message = details.get("message", "")
        raise CloudApiError(error.code, reason, message,
                            f"Google API HTTP {error.code} on {url}. {diagnostic} "
                            f"{reason or ''} {message}".strip()) from None


def read_identity_config(token, *, wait_for_config=False):
    url = IDENTITY_ADMIN_API + "/config"
    for attempt in range(7):
        try:
            return cloud_api(url, "firebaseauth.configs.get", token=token)
        except CloudApiError as error:
            missing_config = error.status == 404 or error.reason == "CONFIGURATION_NOT_FOUND" or (
                "CONFIGURATION_NOT_FOUND" in error.message)
            if error.reason == "SERVICE_DISABLED" or (wait_for_config and missing_config):
                if attempt < 6:
                    print("Waiting for the Identity Platform configuration to become available.", flush=True)
                    time.sleep(5)
                    continue
            elif missing_config:
                return None
            raise


def identity_readiness(token):
    config = read_identity_config(token)
    if config is None:
        print(f"Initializing Identity Platform in {PROJECT}.", flush=True)
        cloud_api(IDENTITY_API + "/identityPlatform:initializeAuth", "firebaseauth.configs.create",
                  token=token, method="POST")
        config = read_identity_config(token, wait_for_config=True)
    subtype = config.get("subtype")
    allows_tenants = config.get("multiTenant", {}).get("allowTenants") is True
    print(f"Identity configuration: subtype={subtype or 'unspecified'}, allowTenants={allows_tenants}", flush=True)
    if subtype == "FIREBASE_AUTH":
        raise SystemExit(f"Approval needed to upgrade Firebase Authentication to Identity Platform in {PROJECT}. "
                         "After the upgrade, recheck whether Allow tenants needs to be enabled.")
    if subtype != "IDENTITY_PLATFORM":
        raise SystemExit(f"Identity configuration in {PROJECT} has an unrecognized subtype. Review it before deploying.")
    if not allows_tenants:
        print(f"Enabling multi-tenancy in {PROJECT}.", flush=True)
        config = cloud_api(IDENTITY_ADMIN_API + "/config?updateMask=multiTenant.allowTenants",
                           "firebaseauth.configs.update", token=token, method="PATCH",
                           body={"multiTenant": {"allowTenants": True}})
        if config.get("multiTenant", {}).get("allowTenants") is not True:
            raise SystemExit("Identity Platform did not confirm multi-tenancy. Staging stopped.")


def tenant_for_staging(token):
    def api(suffix, permission, body=None):
        return cloud_api(IDENTITY_API + suffix, permission, token=token, body=body)

    identity_readiness(token)
    tenant_list = []
    suffix = "/tenants?pageSize=100"
    while True:
        page = api(suffix, "identitytoolkit.tenants.list")
        tenant_list.extend(page.get("tenants", []))
        if not page.get("nextPageToken"):
            break
        suffix = "/tenants?pageSize=100&pageToken=" + quote(page["nextPageToken"], safe="")
    candidates = [item for item in tenant_list if item["displayName"] == "staging"]
    if len(candidates) > 1:
        raise SystemExit("Multiple Identity Platform tenants named staging. Identify the authorized tenant first.")
    if candidates:
        tenant = candidates[0]
    else:
        tenant = api("/tenants", "identitytoolkit.tenants.create", {
            "displayName": "staging", "allowPasswordSignup": True,
            "client": {"permissions": {"disabledUserSignup": True, "disabledUserDeletion": True}},
        })
    tenant_id = tenant["name"].rsplit("/", 1)[-1]
    if not re.fullmatch(r"staging-[a-zA-Z0-9-]+", tenant_id):
        raise SystemExit("Unexpected staging tenant ID.")
    settings = api(f"/tenants/{tenant_id}", "identitytoolkit.tenants.get")
    permissions = settings.get("client", {}).get("permissions", {})
    changes = []
    if settings.get("disableAuth"):
        changes.append("disableAuth=false")
    if not permissions.get("disabledUserSignup"):
        changes.append("client.permissions.disabledUserSignup=true")
    if not permissions.get("disabledUserDeletion"):
        changes.append("client.permissions.disabledUserDeletion=true")
    if changes:
        raise SystemExit(f"Approval needed to update staging tenant {tenant_id} "
                         f"(identitytoolkit.tenants.update): {', '.join(changes)}.")
    if not settings.get("allowPasswordSignup"):
        print(f"Enabling email/password in staging tenant {tenant_id}.", flush=True)
        settings = cloud_api(f"{IDENTITY_API}/tenants/{tenant_id}?updateMask=allowPasswordSignup",
                             "identitytoolkit.tenants.update", token=token, method="PATCH",
                             body={"allowPasswordSignup": True})
        if settings.get("allowPasswordSignup") is not True:
            raise SystemExit(f"Identity Platform did not confirm email/password in {tenant_id}. Staging stopped.")
    return tenant_id


def bind_tenant(tenant, token):
    url = f"{IDENTITY_ADMIN_API}/tenants/{tenant}"
    policy = cloud_api(url + ":getIamPolicy", "identitytoolkit.tenants.getIamPolicy", token=token,
                       body={"options": {"requestedPolicyVersion": 3}})
    for kind, role in (("web", "roles/editor"), ("verifier", "roles/viewer")):
        member = f"serviceAccount:{IDENTITIES[kind]}"
        bindings = policy.setdefault("bindings", [])
        binding = next((b for b in bindings if b["role"] == role and not b.get("condition")), None)
        if binding is None:
            binding = {"role": role, "members": []}
            bindings.append(binding)
        if member not in binding["members"]:
            binding["members"].append(member)
    cloud_api(url + ":setIamPolicy", "identitytoolkit.tenants.setIamPolicy", token=token, body={"policy": policy})


def configure_staging_ttl():
    fields = json.loads(gcloud("firestore", "fields", "ttls", "list", f"--database={DB}",
                               "--format=json", capture=True))
    states = {field["name"]: field["ttlConfig"]["state"] for field in fields}
    for collection in ("teamBrowserSessions", "terminalTickets", "terminalSessions"):
        name = f"projects/{PROJECT}/databases/{DB}/collectionGroups/{collection}/fields/expires"
        if states.get(name) in ("ACTIVE", "CREATING"):
            continue
        gcloud("firestore", "fields", "ttls", "update", "expires", f"--collection-group={collection}",
               f"--database={DB}", "--enable-ttl", "--async")


def staging_api_key(token):
    base = "https://apikeys.googleapis.com/v2/"
    collection = f"projects/{NUMBER}/locations/global/keys"
    expected = f"{collection}/{STEM}"
    restrictions = {
        "browserKeyRestrictions": {"allowedReferrers": [f"{ORIGINS['web']}/*"]},
        "apiTargets": [{"service": "identitytoolkit.googleapis.com"}],
    }
    try:
        key = cloud_api(base + expected, "apikeys.keys.get", token=token)
    except CloudApiError as error:
        if error.status != 404:
            raise
        operation = cloud_api(f"{base}{collection}?keyId={STEM}", "apikeys.keys.create",
                              token=token, body={"displayName": STEM, "restrictions": restrictions})
        operation_name = operation.get("name", "")
        if not re.fullmatch(r"operations/[A-Za-z0-9_.-]+", operation_name):
            raise SystemExit("API Keys returned an unexpected operation name.")
        for _ in range(18):
            if operation.get("done"):
                break
            time.sleep(10)
            operation = cloud_api(base + operation_name, "serviceusage.operations.get", token=token)
        if not operation.get("done"):
            raise SystemExit(f"API key creation is pending ({operation_name}). Rerun after it completes.")
        if operation.get("error"):
            raise SystemExit(f"Staging API key creation failed: {operation['error'].get('message', 'unknown error')}")
        key = operation.get("response", {})
    if key.get("name") != expected:
        raise SystemExit(f"Unexpected staging API key resource {key.get('name')!r}.")
    actual = key.get("restrictions", {})
    targets = actual.get("apiTargets", [])
    if (key.get("deleteTime") or key.get("serviceAccountEmail")
            or actual.get("browserKeyRestrictions") != restrictions["browserKeyRestrictions"]
            or len(targets) != 1 or targets[0].get("service") != "identitytoolkit.googleapis.com"
            or targets[0].get("methods")):
        raise SystemExit(f"Staging key restrictions do not match the expected browser origin and Identity Toolkit API: {expected}")
    value = cloud_api(base + key["name"] + "/keyString", "apikeys.keys.getKeyString", token=token).get("keyString")
    if not value:
        raise SystemExit("Could not retrieve the staging browser API key.")
    print(f"Verified restricted staging browser key {expected}", flush=True)
    return value


def deploy(kind, image, settings, *options):
    print(f"Deploying {SERVICES[kind]}", flush=True)
    gcloud("run", "deploy", SERVICES[kind], f"--region={REGION}", f"--image={image}",
           f"--service-account={IDENTITIES[kind]}", f"--set-env-vars={','.join(f'{k}={v}' for k,v in settings.items())}",
           f"--labels=purpose={STEM}", *options)


def upload_secret(name, contents):
    names = gcloud("secrets", "list", f"--filter=name:{name}", "--format=value(name)", capture=True).splitlines()
    if not any(item.rsplit("/", 1)[-1] == name for item in names):
        gcloud("secrets", "create", name, "--replication-policy=automatic")
    version = gcloud("secrets", "versions", "add", name, "--data-file=-", "--format=value(name)",
                     capture=True, data=contents).rsplit("/", 1)[-1]
    if not version.isdigit():
        raise SystemExit(f"Secret Manager did not return a version for {name}.")
    gcloud("secrets", "add-iam-policy-binding", name,
           f"--member=serviceAccount:{IDENTITIES['terminal']}", "--role=roles/secretmanager.secretAccessor")
    return f"{name}:{version}"


def check_verifier_image(image, settings, docker_env):
    # Match Cloud Run's command, environment and image user. A 403 from this
    # route proves that the verifier is listening and requires a caller token.
    container = command("docker", "run", "--detach", "--network=none",
                        "--entrypoint=node", "-e", "PORT=8080",
                        *(item for k, v in settings.items() for item in ("-e", f"{k}={v}")),
                        image, "staff-service/verifier.js", env=docker_env, capture=True)
    probe = """
        if (!process.getuid()) throw Error('Verifier must run as a non-root user');
        for (let i = 0; i < 40; i++) {
            const res = await fetch('http://127.0.0.1:8080/guard/terminal').catch(() => null);
            if (res?.status === 403) process.exit(0);
            if (res) throw Error('Unexpected verifier response: ' + res.status);
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        throw Error('Verifier failed to listen on port 8080');
    """
    try:
        command("docker", "exec", container, "node", "--input-type=module", "-e", probe, env=docker_env)
        print("Verifier image passed: non-root, port 8080, unsigned caller denied.", flush=True)
    except subprocess.CalledProcessError:
        subprocess.run(["docker", "logs", "--tail", "25", container], env=docker_env, check=False)
        raise
    finally:
        subprocess.run(["docker", "rm", "-f", container], env=docker_env, check=False)


def install():
    if not ACCOUNT:
        raise SystemExit("Set STAGING_OPERATOR_ACCOUNT to the authorized staging operator email.")
    project_number = gcloud("projects", "describe", PROJECT, "--format=value(projectNumber)", capture=True)
    if project_number != NUMBER:
        raise SystemExit("Unexpected Google Cloud project number.")
    print(f"Verified {PROJECT} as {ACCOUNT}", flush=True)
    gcloud("services", "enable", "identitytoolkit.googleapis.com", "apikeys.googleapis.com")
    print("Identity Toolkit and API Keys enablement completed. Reading Identity Platform configuration.", flush=True)
    token = gcloud("auth", "print-access-token", capture=True)
    tenant = tenant_for_staging(token)
    print(f"Using staging tenant {tenant} and Firestore database {DB}", flush=True)

    accounts = gcloud("iam", "service-accounts", "list", "--format=value(email)", capture=True).splitlines()
    for kind, email in IDENTITIES.items():
        if email not in accounts:
            gcloud("iam", "service-accounts", "create", SERVICES[kind], f"--display-name={SERVICES[kind]}")
    databases = gcloud("firestore", "databases", "list", "--format=value(name)", capture=True).splitlines()
    if not any(name.rsplit("/", 1)[-1] == DB for name in databases):
        gcloud("firestore", "databases", "create", f"--database={DB}", f"--location={REGION}",
               "--type=firestore-native")
    for kind in ("web", "verifier"):
        gcloud("projects", "add-iam-policy-binding", PROJECT, f"--member=serviceAccount:{IDENTITIES[kind]}",
               "--role=roles/datastore.user",
               f'--condition=expression=resource.name=="projects/{PROJECT}/databases/{DB}",title=SolariaTeamStagingDatabase')
    configure_staging_ttl()
    bind_tenant(tenant, token)

    api_key = staging_api_key(token)

    repos = gcloud("artifacts", "repositories", "list", f"--location={REGION}",
                   "--format=value(name)", capture=True).splitlines()
    if not any(name.rsplit("/", 1)[-1] == STEM for name in repos):
        gcloud("artifacts", "repositories", "create", STEM, f"--location={REGION}",
               "--repository-format=docker", f"--description={STEM}")
    registry = f"{REGION}-docker.pkg.dev"
    tag = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    web = f"{registry}/{PROJECT}/{STEM}/web:{tag}"
    terminal = f"{registry}/{PROJECT}/{STEM}/terminal:{tag}"
    shared = {"TEAM_FIREBASE_PROJECT": PROJECT, "TEAM_FIREBASE_TENANT": tenant, "TEAM_SESSION_DATABASE": DB}
    verifier_settings = {**shared, "TEAM_VERIFIER_ORIGIN": ORIGINS["verifier"],
                         "TEAM_TERMINAL_CALLER": IDENTITIES["terminal"]}
    with tempfile.TemporaryDirectory(prefix="solaria-docker-") as docker_config:
        docker_env = {**os.environ, "DOCKER_CONFIG": docker_config}
        token = gcloud("auth", "print-access-token", capture=True)
        command("docker", "login", "-u", "oauth2accesstoken", "--password-stdin", registry,
                data=token + "\n", env=docker_env)
        command("docker", "build", "--platform=linux/amd64", "-t", web,
                "--build-arg", "VITE_TEAM_PORTAL_ENABLED=true",
                "--build-arg", f"VITE_TEAM_FIREBASE_API_KEY={api_key}",
                "--build-arg", f"VITE_TEAM_FIREBASE_TENANT={tenant}", str(ROOT / "web"), env=docker_env)
        check_verifier_image(web, verifier_settings, docker_env)
        command("docker", "push", web, env=docker_env)
        deploy("verifier", web, verifier_settings,
               "--command=node", "--args=staff-service/verifier.js", "--no-allow-unauthenticated",
               "--invoker-iam-check", f"--set-custom-audiences={ORIGINS['verifier']}",
               "--min-instances=0", "--max-instances=2", "--concurrency=1")
        command("docker", "build", "--platform=linux/amd64", "-t", terminal, str(ROOT / "terminal"), env=docker_env)
        command("docker", "push", terminal, env=docker_env)

    team_password, admin_password = (secrets.token_urlsafe(32) for _ in range(2))
    access_json = command("docker", "run", "--rm", "--network=none", "-i", terminal, "python", "-c",
                          'import sys; from pathlib import Path; from whale.terminal.access import set_password; '
                          'p = Path("/tmp/access.json"); set_password(p, sys.stdin.read()); print(p.read_text())',
                          data=team_password, capture=True)
    team_secret = upload_secret(f"{STEM}-team", access_json)
    admin_secret = upload_secret(f"{STEM}-admin", admin_password)
    gcloud("run", "services", "add-iam-policy-binding", SERVICES["verifier"], f"--region={REGION}",
           f"--member=serviceAccount:{IDENTITIES['terminal']}", "--role=roles/run.invoker")
    deploy("web", web, {**shared, "TEAM_AUTH_MODE": "staging", "TEAM_PORTAL_ORIGIN": ORIGINS["web"],
                       "TEAM_TERMINAL_ORIGIN": ORIGINS["terminal"], "TEAM_INVITE_EMAILS": "disabled@example.test",
                       "TEAM_MAIL_FROM": "disabled@example.test", "TEAM_RESEND_API_KEY": "staging-no-delivery",
                       "SIGN_STORE": "local", "SIGN_DATA_DIR": "/tmp/staging-sign",
                       "SIGN_BASE_URL": ORIGINS["web"]}, "--allow-unauthenticated", "--max-instances=1")
    deploy("terminal", terminal, {"TERMINAL_PUBLIC_URL": ORIGINS["terminal"], "TEAM_PORTAL_ORIGIN": ORIGINS["web"],
                                  "TEAM_VERIFIER_ORIGIN": ORIGINS["verifier"], "UNUSUAL_WHALES_API_KEY": "staging-no-market-data",
                                  "TERMINAL_ACCESS_FILE": "/run/staging-access/team.json",
                                  "TERMINAL_ADMIN_FILE": "/run/staging-admin/password",
                                  "HTTP_PROXY": "http://127.0.0.1:1", "HTTPS_PROXY": "http://127.0.0.1:1"},
           f"--set-secrets=/run/staging-access/team.json={team_secret},/run/staging-admin/password={admin_secret}",
           "--allow-unauthenticated", "--max-instances=2")
    for kind in ("web", "terminal"):
        print(f"Staging {kind}: {ORIGINS[kind]}", flush=True)
    return tenant, team_password, admin_password


def verify(tenant, team_password, admin_password):
    image = "solaria-staging-browser:local"
    command("docker", "build", "-f", str(ROOT / "browser.Dockerfile"), "-t", image, str(ROOT / "web"))
    values = {
        "TEAM_BROWSER_STAGING": "1", "TEAM_PORTAL_ORIGIN": ORIGINS["web"], "TEAM_TERMINAL_ORIGIN": ORIGINS["terminal"],
        "TEAM_FIREBASE_TENANT": tenant, "STAGING_TEAM_PASSWORD": team_password, "STAGING_ADMIN_PASSWORD": admin_password,
        "GOOGLE_CLOUD_QUOTA_PROJECT": PROJECT,
        "STAGING_OPERATOR_TOKEN": gcloud("auth", "print-access-token", capture=True),
    }
    env_args = [arg for key in values for arg in ("-e", key)]
    command("docker", "run", "--rm", "--shm-size=512m", *env_args,
            image, env={**os.environ, **values})


if __name__ == "__main__":
    try:
        verify(*install())
    except CloudApiError as error:
        raise SystemExit(str(error)) from None
    except subprocess.CalledProcessError as error:
        # Command errors already show the denied permission when Google provides it.
        # Avoid printing arguments, which can include configuration or the browser API key.
        raise SystemExit(f"Staging stopped after {error.cmd[0]} exited {error.returncode}. See the error above.") from None
