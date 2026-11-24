# Staff portal preview

For the separate API-backed local mode, open [the connected portal](http://127.0.0.1:5173/staff). Its emulator setup, fictional logins and invitation walkthrough are in the [staff-service README](../staff-service/README.md). The instructions below describe the mock preview.

The mock role switcher runs in local development. A default production build serves the original staff launcher. The enabled hosted build serves Team Login and ignores mock preview parameters. See the [Team Login release notes](../ops/team-login/README.md) for build settings.

Run `npm run server` (8080) and `npm run dev` (5173). No environment values or
credentials are required for the preview. The homepage’s **Team login** opens the connected portal. Use an explicit mock URL below to switch roles without credentials.

| View | Local URL |
| --- | --- |
| Sign-in | http://127.0.0.1:5173/staff?preview=signin |
| Staff | http://127.0.0.1:5173/staff?preview=staff |
| Board Admin | http://127.0.0.1:5173/staff?preview=board-admin |
| Owner | http://127.0.0.1:5173/staff?preview=owner |

Use **Development preview** at the top to switch views without credentials.
The illustrative Sign in form sends nothing and explains that authentication
comes later. Sample account changes persist across preview navigation in the
same tab, then reset on refresh. They are never saved to browser storage or an API.

## Review interactions

1. Visit the homepage and follow **Staff login**. Press **Sign in** with empty or
   fictional fields to see the deferred-authentication message.
2. Switch through the three dashboard roles. Terminal is first, Sign second.
   Board Admin and Owner also have Terminal Admin; only Owner has Sign → Team.
3. In Board Admin, choose **Manage Staff**, then **Add staff**. Try creating,
   editing, deactivating and reactivating a fictional account. Search and filter
   the table. Duplicate usernames should show an error.
4. In Owner, choose **Board Admins**, then **Add board admin**. Owner can also
   change a sample account between Staff and Board Admin. The account then appears
   in the corresponding list. Board Admin can only manage Staff.
5. Refresh and confirm the original sample records return. Try browser Back and
   Forward, Escape to close a dialog, keyboard tabbing, and the sample-user menu.
6. Review at approximately 1440px and 390px. The account table scrolls horizontally
   inside its own region on narrow screens; dialogs use native modal focus trapping,
   Escape dismissal and focus restoration. Desktop/mobile appearance and actual
   browser interactions remain unverified until browser access is available.

## Preserved shortcut mapping

All existing HTTPS links retain `target="_blank"` and `rel="noopener noreferrer"`.
Internal routes remain same-tab, email retains `mailto:`, and contact downloads
retain their `download` attribute. Preview roles do not grant access in any tool.

| Original label | Exact destination | Preview location |
| --- | --- | --- |
| Terminal | `https://terminal.solariavc.com` | First tool, every dashboard |
| Admin | `https://terminal.solariavc.com/admin` | Administration → Terminal Admin, Board Admin/Owner |
| Documents | `/sign` | Solaria Sign, every dashboard |
| Check a signed document | `/sign/verify` | Solaria Sign, every dashboard |
| Team | `/sign/team` | Solaria Sign, Owner only |
| Johnson Jiang | `/card` | Quick Links → Business cards |
| Karl Li | `/card/karl` | Quick Links → Business cards |
| Johnson’s contact | `/card/johnson-jiang.vcf` | Quick Links → Business cards; download |
| Karl’s contact | `/card/karl-li.vcf` | Quick Links → Business cards; download |
| Webmail | `https://app.titan.email` | Quick Links → Email |
| Contact inbox | `mailto:contact@solariavc.com` | Quick Links → Email |
| Website | `/` | Quick Links → Public pages |
| Linktree | `https://linktr.ee/solariaventure` | Quick Links → Public pages |
| Solaria Capital | `/` | Header brand |
| Back to the site | `/` | Header |
| contact@solariavc.com | `mailto:contact@solariavc.com` | Footer help text |

Vite forwards `/card` requests to the local Node server. The original `/card` and
`/card/karl` URLs therefore work from the preview without changing destinations.
They can also be checked directly at http://127.0.0.1:8080/card and
http://127.0.0.1:8080/card/karl after a build.

## Verification commands

```sh
npm run build
npm test
node scripts/check-staff-preview.mjs
```

The final command requires both servers running. It checks all four development
URLs, the unchanged production launcher for all four query values, exclusion of
preview artifacts, the original card routes through Node/Vite, vCard content types,
and homepage/Sign HTML responses. Component tests render React markup without a
browser to check link order, exact destinations, external/download behavior, and
role-specific placement. These checks do not substitute for visual/browser QA.

Real portal authentication, enforcement, account storage, invitations and Terminal
integration are deferred. Sign's existing owner/admin system is separate. No backend
or linked-tool authentication logic is changed by this preview.
