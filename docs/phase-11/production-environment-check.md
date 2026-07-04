# Phase 11 Production Environment Check

Status: BLOCKED until production environment smoke evidence is attached.

## Required Checks

| Area | Evidence | Status |
| --- | --- | --- |
| App variant | production build uses `APP_VARIANT=production` | BLOCKED |
| EAS channel | production build channel is `production` | BLOCKED |
| Supabase | production URL and publishable key set | BLOCKED |
| Auth | Apple and Google sign-in configured for production IDs | BLOCKED |
| App links | Universal Links and Android App Links verified | BLOCKED |
| Policy URLs | privacy, terms, support, deletion, export, consumer health privacy live | BLOCKED |
| PostHog | production key/host configured and sensitive payload audit passed | BLOCKED |
| Sentry | DSN, release, dist, source maps, release health configured | BLOCKED |
| RevenueCat | production app keys, products, offerings, webhooks, entitlements configured | BLOCKED |
| Feature flags | public Phase 7/8 surfaces intentionally enabled/disabled | BLOCKED |
| Secrets | no secret-looking key in `EXPO_PUBLIC_*` | BLOCKED |

## Smoke Sequence

1. Install production candidate fresh.
2. Launch app and confirm environment label is production where inspectable.
3. Complete onboarding.
4. Add product through each supported intake path.
5. Reach first value.
6. Complete routine check-off.
7. Exercise support, policy, deletion, and export paths.
8. Exercise purchase and restore on native build.
9. Confirm PostHog event is sanitized.
10. Confirm Sentry release receives no P0/P1 crash.
11. Confirm EAS Update production branch/channel is correct.

## Launch Blockers

- placeholder public URL
- test RevenueCat key in production
- missing support email
- missing policy URL
- missing app-link association
- missing production monitoring
- unverified deletion/export
- unresolved P0/P1 smoke issue

