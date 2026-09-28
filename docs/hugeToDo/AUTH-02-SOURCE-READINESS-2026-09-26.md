# AUTH-02 Email-Change OTP Source Readiness — 2026-09-26

## Scope and status

This is a source-readiness checkpoint, not AUTH-02 completion or release
approval. It covers the anonymous-to-email flow's template, client expiry,
resend, invalid-code, rate-limit, offline, and same-user failure boundaries.
Hosted Auth, real delivery, and supported-iPhone acceptance remain open.

## Defects found and repaired

1. The repository configured six-digit, one-hour OTPs but did not bind an
   email-change template. A hosted/default template could therefore send a
   clickable confirmation link instead of the code required by the app.
2. The client started its one-hour validity window only after the request
   returned. A slow response could make the local window less conservative
   than the provider's actual send time.
3. Auth errors were classified only from mutable message text even though
   Supabase documents `AuthApiError.code` as the stable discriminator.
4. The common native/web wording `Failed to fetch` did not match the existing
   offline recovery expression.
5. Route-owned auth failure copy was visible but lacked an alert accessibility
   role.
6. Secure email change was implicit. The source now explicitly keeps double
   confirmation enabled for ordinary changes. Supabase's documented anonymous
   conversion has no old email identity, and the client prevents permanent
   active sessions from entering this account-upgrade path.

## Current source contract

- `supabase/config.toml` pins six digits, a 3,600-second expiry,
  `double_confirm_changes = true`, and the source-controlled email-change
  template.
- `supabase/templates/email_change.html` contains `{{ .Token }}` and no link,
  image, tracking element, or `ConfirmationURL`.
- The resend path uses `auth.resend({ type: 'email_change', email })` only for
  the exact pending anonymous owner. It never falls back to a sign-in that
  could replace the UUID.
- A failed resend retains both the provider-side pending request and the
  route's existing challenge. A successful resend clears the entered code and
  begins a fresh cooldown from request dispatch.
- Verification uses `type: 'email_change'` and rejects changed owners,
  changed addresses, missing challenges, and any response that is not the same
  now-permanent user.
- Provider `otp_expired`, rate-limit, duplicate identity/email, validation,
  and network failures map to stable, non-provider-revealing recovery copy.
- Email failures use the normal semantic-auth failure path; unlike the Apple
  provisional-session path, they do not request rejected-session cleanup.

## Verification performed

- Focused AUTH-02/auth/route tests: 61 passed.
- Mobile TypeScript check: passed.
- Mobile lint: passed.
- Repository local Supabase source contract: 20 tests passed and final
  contract check passed.
- Human-simulated checkpoint: headless Chrome Expo web passed at the supported
  375 x 667 viewport. It completed onboarding, showed the 60-second resend
  countdown, rejected deterministic code `111111` with recovery copy, accepted
  fixture code `424242`, and reached the current paywall. Evidence is in the
  ignored local folder
  `test-results/human-e2e/2026-09-26/auth02-email-change-source-current/`.

The deterministic development fixture and browser packet exercise
invalid-code recovery and cooldown presentation only. They do not prove email
delivery, hosted configuration, or native session persistence.

## External gates still required

AUTH-02 must remain incomplete until all of the following are captured against
the exact release candidate:

1. Authenticated staging configuration readback proves anonymous sign-in and
   manual linking enabled, secure/double email change enabled, six-digit OTP,
   3,600-second expiry, the exact template subject/body installed, reviewed
   redirect allowlists, and reviewed rate limits.
2. A reviewed custom SMTP provider is configured. The provider's domain,
   sender authentication, suppression/bounce behavior, retention, DPA,
   subprocessors, region, and production capacity must be accepted. Email
   tracking must be disabled.
3. Real delivery to representative providers proves the message contains the
   code, contains no consumable confirmation link, renders accessibly, avoids
   clipping, and does not expose internal URLs or secrets.
4. A supported physical iPhone/TestFlight run records a redacted Supabase UUID
   before and after request, invalid code, expiry, successful resend, rate
   limit, offline request/resend/verify, background/relaunch, and final valid
   verification. The UUID must stay identical and local Shelf/routine/progress
   evidence must remain intact after every failure.
5. A changed-owner and identity-already-owned adversarial run proves no pending
   challenge can be consumed and no fallback account switch occurs.
6. Hosted Auth logs and client logs prove raw email, OTP, bearer, and provider
   error details are absent from analytics/crash reporting.
7. The exact staging evidence is independently reviewed and then repeated for
   production configuration before release.

## Primary references checked

- Supabase email templates:
  <https://supabase.com/docs/guides/auth/auth-email-templates>
- Supabase local template configuration:
  <https://supabase.com/docs/guides/local-development/customizing-email-templates>
- Supabase anonymous-user conversion:
  <https://supabase.com/docs/guides/auth/auth-anonymous>
- Supabase Auth error codes:
  <https://supabase.com/docs/guides/auth/debugging/error-codes>
- Supabase Auth rate limits:
  <https://supabase.com/docs/guides/auth/rate-limits>
