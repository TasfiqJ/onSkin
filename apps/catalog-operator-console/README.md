# Catalog operator console

This is a separate internal web surface for CAT-08 catalog source and correction
operations. It is not imported by, routed from, or shipped inside the consumer
mobile application.

## Boundary

- The browser receives a Supabase publishable key only. A service-role or secret
  key is rejected by source configuration and must never be supplied at deploy
  time.
- Sign-in is passwordless and account creation is disabled. A verified TOTP
  factor and an active database-side operator grant/session are required before
  queue data is returned.
- The browser calls only the `catalog-operator` Edge Function. It never reads or
  writes catalog tables directly.
- Direct browser/API-role execution of the six operator RPCs is revoked. Edge
  signature-verifies the exact presented AAL2 bearer, rechecks account access,
  and sends its signed Auth-session UUID plus a server-only deployment tuple to
  six hardcoded functions in the non-Data-API `catalog_operator_gateway`
  schema. Postgres derives the operator identity, normalized confirmed email,
  and verified TOTP factor.
- Edge connects through the transaction pooler as the constrained
  nonsuperuser, membership/ownership-free `catalog_operator_edge` role with
  CA/hostname-verified hosted TLS. It does not hold or use a Supabase
  service-role key. `CATALOG_OPERATOR_DATABASE_URL` is a server-only secret and must never
  enter Vite, browser storage, source, logs, or client responses.
- The workspace topbar is parsed from the database session receipt and shows
  the confirmed email, user UUID, exact capabilities, expiry, environment,
  source revision, Edge deployment ID, admission state, and control generation.
  Vite's environment label is not runtime authority.
- Sessions are held in memory, expire after 15 minutes of inactivity or one hour
  absolutely, and are cleared on local sign-out.
- The console has no analytics, advertising, error-reporting SDK, remote font,
  image, or other third-party runtime recipient.

Supabase's `aal2` claim means a second factor was verified for that Supabase
session. It is not, by itself, a claim of NIST AAL2 conformance or
phishing-resistant authentication.

## Local use

Copy `.env.example` to an ignored `.env.local` and use local-project values:

```powershell
npm.cmd --workspace @onskin/catalog-operator-console run dev
```

The local database must include migration `0063`, an explicitly provisioned
non-anonymous operator account, a verified MFA factor, and a current operator
grant. No fixture mode can bypass those checks.

For local synthetic browser verification, use the local-only fixture script
with the console's normal Supabase Auth/Edge calls. Build first and use
`preview`; Vite development injects CSS through inline style elements, which
the checked-in `style-src 'self'` policy correctly blocks.

```powershell
$env:VITE_OPERATOR_CONSOLE_ENV='local'
$env:VITE_SUPABASE_URL='http://127.0.0.1:54329'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_0123456789abcdefghijklmnopqrstuvwxyz'
npm.cmd --workspace @onskin/catalog-operator-console run build

# Separate local-only terminal:
$env:CATALOG_OPERATOR_FIXTURE_ORIGIN='http://127.0.0.1:4318'
node scripts/e2e/catalog-operator-console-fixture-server.mjs

npm.cmd --workspace @onskin/catalog-operator-console run preview -- --port 4318
```

The fixture models email OTP -> `aal1` -> verified TOTP challenge -> `aal2`;
it uses no external service and is never deployment evidence. Do not weaken the
CSP to make the development server look styled.

## Deployment gates

Do not expose this app publicly or call it production-ready until all of the
following are independently verified:

1. Dedicated access-controlled hosting, HTTPS, the checked-in security headers,
   and an allowlisted production console origin.
2. Hosted migration/pgTAP and adversarial multi-session evidence on the exact
   deployed revision.
3. Named operator provisioning, revocation, recovery, least-privilege, MFA,
   claim lease, separation-of-duty, and audit-retention drills.
   Prove the dedicated pooler login is nonsuperuser, membership/ownership-free,
   cannot `SET ROLE`, has only gateway usage/execute, no
   table/sequence/Auth/control privileges, verified-full TLS, and no service-role
   secret.
4. Human-simulated happy, empty, stale-version, expired-lease, withdrawn-report,
   revoked-session, and four-operator release flows with synthetic data only.
5. Privacy/security and catalog governance review of the exact source and
   deployment configuration.
6. Exercise frozen, exact-open, revision/deployment/generation mismatch,
   credential rotation, rollback, and immutable control-history drills. The
   reviewed server configuration requires `CATALOG_OPERATOR_DATABASE_URL`,
   `CATALOG_OPERATOR_SOURCE_REVISION`, `CATALOG_OPERATOR_CONTROL_GENERATION`,
   Supabase-managed `DENO_DEPLOYMENT_ID`, and the exact allowed console origin.

The source candidate does not satisfy these external gates on its own.
