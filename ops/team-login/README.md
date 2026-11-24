# Team Login build and release

The website image contains the public website, the Team Login client, its same-origin API, and the verifier entry point. Terminal runs as a separate service. The website and verifier use the same Identity Platform tenant and named Firestore database. Terminal calls the verifier using its runtime service account and a Google identity token with the verifier origin as audience. The browser submits a one-use ticket by POST. Only the two known Terminal entries can be resumed.

## Build and test locally

Run `npm ci` in both the repository root and `staff-service`. From the root, run `npm run build`, `npm test`, `npm --prefix staff-service test` and `node --test staff-service/terminal-handoff.test.js`. To test shared ticket redemption and revocation, use Java 21 or newer and run the following inside `staff-service`.

```sh
npx --no-install firebase emulators:exec --only auth,firestore --project demo-solaria-staff-test --config firebase.test.json "node --test --test-concurrency=1 bootstrap.test.js integration.test.js hosted-terminal.test.js"
```

The [local service guide](../../staff-service/README.md) covers fictional users and the connected browser. The [staging guide](../../staff-service/STAGING.md) covers IAM, invitation delivery, secrets, and bootstrap. The terminal browser suite expects the separate Terminal service on localhost:8790 for local tests. Staging uses bundled Chromium and temporary operator credentials.

## Reproduce a staging build

In a temporary release directory, place the website source under `web/` and the reviewed private Terminal Docker build context under `terminal/`. Copy `ops/team-login/deploy.py` and `ops/team-login/browser.Dockerfile` to the release directory root. A clean website export can be prepared using `git archive HEAD | tar -x -C web` after creating the directory. The Terminal context needs its Dockerfile, requirements and patched Python package. Keep original archives, password files and account exports outside both contexts.

An authorized staging operator sets `STAGING_OPERATOR_ACCOUNT` to the active Google Cloud account and runs `python3 deploy.py` from the release directory with Docker and the Google Cloud CLI available. The script verifies the project number, provisions or reuses staging resources, tests the verifier as a non-root process and runs browser tests against staging. It can enable project APIs, initialize Identity Platform and enable tenants when needed. Run it only with authorization for those project changes.

## Production configuration

| Component | Configuration |
| --- | --- |
| Website build | Pass `VITE_TEAM_PORTAL_ENABLED=true`, the restricted production `VITE_TEAM_FIREBASE_API_KEY`, and `VITE_TEAM_FIREBASE_TENANT` as Docker build arguments. An ordinary Docker build defaults to the original launcher. |
| Website runtime | Preserve the existing Sign settings, storage, mail credentials and service identity. Use `TEAM_AUTH_MODE=production` and the production project, tenant, named database, portal and Terminal HTTPS origins, mail sender and approved recipients. The image supplies `TEAM_PORTAL_ENABLED` and `TEAM_BROWSER_API_KEY` from its build configuration. |
| Private verifier | Run `node staff-service/verifier.js` using the production project, tenant and session database. Configure its exact HTTPS audience and `TEAM_TERMINAL_CALLER`. Only the Terminal runtime identity needs permission to invoke it. |
| Terminal | Supply the exact portal, verifier and Terminal origins. Preserve its existing team/admin password sources, secret mounts, volumes, identity and application settings. Set `TEAM_TERMINAL_HANDOFF=on` on the portal when both ends are ready. |

For an approved release, first record the current traffic split and image digests for each service. Compare the serving images and release source before creating revisions. Use the existing production tenant and Owner and keep the current Sign storage bindings. Validate a new verifier before releasing an image that depends on it. Check that the production build actually contains the enabled portal before switching the website. Roll back an affected service to its recorded traffic allocation and repeat the checks if verification fails.

With Chrome installed, these read-only checks use a fresh context. They submit no real invitation or credentials.

```sh
node scripts/check-production-onboarding.cjs https://solariavc.com --terminal-live
node scripts/check-production-recovery.cjs https://solariavc.com
```

Verify authenticated roles separately in staging. A signed-out redirect alone cannot confirm that an Owner reaches the existing admin password prompt or that a demoted account loses access.

## Production operator utilities

Use the [production configuration template](../../staff-service/production.env.example) as a field reference. Build arguments, runtime settings and operator inputs belong in their indicated environments. Obtain image digests and revision names from the approved release record. Keep the configured mail sender, secret bindings and existing tenant in place.

| Script under `scripts/` | Purpose |
| --- | --- |
| `check-deploy-access.py` | Read effective permissions for the active Google Cloud CLI account. |
| `preflight-team-login-production.py` | Record the current traffic allocations and inspect aggregate account roles. Store the output outside Git. |
| `team-login-production-image.py --tag <new-release-tag>` | Build and smoke-test the enabled website image. Reads the restricted Identity Toolkit browser key or creates it if missing. Add `--push` only when publishing an approved image. |
| `check-production-owner-session.py` | Confirm the account identified by `TEAM_OWNER_EMAIL` and `TEAM_EXPECTED_OWNER_UID` has the Owner role and a current portal session. |
| `invite-production-owner.py` | One-time first-Owner job for an approved single-recipient environment. Requires `TEAM_OWNER_EMAIL`, `TEAM_EXPECTED_WEB_REVISION` and `TEAM_EXPECTED_WEB_IMAGE`. Use the portal recovery screen for an existing Owner. |
| `cutover-team-login-terminal.py` | For the original two-service cutover, validate the Owner session and expected single-revision allocations, prepare tagged revisions, then switch and check traffic. Requires `TEAM_OWNER_EMAIL`, `TEAM_EXPECTED_OWNER_UID`, both expected serving revision names, and `TEAM_EXPECTED_TERMINAL_IMAGE` pinned by digest. |

These utilities run manually. Building or testing this repository does not execute the bootstrap, image publication or traffic switch. Keep local credential files, rollback records and generated invitation messages outside Git.
