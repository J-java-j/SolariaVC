# Solaria Capital

Marketing site for Solaria Capital — a privately held investment firm
operating the Medallion Fund, Solaria Ventures, and Solaria Research.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Production build

```bash
npm run build
npm run preview
```

## Deploy to Google Cloud Run

The repo ships with a multi-stage `Dockerfile` and a Node server that
honors Cloud Run's `$PORT` env var.

If you've already connected this GitHub repo to a Cloud Run service via the
Cloud Console (Cloud Run → "Continuously deploy from a repository"), every
push to `main` will:

1. Trigger Cloud Build
2. Build the image from this `Dockerfile`
3. Deploy a new revision to your Cloud Run service

To deploy manually instead:

```bash
gcloud run deploy solariavc \
  --source . \
  --region europe-west1 \
  --project gen-lang-client-0188652481 \
  --allow-unauthenticated
```

### Local Docker test

```bash
docker build -t solaria-vc .
docker run --rm -p 8080:8080 -e PORT=8080 solaria-vc
# open http://localhost:8080
```

## Tech

- Vite + React 18 + TypeScript
- Tailwind CSS 3
- Node 24 server (`server/index.js`, official Firestore server SDK) that:
  - Serves the built static app from `dist/`
  - Proxies `/api/quotes` to Stooq (with Yahoo Finance fallback) for real
    equity + index prices
  - Proxies `/api/crypto` to CoinGecko for BTC/ETH
  - Handles the contact verification API — validates, checks Turnstile,
    enforces shared quotas, and requires email ownership before delivery
  - Caches responses in-memory (15–60s TTL)

## Contact protection and email verification

All contact surfaces, including both digital-card exchange forms, use the same
protected API. No message reaches a partner inbox until the visitor enters the
six-digit code sent to their email address. This proves current access to the
mailbox, not a person's identity, and does not prevent someone from using a
working disposable mailbox. There is no DNS/MX-only claim of ownership.

### Required production configuration

The form **fails closed** while configuration or dependencies are unavailable.
Do not deploy this change until the services below are configured and the
staging acceptance checks pass. The marketing site and vCard downloads still
work when the contact service is unavailable.

- `RESEND_API_KEY`: existing Resend sending credential, supplied through the
  deployment's secret manager
- `CONTACT_FROM_EMAIL`: sender on a domain verified in Resend, for example
  `Solaria <hello@solariavc.com>`. The `onboarding@resend.dev` test
  domain cannot send verification messages to arbitrary visitors
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: a Cloudflare Turnstile widget
  restricted to the actual site hostnames. The frontend receives only the
  public site key. Server validation requires action `contact` and an allowed
  hostname; the secret is never sent to browsers
- `CONTACT_STORE`: defaults to `firestore`, reusing Google Cloud rather than
  requiring another provider account. The default database is `(default)` and
  collection is `solaria_contact`. Optional overrides are
  `CONTACT_FIRESTORE_PROJECT_ID`, `CONTACT_FIRESTORE_DATABASE_ID`, and
  `CONTACT_FIRESTORE_COLLECTION`. The SDK can discover the Cloud Run project
  automatically. All instances must use the same database and collection
- Firestore must already be enabled with a **Native mode** database accessible
  to the Cloud Run service identity. Inspect the existing project before
  creating a database or changing permissions. Runtime authentication uses
  Application Default Credentials from that service identity; do not create a
  service-account JSON key or set `GOOGLE_APPLICATION_CREDENTIALS` in Cloud Run.
  Any necessary IAM grant, new database or billable setup needs operator approval
- The store receives only HMAC-pseudonymized rate identifiers, hashed document
  IDs, code hashes and AES-GCM-encrypted pending email payloads. There is
  **no automatic TTL policy by default**. The adapter performs ordinary bounded
  cleanup: up to 50 expired records once per hour across all instances, only
  after a successful human check. It rereads candidates transactionally before
  deletion, preserving any concurrently extended record. Keep the `expiresAt`
  ascending single-field index enabled for this query; index exemptions for
  `encrypted` and `codeHash` are appropriate. Every access checks logical expiry
  even if cleanup has not run. Idle periods can retain expired encrypted records
  until another valid request or an operator cleanup run. An optional TTL policy
  would have separate billed deletes and needs approval; it is not enabled here
- An explicit `CONTACT_STORE=redis` remains available for an existing Redis
  deployment, requiring `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN`. It is not required for the default Firestore route
- `CONTACT_VERIFICATION_SECRET`: a securely generated random secret with at
  least 32 bytes of entropy, supplied through the secret manager. Use the same
  value across instances. Rotation invalidates pending codes and resets hashed
  quota identities, so avoid rotating during ordinary rollouts
- `CONTACT_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins, default
  `https://solariavc.com,https://www.solariavc.com`. Add only hostnames you control,
  and also allow those hostnames in Turnstile
- `CONTACT_EMAIL_DAILY_LIMIT`: total contact-form outbound-email allowance per UTC
  day, default `80` (integer from 2 to 100000). Reserve capacity for both code
  and eventual team delivery together. Choose this below the actual account
  allowance after other applications and any inbound-email usage; this is not
  an account-wide billing guarantee
- `CONTACT_TRUST_PROXY_HOPS`: defaults to `0`, which ignores forwarded headers
  and uses the socket peer. Behind Cloud Run this may group visitors under a
  proxy IP and over-limit them. Before launch, inspect the deployment's actual
  trusted proxy chain and set the exact number of trusted rightmost hops to
  reach the client IP. Do not guess a Cloud Run value: load balancers and direct
  service URLs can have different chains. Every publicly reachable ingress
  must enforce the same chain, or leave this at zero and accept the stricter
  shared IP limit. Never trust the first user-supplied X-Forwarded-For value

No credentials are checked into this repository. Creating accounts, adding
credentials or modifying deployment/security settings is a separate operator
step. The application code does not provision services or alter permissions.

### Flow and safeguards

1. `GET /api/contact/config` reports availability and the public widget key
2. `POST /api/contact` accepts the original form fields plus `turnstileToken`.
   Successful bot verification sends a fixed-content code email, returning
   `{ ok: true, verificationRequired: true, verificationId }`. It does **not**
   send the visitor's message to the team
3. `POST /api/contact/verify` accepts only `verificationId` and the six-digit
   `code`. It sends the exact stored request to the original allowlisted
   recipient. Changes to message, address, kind or card ID at this stage are
   ignored

Codes expire after 10 minutes and allow five incorrect attempts. Correct codes
atomically claim a 30-second processing lease and retain at least five minutes
for delivery retries. A crashed instance's lease can be retried; the original
rendered email and Resend idempotency key stay identical. Successful replay
returns success without a second message. Stored message content is removed
on success; the small completion record logically expires and is eligible for
ordinary bounded cleanup. Provider acceptance confirms
submission for delivery, not arrival in the recipient's inbox.

Default shared quotas (fixed windows starting at first attempt):
- 30 API attempts per IP per 10 minutes; 1,000 attempts globally per minute
- 5 new code requests per IP per 10 minutes
- One code per mailbox per minute, 3 per hour, and 5 per day
- 30 code requests per hour and 100 per day across the site, additionally
  constrained by the stricter total outbound-mail allowance below
- **80 total logical outbound emails per UTC day by default**, counting both
  verification codes and team/card delivery. The pair is atomically reserved
  before sending a code, allowing at most 40 newly reserved contact requests
  in a day with no carried-over deliveries. Abandoned/failed requests retain
  their reservations until reset. Both instances and provider-idempotent
  retries reuse the same reservations; retries do not create unbudgeted mail

Every actual provider call rechecks its dated reservation. A request verified
across midnight also reserves its team delivery against the new day. Sends
briefly pause during the last 60 seconds before UTC midnight, with a
Retry-After response, and recheck this guard after awaiting the shared store to avoid
starting a 10-second provider request across the allowance boundary. This is a
conservative application-level outbound-mail control; provider processing,
account-level quotas, inbound email and usage by other applications remain
outside it. Check the real account before choosing a limit; do not assume a
particular provider plan or promise a total account bill.

Quotas live in the selected shared store, so scaling/restarts do not reset them. IPv6 addresses are
grouped by /64; mailbox quota keys ignore case and plus-tags, and normalize
Gmail dots/googlemail aliases. This deliberately favors conservative abuse
protection and can group distinct aliases. Raw addresses, codes, payloads and
provider response bodies are not logged. Request bodies are limited to 20 KB;
JSON, field types, lengths, email syntax, origin and card recipients are checked
on the server. A bounded in-memory admission limit sheds obvious floods before
shared storage. New requests must pass Turnstile before any shared-state
operation; verification IDs carry a server HMAC and a 20-minute admission expiry, so
fabricated or old IDs fail without a database read. The code itself still
expires after ten minutes, and accepted-delivery retries retain their shorter
fixed window. Durable limits remain authoritative across instances. Honeypot
responses contain unusable fake IDs and send no mail. Upstream failures never
bypass these checks.

Verification mail contains no attacker-supplied name, message, phone or links.
If the first send times out, the identical code mail is retried once using the
same provider key. If both responses fail, delivery may be uncertain: the UI
shows an error and the visitor can restart after the quota cooldown. An old
code for a failed or abandoned request is not usable with a new request.

### Development and tests

Use Node 24. Run `npm ci`, `npm test`, and `npm run build`.
Tests use mocked email/Turnstile providers, bounded memory storage, and a
transactional Firestore fake with conflict retries. They send no live mail and
need no secrets. Firestore integration tests are opt-in and refuse a non-local
emulator endpoint. A configured Firebase emulator can run them without a
Google login, credentials or a live project:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npm test
```

The optional Redis integration test can also exercise actual Lua scripts
against a disposable local Redis process:

```bash
REDIS_SERVER_BIN=/path/to/redis-server npm test
```

For interactive local development, copy `.env.example` to `.env`, set a real
Resend sender/credential if you intend to send mail, and set
`CONTACT_LOCAL_DEV=true`. Run `npm run server` alongside `npm run dev`.
This explicit mode uses bounded in-memory state and bypasses Turnstile only
for the listed localhost origins. It is disabled under `NODE_ENV=production`
or Cloud Run's `K_SERVICE`, and must never be exposed as a public service.
Restarting a local development server invalidates pending verification codes.

### Firestore deployment notes

The existing site is deployed as Cloud Run service `solariavc` in
`europe-west1`, project `gen-lang-client-0188652481`. No Firestore database,
service-identity permissions, production credentials or resource setup is
verified merely because the code builds. Confirm the selected database is
Native mode and located appropriately for this service before rollout.

The server SDK uses IAM, not browser Firebase Security Rules. Use the minimum
required database read/write permissions. Before deployment, explicitly check
that existing Firebase client Security Rules deny all browser/public access to
the selected contact collection. An existing broad or recursive allow rule can
still grant access even if another matching rule says false; remove overlapping
public access with operator approval or select an appropriately isolated
database. Do not assume a collection name creates an IAM security boundary.
All transactions read before writing, retry at most three times, and never send mail inside a
transaction. A five-second application deadline stops downstream work if
storage is slow; best-effort cleanup has a shorter one-second HTTP-path budget.
This is an HTTP-path deadline, not cancellation of the SDK operation. A transaction can retain locks, retry, commit and incur charges after it, so state
claims and idempotency remain authoritative for later retries.

Firestore's standard free quota for one eligible database includes 50,000
reads/day, 20,000 writes/day and 1 GiB storage, subject to the actual project's
other usage. Rejected requests still incur reads, and attacks can consume
billable operations. Inspect billing/alerts and expected traffic; application
mail limits are not a hard cap on all Firestore costs. Ordinary cleanup deletes
can use available standard delete quota; optional TTL deletes are billed separately and are not configured by this change. Never
enable a paid service, change IAM, or deploy missing configuration just to make the test suite pass.

For quiet periods or operator maintenance, the repository includes a bounded
cleanup command. With no arguments it only prints instructions and does not
connect to a database. To apply it, explicitly choose the project and use the
same database/collection settings as the service:

```bash
CONTACT_FIRESTORE_PROJECT_ID=gen-lang-client-0188652481 npm run contact:cleanup -- --apply
```

The command shares the one-hour throttle and 50-record maximum; it does not
create a scheduler, resources, credentials or a TTL policy. A quiet service is
not guaranteed to physically erase every expired record at ten minutes. Choose
and approve an operator maintenance cadence or a bounded scheduled cleanup job
before deployment if a maximum physical retention deadline is required.

Switching between Redis and Firestore starts a separate state store: pending
codes and limits are not migrated. Don't mix adapters across simultaneously
serving revisions. Plan a controlled cutover; issue fresh codes after the
change, and avoid a rolling split that could reset quotas or strand requests.

### Deployment acceptance checks

Before approving production deployment, use an authorized staging domain and
real test mailbox to verify: widget success/expiry/failure; code arrival; wrong
code and resend cooldown; final delivery to site/each card recipient; retry
without duplicate mail; verification through a second application instance;
Firestore and provider outage fail-closed behavior; mobile/desktop keyboard and
screen-reader states. The automated tests do not establish live DNS, mail
reputation, provider account setup, quota sizing or proxy-chain correctness.

Provider references: [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity),
[Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions),
[Firestore TTL](https://firebase.google.com/docs/firestore/ttl),
[Firestore pricing](https://firebase.google.com/docs/firestore/pricing),
[optional Redis REST API](https://upstash.com/docs/redis/features/restapi),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Resend sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## Digital business card (`/card`)

`public/card/index.html` is a standalone page — the URL programmed into the
NFC business cards (`https://solariavc.com/card`). It is `noindex` and not
linked from the site.

- **Save contact** links to `/card/johnson-jiang.vcf`, a real `text/vcard`
  response generated by `server/index.js`. iOS Safari opens its native
  "Create New Contact" sheet straight from the tap; Android and desktop
  download a named `.vcf`. The page appends `?saved=YYYY-MM-DD` (the
  recipient's local date) so the contact note says "Saved on" without
  assuming an in-person meeting. Legacy `?met=YYYY-MM-DD` links still work;
  `saved` takes priority when both parameters are present. Missing or invalid
  dates fall back to the current date in `America/Los_Angeles`.
  The saved contact contains no photo.
- **Send me yours** posts to `POST /api/contact` with `kind: "card"` (plus an
  optional `phone`). Card submissions are emailed to
  `JohnsonJiang@solariavc.com` directly (the site's contact form still goes
  to `contact@solariavc.com`). Requires the same protected contact configuration and email verification as the main form.
- **Share** uses the Web Share API where available, otherwise copies the link.
- `public/card/og.png` (1200×630) is the link preview shown when the card URL
  is texted or posted.

In development, run `npm run server` alongside `npm run dev`; Vite proxies
both `/api` and the `.vcf` route to it. Open the page directly at
`http://localhost:5173/card/index.html`.

### Karl Li's card (`/card/karl`)

`public/card/karl/index.html` uses the same design and interactions, with a
separate QR code, social preview, and `/card/karl-li.vcf` contact download.
Karl's title is Vice President / Co-Founder. No portrait is included.

His card includes `kal126@ucsd.edu`, `+1 (323) 868-1396`, and his LinkedIn
profile. Keep the contact details in his page and `server/card-profiles.js`
in sync when updating them.

Karl's exchange form sends `kind: "card", cardId: "karl-li"` and delivers to
`kal126@ucsd.edu`. The server uses
an allowlist to select the owner's inbox; it never accepts a destination email
from the browser. Requests without `cardId` continue to use Johnson's card.

## Structure

```
public/card/index.html   # digital business card (NFC landing page)
public/card/og.png       # its link-preview image
src/
  App.tsx                # composition
  main.tsx               # entry
  styles.css             # tailwind + design tokens
  components/
    Nav.tsx
    Hero.tsx
    Marquee.tsx
    About.tsx
    Thesis.tsx
    Portfolio.tsx
    Team.tsx
    Apply.tsx
    Footer.tsx
public/favicon.svg
Dockerfile
nginx.conf.template
```
