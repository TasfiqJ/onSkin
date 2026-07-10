# Document 1: Authentication, Onboarding, Core Data Model & Row-Level Security — Build Spec

## TL;DR

- **Build a guest-first, anonymous-session app that defers hard signup until after the personalized skin quiz "aha" moment, gates Pro behind an onboarding paywall, and treats privacy as the conversion asset.** This is the right architecture: roughly half of subscription conversions happen on Day 0 (RevenueCat State of Subscription Apps), the median subscription app converts only low-single-digit percentages of installs to paid while top performers convert several times higher, and quiz-driven onboarding is what closes that gap.
- **The data model is a per-user RLS-enforced Postgres schema** anchored on the `auth.users → public.profiles` trigger pattern, an append-only `routine_completions` log, an immutable `consents` ledger (required _separately_ for collection vs. sharing under Washington MHMDA and GDPR Art. 9), a RevenueCat-webhook-fed `entitlements` mirror, and a `photos` table with a `local_only` flag so privacy-first photos never touch Storage.
- **Ship with Supabase anonymous sign-in + Sign in with Apple + Google, expo-secure-store (LargeSecureStore AES pattern), and a simple queue-and-retry offline layer for v1** (upgrade path: Legend-State v3 or PowerSync). Passkeys are now first-class in Supabase but premature as the _primary_ method; biometric app-lock (Face ID) is a high-value privacy feature worth shipping. The foundation genuinely supports a 7-figure business.

---

## Key Findings

1. **Sign in with Apple is mandatory the moment you offer Google sign-in on iOS (Guideline 4.8).** You can ship email-only without it, but the spec offers social login, so SIWA is required. Account deletion in-app (5.1.1(v)) is also mandatory and must revoke Apple tokens via the REST API.
2. **Anonymous sign-in is production-ready and the correct conversion lever, but account upgrades must be identity-preserving:** with the installed Supabase JS client, native Apple/Google ID tokens link to the active anonymous session through `linkIdentity()`, while email attaches through `updateUser()` and an `email_change` OTP. Never fall back from a failed link to normal sign-in because a new user ID would orphan or clear the local-first plan.
3. **Onboarding should be long, not short, for this category.** Flo runs ~40–70 screens; Noom 100+. Long quizzes build sunk-cost commitment and filter for intent. A dermatologically-credible quiz uses the 4-axis Baumann structure — but **the validated Baumann Skin Type Indicator (BSTI) questionnaire is patented and copyrighted**, so you must author original questions.
4. **RLS performance hinges on wrapping `auth.uid()` in a subquery** `(select auth.uid())` for initPlan caching, indexing every policy column, using `TO authenticated`, security-definer functions for cross-table checks, and never forgetting `WITH CHECK`. CVE-2025-48757 (disclosed May 29, 2025, CVSS 9.3) found **303 endpoints across 170 Lovable projects — 10.3% of the 1,645 analyzed — had Supabase tables readable by unauthenticated requests using the public anon key**, exposing names, emails, addresses and financial records.
5. **Consent must be unbundled:** MHMDA requires opt-in consent for _collection_ that is "separate and distinct" from consent for _sharing_; GDPR Art. 9 requires _explicit_ consent for health data (the skin quiz is health inference; photos are special-category). These cannot be bundled into a ToS checkbox.
6. **Offline-first: start simple.** A TanStack Query + persistence + optimistic-update queue is right for v1. Legend-State v3 has a first-party Supabase sync plugin; PowerSync is the heavyweight option with true offline support and last-write-wins conflict resolution by default.
7. **NEW 2026 COMPLIANCE FLAG: the free-trial toggle paywall pattern is now being rejected by Apple on iOS** (Guideline 3.1.2, enforcement reported as of early 2026). The historically high-converting trial-toggle is now an Android/web-only pattern — see paywall section.

---

## Details

### 1. Auth Method Strategy (2026 evidence)

**Sign in with Apple — required.** Apple's Guideline 4.8 requires an equivalent privacy-focused login whenever you offer any third-party login (Google, Facebook, etc.). The equivalent option must (a) limit data collection to name and email, (b) let users keep their email private, and (c) not collect interactions for advertising without consent. Since the spec offers Google sign-in, **SIWA is mandatory on iOS.** A South Korea-specific requirement (server-to-server notification endpoint by Jan 1, 2026) applies to SIWA apps. Email-only apps are exempt, but that's not this product.

**Recommended auth menu (in priority order):**

1. **Sign in with Apple** (iOS, required; also offer on Android for parity)
2. **Continue with Google** (native `react-native-google-signin` → Supabase `signInWithIdToken`; on Android this hits Google Credential Manager / One Tap). Note the notorious Android `DEVELOPER_ERROR` from SHA-1/client-ID misconfiguration.
3. **Email magic link OR 6-digit OTP** as the privacy-neutral fallback. **Recommendation: OTP codes over magic links** for mobile — magic links require deep-link handling and break when opened in a different browser/device; OTP stays in-app and is more reliable. Supabase supports both via `signInWithOtp` (configurable as magiclink vs. OTP).
4. **Passwords: do not offer as primary.** Passwordless reduces friction and eliminates leaked-password liability.

**Passkeys (WebAuthn): supported but premature as primary.** Supabase now ships first-class passkey support (`signInWithPasskey()`, `auth.passkey` namespace, RP ID config). However: (a) **anonymous users cannot register passkeys** (must link email/phone first), (b) RP ID must be chosen carefully and is **immutable once users enroll**, (c) RN support still leans on `react-native-passkeys` or Clerk. **Recommendation: offer passkeys as an optional account-upgrade in Settings post-launch, not a primary onboarding method.** Confidence: medium — re-verify Supabase passkey GA status and RN library maturity at build time.

**Anonymous / guest mode — the recommended default entry.** `signInAnonymously()` creates a real `auth.users` row with the `authenticated` role and an `is_anonymous: true` JWT claim. This lets users complete the quiz and reach the value moment before being asked to sign up. **Pitfalls to engineer around:**

- **Use explicit same-user linking.** The current [Supabase anonymous-auth guidance](https://supabase.com/docs/guides/auth/auth-anonymous) requires identity linking for conversion. The installed `@supabase/supabase-js` client accepts native Apple/Google ID-token credentials in `linkIdentity()`, so the app links the provider while the anonymous session is active and asserts that the returned user ID is unchanged and `is_anonymous` is false. Historical React Native identity-conflict reports still justify real-device staging QA, but automatic email matching is not the implementation contract.
- **Email conversion uses the current session.** Call `updateUser({ email })`, then verify the six-digit code with `verifyOtp({ email, token, type: 'email_change' })`; do not call `signInWithOtp` while an anonymous session must be preserved. If project configuration auto-confirms the same-user update and returns `is_anonymous=false` immediately, finish account creation without showing an impossible code screen. Normal `signInWithOtp` remains the returning/no-session path.
- **Enable manual linking** in every Supabase project and verify the email-change OTP template/configuration. If an Apple, Google, or email identity belongs to another account, fail closed and keep the anonymous session; do not switch IDs until a reviewed merge policy exists.
- **CAPTCHA is strongly recommended** (Turnstile) to prevent anonymous-signup abuse — anonymous users create real rows and can be farmed.
- **Use restrictive RLS** checking `is_anonymous` to lock anonymous users out of sensitive writes (e.g., no photo cloud-backup, no community posting). Note: restrictive policies fail alone — they must be combined with a permissive policy that returns true.
- **Orphaned-data cleanup:** anonymous users who never convert accumulate. Run a scheduled Edge Function to purge anonymous accounts with no activity after N days.

**Auth friction vs. conversion — what the evidence says.** The category evidence is unambiguous that _deferring auth until after value_ wins. Top wellness apps (Flo, Calm, Headspace, Noom) run the quiz/personalization _first_ and only ask for account creation near or after the paywall. Headspace uses one-tap social sign-up to minimize effort. The pattern from RevenueCat benchmark data: "apps that let users feel the product before the paywall convert at higher rates." Each additional required field drops completion — Baymard Institute's 2024 checkout benchmark finds the average flow has 11.3 form fields but most sites need only ~8, and "18% of users have abandoned their purchase due to checkout complexity." (Baymard's data is e-commerce checkout, not app onboarding — the directional "fewer fields = higher completion" principle transfers; specific per-field drop figures circulating online, e.g. "5–10% per field removed," come from secondary form-optimization sources, not Baymard's primary research.) For health/wellness specifically, social logins reduce the create-account moment to one tap, which measurably reduces drop-off vs. typing email + password.

**What top wellness apps actually do (2026 onboarding teardown):**

- **Flo:** ~40–70 screen questionnaire (~7 min), every screen collects health data to deepen commitment; paywall _after_ the quiz; trust block (doctors, reviews) placed _after_ the plans, not before; a "remind me before trial ends" toggle; a post-subscribe 33% upgrade-discount "gift" and a "Flo for Partners" viral loop.
- **Calm:** weaves supportive statements between heavier questions; delivers a mid-quiz "micro-result" (naming your state) to motivate completion; asks whether a healthcare professional recommended it.
- **Headspace:** narrative welcome → social sign-up → value screen ("Just 10 days of Headspace can increase happiness by 16%") → personalization → paywall → _interactive sample meditation_; 10-day Basics course after conversion to prevent early churn.
- **Noom:** 100+ pre-paywall screens (10–15 min invested) building maximum sunk-cost commitment.

### 2. Onboarding Flow Design (the look/feel core)

**Recommended screen-by-screen sequence:**

1. **Welcome / value carousel (1–3 slides).** One outcome-driven headline ("Healthier skin in 8 weeks, built around _your_ skin"). Anonymous session created silently here.
2. **Goal selection** (large tappable cards): clear skin / anti-aging / hydration / even tone / sensitivity / barrier repair. Drives personalization and the paywall copy later.
3. **Health-data collection consent** (dedicated, unbundled — see §4) immediately before the quiz.
4. **Skin quiz (8–16 questions, Baumann 4-axis core).** See quiz spec below.
5. **Pregnancy/breastfeeding screening** (retinoid contraindication — liability-reducing and personalization-critical).
6. **Current products intake** (barcode scan / search / skip — make skip visible).
7. **Personalization theater** ("Analyzing your skin profile…" with a Rive/Lottie animation, 2–4s) → reveal "Your Skin Type: [DSPT]" result screen.
8. **Notification pre-permission priming screen** (soft ask) → OS prompt only on "yes."
9. **Account creation** (SIWA / Google / email OTP) — at the value moment.
10. **Onboarding paywall** (annual default, JTBD review).
11. **First routine setup** → push toward first check-off (activation).

**Paywall placement (data-backed):** Onboarding paywall is where most trials happen — at Mojo, onboarding accounts for ~50% of trial starts. The experiment cited by RevenueCat and attributed to **Rosie Hoggmascall (Growth at Fyxer AI, author of "Growth Dives")**: "A: Welcome screen → onboarding → home → paywall = 2% trial opt-in; B: Welcome screen → paywall → onboarding → home = 8%; C: Welcome screen → new three-slide carousel → paywall → onboarding → home = 15% trial opt-in." That is a 7.5x swing attributable purely to onboarding structure.

**Trial length:** longer trials convert substantially better. RevenueCat's State of Subscription Apps reports trial-to-paid for ~17–32-day trials around 42–46% versus ~25–27% for ≤4–7-day trials — roughly a 70% lift from running a longer trial — because the mechanism is habit formation, not generosity (more than half of 3-day-trial users cancel on Day 0). **Recommendation: test a 14-day trial as the default** for the $39.99/yr Pro plan.

**⚠️ Trial-toggle compliance update.** The free-trial toggle (let the user switch between "start free trial" and "pay now") historically drove big lifts — RevenueCat's paywall-redesign case study reports a redesigned paywall with a trial toggle "saw a 31% increase in install-to-trial conversions and a 64% uplift in revenue." **However, the same source warns that as of early 2026 Apple is rejecting apps that use a free-trial toggle under Guideline 3.1.2.** **Recommendation: do NOT ship the trial toggle on iOS.** Use a single clear offer (annual with trial, "not now" exit visible) on iOS; the toggle may still be used on Android/web. Re-verify Apple's current enforcement at build time.

**Quiz specifics — dermatological credibility.** The Baumann Skin Type system uses 4 dichotomous axes: **Oily/Dry (O/D), Sensitive/Resistant (S/R), Pigmented/Non-pigmented (P/N), Wrinkled/Tight (W/T)** → 16 types (e.g., OSPW, DSNT). **Legal caution: the validated Baumann Skin Type Indicator (BSTI) questionnaire is patented (US20060265244A1, US20140018634A1; system patented 2004) and copyrighted, and per Skin Type Solutions only it and licensed providers may legally use the actual quiz.** You may legally implement the _concept_ of a 4-axis oily/dry, sensitive/resistant, pigmented/non, wrinkled/tight assessment (the axes describe skin biology and aren't themselves protectable), but you **must author your own original questions and scoring** — do not copy BSTI items, and be cautious about the "16 types" branding which is closely associated with the Baumann mark. Confidence: medium-high that the concept is implementable; **a patent/trademark attorney review before build is mandatory, not optional.**

Quiz must include: a Fitzpatrick-style phototype question (frame inclusively — Fitzpatrick is critiqued for under-serving skin of color, so pair with a Monk Scale–style tone selector and descriptive options rather than only "how easily do you burn"), the 4 Baumann axes, sensitivities/allergies, pregnancy/breastfeeding status, current actives (for the conflict engine), and goals.

**Quiz length:** 8–16 questions is the credible-but-not-exhausting range; the "investment effect" (Noom/Duolingo) supports going longer with progress cues and a personalization payoff. **Recommendation: ~12 core questions with a visible progress bar and a "building your plan" payoff screen.**

### 3. Core Data Model (the schema)

All tables in `public`, RLS enabled, every policy uses `(select auth.uid())` and `TO authenticated`. Foreign keys to `auth.users(id)` with `ON DELETE CASCADE`.

**`profiles`** — the `auth.users → public.profiles` pattern via a `handle_new_user()` trigger on `auth.users` AFTER INSERT.

- `id uuid PK references auth.users(id) on delete cascade`, `display_name text`, `avatar_path text`, `locale text`, `units text` (metric/imperial), `current_streak int default 0`, `longest_streak int default 0`, `created_at`, `updated_at`.
- **2026 pitfall:** the trigger-on-signup pattern can fail silently and **block signups** if the trigger errors (e.g., a NOT NULL violation), because it runs inside the auth transaction. Make the trigger defensive (all columns nullable or defaulted, `security definer`, exception handling). Some teams now prefer creating the profile client-side after first sign-in or via an Edge Function to avoid auth-blocking failures. Confidence: high that the pitfall is real.
- RLS: `select/update/insert using ((select auth.uid()) = id)` with matching `WITH CHECK`.

**`skin_profiles`** — quiz results.

- `id uuid PK`, `user_id uuid FK`, `oily_dry int`, `sensitive_resistant int`, `pigmented_non int`, `wrinkled_tight int` (axis scores), `fitzpatrick int`, `monk_tone int`, `sensitivities text[]`, `pregnancy_status text` (none/pregnant/breastfeeding/prefer_not), `goals text[]`, `completed_at timestamptz`, `version int`. **This is health-inference data → gated behind the health-data consent.**
- RLS: owner-only.

**`user_products`** (the shelf).

- `id uuid PK`, `user_id uuid FK`, `catalog_product_id uuid NULL FK` (to Open Beauty Facts–seeded catalog), plus manual-entry fallbacks `manual_name text`, `manual_brand text`, `barcode text`, `opened_at date`, `pao_months int`, `expiry_date date`, `expiry_computed date GENERATED ALWAYS AS (least(expiry_date, opened_at + (pao_months || ' months')::interval)) STORED` (PAO/expiry whichever is sooner), `status text` (active/finished/discarded).
- Index on `user_id`, `catalog_product_id`. RLS owner-only.

**`routines` + `routine_steps`.**

- `routines`: `id`, `user_id`, `type text` (AM/PM/custom), `name`, `is_active bool`.
- `routine_steps`: `id`, `routine_id FK`, `user_product_id NULL FK`, `step_order int`, `frequency text` (daily/skin-cycling/every_n_days), `cycling_night int NULL` (1=exfoliation, 2=retinoid, 3–4=recovery), `instructions text`. Application-order correctness lives in `step_order`.
- RLS via the routine's `user_id` — use a security-definer helper `owns_routine(routine_id)` to avoid a join inside the policy (the documented Supabase RLS performance pattern).

**`routine_completions`** (the streak/adherence event log — append-only).

- `id`, `user_id`, `routine_id`, `step_id NULL`, `completed_at timestamptz`, `completed_date date`, `source text` (live/backfilled), `created_at`. Unique constraint on `(user_id, step_id, completed_date)` to dedupe.
- **Append-only**; no UPDATE/DELETE policy (only INSERT + SELECT for owner). **Partitioning:** at scale, range-partition by month on `completed_at`. For v1, a btree index on `(user_id, completed_date)` suffices; partition later.
- **Streak integrity:** record both `completed_at` (when logged) and `completed_date` (the day it counts for). Offline backfill is legitimate, but to prevent backdating abuse, **cap backfill to a 48-hour window server-side** and flag `source='backfilled'`. Compute streaks server-side / in a security-definer function from this log.

**`photos` metadata.**

- `id`, `user_id`, `storage_path text NULL` (NULL when local-only), `taken_at`, `lighting_score numeric`, `alignment_score numeric`, `local_only bool DEFAULT true`, `face_region_redacted bool`. **No faceprint/biometric template is ever stored (BIPA avoidance).** In current V1, local photo save automatically syncs neither image bytes nor metadata; these columns remain future server scaffolding under D-086.
- RLS owner-only; Storage bucket **private** with a `storage.objects` policy scoping by `(storage.foldername(name))[1] = (select auth.uid())::text`. (Public buckets bypass RLS on read — never use one for photos.)

**`streaks`** — **recommendation: computed (authoritative), with a denormalized `current_streak`/`longest_streak` cached on `profiles` via trigger for read performance.** Stored-only drifts on backfill/timezone edge cases; computed-only is correct but expensive. Hybrid is best.

**`entitlements`** (RevenueCat mirror).

- `user_id PK`, `entitlement text` (pro/pro_plus), `is_active bool`, `product_id text`, `expires_at timestamptz`, `rc_event_id text`, `updated_at`.
- Populated by a **RevenueCat webhook → Supabase Edge Function** (service-role, bypasses RLS). Read `event.app_user_id` (NOT `body.app_user_id` — the common 400 "user*id not found" bug), return 200 fast to avoid retries, and **make processing idempotent on `event.id`** (RevenueCat guarantees at-least-once, not exactly-once delivery). Handle event \_types* correctly (don't grant on a CANCELLATION). Optionally call RC `GET /subscribers` after a webhook to reconcile. RLS: SELECT owner-only; writes service-role only.

**`consents`** (MHMDA/GDPR immutable audit ledger).

- `id`, `user_id`, `consent_type text` (account / health_data_collection / photo_capture / photo_cloud_backup / marketing / data_sharing), `granted bool`, `version text`, `consent_text_hash text`, `granted_at timestamptz`, `revoked_at timestamptz NULL`, `ip inet`, `user_agent text`.
- **Append-only immutable** — revocation is a _new row_, never an UPDATE. RLS: INSERT + SELECT owner; no UPDATE/DELETE.

**`notification_preferences`** — `user_id PK`, `am_reminder_time time`, `pm_reminder_time time`, `streak_nudges bool`, `replenishment_alerts bool`, `push_token text`, `timezone text`. RLS owner-only.

**`subscriptions_events`** (optional raw webhook log) — service-role write, for audit/debugging.

**RLS verification rules (apply to every table):** wrap auth functions — `(select auth.uid()) = user_id`, not bare `auth.uid()` — to trigger initPlan caching (100x+ improvement on large tables); add `TO authenticated` so policies short-circuit for anon; index every column referenced in a policy; always include `WITH CHECK` on INSERT/UPDATE (its absence lets users set `user_id` to someone else's UUID, stealing ownership); use security-definer functions for cross-table checks; remember an UPDATE policy requires a corresponding SELECT policy. Run Supabase's Security & Performance Advisors (lints `0003 auth_rls_initplan`, `0008 rls_enabled_no_policy`, `0013 rls_disabled_in_public`) before every release; treat any "RLS disabled in public" as a launch blocker.

### 4. Privacy / Consent Architecture in the Flow

**Where each consent goes (the placement map):**

- **Account-creation consent** (ToS + privacy policy acceptance): at the account creation screen (step 9). Standard.
- **Health-data collection consent** (MHMDA "collection" + GDPR Art. 9 explicit): **a dedicated, unbundled screen _before_ the skin quiz** (step 3), because the quiz infers health status. Must name the categories collected and the purpose. Cannot be a pre-checked box or bundled into ToS.
- **Photo capture consent:** at first camera use, separate.
- **Cloud-backup-of-photos consent:** reserved and unavailable in current V1. Any future implementation must remain distinct from capture because uploading special-category images off-device is higher-risk, and may be exposed only after encrypted upload, restore, deletion, reviewed consent, and device QA ship together (D-086).
- **Marketing consent:** separate, opt-in, never bundled.
- **Data-sharing consent (MHMDA "separate and distinct" from collection):** required before any sharing with third parties/affiliates (ShopMy affiliate later, or any analytics that count as sharing). MHMDA mandates this be a distinct consent from collection consent. _Selling_ health data requires a signed authorization retained for six years — avoid entirely.

MHMDA specifics (RCW 19.373): consent = "a clear affirmative act that signifies a consumer's freely given, specific, informed, opt-in, voluntary, and unambiguous agreement." Consent for sharing must be "separate and distinct from the consent obtained to collect." There are **no applicability thresholds** (it applies regardless of company size), it carries a **private right of action** (violations are per se Consumer Protection Act violations), and its deletion right notably lacks the retention exceptions found in other privacy laws. GDPR Art. 9 requires _explicit_ consent (a named, specific statement referencing the health data types) plus an Art. 6 basis; legitimate interest is not available for health data, and "over 80% of health apps on European app stores rely on user consent as their primary Article 9 justification" (EDPB analysis cited by Momentum). Photos are special-category only when processed to identify a person — because we do _on-device_ face detection and store no faceprint, we minimize this, but skin photos still reveal health status, so treat them as Art. 9 data requiring explicit consent. A DPIA (Art. 35) is advisable given large-scale health-data processing.

**Age gating:** Use a **neutral age gate** (date-of-birth entry, not "are you over 13?" which invites falsification). COPPA floor is 13; GDPR digital-consent age is 16 (member states may set 13–15). **Recommendation: gate at 16 globally for simplicity given health data, or 13 with parental-consent handling where required.** Most consumer wellness apps ship a DOB picker or age-bracket selector and block under-threshold users.

**Account deletion (Apple 5.1.1(v)) — mandatory, in-app:**

- Easy-to-find Delete Account in Settings; must delete the account record and associated personal data (including shared user-generated content like photos). Apple's support page: account deletion has been required since June 30, 2022, the control must live inside the app, and it must remove the account record and associated personal data.
- **Must call the Sign in with Apple REST API to revoke tokens** during deletion (reviewers sign in → delete → sign in again; intact data = rejection). Documented in Apple TN3194.
- Architecture: in-app button → Edge Function (service-role) → revoke SIWA token → delete `auth.users` row (cascades to all `public` tables via FK `ON DELETE CASCADE`) → **explicitly delete Storage objects** (Storage cascade is not automatic — remove the user's bucket folder) → call **RevenueCat subscriber-deletion API** → call **PostHog person-deletion API** → confirm to user. Notify the user that App Store billing continues until they cancel.
- **Soft-delete grace period:** mark `deleted_at` and disable access immediately, hard-purge after 14–30 days (recommendation: 30 days) — **but MHMDA's deletion right has no retention exception**, so for Washington users honor deletion promptly within the 45-day statutory window and don't over-retain. Google Play has an equivalent data-deletion requirement (in-app + web deletion route).

**Data export (GDPR Art. 20 portability):** the mobile action wraps two explicit scopes in one versioned JSON artifact. The `data-export` Edge Function supplies owner-scoped account, profile, product, routine, completion, consent, and any server-side photo metadata (with signed URLs only for valid owned cloud-photo paths). A registry-driven mobile collector adds the encrypted local-first records from the current device, including the device-authoritative profile, shelf, cycle/ramp choices, completion history, preferences, sanitized Progress metadata, and decrypted Progress notes when available. Progress image files, thumbnails, device paths, encryption keys, auth credentials, and temporary cache files are excluded. A configured backend failure aborts the export rather than silently omitting account-held data; a build with no configured backend produces an explicitly marked device-only bundle.

### 5. Session / Security Engineering

**Token storage — recommendation: `expo-secure-store` via the LargeSecureStore AES pattern.** SecureStore has a ~2KB (2048-byte) limit and the Supabase session JSON exceeds it. The documented Supabase workaround: generate an AES-256 key, store _that_ in SecureStore, and store the AES-encrypted session in AsyncStorage (using `aes-js` + `react-native-get-random-values`). Plain AsyncStorage for JWTs is criticized (unencrypted at rest); MMKV is fast but also unencrypted unless you add encryption. **Use LargeSecureStore.** Configure the client with `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`. (Also note: Supabase legacy anon/service_role keys are deprecated by end of 2026 in favor of publishable/secret keys — use the new keys.)

**Auth state + token refresh:** register `supabase.auth.onAuthStateChange`, and start/stop auto-refresh on `AppState` foreground/background. Handle offline gracefully — a cached session allows local reads.

**Deep links:** OAuth and magic-link redirects need a scheme (`yourapp://auth/callback`) configured in `app.json` plus `expo-auth-session` or `react-native-google-signin`. **Recommendation: use native sign-in (`signInWithIdToken`) for Apple/Google to avoid web-redirect fragility, and OTP codes instead of magic links** to sidestep deep-link complexity entirely.

**CAPTCHA / bot protection:** Supabase Auth supports Turnstile — enable for anonymous sign-in and signup. **Rate limiting:** Supabase enforces auth rate limits (default email/OTP expiry 24h); keep defaults and monitor. **Leaked-password protection:** enable in Supabase Auth settings (HaveIBeenPwned check) — low cost, real value even though we de-emphasize passwords.

**MFA:** **optional for a consumer beauty app** — validated as unnecessary for v1. Offer TOTP MFA as an opt-in in Settings for privacy-conscious users, but don't force it.

**Biometric app-lock (Face ID to open app) via `expo-local-authentication`:** **recommendation: ship it as a privacy feature**, especially because the app holds sensitive progress photos. Health and finance apps commonly ship this; it's a strong trust signal and directly supports the privacy-as-trust-asset positioning. Make it opt-in, gating app open and the photo gallery specifically.

### 6. Offline-First + Sync Foundation

Routine check-offs happen in bathrooms, often offline, so writes must succeed locally and sync later. Options evaluated:

- **Simple queue-and-retry / TanStack Query + persistence + optimistic updates:** lowest complexity, well-understood, sufficient for the write patterns here (single-user, append-mostly completions). **Recommended for v1.**
- **Legend-State v3:** has a first-party Supabase sync plugin (`syncedSupabase`), local persistence via AsyncStorage, uses `created_at`/`updated_at`/`deleted` columns for change tracking, `retrySync` for offline. Fast and ergonomic. **Recommended upgrade path** once sync needs grow.
- **PowerSync:** the heavyweight — syncs Postgres↔local SQLite, true offline-first, **last-write-wins conflict resolution by default** (customizable; CRDT options exist), native Supabase Auth + asymmetric JWT support, official Supabase partnership. Requires a custom dev build (native modules; no Expo Go) and has cost/ops overhead; note a known Supabase logical-replication WAL-growth issue to configure around (set smaller `max_wal_size`). Free tier exists; Supabase Pro from $25/mo (PowerSync priced separately). **Adopt only if multi-device real-time sync becomes a core requirement.** Of the pluggable sync engines (ElectricSQL, Zero, PowerSync), PowerSync is the only one with first-class offline support — Zero and ElectricSQL explicitly treat offline as out of scope.
- **WatermelonDB:** powerful but requires building backend sync plumbing yourself.

**Recommendation: v1 = TanStack Query + optimistic updates + a persisted mutation queue.** Plan the migration to Legend-State or PowerSync as a future-document decision when multi-device sync is prioritized.

**Conflict resolution for routine_completions:** completions are append-only and idempotent on `(user_id, step_id, completed_date)` — so **last-write-wins is acceptable** and conflicts are nearly impossible by construction (a completion either exists for that day or doesn't). The unique constraint dedupes. **Streak integrity:** cap offline backfill to 48h server-side and flag backfilled rows to prevent abuse while honoring genuine offline use.

### 7. Analytics / Experiment Foundation at Auth Layer

**PostHog identify timing:** call `posthog.identify(userId)` at the value moment when the anonymous→permanent conversion happens (account creation), passing the Supabase user ID. This merges all prior anonymous events to the identified person. **RN caveat:** on Android, persisted anonymous IDs may not migrate across SDK upgrades (you may see inflated `Application Installed` counts) — ensure `identify` runs on app load for known users. Don't call identify repeatedly; if called multiple times with the same data without reload, PostHog ignores subsequent calls.

**Onboarding funnel taxonomy** (event names): `onboarding_started`, `screen_viewed` (with `screen_name` property for granularity), `quiz_question_answered` (`question_id`, `axis`), `quiz_completed`, `personalization_shown`, `notification_prompt_shown`/`_granted`/`_denied`, `account_created` (`method`), `paywall_shown`, `trial_started`, `purchase_completed`, `first_routine_created`, `first_checkoff_completed`.

**RevenueCat ↔ PostHog:** use RevenueCat's PostHog integration so subscription events become PostHog events tied to the same distinct ID, enabling subscription cohorts and trial→paid funnels in PostHog.

**A/B testing onboarding variants:** PostHog experiments run on feature flags. **Bootstrap feature flags at init** (pass precomputed values into the PostHog provider via the `bootstrap` config) to avoid the 100–500ms flag-fetch flicker that would otherwise flash the wrong onboarding variant. Use the same `distinctID` client/server. Flags cache in AsyncStorage (can be stale — handle `undefined` as "not loaded yet," not "off").

**North-star activation metric:** **"completed first routine check-off within 24 hours of install."** This is a well-formed activation metric (Reforge's Setup→Aha→Habit framework; the Facebook-origin "X actions in Y days" pattern). It captures the core habit-loop behavior and predicts retention — Amplitude's analysis of 2,600+ companies found that for half of all products, 98% of new people are inactive by Day 14, underscoring the need to drive the first action fast. Pair the activation metric with a depth/habit metric (e.g., "3 check-offs in first 7 days"). Avoid vanity metrics like raw signups (Reforge/Amplitude explicitly warn that "Registered Users" and "DAU" are poor north stars because they don't capture value).

### 8. Look / Feel Specification Inputs

- **Screen transitions:** horizontal slide for sequential quiz steps (reinforces progress); fade for context switches; **shared-element transition** for the personalization reveal (quiz answers morph into the result card).
- **Progress indicator:** **stepped segments or a progress bar** (not dots) for the multi-step quiz — sets expectations and creates momentum; dots are fine only for the 1–3 slide welcome carousel.
- **Selection controls:** **large tappable cards** for goals and single-select quiz answers (best tap target, most premium feel); chips for multi-select sensitivities; sliders only for genuinely continuous inputs (rare here — prefer cards).
- **Haptics:** selection tick on card tap (`Haptics.selectionAsync`), success notification haptic on quiz completion and first check-off.
- **"Analyzing your skin profile" animation:** **Rive recommended over Lottie** for this interactive/stateful moment — in Callstack's React Native benchmark Rive ran at ~60fps vs. Lottie's ~17fps for the same animation, and Rive files are far smaller (a recreated animation was ~2KB in Rive vs ~24KB as Lottie). Rive's state machine lets the animation respond to the actual computed result. Lottie remains fine for simple decorative loops and has the easier After-Effects pipeline. **Recommendation: Rive for the hero personalization moment; Lottie acceptable elsewhere.** Confidence: medium — both are production-grade, and LottieFiles' late-2025 native state-machine + AI features narrow the gap, so re-evaluate at build time.
- **Skeletons over spinners** for content loads (perceived performance).
- **Dynamic Type / font scaling:** layouts must reflow with iOS Dynamic Type; avoid fixed-height containers around text; test at the largest accessibility sizes.
- **Dark mode:** design onboarding in both themes from the start; the "analyzing" animation needs dark-mode variants.
- **Localization-readiness:** externalize strings; design for ~30% string-length expansion (German/French); support RTL (mirror layouts, use logical start/end not left/right).
- **Accessibility:** correct VoiceOver focus order in multi-step flows (focus moves to the new screen's heading on transition); respect Reduce Motion (swap shared-element/slide transitions for fades, disable the heavy Rive animation); all tappable cards need accessibility labels and 44pt minimum targets.

**Permission-priming evidence (confidence: directional, vendor-sourced):** showing a soft in-app explainer before the OS notification prompt materially raises opt-in. OneSignal claims best-practice prompting "can improve push opt-in rates by up to 50 percent"; CleverTap's docs claim contextual timing can lift opt-ins ~45% (shown after the 3rd session) or "almost triple" them vs. first-launch prompts. iOS cold push opt-in baselines sit ~40–51% (vs. ~81–91% Android). These are vendor claims, not peer-reviewed studies — treat as directional but the _direction_ (prime first) is well-established. **For the iOS App Tracking Transparency prompt** (relevant only if you add ad-attribution SDKs/ShopMy attribution later): Adjust's Q2 2025 benchmark puts the industry-wide shown-prompt opt-in at **35%** (up from 34.5% in 2024), with health & fitness historically ~42% (Statista/MarketingCharts, March 2022). The commonly cited "~25–40%" range is well supported; lower figures (~14%) reflect cold-at-download prompting. **Recommendation: prime before both the notification and any ATT prompt, and fire them at the value moment, not at launch.**

### 9. Seven-Figure Validation

The evidence supports that this foundation layer is a primary revenue driver, not just plumbing:

- **Onboarding completion → trial start:** roughly half of all paid conversions happen on Day 0 (RevenueCat SOSA); onboarding quality sets the conversion ceiling before the paywall is even seen. At Mojo, onboarding drives ~50% of trial starts.
- **Quiz-personalization → conversion lift:** the Hoggmascall experiment showed a carousel + paywall + quiz flow hitting 15% trial opt-in vs. 2% for a paywall-last flow — a 7.5x swing. RevenueCat/Adapty case studies repeatedly tie personalized onboarding to large lifts (one paywall redesign: "a 31% increase in install-to-trial conversions and a 64% uplift in revenue" — though that specific design used a now-iOS-noncompliant trial toggle; the _personalization/short-form_ lessons still hold).
- **Privacy-trust → willingness-to-pay — Yuka is the reference case.** Per Yuka's own published 2024 balance sheet (yuka.io/en/independence), it earned **$7.3M total in 2024 — exactly $7,174,710 (98.1%) from premium subscriptions**, $137,893 from books/calendars, and $58,043 from services, with a ~15-person team, 80M+ users, **zero brand revenue and zero marketing spend**, growing purely on word-of-mouth driven by trust in its independence and refusal to sell data. For a skincare app handling face photos, privacy-as-trust is a direct monetization asset and word-of-mouth engine.
- **Data-accumulation → retention:** the longer a user logs routines, products, and photos, the higher the switching cost (data lock-in). The append-only completion log and longitudinal photos create a compounding retention moat; annual plans retain far better than monthly in health apps (RevenueCat SOSA: ~44% one-year retention on annual vs. ~17% monthly vs. ~3% weekly), which is why annual should be the paywall default.
- **Cost of getting it wrong:** the median subscription app converts only low-single-digit percent of installs to paid vs. several-times-higher for top performers, and the gap is mostly onboarding/paywall execution (RevenueCat SOSA reports hard-paywall median download-to-paid ~10–12% vs. ~2% freemium, ~5x). The global day-30 onboarding completion average is ~8.4% and most apps lose 90%+ of users before onboarding completes (AppsFlyer/Business of Apps); health & fitness has one of the highest day-1 onboarding rates (~26%). Auth bugs and broken signup flows generate 1-star reviews and permanent drop-off.

**Verdict: the foundation genuinely supports a 7-figure business** — conditional on executing the deferred-auth + quiz-personalization + onboarding-paywall + privacy-trust pattern, not on shipping a generic login + form.

### 10. Synthesis

**(a) Recommended auth strategy & flow:** Anonymous session on first launch → quiz/value first → SIWA + Google + email OTP at the value moment (SIWA mandatory because Google is offered) → onboarding paywall with annual default and a 14-day trial (no trial _toggle_ on iOS — Apple now rejects it). Passkeys and MFA optional in Settings post-launch. Runner-up to anonymous-first: a "skip for now" guest button that still creates an anonymous session — same backend, slightly different framing.

**(b) Data model & RLS:** per-user RLS with `(select auth.uid())` + `TO authenticated` + indexed policy columns + `WITH CHECK` everywhere + security-definer helpers for cross-table checks; service-role only for the RevenueCat webhook and deletion/export Edge Functions; append-only `routine_completions` and immutable `consents`.

**(c) Consent/compliance map:** unbundled, opt-in, explicit consents — health-data-collection before the quiz, photo-capture at camera, cloud-backup separately, sharing separately (MHMDA "separate and distinct"), marketing separately; neutral DOB age gate; in-app deletion with SIWA token revoke + cascade + RC/PostHog deletion; JSON export Edge Function.

**(d) Session/security/offline:** LargeSecureStore AES token storage; Turnstile CAPTCHA; leaked-password protection on; biometric app-lock for photos; v1 offline = TanStack Query + optimistic queue, LWW for idempotent completions, 48h backfill cap for streak integrity.

**(e) Look/feel foundations:** slide + shared-element transitions, stepped progress bar, large tappable cards, haptic ticks, Rive for the personalization hero, skeletons, Dynamic Type/dark mode/RTL/VoiceOver/Reduce-Motion from day one.

**(f) 7-figure verdict:** Yes — the architecture is conversion- and retention-optimized and turns privacy into a growth asset (Yuka proves the model at $7.3M with zero marketing).

**(g) Confidence flags / re-verify at build time:** Apple's trial-toggle rejection under 3.1.2 (newly reported — confirm scope); Supabase passkey GA + RN library maturity; **Baumann/16-type patent + trademark exposure (mandatory legal review)**; RevenueCat webhook payload shape and subscriber-deletion API; Apple Guidelines 4.8 / 5.1.1(v) exact current wording; Legend-State v3 / PowerSync version status; Rive vs Lottie after Lottie's late-2025 state-machine update; the profile-creation-trigger pitfall (consider client-side/Edge-Function profile creation); Supabase legacy→publishable/secret key migration (by end of 2026); exact RevenueCat SOSA edition figures (2025 vs 2026 numbers differ — cite the edition you pull from).

## Recommendations

1. **Build the deferred-auth, quiz-first flow now** — it's the single highest-leverage decision. Benchmark: aim for top-decile install-to-paid (hard-paywall top apps reach the high-30s percent trial-to-paid); if you're below the low-single-digit median after launch, the onboarding sequence is the first thing to fix.
2. **Implement the consent ledger and unbundled consent screens before writing any quiz code** — retrofitting MHMDA/GDPR consent is expensive and the MHMDA private right of action makes it high-risk.
3. **Ship LargeSecureStore, RLS with `(select auth.uid())`, and RevenueCat webhook idempotency (keyed on `event.id`) from day one.** Run Supabase's Security Advisor before every release; treat any "RLS disabled in public" lint as a launch blocker.
4. **Drop the iOS trial toggle** (Apple 3.1.2 rejections); use a single clear annual-default offer with a visible "not now." Toggle may remain on Android/web.
5. **Start offline simple (TanStack Query queue); don't adopt PowerSync until multi-device sync is a prioritized requirement.**
6. **Get a patent/trademark attorney review of the skin-type quiz** before implementing the 16-type framing — author original questions; do not reuse BSTI items.
7. **Define and instrument the activation metric ("first check-off within 24h") in PostHog at launch**, with bootstrapped feature flags for onboarding A/B tests.

## Caveats

- Several technical specifics are version-sensitive and flagged above for build-time re-verification (Apple trial-toggle enforcement, Supabase passkeys, Legend-State v3, PowerSync, RevenueCat APIs, Apple guideline wording, Supabase key migration).
- The Baumann patent/copyright/trademark situation is the most significant legal risk; the legal-review recommendation is mandatory.
- MHMDA's deletion right with no retention exceptions can conflict with other legal retention obligations — flag for counsel.
- Notification-priming and ATT opt-in lift figures are largely vendor claims (OneSignal, CleverTap), not peer-reviewed studies; the _direction_ (prime first, fire at value moment) is sound, but treat the magnitudes directionally.
- Conversion benchmarks (RevenueCat SOSA, Adapty) measure subscription conversion, not pure onboarding-screen completion; the 2025 and 2026 SOSA editions report somewhat different exact figures, so cite the specific edition when quoting numbers. Use as directional targets.
