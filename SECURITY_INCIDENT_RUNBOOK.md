# Security Incident Runbook

## 1. Triage

- Classify suspected issue: data leak, cross-user access, payment/entitlement abuse, secret leak, unsafe guidance, deletion/export failure, vendor payload leak.
- Assign severity using `SECURITY_AUDIT_REPORT.md`: P0 stop launch, P1 must fix before beta, P2 fix before public launch, P3 backlog.
- Preserve evidence without copying secrets or health data into chat/tickets.

## 2. Immediate containment

- Halt the affected store rollout or disable the matching reviewed feature flag.
- For RevenueCat webhook abuse: remove webhook endpoint or rotate `REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_WEBHOOK_SIGNING_SECRET`.
- For cloud photo/Ask/vendor leak: disable cloud feature flags and block related Edge Function routes.
- For RLS/storage exposure: revoke public access, patch migration/policy, and pause production traffic.
- For an app release issue: halt expansion and submit a reviewed emergency store binary. EAS Update is not enabled for V1.

## 3. Secret rotation

Rotate affected categories, never paste values into reports:

- Supabase secret/service-role keys and publishable/anon key if needed.
- RevenueCat webhook and REST/API secrets.
- AI/vendor/ShopMy secrets.
- Sentry auth token and DSN if abused.
- PostHog personal/project keys.
- Apple/Google OAuth and SIWA private keys.
- EAS/GitHub/CI tokens.

## 4. Investigation

- Identify affected users using minimized IDs and server-side audit logs.
- Check Supabase logs, storage object access, Edge Function logs, RevenueCat event IDs, Sentry/PostHog payloads.
- Verify whether local data, cloud rows, storage objects, exports, or third-party vendors were affected.
- Keep a timeline: detection, containment, patch, verification, notification decision.

## 5. Patch and verification

- Reproduce with a failing test or scripted check.
- Patch smallest safe surface.
- Run relevant unit/static/live tests.
- Add regression coverage.
- Update `SECURITY_AUDIT_REPORT.md` and this runbook if process failed.

## 6. Communication

- Notify founder, engineering owner, counsel, clinical reviewer if claims/safety involved, and affected vendors.
- If user notification is required, state what happened, what data was affected, what was not affected, what was fixed, and what users should do.
- Do not overclaim certainty before logs/evidence support it.

## 7. Postmortem

- Record root cause, impact, detection gap, containment time, user impact, patch, tests added, and prevention work.
- Add a launch gate so the issue cannot recur silently.
