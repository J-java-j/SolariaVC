# Local staff portal backend

The Solaria Team Portal uses the Firebase Auth emulator at `127.0.0.1:9099` and the team API at `127.0.0.1:8787`. In local development, **Team login** opens the connected portal at `/staff`. Use `/staff?preview=signin` for the independent mock preview.

## Start and test

Use Node 22 or newer (verified with Node 24). Run these PowerShell commands from the repository root. Install the dependencies once.

```powershell
npm.cmd --prefix staff-service ci
```

In terminal 1, start the emulator and wait for **All emulators ready**.

```powershell
npm.cmd --prefix staff-service run emulator
```

In terminal 2, create the three fictional accounts and start the API.

```powershell
npm.cmd --prefix staff-service run seed
npm.cmd --prefix staff-service start
```

In terminal 3, check the live service, exercise each seeded login, and run the integration suite.

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
npm.cmd --prefix staff-service run roles
npm.cmd --prefix staff-service test
```

| Fictional account | Profile | Manageable accounts |
| --- | --- | --- |
| `staff@example.test` | Own | None (`403` on roster and all management actions) |
| `board-admin@example.test` | Own | Staff |
| `owner@example.test` | Own | Staff and Board Admins |

All three seeded logins use the fixture password `Fictional-local-2026!`. Running the seed again preserves existing accounts and their current roles and status. Stop the emulator with Ctrl+C to save identities in the ignored `.emulator/` directory. The test command starts a separate temporary emulator on port 9199 and an API on an ephemeral port, then tears them down.

## Interface

Sign in directly with the provider. Send its ID token as `Authorization: Bearer <idToken>` on portal requests. Each protected request verifies the token and reads the current Firebase user record. The API uses the provider UID, display name, email, disabled flag and a server-assigned role claim on that record. This keeps role changes and deactivation effective for tokens issued before the change. Accounts without an assigned portal role have no portal access.

| Method and path | Result |
| --- | --- |
| `GET /health` | Checks connectivity to the configured emulator |
| `GET /me` | Own UID, email, display name, role and active status |
| `GET /accounts` | Accounts the signed-in administrator can manage, including inactive accounts |
| `POST /accounts` | Accepts `email`, `displayName` and `role`. Creates an account and a password-setup invitation in the emulator outbox. Returns the account with status 201. |
| `PATCH /accounts/{uid}` | Accepts one or more of `displayName`, `active` and `role`. The Owner can switch between Staff and Board Admin. The UID and sign-in email are stable through these edits. |

The management API accepts fictional addresses ending in `@example.test`. Account creation takes no password. The invited person chooses one at the emulator's single-use password-reset link. Only the local seed command provisions the Owner. Portal writes are serialized in the single API process so each queued edit rechecks the actor and target before writing.

### Manually invite a Staff account

Run in PowerShell with the review service running. Changing the sign-in email below lets you try the same management request as any of the three roles.

```powershell
$identity = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
$login = Invoke-RestMethod -Method Post -Uri "$identity/accounts:signInWithPassword?key=local-demo" -ContentType 'application/json' -Body (@{ email = 'board-admin@example.test'; password = 'Fictional-local-2026!'; returnSecureToken = $true } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.idToken)" }
Invoke-RestMethod http://127.0.0.1:8787/me -Headers $headers
$newAccount = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/accounts -Headers $headers -ContentType 'application/json' -Body '{"email":"review@example.test","displayName":"Taylor Reed","role":"staff"}'
Start-Process http://127.0.0.1:5173/staff/launch/outbox
```

Open **Set your password** in the matching message, confirm a password, then choose **Go to sign in**. The local manager outbox displays only messages for accounts that role can manage. The first Owner uses the operator-only emulator inbox before a portal manager exists. Use fictional identities on this machine.

## Connected browser review

With the emulator, seed and API running, run `npm.cmd run dev -- --host 127.0.0.1` from the repository root. Open [the connected portal](http://127.0.0.1:5173/staff). Roles come from the API. A recent Firebase ID token is exchanged for an eight-hour HttpOnly session cookie shared by tabs on the portal host. Sign-out clears the cookie for this browser. Use separate browser profiles or private contexts to test different roles. Navigation, returning to the tab, and account actions recheck access.

- Staff can open the dashboard and use the account menu to sign out.
- Board Admin can open **Manage Staff → Add staff** and send an invitation. Use **Open local outbox** and click **Set your password** beside the recipient's address. Accounts awaiting setup also offer **Resend invitation**.
- Owner can open **Board Admins** and change a Board Admin's role in **Edit**. Return to that account's tab and click **Dashboard**. Its management controls disappear. Deactivating an account sends it to sign-in on its next protected request. The table confirms each saved action inline.

To repeat the automated browser walkthrough, also run `npm.cmd run build` and `npm.cmd run server` from the website root for the production launcher check. With Chrome installed, run `npm.cmd --prefix staff-service run test:portal`. The test signs in as all three seed accounts in separate browser contexts, creates a uniquely named invitee, exercises role and status changes on that identity, and removes the test identity afterward.

## Private staging

See the [private staging runbook](STAGING.md) for environment configuration, first Owner setup, invitation delivery, password recovery, and ownership transfer.

The [shortcut inventory and Terminal handoff](SHORTCUTS.md) describes every launch ID and direct-access boundary.
