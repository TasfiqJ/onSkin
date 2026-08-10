# Document 0 — Master Technical Architecture for a Production-Grade Skincare Routine App (iOS + Android)

> **Historical research input, not the active launch or legal authority.** The
> accepted iOS-only, provisional U.S.-only launch plan and the current
> evidence-based legal gates in `docs/hugeToDo/`, `docs/phase-3/`, and
> `docs/ARCHITECTURE.md` supersede categorical jurisdiction, medical-device,
> vendor, price, schedule, and readiness statements below. Applicability and
> classification depend on the final entity, relationships, intended use,
> functions, data flows, users, claims, vendors, and release markets. Qualified
> counsel and the relevant regulator/vendor decisions remain required.

## TL;DR

- **Build it in React Native (Expo SDK 52+, New Architecture/Fabric) with a Supabase Postgres backend, RevenueCat for subscriptions, and a phased AI strategy that ships guided photo capture + slider comparison FIRST (no AI claims) before any cloud "skin analysis."** This stack is the best fit for a senior team optimizing for one TypeScript codebase, mature camera/widget tooling, predictable infra costs, and Postgres's relational power for the ingredient-conflict graph.
- **The ingredient intelligence layer should be a curated rules engine, not ML.** Candidate CosIng and Open Beauty Facts (OBF) data may enter the build pipeline only as separately acquired, exact-SHA-256-bound offline artifacts with recorded source/date and review; the app never sends a user's search or barcode to either source and never publishes user corrections to OBF. CosIng remains an informative reference, not a safety or legal approval. Keep the OBF-derived component separable from proprietary/editorial data until counsel classifies the exact database design and approves any ODbL attribution, share-alike, or offer-of-data duties. Then hand-curate the top ~2,000 products and a conflict-rules matrix of roughly 30–60 ingredient pairs that actually matter.
- **Treat skin photos and skin inferences as sensitive/health-adjacent data from
  day one.** The app uses the current U.S. Wave 1 consumer-health controls as a
  conservative launch gate. HIPAA status depends on the entity and relationship
  to a covered entity or business associate; CCPA/CPRA depends on statutory
  scope and thresholds; Washington MHMDA and every other state-law
  classification require review against the final facts. On-device-first
  architecture supports data minimization, but only exact-build and observed
  traffic evidence can support a public statement that a data class stays on
  device or is not used for model training.

## Key Findings

1. **Framework: React Native New Architecture (Expo) wins for this app, with Flutter the runner-up.** Both are production-grade in 2026. Flutter has a real edge in raw animation performance (Impeller delivers consistent 60–120fps; RN's Fabric hits ~51fps on the heaviest UIs). But this app is not animation-bound — it's camera-heavy, widget-heavy, integration-heavy, and needs the largest possible hiring pool. RN's decisive advantages: (a) `react-native-vision-camera` is the most mature cross-platform camera library with a frame-processor architecture ideal for guided capture; (b) Expo's `expo-apple-targets`/`@bacons/apple-targets` plus `expo-widgets` make WidgetKit + Live Activities buildable from an Expo project; (c) RevenueCat, Supabase, Sentry, PostHog, ShopMy all ship first-class JS/TS SDKs; (d) the JavaScript/TypeScript talent pool is 3–5× larger. Kotlin Multiplatform (Compose Multiplatform for iOS went stable May 2025, v1.8.0) is a credible third option but the talent pool is smaller and the third-party SDK ecosystem (RevenueCat, ShopMy) is thinner. Fully native Swift+Kotlin is rejected: it doubles the team and timeline for an app whose differentiators are data and UX, not raw rendering.

2. **Backend: Supabase (Postgres) wins decisively over Firebase and Convex.** The ingredient/conflict layer is inherently relational (ingredients ↔ products ↔ conflict_rules with joins, severity grades, evidence grades) — Postgres is the natural home; Firestore's document model maps poorly. Supabase's resource-based pricing is predictable, whereas Firebase's Blaze model "charges per read, write, and delete... which can spike with heavy usage"; Row-Level Security enforces per-user photo isolation at the database layer; pgvector is available for future photo-embedding similarity. Pricing (per supabase.com/pricing, May 2026): Free (50K MAU), Pro $25/mo + usage (100K MAU included, then $0.00325 per MAU), Team "From $599/month" adding "SOC2 & ISO 27001" with "HIPAA available as paid add-on." Supabase Auth is bundled into the $25 Pro fee (100K MAU included; e.g. at 150K MAU the overage is 50,000 × $0.00325 = ~$162.50 extra), versus Firebase's per-read Blaze model that can spike unpredictably. Successful consumer-health apps increasingly run exactly this stack (React Native + Supabase + RLS). Convex is elegant for realtime but this app's realtime needs are minimal, and its proprietary document model creates lock-in.

3. **Ingredient database: curated rules engine, reviewed offline sourcing.** The [European Commission's CosIng page](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en) says the database is informative and has no legal value; presence is not approval or a product-level safety conclusion. OBF is the barcode-linked product sibling of Open Food Facts, and the [Product Opener license guide](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/) distinguishes database, individual-content, and image rights. Layerwell accepts neither source through a request-time API: imports are exact-hash-bound offline artifacts, OBF images remain excluded, and user additions/corrections are not contributed externally. Counsel must decide whether the exact OBF component is a derivative or collective database and which ODbL obligations apply. INCIDecoder/Skincarisma/SkinSort have no approved source route; do not scrape or build on them. The conflict/synergy engine should be a hand-curated ingredient-pair matrix derived from dermatology literature, NOT ML — the number of pairs that genuinely matter is small (retinoids × AHA/BHA, retinoids × benzoyl peroxide, the niacinamide × vitamin C "myth," vitamin C × pH-dependent acids, copper peptides × direct acids, benzoyl peroxide × vitamin C). Note the evidence is genuinely contested: Paula's Choice and others argue the retinol × AHA/BHA and niacinamide × vitamin C conflicts are overstated by older research — so each rule must carry an evidence grade and a resolution suggestion ("separate AM/PM" not "never use").

4. **AI/ML: ship guided capture + comparison first, add AI later — this sequencing is technically correct.** On-device face detection is fully solved with no cloud: Apple's Vision framework (`VNDetectFaceLandmarksRequest` → `VNFaceObservation` with `boundingBox`, `landmarks`, and `roll`/`yaw`/`pitch` head-pose plus `faceCaptureQuality`) and Google ML Kit Face Detection (`Face` object with `getBoundingBox()`, `getHeadEulerAngleX/Y/Z()`, 133-point contours). In React Native, `react-native-vision-camera-face-detector` (v1.10.1, ML Kit-backed on both platforms) runs these in a frame processor for a guided alignment overlay. Commercial skin-analysis vendors (Haut.AI, Perfect Corp/YouCam, Revieve, Thea Care) are B2B/enterprise with "request pricing" — none publish public per-call pricing, and none publish independent accuracy benchmarks. Adopt the Monk Skin Tone scale (10-shade, Google/Dr. Ellis Monk, CC BY 4.0) over Fitzpatrick for fairness, but note MST itself "still requires further validation" per recent npj Digital Medicine work. Recommendation: ship side-by-side/slider comparison with no AI claims first; add AI trend analysis only when you can do it credibly and with consent.

5. **Payments: RevenueCat + StoreKit 2 / Play Billing, with a cautious US web-checkout play.** RevenueCat is free under $2,500/mo revenue, then a percentage of tracked revenue; Paywalls v2 (GA at WWDC 2025) are native, no-code, remotely configurable with built-in A/B Experiments. The Epic v. Apple ruling (April 30, 2025) lets US iOS apps link to external web checkout; the Ninth Circuit (Dec 11, 2025) said Apple may charge a "reasonable" commission but the rate is unresolved and on remand as of April 2026 (Apple seeking Supreme Court review). So US external links are currently commission-free but the window is uncertain. RevenueCat's "Web Purchase Button"/Express Checkout (wallet-button web paywall) is the lowest-friction way to exploit this. For affiliates, ShopMy has an official OAuth developer API; its network is "47,000+ brands offering commission," its docs confirm "the ShopMy network operates with a 30-day cookie window" (plus a 30-day return window), and the platform has facilitated over $500M in brand sales across 175,000+ creators — this is your primary affiliate integration. Amazon Associates has historically restricted in-app use; Skimlinks/Sovrn are aggregator fallbacks. Use simple universal links / deep links for attribution before reaching for Branch/AppsFlyer.

6. **Notifications/widgets/background: local-first, with careful Android 14 handling.** Routine reminders should be local notifications, not push. Android 14+ denies `SCHEDULE_EXACT_ALARM` by default for new installs targeting API 33+; a routine reminder is best served by inexact alarms / WorkManager unless you qualify for `USE_EXACT_ALARM` (calendar/alarm apps only). iOS time-sensitive notifications require justification. Widgets: iOS WidgetKit is SwiftUI-only — share data via App Groups + UserDefaults, refresh via `WidgetCenter.reloadAllTimelines()` (used sparingly — Apple throttles timeline reloads); Android uses Glance. Per Evan Bacon's analysis of the top 10K iOS apps, "20.5% of the top 10k apps have a Home Screen Widget" — a well-trodden path. Live Activities (via `expo-widgets`/ActivityKit, iOS 16.2+) are a strong fit for a skin-cycling "tonight's step" display. For push (announcements, win-backs), OneSignal or FCM both work; native APNs/FCM + Supabase Edge Functions is the lock-in-free path.

7. **Compliance is fact- and jurisdiction-specific; use the conservative U.S.
   Wave 1 gate until counsel classifies the release.** Skin photos and inferred
   skin information can fall within consumer-health, biometric, general
   privacy, breach, and consumer-protection regimes. Washington MHMDA is treated
   as a launch gate for the planned U.S. release; CCPA/CPRA, HIPAA, BIPA, and
   other state laws require entity-, threshold-, relationship-, purpose-, and
   data-flow-specific analysis. Canadian and EU storefronts remain closed
   pending their own gates. On-device face framing without a retained identity
   template is a risk-minimizing design fact, not a legal classification.
   Public device-only/no-training claims require exact-binary, storage, vendor,
   and network proof plus counsel-reviewed copy.

8. **Design system: editorial-clinical hybrid, serif display + clean sans body.** The premium beauty/wellness convergence in 2026 pairs a high-contrast display serif (heritage, editorial — think Canela, GT Sectra; budget Google-Fonts route: Fraunces, Cormorant) with a clean grotesque/neo-grotesque sans for body and UI (Söhne, or free routes Inter/SF Pro/Sen/Tenor Sans). Color: clinical-clean neutrals (off-white, warm greige) with a single restrained accent, full dark-mode support. Premium foundry licensing (Klim, Commercial Type) runs into real money for app embedding; Google Fonts/SIL OFL routes are zero-cost and safe. Standards: 8pt grid, design tokens (Figma → NativeWind/Tailwind), Reanimated 3 + Skia for motion, Lottie for celebratory streak moments, WCAG 2.2 AA, Dynamic Type, careful contrast for text-over-photography, restrained haptics.

9. **Dev infra: Turborepo monorepo, TypeScript end-to-end, EAS, PostHog.** Monorepo (Turborepo) with shared TS packages; the Supabase client + generated types or tRPC for the API layer; EAS Build/Submit + EAS Update for OTA. EAS Update is App-Store-compliant for JS/asset/styling changes that don't alter the app's primary purpose (Apple DPLA §3.3.1(B); Guideline 2.5.2 bans downloading code that "changes features or functionality") — native changes require a new binary, enforced via `runtimeVersion`. Testing: Maestro for E2E, React Native Testing Library for units. Observability: Sentry for crashes; PostHog for product analytics + feature flags + experiments + session replay in one (best value; ~$200–400/mo with features enabled; usage-based). CI/CD: GitHub Actions + EAS. A team of 4–6 senior engineers can reach MVP in roughly 5–7 months for this feature set.

## Details

### 1. Cross-Platform Framework

RN 0.76+ made the New Architecture (Fabric renderer, JSI, TurboModules, Hermes) the default, eliminating the legacy async bridge. Independent 2026 benchmarks show Flutter/Impeller leading on sustained complex-UI frame rates (58–60fps vs RN ~51fps) and cold start (~250ms vs ~350ms), while RN often wins on startup-to-interactive and battery in standard business UIs. For a forms/lists/camera/widgets app, the performance delta is imperceptible to users. The deciding factors are ecosystem and native-integration story:

- **Camera:** `react-native-vision-camera` (v5.x, frequent updates) exposes frame processors via JSI — the docs themselves cite VisionCamera frame processing as the canonical example of throughput impractical through Flutter's serialized platform channels. This is exactly what guided-capture overlays (real-time face alignment, lighting checks) need.
- **Widgets:** iOS WidgetKit requires Swift/SwiftUI regardless of framework. Expo solves this with `expo-apple-targets` (`@bacons/apple-targets`, requires Expo SDK 53+, Xcode 16, CocoaPods 1.16.2+) which generates and links native widget/Live Activity targets outside the regenerated `ios/` dir, and the newer `expo-widgets` module. Data sharing uses App Groups + UserDefaults; a small native module calls `WidgetCenter.shared.reloadAllTimelines()`.
- **Talent/SDKs:** TypeScript is the standard; ~67% of developers know JS; RN has ~2× the job listings of Flutter. Every commercial SDK this app needs ships RN support first-class.

Flutter remains the runner-up — choose it only if the team is Dart-native or if pixel-perfect custom-canvas UI becomes the core differentiator. KMP is viable for sharing business logic but adds hiring risk.

### 2. Backend Architecture

Postgres suits the ingredient graph: `ingredients`, `products`, `product_ingredients` (join with position + concentration_band), `conflict_rules` (ingredient_a, ingredient_b, severity, evidence_grade, resolution, citation). RLS policies (`auth.uid() = user_id`) enforce that users only ever read/write their own photos and routines at the database layer — defense that survives an application bug. Storage: compressed photos at ~150–400KB each × 50–200 photos/user/year is modest; Supabase Storage egress is a cost to verify against the current approved plan. Edge Functions (Deno) handle reviewed service workflows; cold starts must be measured for the exact release paths. Realtime is minimal. Vendor lock-in is reduced, not eliminated, by using Postgres and source-controlled contracts. HIPAA status cannot be inferred from the consumer-app label: counsel must assess the final entity, relationships, data flows, and whether the app acts for a covered entity or business associate. Any vendor HIPAA posture, BAA, region, product tier, and control set must be verified in the executed production agreement.

### 3. Ingredient & Product Database Pipeline

- **Candidate ingredient reference:** transform a reviewed CosIng snapshot only from an exact-hash-bound offline artifact and retain the Commission source/date and reuse decision. Carry "informative purpose and no legal value" into provenance and never infer approved/safe/permitted from presence.
- **Candidate product reference:** transform only a reviewed, exact-hash-bound OBF export/snapshot; the importer performs no network I/O. The [current Product Opener API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/) identifies v3 as current and v2 as deprecated, but Layerwell calls neither version at runtime. OBF images and automatic contribution are excluded. Keep the OBF-derived component separable and attach source/date/hash/attribution metadata while counsel decides the exact ODbL classification and duties. Coverage is volunteer-driven and uneven, so **manually curate the top ~2,000 products** (best-sellers across Sephora/Ulta/derm-favorites) for guaranteed quality without silently co-mingling the source components.
- **Conflict rules:** hand-curate ~30–60 pairs from dermatology literature with severity + evidence grade + resolution. Build the AM/PM application-ordering logic as a separate ordered ruleset (cleanser → toner → actives by molecular weight/pH → moisturizer → SPF).
- Do NOT scrape INCIDecoder/Skincarisma/SkinSort — no APIs, ToS/legal risk.

### 4. AI/ML Layer (phased)

**Phase 1 (launch):** Guided capture using on-device face detection (Apple Vision `VNDetectFaceLandmarksRequest`: `boundingBox`, `landmarks`, `roll`/`yaw`/`pitch`, `faceCaptureQuality`; ML Kit `Face.getHeadEulerAngleX/Y/Z()`, `getBoundingBox()`) for alignment, head-tilt, and distance checks, via `react-native-vision-camera-face-detector` (v1.10.1) frame processor. Note these plugins wrap Google ML Kit on both iOS and Android; if you specifically want Apple Vision on iOS, write a custom native frame-processor plugin in Swift. Lighting consistency: compute average luminance/white-balance from the frame buffer on-device and prompt the user. Output: ghost-overlay of the previous photo + slider/side-by-side comparison. NO AI claims.
**Phase 2 (later):** Optional cloud "trend analysis" via a multimodal vendor or general vision API — gated behind explicit, revocable consent, with a clear data-flow disclosure. Evaluate Haut.AI / Perfect Corp / Revieve (all B2B, "request pricing," no public benchmarks) vs general vision APIs. Adopt Monk Skin Tone for fairness evaluation; validate across tones before shipping any claim.

### 5. Payments & Affiliate

RevenueCat abstracts StoreKit 2 + Google Play Billing; Paywalls v2 + Experiments handle pricing tests for Pro $39.99/yr and Pro+ $79.99/yr. Note RevenueCat's State of Subscription Apps 2026 data (115,000+ apps, $16B revenue, 1B+ transactions): "trials of 17–32 days convert at an incredibly high median of 42.5%" vs "<4 day trials convert at just 25.5%, meaning long trials convert ~70% better"; hard paywalls convert ~5× freemium at D35 but refund ~70% higher — both relevant to monetization design. US web-checkout via external link is commission-free today (post-Epic) but legally unsettled; implement RevenueCat Web Purchase Button as a low-risk lever, keep StoreKit IAP as the primary. ShopMy OAuth API is the affiliate backbone; use universal links for attribution first.

### 6. Notifications, Widgets, Background

Local notifications for routine reminders with proper timezone handling. Android 14: default to inexact alarms / WorkManager; only request exact-alarm access if a feature truly needs minute-precision and you can justify it (`canScheduleExactAlarms()` check is mandatory or the app crashes). iOS Live Activities (`expo-widgets`, ActivityKit, iOS 16.2+) for skin-cycling night display. Widget timelines refresh on Apple's schedule (TimelineProvider) — don't over-call reload. Background photo upload: queue + retry when on Wi-Fi/charging. Push: native APNs/FCM + Supabase Edge Functions to avoid OneSignal lock-in, though OneSignal speeds time-to-market.

### 7. Security/Privacy/Compliance Checklist

- Standalone Consumer Health Data Privacy Policy linked on homepage (WA MHMDA §4).
- Separate affirmative consent for collection vs sharing; signed authorization before any sale; honor withdrawal.
- On-device capture + on-device face detection (no faceprint template stored → mitigates BIPA) + client-side encryption; cloud upload opt-in only.
- Encryption in transit (TLS) and at rest; RLS for per-user isolation.
- Data access/deletion/withdrawal flows, including processors, third parties, and
  backups, under every law counsel determines applies to the final release.
- App Store privacy nutrition labels accurate to actual data flows.
- Preserve the current fail-closed declared-age-range and minors policy gates;
  age thresholds and regional behavior require exact-market legal and Apple
  review and must not be chosen merely for perceived regulatory simplicity.
- Geofencing around healthcare facilities is outright banned under MHMDA — never do location-based health targeting.

### 8. Design System Foundations

- **Display:** high-contrast editorial serif. Premium: Canela / GT Sectra (foundry licensing required — budget for app embedding). Free: Fraunces or Cormorant (OFL).
- **Body/UI:** clean sans. Premium: Söhne. Free: Inter / SF Pro (system) / Sen / Tenor Sans.
- 8pt grid; design tokens Figma → NativeWind; Reanimated 3 + Skia motion; Lottie for streak/celebration; WCAG 2.2 AA; Dynamic Type; restrained haptics; full dark mode.

### 9. Dev Infrastructure & Timeline

Turborepo monorepo, TS end-to-end, Supabase typed client (or tRPC), EAS Build/Submit/Update, Maestro + RNTL, Sentry + PostHog, GitHub Actions. EAS Update for JS/asset hot-fixes within store rules; `runtimeVersion` gates native compatibility. Expo's own guidance: updates "need to follow the App Store and Play Store guidelines... changes to your app's behavior need to be reviewed." **MVP timeline for 4–6 senior engineers: ~5–7 months** given the feature breadth.

### 10. Recommended Stack (one choice per layer)

- **Client:** React Native + Expo (New Architecture). Runner-up: Flutter (rejected for weaker SDK ecosystem + smaller talent pool for this integration-heavy app).
- **Backend:** Supabase/Postgres. Runner-up: Firebase (rejected for relational mismatch + unpredictable per-operation pricing).
- **Auth/Storage:** Supabase Auth + Storage with RLS.
- **Payments:** RevenueCat (StoreKit 2 + Play Billing).
- **Affiliate:** ShopMy OAuth API; Skimlinks/Sovrn fallback.
- **Analytics/Flags:** PostHog. Crashes: Sentry.
- **AI:** On-device (Vision / ML Kit) for capture; cloud vendor optional, later.
- **Widgets:** expo-apple-targets + expo-widgets (iOS), Glance (Android).

**System architecture narrative:** RN/Expo client ↔ Supabase (Postgres + Auth + Storage + Edge Functions, RLS-enforced) for routines, ingredient/product catalog, conflict engine, and photo metadata; photos captured + face-detected on-device, encrypted, uploaded to Supabase Storage only on opt-in; RevenueCat SDK in-client with webhooks → Supabase Edge Function to grant entitlements; ShopMy OAuth API for creator stacks, with affiliate webhooks → Edge Function for attribution; PostHog SDK for analytics/flags; Sentry for crashes. Optional Phase-2 cloud AI sits behind a consent gate as a separate service called from an Edge Function.

**Cost model (infra + services, monthly, order-of-magnitude):**

- 10K MAU: Supabase ~$25–50; RevenueCat free (<$2.5K rev) or ~1% of revenue; PostHog free–$50; Sentry ~$26; total roughly $100–200.
- 100K MAU: Supabase ~$100–200; RevenueCat ~1% of revenue; PostHog ~$200–400; Sentry ~$80–150; storage/egress ~$50–150; total roughly $600–1,200 + RevenueCat's revenue share.
- 500K MAU: Supabase ~$1,000–2,000 (MAU overage $0.00325/MAU + compute + egress); PostHog ~$500–1,000+; Sentry ~$300+; total roughly $3,000–5,000 + RevenueCat revenue share.

**Build order for the 15 feature documents:** (1) Auth + data model + RLS; (2) Ingredient/product DB pipeline + conflict engine; (3) AM/PM routine builder; (4) Smart shelf (PAO/expiration); (5) Actives/skin-cycling scheduler; (6) Guided photo capture + slider comparison; (7) Reminders/streaks/widgets; (8) Subscriptions/paywall (RevenueCat); (9) Personalized recommendations; (10) Creator stacks + ShopMy; (11) Community layer; (12) AI trend analysis (last).

## Recommendations

1. **Commit to React Native + Expo + Supabase + RevenueCat now.** Validate with a one-week spike building three POCs (guided camera capture, RLS-protected photo upload, RevenueCat paywall) before locking in.
2. **Build the ingredient data pipeline and conflict rules engine early (doc #2)** — it's the moat and the longest pole. Curate top 2,000 products + 30–60 conflict pairs with evidence grades.
3. **Ship guided capture + slider comparison with zero AI claims at launch.** Defer cloud skin analysis until you can do it with consent and fairness validation.
4. **Stand up the MHMDA-compliant privacy architecture from line one** (standalone health-data policy, granular consent, on-device-first photos). This is cheaper than retrofitting and is a marketing asset.
5. **Default to StoreKit/Play IAP; add RevenueCat Web Purchase Button as an experiment**, monitoring the post-Epic commission ruling. **Threshold to revisit:** if the district court sets a US external-link commission below ~10%, aggressively shift to web checkout; if it lands near 27% (parity with IAP), keep IAP primary.
6. **Use PostHog for analytics + flags + experiments** to avoid tool sprawl; wire RevenueCat → PostHog for subscription cohorts.

**Benchmarks that would change these recommendations:** if guided-capture frame-processing performance proves unacceptable in RN (validate in the spike), reconsider Flutter or native iOS for the camera module; if Supabase egress at scale exceeds projections, move photo storage to Cloudflare R2/S3 behind signed URLs; if the US external-link commission settles high, abandon web checkout.

## Caveats (confidence flags)

- **Ingredient-conflict evidence is genuinely contested.** Reputable sources (Paula's Choice) argue the retinol × AHA/BHA and niacinamide × vitamin C "conflicts" are myths or overstated. Every rule must carry an evidence grade and a non-alarmist resolution. _Medium-low confidence on specific pairs; high confidence on the "curated rules engine, not ML" architecture._
- **Cross-platform benchmark numbers come largely from vendor/agency blogs**, not neutral labs; treat specific fps/ms figures as directional. _Medium confidence._
- **Commercial skin-analysis vendor pricing is not public** and none publish independent accuracy benchmarks — any cloud-AI cost line is unknown until you request quotes. _Low confidence on cost._
- **The US external-purchase-link commission is legally unsettled** (on remand April 2026, Apple seeking Supreme Court review) — the commission-free window could close. _Low confidence on durability._
- **Monk Skin Tone scale itself "requires further validation"** per npj Digital Medicine; don't over-promise fairness. _Medium confidence._
- **MVP timeline (5–7 months)** assumes 4–6 genuinely senior engineers and no major scope creep; the conflict-data curation and compliance work are the most common sources of slippage. _Medium confidence._
- **Google Play's exact OTA policy clause was not fully verified**; confirm against Google Play's Device and Network Abuse policy before relying on aggressive OTA cadence. _Low confidence._
- **Apple's newer Swift-async Vision API** may now be the recommended path over the `VN`-prefixed classes; verify current Apple docs at build time. _Medium confidence._
