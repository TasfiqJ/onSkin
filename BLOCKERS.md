# Blockers — the founder's do-not-guess list

Everything here needs **you** (the founder): an account, an API key, money, a
signature, legal sign-off, or a product/content decision the `/docs` don't
specify. The code is built _around_ each one and reads from `.env` placeholders
(see `.env.example`) or uses clearly-labelled placeholder content. Each spot is
marked in code with `// BLOCKED: <id>`.

**Status key:** 🔴 open (needs you, nothing safe to stub) · 🟡 stubbed (code
built + wired to a placeholder; drop in the real value and it works) · ✅ cleared.

---

## A. Accounts / API keys / money / signatures

### B-SUPABASE — Supabase project 🟡 stubbed
Create the Supabase project; provide `EXPO_PUBLIC_SUPABASE_URL` and the **new
publishable key** (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) + the **secret key**
(`SUPABASE_SECRET_KEY`, Edge Functions only). Then apply the migrations in
`supabase/migrations/` and run the Security & Performance Advisors. Legacy
anon/service_role keys are being deprecated end-of-2026 — use the new keys.

### B-REVENUECAT — RevenueCat 🟡 stubbed
Provide `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`, configure the
`pro` / `pro_plus` entitlements + the `$39.99/yr` annual product, set the
webhook → `revenuecat-webhook` Edge Function with `REVENUECAT_WEBHOOK_AUTH`.
RC webhook payload shape + subscriber-deletion API to be confirmed against live
docs (see B-VERIFY-RC).

### B-APPLE — Apple Developer account 🟡 stubbed
Register App ID `com.onskin.app`; enable Sign in with Apple; create the SIWA
service id + key (`APPLE_*` secrets) for **server-side token revocation on
account deletion** (Apple 5.1.1(v), TN3194); create the App Store Connect app.
South-Korea server-to-server SIWA notification endpoint (due 2026-01-01) to
confirm. Needs paid membership ($) + your signature on agreements.

### B-GOOGLE — Google Sign-In + Play Console 🟡 stubbed
OAuth client IDs (iOS / Web) → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` /
`_WEB_CLIENT_ID`; Android SHA-1 fingerprints registered; Play Console app
($25 one-time). Watch the Android `DEVELOPER_ERROR` (SHA-1/client-id mismatch).

### B-POSTHOG — PostHog 🟡 stubbed
`EXPO_PUBLIC_POSTHOG_KEY` + `_HOST`, plus `POSTHOG_PERSONAL_API_KEY` for
server-side person-deletion on account delete. Wire RevenueCat → PostHog
integration for subscription cohorts.

### B-SENTRY — Sentry 🟡 stubbed
`EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`
for source-map upload in CI.

### B-TURNSTILE — Cloudflare Turnstile 🟡 stubbed
`EXPO_PUBLIC_TURNSTILE_SITE_KEY` + the secret configured in Supabase Auth.
Strongly recommended for anonymous sign-in + signup (docs/01 §5).

### B-SHOPMY — ShopMy affiliate OAuth 🔴 open
Creator-stacks slice (future doc). OAuth client id/secret needed. Not yet built.

---

## B. Legal exposure — engine built, content is yours + counsel's

### B-QUIZ-COPY — Skin-type quiz questions & scoring 🔴 open
The 4-axis quiz **engine** (Oily/Dry, Sensitive/Resistant, Pigmented/Non,
Wrinkled/Tight + phototype + Monk tone + sensitivities + pregnancy + goals),
scoring, and reveal are built with **clearly-labelled placeholder questions**
(`PLACEHOLDER_QUIZ`). The validated Baumann BSTI questionnaire is **patented +
copyrighted** (docs/01 §2) — final original questions + scoring need a
**patent/trademark attorney review (mandatory, not optional)** before ship. Do
not reuse BSTI items or lean on "16 types" branding.

### B-PRIVACY-COPY — Legal copy (policies + consent strings) 🔴 open
The consent **ledger** + unbundled consent **screens** are built with
placeholder body text + a `version`/`consent_text_hash` mechanism. You + counsel
must supply final: standalone **Consumer Health Data Privacy Policy** (MHMDA),
Privacy Policy, Terms of Service, and the exact consent statements for
`health_data_collection`, `photo_capture`, `photo_cloud_backup`, `marketing`,
`data_sharing`. A GDPR Art. 35 **DPIA** is advised given large-scale health-data
processing.

### B-CONFLICT-RULES — Ingredient conflict matrix 🔴 open
The conflict engine + schema (`conflict_rules`: severity, evidence_grade,
resolution, citation) are built, but the **30–60 curated ingredient pairs** are
contested dermatology content (docs/00 §3, caveat: evidence is genuinely
contested). Needs derm/literature curation + each rule carrying an evidence
grade and a non-alarmist resolution. Belongs to the (missing) Document 2.

---

## C. "Re-verify at build time" items

### B-VERIFY-APPLE-TRIAL-TOGGLE ✅ cleared by design
docs/01 §2 flags Apple 3.1.2 rejecting the free-trial toggle. Resolved by
_not_ building a trial toggle on iOS at all — single annual offer with a visible
"Not now," matching the design spec paywall. No founder action required.

### B-VERIFY-SUPABASE-KEYS ✅ accounted for
Using the new publishable/secret key env names from the start (legacy keys
deprecated end-2026). No action beyond providing the new keys (B-SUPABASE).

### B-VERIFY-METRO — Metro monorepo resolution 🟡 stubbed
Monorepo `metro.config.js` follows Expo's documented pattern but can't be
runtime-verified here (no Mac/simulator). Confirm `expo start` resolves
workspace packages on the first real device build.

### B-VERIFY-RC — RevenueCat webhook payload + subscriber-deletion API 🟡 stubbed
`revenuecat-webhook` Edge Function reads `event.app_user_id` (not
`body.app_user_id`), is idempotent on `event.id`, and returns 200 fast — but the
exact payload + the subscriber-deletion endpoint must be confirmed against live
RC docs/account.

### B-VERIFY-PASSKEYS 🔴 deferred
Supabase passkey GA + RN library maturity unverified. Per docs/01 §1, passkeys
are an optional post-launch Settings upgrade, NOT a primary method — not built
in this phase. Re-verify before adding.

### B-VERIFY-RIVE-LOTTIE 🟡 stubbed
docs/01 §8 recommends Rive for the "analyzing your skin" hero moment over
Lottie, but says re-evaluate after Lottie's late-2025 state-machine update. The
personalization-theater screen is built with a lightweight Reanimated
placeholder animation; swap in the chosen Rive/Lottie asset later.

---

## D. Missing source-of-truth documents

### B-MISSING-DOCS — Documents 2–15 not present in /docs 🔴 open
Only `docs/00-architecture.md` + `docs/01-auth-onboarding.md` (+ design-spec.pdf)
exist. Per CLAUDE.md's hard rule ("if it isn't specified, STOP and ask — do not
invent product behavior, schema, or copy"), everything the build order lists
beyond auth/onboarding needs its detailed doc before full implementation:

| Build-order item | Needs document | Status |
| --- | --- | --- |
| 2 · Ingredient/product DB + conflict engine | Doc 2 | schema sketched from docs/00 §2 only; data + detailed spec blocked |
| 3 · AM/PM routine builder | Doc 3 | tables exist (docs/01 §3); builder UX blocked |
| 4 · Smart shelf (PAO/expiry) | Doc 4 | table + design-spec screen only; rules blocked |
| 5 · Actives / skin-cycling scheduler | Doc 5 | `cycling_night` column only; scheduling logic blocked |
| 6 · Guided photo capture + comparison | Doc 6 | `photos` table + design-spec screen; capture spec blocked |
| 7 · Reminders / streaks / widgets | Doc 7 | `notification_preferences` + streak fn; widget spec blocked |
| 8 · Subscriptions / paywall | Doc 8 | design-spec paywall + `entitlements`; RC config blocked |
| 9 · Personalized recommendations | Doc 9 | blocked |
| 10 · Creator stacks + ShopMy | Doc 10 | blocked (also B-SHOPMY) |
| 11 · Community layer | Doc 11 | blocked |
| 12 · AI trend analysis | Doc 12 | blocked (intentionally last) |

I build the slices Documents 00/01 + the design spec fully authorize, scaffold
the UI/schema the design spec clearly shows, and stop short of inventing
unspecified behavior/copy/schema for the rest.

---

## New blockers discovered during build

### B-VERIFY-AUTH-LINKING — anon → social account linking 🟡 stubbed
docs/01 §1 flags that `linkIdentity()` for OAuth in RN is broken ("Identity is
already linked to another user") and that the reliable pattern is email-based
automatic linking. `signInWithApple`/`signInWithGoogle` use `signInWithIdToken`;
whether that LINKS to the existing anonymous user (preserving quiz/routine data)
or creates a NEW user must be verified on a real device with real Apple/Google
accounts (needs B-APPLE + B-GOOGLE). If it orphans data, switch to the
`updateUser({ email })` → re-auth email-match pattern.

### B-GOOGLE (addendum) — iOS URL scheme for the config plugin 🟡 stubbed
The `@react-native-google-signin/google-signin` Expo config plugin needs the
reversed iOS client id (`iosUrlScheme`) in `app.json` to build on iOS. Add it
once the iOS OAuth client exists.

### B-EVERY-N-DAYS — `every_n_days` step frequency has no interval column 🔴 open
docs/01 §3 lists `every_n_days` as a valid `routine_steps.frequency` value but
specifies **no column** to store the interval (e.g. "every 3 days"). Per
CLAUDE.md (don't invent schema), the column was intentionally omitted from
`routine_steps`. The routine-builder / skin-cycling docs (Documents 3 & 5,
missing) should specify how the interval is represented; add the column then.
Discovered during the Slice 1 RLS review.
