# Blockers — the founder's do-not-guess list

Everything here needs **you** (the founder): an account, an API key, money, a
signature, legal sign-off, or a product/content decision the `/docs` don't
specify. The code is built _around_ each one and reads from `.env` placeholders
(see `.env.example`) or uses clearly-labelled placeholder content. Each spot is
marked in code with `// BLOCKED: <id>`.

**Status key:** 🔴 open (needs you, nothing safe to stub) · 🟡 stubbed (code
built + wired to a placeholder; drop in the real value and it works) · 🟢
de-risked · ✅ cleared.

---

## How to clear these in one pass (the founder's TODO)

Captured from the Slices 0–6 handoff report so this file stands alone.

**1. To make the app actually run end-to-end**
- **B-SUPABASE** first: create the project, provide the URL + publishable +
  secret keys, then `supabase db push` (applies every migration) and
  `supabase gen types typescript … > packages/types/src/database.types.ts`.
  On a Mac, `expo start` / EAS build for iOS.
- Then add each account key as a single `.env` value when ready: **B-APPLE**,
  **B-GOOGLE**, **B-REVENUECAT**, **B-POSTHOG**, **B-SENTRY**, **B-TURNSTILE**.

**2. To unblock legal content** (you + counsel): **B-QUIZ-COPY**,
**B-PRIVACY-COPY**, **B-CONFLICT-RULES**.

**3. To unblock the rest of the build order**: provide the missing feature
documents — see **B-MISSING-DOCS**. Highest leverage: **Document 2**
(ingredient/conflict engine) and **Document 3** (routine builder), which feed the
Today loop, shelf, and conflict screens.

**Snapshot of current statuses** — Accounts: B-SUPABASE/REVENUECAT/APPLE/GOOGLE/
POSTHOG/SENTRY/TURNSTILE 🟡, B-SHOPMY 🔴 · Legal: B-QUIZ-COPY/PRIVACY-COPY/
CONFLICT-RULES 🔴 · Verify: APPLE-TRIAL-TOGGLE ✅, SUPABASE-KEYS ✅, METRO 🟢,
RC 🟡, PASSKEYS 🔴, RIVE-LOTTIE 🟡, AUTH-LINKING 🟡 · Docs: MISSING-DOCS 🔴,
EVERY-N-DAYS 🔴.

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
server-side person-deletion on account delete. The docs/01 §7 funnel is already
instrumented through a `track()`/`identify()` shim (`src/lib/analytics/track.ts`);
the real `posthog-react-native` SDK (with bootstrapped flags + identify at the
value moment) + the RevenueCat→PostHog integration are wired in the analytics
slice (build-order, not yet reached). Env vars documented.

### B-SENTRY — Sentry 🟡 stubbed
`EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`
documented in `.env.example`. The `@sentry/react-native` SDK init + source-map
upload are part of the observability slice (not yet reached); no Sentry code is
wired yet beyond the documented env vars.

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

### B-DERM-REVIEW — Clinical sign-off of the conflict matrix 🔴 open (LAUNCH GATE)
docs/02 §9 makes this **mandatory, not optional** — it gates launch of the whole
intelligence layer. The ~14 starter rules (migration `…0013_seed_intelligence.sql`
+ `apps/mobile/src/features/intelligence/rules.ts`) are authored from docs/02
§4.4/§4.8 but every row has `reviewed_by = NULL`. Before ANY rule (especially the
`safety`/pregnancy rows) is shown to real users, a **board-certified
dermatologist + a cosmetic chemist/pharmacist** must review every rule's
type/severity/grade/mechanism/resolution/citation and the PAO category defaults,
and populate `reviewed_by`. **Production exposure note (RLS review):** the seed
ships `is_active = true` for dev/demo; before any client-facing deploy, either
flip unreviewed rows to `is_active = false` or withhold the seed until
`reviewed_by` is set. Expand toward the doc's ~40 pairs only via versioned,
reviewed events. *(Supersedes the old B-CONFLICT-RULES — the matrix now exists;
what's blocked is the clinical sign-off + expansion.)*

### B-CATALOG-SEED — CosIng + Open Beauty Facts data import 🔴 open
The catalog schema + ingestion design exist, but the actual data isn't imported
(needs network + the live DB, neither available at build time). docs/02 §2:
verify CosIng's current bulk-download route (it's been inconsistent since the
Commission relaunch); seed Open Beauty Facts from the **daily dumps** via DuckDB
(NOT the API — API is one call per real scan); honor ODbL (attribution in
Settings/About + share-alike + **contribute-back** newly-added products); hand-
curate the top ~2,000 products with concentration bands; populate
`ingredient_tags`. Until then the engine uses the client-side starter tag
dictionary for the common active families.

### B-SERVER-DETECT — server-authoritative detect_conflicts() 🟡 deferred
docs/02 §10 specifies a `SECURITY DEFINER` `detect_conflicts(uid)` PL/pgSQL twin
of the client detector. Deferred (DECISIONS D-020): the tested TS engine + the
owner-RLS `routine_conflicts` cache cover v1 without a security gap; add the SQL
twin once there's a live DB to test it against, to avoid an untested
divergent implementation on a liability surface.

---

## C. "Re-verify at build time" items

### B-VERIFY-APPLE-TRIAL-TOGGLE ✅ cleared by design
docs/01 §2 flags Apple 3.1.2 rejecting the free-trial toggle. Resolved by
_not_ building a trial toggle on iOS at all — single annual offer with a visible
"Not now," matching the design spec paywall. No founder action required.

### B-VERIFY-SUPABASE-KEYS ✅ accounted for
Using the new publishable/secret key env names from the start (legacy keys
deprecated end-2026). No action beyond providing the new keys (B-SUPABASE).

### B-VERIFY-METRO — Metro monorepo resolution 🟢 largely de-risked
Monorepo `metro.config.js` follows Expo's documented pattern. **`npx expo export
--platform ios` succeeds** — Metro resolved the `@onskin/types` workspace import
and bundled the full app (Babel + NativeWind transform + fonts all OK). Only the
interactive `expo start` dev server on a real device remains unverified; the
production bundle graph is proven.

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
