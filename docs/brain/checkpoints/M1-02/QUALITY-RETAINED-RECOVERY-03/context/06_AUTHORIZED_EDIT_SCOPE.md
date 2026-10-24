# Edit authority, explicit allowlist

Authorized product changes ONLY when narrowly substantiated by failing reproducible tests:
- `apps/mobile/src/features/shelf/**`, `today/**`, `routine/**`, `scheduler/**`, `streak/**`, `photos/**`, `notifications/**`, `onboarding/**`.
- Related `apps/mobile/src/app/shelf/**`, `app/onboarding/**`, `app/photos/**`, `app/routine/**`, and specific existing `apps/mobile/src/app/(tabs)/shelf.tsx`, `today.tsx`, `progress.tsx`, `you.tsx` when their behavior requires changes.
- Related `apps/mobile/src/components/**` only for documented UI call sites and tests.
- `docs/USER_FLOW_TREE.md` only to add a missing E2E branch documenting real work.
- Exact two generated worklist outputs in 04_EXACT_QUALITY_SCOPE.md.
- New additive task evidence under `docs/brain/checkpoints/M1-02/QUALITY-RETAINED-RECOVERY-03/**`.
- Tracked `ONSKIN_BRAIN_HANDOFF.txt` factual index update.

Completely READ-ONLY: `.github/**`, `scripts/phase4/**` generator and tests, `scripts/phase9/**`, `scripts/security_readiness/**`, original security/DB policies, generated scanner source inventories, rules, pins, dates, expiry, exceptions, `docs/brain/state/**`, original checkpoints/reviews, `supabase/**`, Edge/SQL/migrations, shared `apps/mobile/src/lib/auth/**`, `/lib/consent/**`, `/lib/storage/**` and cryptography/owner primitive implementations, package manifests/lockfiles/new libraries, native app/config/iOS/Android, clinical/JANUS/recommendation/claims, pricing/payments/provider, device/signing/hosting/release.

No signed/owner-approval artifacts may be invented. If a fix requires a protected path, document the precise blocker, continue independent allowed work. Do not attempt protected bypass under another name.
