# Website patches, 2026-11-24 (for Daniel)

Johnson asked for these fixes on the live website and approved each one. They were made on top of
your live image, one small revision at a time. **The same fixes are the seven commits under this
one on branch `fix/live-site-2026-11-24`** (see "Before your next deploy").

## What is live now

Service `solariavc` (europe-west1). Your four tags are untouched.

| Revision | Live from (ET) | What it adds |
|---|---|---|
| `solariavc-portal-fix-20261124-2` | 14:35 | recovery link opens `/staff?recover=1`; 10 s sign-in memory for portal reads |
| `solariavc-portal-fix-20261124-3` | 15:12 | `/service-worker.js`: removes the old site's leftover worker |
| `solariavc-portal-fix-20261124-4` | 15:20 | portal clicks show at once |
| `solariavc-portal-fix-20261124-5` | 16:12 | **Solaria Sign sign-in loop fixed** (`TEAM_SIGN_GATE=off`); any email can be given a portal account (`*` in `TEAM_INVITE_EMAILS`) |
| `solariavc-portal-fix-20261124-6` | 16:30 | Sign's "Sign all" page: boxes grow as you type; the recovery button says "Requesting…" |
| `solariavc-portal-fix-20261124-7` | 17:08 | **what search engines read**: real 404s, a sitemap that dates itself, one description of the company, `www` → `solariavc.com` |

- **Images:** `cloud-run-source-deploy/solariavc/team-login`, tags `portal-fix-20261124-2` … `-7`.
  Each is FROM the one before, plus COPY lines only. The Dockerfile and file hashes of each are
  in `live-build/` (for -2) and `live-build-3/` … `live-build-7/`.
- **Read back:** every image was read back from the registry before it got traffic. Your layers
  come first and unchanged, and the new layers hold exactly the listed files (root-owned, 0644,
  same SHA-256 as here).
- **Settings changed:** only two, both on -5 and carried into -6:
  - `TEAM_SIGN_GATE=off` (new)
  - `TEAM_INVITE_EMAILS` gained a `*` entry; your two named addresses are still in it

## Roll back (about 10 seconds each)

```bash
gcloud run services update-traffic solariavc --region europe-west1 --project gen-lang-client-0188652481 --to-revisions solariavc-portal-fix-20261124-6=100
```

- Going back to -6 undoes only the search changes; unknown addresses answer with the home page again.
- Going back to -5 also undoes the "Sign all" and label changes.
- **Going back to -4 or earlier brings the Sign sign-in loop back** and makes the portal refuse
  every email except the two named ones.
- Never go back to `solariavc-portal-fix-20261124` (no number): its Sign guards used the memory.

## Before your next deploy

Your build replaces this image, so build from this branch, or merge it into yours first. It is
`checkpoint/team-login` at 7c07a40 plus seven commits, one per fix (15 files).
- **Checked from source:** built with your build's switches (`VITE_TEAM_PORTAL_ENABLED=true` and
  the two Firebase values), the patched source:
  - gives the same `sign-BkD4rtCl.js` that is live now, byte for byte, and the same `404.html`,
    `robots.txt` and home page head
  - passes the portal's real-browser test (17 checks), the Sign all test (18 checks) and the
    search test (8)
  - passes your own `npm test` (90 tests)
  - **not run:** your `staff-service/*.test.js`, which need the Firebase emulators. The
    staff-service changes were tested with `tests/*.test.mjs` here, against a stand-in for
    `firebase-admin` (`test-stubs/`).
- **Your unpatched source reproduces your live build:** `live-build-6/build_like_live.py` built
  7c07a40 and got `sign-DhmF2Xy8.js`, `main`, `client` and the stylesheets identical to your
  image. So the Sign page was rebuilt from source, not patched by hand.
- **Keep these two settings** on the service, or the behaviour changes back:
  - `TEAM_SIGN_GATE=off`
  - the `*` entry in `TEAM_INVITE_EMAILS`
- Pushing to GitHub stops this kind of drift. J-java-j/SolariaVC is public, so keep keys out.

# Revision -5: Solaria Sign's sign-in loop, and who can be invited

## Sign's sign-in loop

**Report (a team member, 15:54–16:10 ET):** ask for a sign-in link, click it, click Continue,
and the page asks for the email again. Six tries, then the 5-per-10-minutes limit refused a seventh.

**Cause:** `server/team-access.mjs`, live since your 00187. For any browser without a Team
Portal session it answers `GET /api/sign/me` with `{"user":null}`. Sign's own session is never
asked. So after Sign accepted the emailed link (`POST /api/sign/auth/verify` answered 200 each
time), the page asked who was signed in, was told nobody, and showed the email form again.

- **In the request log:** that browser's `/api/sign/me` answers were 168 bytes every time. A
  browser that also had a portal session got 267 bytes, then 374 with the user in it.
- **Who it locked out:** every Sign team member except Johnson and you, because only your two
  emails could have a portal account at all.

**Johnson's decision:** "Emailed link only". Sign works with its own emailed link, as it did
until 2026-11-23. The terminal keeps the portal check.

**The change:** one line at the top of `guardTeamDestination`:

```js
if (process.env.TEAM_SIGN_GATE === 'off') return false;
```

- Only the exact value `off` turns the check off. Unset, or anything else, keeps it on as you built it.
- With it off, Sign's own sign-in still guards every team route: `signedInUser()` in
  `server/sign/index.js` runs for envelopes, folders and the Team page.
- **To turn the check back on:** remove the setting. Do that only once every Sign team member
  has a portal account, and tell them they must sign in at `/staff` first. Otherwise the loop
  returns, because the Sign page gives no hint that the portal is needed.
- **Tests:** `tests/sign-gate.test.mjs` (5). Four pin your behaviour with the check on,
  including the `{"user":null}` answer; one failed before the change.

## Any email can be given a portal account

`TEAM_INVITE_EMAILS` was an exact list of two addresses, so the Owner could add nobody from the
portal, and nobody else could use recovery.

**Johnson's decision:** "Any email". He and Board Admins can add any address.

**The change:** `approvedEmails(list)` in `staff-service/provider.js`. A `*` entry approves any
well-formed address (one `@`, no spaces, at most 254 characters). Without a `*` the list is exact,
as before.

- Who may create accounts is unchanged: Owner and Board Admins only, and a Board Admin still
  can't create a Board Admin.
- **To go back to a named list:** remove the `*` entry from the setting.
- **Tests:** `tests/any-email.test.mjs` (7), three on the rule and four through the real request
  handler. All failed before the change.

# Revision -6: the "Sign all" page, and one label

## Sign all: boxes that grow, answers shown whole

**Report:** "website seems to not expand as you write, so most of it is off screen for text box".

- The one-document signing page was fixed on Nov 14–20 and is fine on the live build.
- The **Sign all page** (`Queue` in `src/sign/SignQueue.tsx`, used at `/sign/queue` and by a
  signer's "Sign all N" button) still had a one-line `<input>` per blank, 201 px wide on a
  laptop. A long answer scrolled out of sight. The marked space on the document cut it off too.

**The change** (three files in `src/sign/`):

- Each blank's box is a textarea that grows as the answer is written (`AnswerBox`). Enter adds no
  line break, as before; Shift+Enter does.
- The marked space on the document draws the answer with the signing page's `Answer` component:
  wrapped or smaller to fit, as the sealed PDF will print it.
- An answered blank's number badge sits at the corner of its space, off the words.
- A long answer gets the same note as on the signing page: "long answers print smaller to fit
  the space".

**Tests:** `tests/signall-browser.mjs` runs the real server and a real Chrome with two test
documents, at laptop and phone sizes, and signs both documents at the end.

- On your live build 4 of 18 checks fail: the four that describe the fault.
- On the new build all 18 pass, and the answers are stored exactly as typed.
- Looked at in the Mac's WebKit too, at 1280×900 and 390×844: `pictures/`.

## The recovery button's label

`ConnectedPortal.tsx` had `'Requesting?'` where the ellipsis was lost. It now says
`Requesting…`, written the way "Signing in…" is. Live as `ConnectedPortal-Fast02.js` and
`staff-Fast02.js`, which are your 00187 files with the listed edits (`live-build-6/make_fast.py`).

# Revision -7: what search engines read

Johnson asked for solariavc.com to be the firm's main site and searchable on Google, and asked
what had changed.

## What had changed

- **Your "Frontend redesign" (0bd9d2b, 2026-07-14)** rewrote the Google title and description
  from his April text ("a privately held investment firm operating the Medallion Fund…") to
  "Student venture capital for frontier builders", and removed the Fund and Ventures sections.
  The link preview and the structured data kept the April text, so the page described two
  different companies.
- **Nothing of yours took the site out of Google.** Googlebot fetched the home page,
  `robots.txt` or the sitemap on 14 of the 22 days to 2026-11-24, and the home page answered 200.
  What Google has actually listed can't be read from here.
- **Older faults, from April:**
  - Every address with no file behind it answered 200 with the home page. Googlebot was
    fetching `/news/`, `/blog/`, `/press/`, `/cms/` and `/wp-json/` (the domain's DNS is still
    at WordPress.com, where the site once was) and getting a copy of the home page each time.
  - The sitemap listed only the home page, dated 2026-04-17.
  - `robots.txt` blocked `/staff` and `/sign`, so search engines couldn't read their `noindex`.

## The wording

Johnson's words: a private company that runs a student-funded fund operated by students and
builds spinout companies from university research and patents, like UC San Diego's. Kept simple.

- **Title:** `Solaria Capital — Student-run fund and university spinouts`
- **Description:** `Solaria Capital is a private company with a student-funded fund run by
  students. We build spinout companies from university research and patents, like UC San Diego's.`
- The same two strings are the link preview (Open Graph and Twitter) and the structured data's
  description. The structured data is now an `Organization` plus a `WebSite`, not a
  `FinancialService`.
- **The page's own text was not changed.** Its first paragraph still says "student-led venture
  platform". That is Johnson's to decide.

## The changes

- **`server/index.js`:**
  - An address with no file is a 404 with `404.html` and `X-Robots-Tag: noindex`. The public
    site is one page with no client routes, so nothing needed the old catch-all. In 30 days of
    logs its only non-crawler users were `/favicon.ico`, the old worker file and scanner probes.
  - `/favicon.ico`, `/apple-touch-icon.png` and `/index.html` are 301s to the real files.
  - `/sitemap.xml` is written by the server: the home page and every `research/*.pdf`, each
    dated by its file's last change. `public/sitemap.xml` is gone.
  - `Host: www.solariavc.com` gets a 301 to `https://solariavc.com` (same path and query).
  - Any `*.run.app` host gets `X-Robots-Tag: noindex`. Your tagged test addresses still work.
- **`public/robots.txt`:** blocks only `/api/`, `/staff/local-api/` and `/staff/launch/`.
- **`public/research/solaria-family-model-m5v3.html`:** `noindex, follow`, since it only frames
  the PDF. The PDF is what the sitemap lists.
- **`index.html`:** the head, as above (`live-build-7/make_head.py` does it to a source or a
  built file).

**Tests:** `tests/site-search.test.mjs` (8) runs the real server. On -6 six fail; on -7 all pass.
One of them checks that everything real still answers 200: every site link, every portal
shortcut in `destinations.json`, the emailed-link pages, the cards and their `.vcf` files.

## Done outside the code

- **`www.solariavc.com` now reaches the site.** A Cloud Run domain mapping to `solariavc` was made on
  2026-11-24 at 17:19 ET, and Google issued its certificate at 17:32 ET.
  - No DNS change was needed: at WordPress.com, `www` is a CNAME to `solariavc.com`, which already
    points at Google.
  - The server answers `www` with a 301 to `https://solariavc.com`.
  - To undo, delete the mapping `www.solariavc.com` in europe-west1.

## Still to do, outside the code

- **Google Search Console:** verify `solariavc.com` and submit `https://solariavc.com/sitemap.xml`.
  That is the only way to see what Google has listed; it can't be read from here.
- **The page's text comes from scripts.** Googlebot runs them (it fetched the script and style
  files); crawlers that don't see an empty page. Building the home page's HTML ahead of time
  would fix that. Not done: it changes how the public page starts and needs its own look.

# Checked and found fine

- **Checkboxes on the board confirmations:** every signer still waiting has choose-one boxes
  (7 signers; counted in production, no names read). The one-off repair ran on 2026-11-14.
  - Two people signed before the repair with both boxes ticked: two documents, both sent
    2026-11-14 and still open for the other signer (Johnson has their ids). Johnson may want
    those two voided and sent again, and shouldn't counter-sign them before deciding.
  - No completed board confirmation has both boxes ticked (none is completed yet).
- **No answer of 500 or more** on the website, the terminal or the verifier in two days of logs.

# Not yet seen on the live site

By 16:43 ET nobody had used these since they went live, so they are deployed and tested here but
not yet seen working for a real visitor:

- **Sign's sign-in without a portal session.** Proof will be a browser with no portal session
  getting an `/api/sign/me` answer larger than 168 bytes after `auth/verify`, then a 200 on
  `/api/sign/envelopes`.
- The new Sign all files (`sign-BkD4rtCl.js`, `sign-DDl034i8.css`) and the `Fast02` portal files.
- A first invitation to an address outside the old list of two.
- `www.solariavc.com` over https. Google reports the mapping ready, but by 17:33 ET only four
  plain-http requests had arrived, which Google itself sent on to https.

# Tools

`tools/` holds what was used: `readback.py` (compare an image with its base in the registry),
`switch_watch.sh` and `switch_term.sh` (move traffic, watch, roll back on trouble),
`web_revision.py`, and the read-only log and document counts. None holds a key; each asks
`gcloud` for a token when it runs and prints no address, name or email.

# Noticed, not changed

- **Cold starts:** the website runs with no minimum instance. It started 28 new instances
  today, and 17 requests waited more than 3 s. One always-on instance would remove that, at a
  cost; that is Johnson's call.
- **The verifier's slowest answer was 3.3 s** against the terminal's 4 s limit. No request has
  failed for it yet.
- **Old session records** (`teamBrowserSessions`, `terminalSessions`, `terminalTickets`) are never
  deleted after they expire. A Firestore TTL on `expires` would clear them.

# Revision -2 in detail (the first patch, 14:35 ET)

## 1. "Request password recovery" on the sign-in page

The link was `mailto:Johnson's address?subject=Team%20Portal%20password%20recovery`, so
on a computer with no mail app set up nothing happened. It now opens `/staff?recover=1`,
your own self-service page ("Email me a password link").

- **In your source:** change that one link's `href` in the sign-in form. It is the
  `portal-text-action` link shown when connected. Vite gives the files new names on your
  next build, so nothing else is needed.
- **In the live image:** the built bundle was patched under new file names, because the
  website serves `/assets/*` as `immutable` for a year:
  - `assets/ConnectedPortal-RcvLnk01.js` is `ConnectedPortal-XbvD2RiI.js` with only that `href` changed. The other three `mailto:` links are untouched.
  - `assets/staff-RcvLnk01.js` is `staff-D8cCkydr.js` pointing at the new chunk (both references).
  - `staff.html` points at the new staff chunk.
  - The old files are still in the image.

## 2. Slow buttons

**What was slow:** Johnson's session on 00133 (13:41–14:28 ET) made 176 portal requests,
140 of them `GET /me`. On the server, `/me` had a median of 0.215 s (max 0.86 s) and
`/accounts` a median of 0.461 s (max 0.88 s), with no cold starts. Each lookup is a Firestore
read (`team-login-prod`, us-east4) followed by an Identity Platform `getUser`, one after the
other. One instance served all of them. Replaying those rows through the real rule gives
115 of the 165 lookups (70%) remembered, saving about 16 s of `/me` server time over the
session. The rule: 10 s counted from the lookup that missed, not extended on hits, and
starting over at each sign-in or sign-out. That is an estimate until it is measured on live
clicks.

**The change** (`staff-service.diff`, two files):

- `hostedTerminal().user(cookie, fresh = false)` remembers a passed check for 10 s, per instance:
  - never past the session's own `expires`
  - keyed by the cookie's SHA-256, never the cookie itself
  - at most 1000 entries (the memory starts over past that)
- Refusals are never remembered.
- `forget()` drops the entry at once. That covers sign-out and the old session at a new sign-in.
- `currentRole(…, fresh = req.method !== 'GET')`: every portal change checks the person fresh
  both times, including the re-check inside `serialize()`. That covers create, edit, activate
  or deactivate, and resend invite.
- **Guards always check fresh.** `server/team-access.mjs` authorizes every Sign page and
  every Sign API call, writes included, with a GET to `/guard/<id>` on the loopback staff
  server. So `authorize()` passes `fresh` for guards.
- The terminal hand-off is unchanged. The verifier's `exchange()` and `check()` call the
  inner `user(parent)` and never use the memory. That holds even if you deploy this file to
  the verifier too.

**What uses the memory:**

- `GET /me`
- `GET /accounts`
- the redirect decision at `/staff/launch/*`

In each case the destination checks again fresh: Sign through its guard, the terminal
through the verifier.

**Trade-off:** for up to 10 s, on an instance that remembered someone, those portal reads can
show them as they were. A role change or deactivation reaches the portal pages up to 10 s
late. It reaches changes, Sign and the terminal at once.

## Tests (node:test)

- `tests/hosted-terminal.test.mjs` (10 tests) and `tests/api.test.mjs` (6 tests, which run the
  real request handler over local HTTP):
  - On your live files, 5 of the 16 fail: the five that need the memory. The safety tests pass on both:
    - fresh checks on changes and on guards
    - a demotion stops changes and the owner-only Sign area at once
    - sign-out forgets
    - refusals not kept
    - the memory capped at the session's end
  - On the patched files, all 16 pass.
- `live-build/assets.test.mjs` (7 tests): the page-file changes are byte for byte what is
  described above. Before the change 5 fail; after, all 7 pass.
- **To run:** in a scratch folder, put your `staff-service/` (with `staff-service.diff` applied
  by `patch -p1` from the folder), this `tests/` next to it, and `test-stubs/firebase-admin/`
  at `node_modules/firebase-admin/`. Then run `node --test tests/*.test.mjs`. A bare
  `node --test tests/` fails on Node 22. Done that way on this Mac, the diff applied cleanly,
  gave exactly the deployed files, and all 16 passed.

## live-build/

This is how the live image was made:

- `Dockerfile`: FROM your digest, plus three COPY lines (no RUN or USER).
- `make_assets.py`: the three byte-level replacements, with expected counts checked.
- `assets.test.mjs`
- `ctx-sha256.txt`: hashes of the five files. These matched the image's three new layers when
  read back from the registry. The files are root-owned and mode 0644, and the folders match
  your layers.

## Status

- **14:23 ET:** first patch revision created with no traffic. No instance started while it had none.
- **14:28 ET:** 100% moved to it. Two instances started, each passed the start-up probe and
  logged `Solaria Capital server listening on :8080`.
- **14:30–14:33 ET:** found that Sign's guards used the memory. Fixed (guards fresh), tested,
  and rebuilt (build at 14:33).
- **14:35 ET:** 100% moved to `solariavc-portal-fix-20261124-2`. It started cleanly, and Google
  reports it Ready with the four tags unchanged.
- **First requests:** all 200, including `assets/staff-RcvLnk01.js`,
  `assets/ConnectedPortal-RcvLnk01.js`, and `/staff?recover=1` opened from the new page.
