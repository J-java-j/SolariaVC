# Connected portal shortcuts

On the local [Team Portal](http://127.0.0.1:5173/staff), each authenticated outbound link starts at `/staff/launch/{id}`. The server resolves the ID using its allowlist. It verifies the Firebase session cookie with revocation checking and loads the current role and disabled flag before it returns a destination. On sign-in the tab retries the same launch ID. A wrong role gets HTTP 403. The URL contains no session credential.

| Link | Launch ID | Destination | Access at destination |
| --- | --- | --- | --- |
| Terminal | `terminal` | `https://terminal.solariavc.com` | Existing team password. See the local Terminal integration below. |
| Terminal Admin | `terminal-admin` | `https://terminal.solariavc.com/admin` | Board Admin or Owner at launch, then existing admin password. See the local Terminal integration below. |
| Documents | `documents` | `/sign` | Public email entry and recipient workflows. The sender workspace also requires a portal session and Sign sender access. |
| Check a signed document | `verify` | `/sign/verify` | Public verification |
| Team | `sign-team` | `/sign/team` | Portal Owner plus independent Sign owner access |
| Johnson Jiang / Karl Li | `johnson-card` / `karl-card` | `/card` / `/card/karl` | Public NFC business cards |
| Johnson’s contact / Karl’s contact | `johnson-contact` / `karl-contact` | `/card/johnson-jiang.vcf` / `/card/karl-li.vcf` | Public contact downloads, also used by the public cards |
| Webmail | `webmail` | `https://app.titan.email` | Titan authenticates mailbox access |
| Contact inbox / footer contact | `contact` | `mailto:contact@solariavc.com` | Opens the configured mail handler |
| Website / header brand / Back to the site | `website` | `/` | Public homepage |
| Linktree | `linktree` | `https://linktr.ee/solariaventure` | Public community links |
| Open local outbox | `outbox` | `/staff/outbox` | Local only. Board Admins see Staff invitations; Owners also see Board Admin invitations. |

Web destinations open in a new tab. The final vCard response supplies the download filename. Dashboard, account management, Settings, sign-out and the skip link operate in the current tab. Sign-in, recipient invitation acceptance and recovery contact remain reachable without a portal session.

The local Vite and Node servers check direct visits to Sign team administration, sender queues and envelope pages. Private sender APIs for envelopes (including original and sealed downloads), folders and team management also check the portal session before Sign checks its own permissions. External recipients continue to use Sign links, recipient sessions and recipient-authorized downloads. Public verification and business cards work without a portal account.

## Local Terminal integration

The recovered app runs at `http://localhost:8790/` and `http://localhost:8790/admin`. Use `http://127.0.0.1:5173/staff` for the portal. The different hostnames keep the two apps' cookies separate. Start the emulator and website as described in README.md. In the shell that starts the staff service, set `$env:TEAM_LOCAL_TERMINAL='1'` before running `npm.cmd --prefix staff-service start`.

A Terminal navigation without a valid session goes through one of the two fixed portal launch IDs. After Firebase authorization, the portal submits a single-use, 30-second ticket in a form body to Terminal. Terminal validates the form origin and redeems the ticket over loopback. Its host-only HttpOnly cookie identifies a server-held link to the portal session. Each protected request uses the existing portal guard, which reads the current Firebase user. Portal sign-out removes the linked tickets and sessions. Restarting the staff service clears the in-memory handoffs.

The existing Terminal password files and password handlers run after the portal checks. The local review uses fictional passwords and no live market credentials. From the website checkout run `node --test staff-service/terminal-browser.test.js` with both apps running. For the original launch-inventory tests, start the API with the local Terminal option unset.

The hosted flow uses an IAM-protected verifier, host-only cookies and a named Firestore database for single-use tickets and session revocation. For the build settings and direct-entry checks, see the [Team Login release notes](../ops/team-login/README.md).
