# User Flow Tree

This file maps human-simulated E2E branches for Layerwell. Update it before testing a UI feature. Cover Critical branches first, then Important, then Nice.

## Surface Inventory

- Primary surface: Expo React Native mobile app in `apps/mobile`.
- Primary commands:
  - `npm --workspace apps/mobile run ios`
  - `npm --workspace apps/mobile run android`
  - `npm --workspace apps/mobile run start`
- Secondary web command: `npm --workspace apps/mobile run web`
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/`
- Device/layout support policy: `docs/DEVICE_SUPPORT_POLICY.md`.
- Release scope is iOS all-features. Android commands, layouts, and historical
  evidence below are cross-platform resilience work only; they are not launch
  acceptance gates. Google OAuth is tested as an iPhone sign-in provider. No
  Google Play or Play Billing evidence is required for this iOS release.
- Launch-blocking Expo web floor: 360 x 640. 320-wide browser viewports and
  sub-640 browser-only heights are resilience stress audits unless a supported
  native device, keyboard/Dynamic Type state, or store-review requirement
  reproduces the same issue.
- Durable local evidence gate: `npm run e2e:human:manifest` verifies committed
  Expo web-compatible support-floor evidence, requires the 360 x 640 / 200%
  text-pressure pass, requires supported-phone 360 / 375 / 390 / 412 / 414 /
  430 px direct-entry evidence, requires skipped/direct-entry onboarding,
  paywall, recovery, conflict, share, shelf, and progress sweeps when
  available, records smaller 320-wide stress evidence when available, and writes
  `docs/e2e/generated/human-e2e-manifest.{json,md}`.
  Native simulator/device automation remains an Open Question.
- Historical entries below may include evidence captured before the current
  360 x 640 floor. Treat 320-wide browser evidence as stress/resilience
  evidence unless elevated by supported physical-device, accessibility,
  app-review, beta, or support data.

## Known App Areas From Route Inspection

- Onboarding: age, consent, goals, quiz, products, notifications, analyzing, reveal, account, paywall. Goals are health-purpose input and may not mount before a current health-data grant.
- Tabs: Today, Shelf, Progress, You.
- Shelf flows: search, scan, OCR, no match, manual add, opened date, catalog-match recovery, catalog reporting, replenish, archive, product detail.
- Progress flows: photo capture/review, timeline, progress detail.
- Settings/account flows: subscription, timing, privacy/local data, account actions.
- Growth and sharing flows: share cards and conflict screens.
- Trend, community, commerce, and Ask surfaces.

## Flow: App Private Data Availability

- Goal: A user never sees encrypted local state misrepresented as empty/default when the shared private-data key is unavailable.
- Persona: Returning user with local profile, shelf, routine, completion, preference, entitlement, or Progress records.
- Entry state: The app has resolved auth and the app-lock preference; encrypted private records may be readable, temporarily unavailable, missing their key, malformed, or unable to authenticate.
- Start screen/URL/window: Cold or foreground entry to any app route.
- Success state: App content mounts only after a read-only audit verifies every private-KV envelope; transient failure remains non-destructive and retryable.
- Priority: Critical
- Automate later: Yes
- Surface: iOS and Android; Expo web for provider ordering, route blocking, retry, and responsive recovery.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/private-data-availability-current/`

### Path A: Readable Private Data

1. Action: Open or foreground the app after any configured app-wide authentication succeeds.
   Expected result: The app performs a non-creating readability audit, ignores unrelated/legacy plaintext and separately keyed Supabase session envelopes, then mounts Offline Sync and the intended route. App-lock authentication remains before the audit, and Progress timeline authentication remains after the audit.
   Evidence: Provider-order contract, private-KV unit tests, route snapshot, and native secure-storage access log.

### Branches

- Branch: shared encrypted private data unavailable
  - Priority: Critical
  - Automate later: Yes
  - Action: After encrypted private records exist, force the shared SecureStore/Keychain/Keystore content-key read to fail; cold-open representative `/today`, `/shelf`, `/routine/plan`, `/settings/privacy`, and `/progress` routes at supported phone sizes. Retry once while failure persists, then repeat with one-shot failure and restored key access. Repeat after app background/foreground and with app lock enabled.
  - Expected result: App-wide recovery appears only after app unlock and before Offline Sync, navigation, tabs, route queries, local mutations, or sensitive/default route copy mounts. It exposes no raw error or ciphertext, retains a 56 pt retry after repeated failure, has no horizontal overflow, emits no analytics/backend request, and leaves every encrypted envelope byte-identical. A successful retry mounts the originally requested route. Foreground return rechecks availability before content can reappear. Missing-key/wrong-key states never create replacement key material; explicit local-data deletion remains the only destructive recovery.
  - Evidence: Persistent failure screenshots and visible-text/role snapshots across representative routes at 360 x 640 and 390 x 844, one-shot retry screenshot, app-lock ordering sequence, foreground recheck, control geometry, dialog/page-error/browser logs, vendor request log, ciphertext hash/unit evidence, and physical iOS/Android fault-injection logs.
  - Current evidence: `assertPrivateKVReadable` scans all private envelopes without creating or returning key material, while `PrivateDataAvailabilityGate` sits inside `AppLockProvider` and outside Offline Sync/navigation. Focused storage/provider contracts prove missing-key failure preserves every envelope and unrelated keyed envelope formats are ignored. The 2026-07-10 Expo web run passed persistent failure on five representative routes at 360 x 640 and 390 x 844, one-shot recovery, foreground recheck with exact-route restoration, and rejected app-lock ordering. Every seeded ciphertext/key hash remained byte-identical and no sensitive vendor request occurred. Physical iOS Keychain and Android Keystore fault injection remains Tas QA.
- Branch: malformed or unsupported private envelope
  - Priority: Critical
  - Automate later: Yes
  - Action: Place truncated, wrong-shaped, bad-hex, unknown-version, and arbitrary-`keyId` envelopes under app-owned private keys. Repeat with an unrelated legacy nonce/ciphertext payload and a real Supabase auth-storage key. Cold-open Shelf at 360 x 640 and 390 x 844, retry while corruption remains, then restore or explicitly remove the fixture and retry.
  - Expected result: App-owned malformed/future envelopes block before navigation or Shelf content mounts, remain byte-identical across reads and retries, count as orphaned ciphertext when the content key is absent, and cannot be overwritten by a fallback or concurrent write. Unrelated legacy values remain readable; known Supabase auth keys stay under the auth authority and are never returned through private-KV APIs. Restoring or explicitly removing the affected record lets retry mount the original route.
  - Evidence: Focused parser/audit/orphan/write-conflict tests plus screenshots, SHA-256 snapshots, browser logs, request logs, and recovery result at `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/`. Physical native storage corruption remains Tas QA.
- Branch: malformed app-lock preference
  - Priority: Critical
  - Automate later: Yes
  - Action: Cold-open a data-bearing route with a malformed plaintext or encrypted app-lock preference. Inspect the initial state, then choose `Unlock and reset app lock`; repeat with device authentication unavailable, cancelled, failed, and successful.
  - Expected result: No route content, tabs, private-data recovery, or automatic biometric prompt appears before the explicit recovery action. The malformed preference remains unchanged after load and failed/cancelled authentication. The screen explains that only app-lock settings will reset. Successful device authentication removes only that preference, leaves every other private record untouched, and then mounts the requested route. Generic key/decryption failures do not offer destructive preference reset.
  - Evidence: Store/provider contracts and the real web malformed-preference authenticated reset at `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/`; native prompt/cancel/failure/accessibility evidence remains Tas QA.

## Flow: Bottom Tab Navigation

- Goal: A user can always read and tap the primary app destinations from the floating bottom tab bar.
- Persona: Returning mobile user moving between Today, Progress, Shelf, and You.
- Entry state: App opened on any main tab with local or fixture data.
- Start screen/URL/window: Today tab or any `(tabs)` route.
- Success state: All four tab labels and icons are visible, centered, and tappable without clipping on phone widths.
- Priority: Critical
- Automate later: Yes
- Surface: iOS and Android first; Expo web for responsive visual checks.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/navigation/`
- Current local evidence: `test-results/human-e2e/2026-07-07/navigation-current/`

### Path A: Main Tab Switching

1. Action: Open the app on a small phone viewport, inspect the floating tab bar, then switch between Today, Progress, Shelf, and You.
   Expected result: Each tab remains reachable and visibly selected when active.
   Evidence: Screenshot and tab geometry snapshot.
   Current local evidence: 2026-07-07 Chrome CDP Expo web run at 320 x 568 and 390 x 568 starts on `/today`, clicks Progress, Shelf, and You through the floating tab bar, and verifies exactly one selected tab after each switch, all four visible labels, 54 px tab targets, center hit-tests inside each tab, zero horizontal overflow, no non-tab controls in the floating-bar zone, and zero browser console errors.
   Current polish evidence: 2026-07-08 headless Chrome Expo web at 320 x 568 and 390 x 568 caught PM Today's floating tab bar sitting over a light scene-clearance band even though the dark screen was active. After the route-aware scene background fix, PM Today samples dark behind the bar, Progress/Shelf/You sample paper, all labels remain visible, exactly one tab is selected after each switch, centers hit the expected tab, targets are 54 px tall, and horizontal overflow is zero. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/`.
   Current resume evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 and 390 x 568 re-opened `/today`, clicked Progress, Shelf, You, and Today from the floating bar, verified exactly one selected tab after each switch, 53.99 px tab targets, center hit-tests resolving to the intended tab, zero horizontal overflow, no non-tab controls in the bar zone, and only expected local placeholder warnings. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-resume-current/`.
   Current label-geometry evidence: 2026-07-08 headless Chrome Expo web at 320 x 568 and 390 x 568 opened Today, Progress, Shelf, and You by route to verify selected-state geometry, exactly one selected tab in each state, all tab centers hit the intended tab, labels stay inside their tab frame with 19 px line boxes, horizontal overflow is zero, and no unexpected browser warn/error logs were recorded. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-geometry-current/`.
   Current interactive evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 and 390 x 568 clicked Today, Progress, Shelf, and You through the floating bar, verified exactly one selected tab after each switch, 54 px tab targets, 19 px label boxes, center hit-tests resolving to each intended tab, zero horizontal overflow, and zero browser warn/error logs. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-interactive-current/`.
   Current supported-polish evidence: 2026-07-09 headless Chrome Expo web re-ran the durable tab bar geometry gate after the active-pill polish at 320 x 568 stress width plus 360 x 640, 375 x 667, 390 x 844, 412 x 915, and 430 x 932 supported-phone viewports. The app renders Today, compact visible `Prog.`, Shelf, and You labels through the 430 px compact-phone band, keeps the active capsule inset instead of filling a whole tab slot, and preserves the full `Progress tab` accessibility label. The pass verifies exactly one selected tab on each routed tab state, 66 px pill bar height, 54 px tab targets, direct one-line labels, center hit-tests resolving to every tab, zero horizontal overflow, only expected local placeholder warnings, and no focused 412 x 915 / 200% route-audit tab-label issue because role=`tab` labels are verified by the dedicated tab-bar harness. Evidence and bug report are in `test-results/human-e2e/2026-07-09/navigation-tabbar-supported-polish-postfix2/`, `test-results/human-e2e/2026-07-09/tabbar-polish-412-pressure-postfix2/`, and `docs/e2e-bug-reports/2026-07-09-tabbar-supported-polish-progress-overflow.md`.

### Branches

- Branch: compact phone width coverage
  - Priority: Critical
  - Automate later: Yes
  - Action: Render the tab bar at 320 px stress width plus 390 px and 412 px supported phone viewports.
  - Expected result: Today, `Prog.`, Shelf, and You labels render on one line inside the floating bar through the compact-phone band, with the full `Progress tab` accessibility label, no clipped glyphs, no text overlap, and at least 44 pt tap targets.
  - Evidence: Phone-width screenshots and DOM/native geometry snapshot.
  - Current local evidence: 2026-07-07 Chrome CDP Expo web screenshots and geometry snapshots at 320 x 568 and 390 x 568 show Today, Progress, Shelf, and You labels inside their tab bounds, all tab targets at least 54 px tall, tab widths 75.5 px at 320 and 93 px at 390, and no horizontal overflow.
  - Current polish evidence: 2026-07-08 headless Chrome screenshots confirm the Wealthsimple-style white floating bar remains readable while PM Today now keeps the surrounding bottom clearance dark instead of showing a light slab.
  - Current resume evidence: 2026-07-08 in-app browser screenshots and geometry snapshots confirm Today, Progress, Shelf, and You labels remain visible at 320 x 568 and 390 x 568, with tab widths of about 75.6 px and 93.1 px respectively, 53.99 px heights, successful center hit-tests, and zero horizontal overflow.
  - Current label-geometry evidence: 2026-07-08 headless Chrome Expo web screenshots and snapshots confirm Today, Progress, Shelf, and You labels remain inside their tab frames in each selected route state at 320 x 568 and 390 x 568, with tab widths of about 75.5 px and 93 px, 54 px target heights, 19 px label boxes, successful center hit-tests, and zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-geometry-current/`.
  - Current interactive evidence: 2026-07-08 in-app browser screenshots and geometry snapshots confirm tab clicks keep Today, Progress, Shelf, and You selected states accurate at 320 x 568 and 390 x 568, with tab widths of about 75.6 px and 93.1 px, 54 px target heights, 19 px label boxes, successful center hit-tests, zero horizontal overflow, and zero browser warn/error logs. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-interactive-current/`.
  - Current supported-polish evidence: 2026-07-09 headless Chrome Expo web screenshots and JSON snapshots confirm Today, `Prog.`, Shelf, and You render as direct one-line visible labels at 320 x 568, 360 x 640, 375 x 667, 390 x 844, 412 x 915, and 430 x 932, with `Progress tab` preserved as the accessibility label. The rerun reports 54 px tab targets, successful center hit-tests, exactly one selected tab per route state, zero horizontal overflow, and only expected local placeholder warnings. The focused 412 x 915 / 200% pressure recheck also reports zero route-audit issues after role=`tab` labels were left to the dedicated tab-bar geometry harness, matching their native max-font-scale cap. Evidence is in `test-results/human-e2e/2026-07-09/navigation-tabbar-supported-polish-postfix2/` and `test-results/human-e2e/2026-07-09/tabbar-polish-412-pressure-postfix2/`.
- Branch: content clearance beneath floating tab bar
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Today at 320 px and 390 px phone viewports with the contextual SPF prompt or empty-routine CTA visible.
  - Expected result: No visible CTA, prompt control, or inactive locked-paywall compliance control sits partially underneath the floating tab bar; controls either sit fully above the bar or require a deliberate scroll into view, with enough visual separation to keep the floating bar feeling intentional.
  - Evidence: Phone-width screenshots, hit-test snapshot, and control geometry.
  - Current local evidence: 2026-07-07 Chrome CDP Expo web checked `/today`, `/progress`, `/shelf`, and `/you` at 320 x 568 and 390 x 568; the DOM geometry snapshot found no non-tab visible controls intersecting the floating tab-bar zone.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 first swept 41 routes in `test-results/human-e2e/2026-07-08/short-phone-480-route-audit-6/`, then tightened `/today` empty-routine compact spacing after the `Add products` CTA looked crowded near the floating bar. Post-fix `/today` shows `Add products` at 230 x 56 px, y=314-370, with 37 px clearance above the floating tab bar, correct center hit-test, and zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/today-empty-short-phone-480-clearance/`.
  - Current retained 320-wide stress empty-state evidence: 2026-07-09 Codex in-app browser Expo web reverified `/today?routine=AM` at 320 x 480 after the tighter empty-routine card treatment. The short stress-floor card keeps `Build a routine from your shelf.` and hides lower helper copy, renders `Add products` as a complete 238 x 56 px button at y=155-211 with 196 px clearance above the floating tab bar, reports zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, and zero unexpected current-origin logs, and tapping `Add products` routes to `/shelf/manual`. Evidence and report are in `test-results/human-e2e/2026-07-09/today-empty-support-floor-current/`.
  - Current shelf/paywall evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 found `/shelf` empty-state `Add by hand` hidden under the floating tab bar and direct `/paywall/upsell?feature=full_routine` `Maybe later` clipped below the viewport. Post-fix `/shelf` shows `Scan a barcode` at 256 x 56 px and `Add by hand` at 256 x 48 px with center hit-tests landing on the buttons, 31 px clearance above the tab bar, and `Add by hand` routing to `/shelf/manual`; the paywall shows `Maybe later` at 264 x 48 px inside the viewport and tapping it dismisses to `/today`. Evidence is in `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/`.
  - Current Progress evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 found `/progress` empty-state `Take my first photo` rendered at y=349-405 with only about 2 px of clearance before the floating tab bar. Post-fix it renders at 272 x 52 px, y=315-367, with 33.6 px clearance, the center hit-tests to `Take my first photo`, tapping routes to `/progress/capture`, and horizontal overflow stays zero. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/` and `docs/e2e-bug-reports/2026-07-08-progress-empty-short-phone-clearance.md`.
  - Current Progress paywall evidence: 2026-07-08 bundled Playwright Chrome Expo web at 320 x 480 reproduced the free `/progress` contextual photo paywall legal controls sitting under the floating tab bar in the pre-fix route sweep, then verified the shared compact-header ProGate fix. Post-fix `/progress` has Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first visible and hit-testable, with zero target issues, zero visible-control issues, zero horizontal overflow, zero JavaScript dialogs, and no unexpected browser logs. Evidence and report are in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/` and `docs/e2e-bug-reports/2026-07-08-progate-short-phone-compliance-clipping.md`.
  - Current 320 x 430 Progress paywall evidence: 2026-07-08 Codex in-app browser Expo web reproduced `/progress` free-user `Explore first` sitting in the floating tab-bar hit zone after the shelf 430 px fixes. Post-fix, ProGate uses a sub-460 px density band that preserves Terms, Privacy, Restore, Maybe later, annual price, store-unavailable reason, and Start free trial with zero geometry issues on `/progress`; lower-priority `Explore first` is allowed to drop out of the sub-460 px first viewport. The follow-up 49-route sweep no longer reports Progress failures. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/`, `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postprogress-sweep/`, and `docs/e2e-bug-reports/2026-07-08-progress-progate-short-phone-430-clearance.md`.
  - Current split-short phone evidence: 2026-07-08 Codex in-app browser Expo web stress-tested the current route set at 320 x 390 after the 430 px clearance pass. Post-fix, Ask, Shelf, contextual paywall, Recommendations, Skin Notes, and Settings notifications keep visible controls fully readable and hit-testable, with lower-priority controls deliberately below the first viewport until scroll. Focused evidence covers 11 routes with zero clipped or blocked controls and successful taps for Progress-photo nudge, scan Close, Shelf Add by hand, Maybe later, Ask conflict prompt, Skin Note open, Recommendation open, Drugstore budget chip, OCR manual continuation, and no-match Add it by hand. The follow-up 49-route 320 x 390 sweep reports zero failed routes. Latest 320 x 390 / 120% evidence also verifies the contextual upsell paywall keeps `Maybe later`, Terms, Privacy, Restore, and Start free trial complete and hit-testable in the split-short header/body layout. Evidence and report are in `test-results/human-e2e/2026-07-08/split-short-phone-390-clearance/`, `test-results/human-e2e/2026-07-08/current-main-split-short-phone-390-sweep-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/`, and `docs/e2e-bug-reports/2026-07-08-split-short-phone-390-clearance.md`.
  - Current 320 x 390 final resilience sweep: 2026-07-09 headless Chrome Expo web re-ran all 49 direct-entry routes on current `main` at 320 x 390 with scale 1.0. The split-short stress sweep reports zero failed routes, zero disallowed browser logs, and no visible clipped, sub-44, blocked-hit, or horizontal-overflow issues. Evidence and report are in `test-results/human-e2e/2026-07-09/current-main-split-short-phone-390-sweep-postfix/`.
  - Current full-route rerun evidence: 2026-07-08 bundled Playwright Chrome Expo web at 320 x 480 re-ran 49 current `main` direct-entry routes after the compact-route fixes. The sweep found zero failed routes, zero visible clipped controls, zero sub-44 user-facing controls, zero blocked hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-08/current-main-short-phone-480-rerun/`.
  - Current 320 x 480 final resilience sweep: 2026-07-09 headless Chrome Expo web re-ran all 49 direct-entry routes on current `main` at 320 x 480 with scale 1.0. The stress-only sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/current-main-short-phone-480-rerun/`.
  - Current 320 x 430 final resilience sweep: 2026-07-09 headless Chrome Expo web re-ran all 49 direct-entry routes on current `main` at 320 x 430 with scale 1.0. The stress-only sweep reports zero failed routes, zero disallowed browser logs, and no visible clipped, sub-44, blocked-hit, or horizontal-overflow issues. Evidence and report are in `test-results/human-e2e/2026-07-09/current-main-short-phone-430-final-clearance-sweep/`.
- Branch: PM Today scene background
  - Priority: Important
  - Automate later: Yes
  - Action: Open Today in the PM routine state at 320 px and switch away to another tab.
  - Expected result: The Today tab scene uses the night background behind the PM route, while non-Today tabs keep the paper background so there is no paper strip or flash around the night Today surface.
  - Evidence: Phone-width screenshot, route snapshot, and computed background colors.
  - Current local evidence: 2026-07-08 headless Chrome Expo web at 320 x 568 and 390 x 568 verified PM Today uses dark bottom-scene samples around the floating tab bar after the fix, Progress/Shelf/You use paper samples, tab labels and hit targets remain correct, exactly one tab is selected, and horizontal overflow is zero. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/`.
- Branch: keyboard or text-scale pressure
  - Priority: Important
  - Automate later: Yes
  - Action: Open a screen with keyboard input or increased platform text scale where the harness supports it.
  - Expected result: The tab bar hides when the keyboard is open and labels keep readable geometry when visible again.
  - Evidence: Screenshot or simulator UI snapshot.
  - Current local status: Desktop Chrome still does not emit native React Native `Keyboard` show/hide events for the floating tab bar, and the in-app browser blocked JavaScript URL text-scale mutation during the post-fix rerun. However, the 2026-07-08 320 x 568 / 118% text-pressure audit caught `/progress` paywall Terms, Privacy, and Restore under the floating tab bar; the ProGate fix now promotes compact Progress photo paywalls into the header compliance treatment, and post-fix in-app browser geometry verifies `/progress`, `/progress/capture`, and `/progress/review` keep Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first visible, 48 px+, and center-hit-testable. Evidence and report are in `test-results/human-e2e/2026-07-08/text-scale-120-compact-audit/`, `test-results/human-e2e/2026-07-08/progress-progate-text-pressure-postfix/`, and `docs/e2e-bug-reports/2026-07-08-progress-progate-text-pressure-tabbar-overlap.md`. Native simulator/device keyboard and Dynamic Type QA remain open.
  - Current 120% route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran 49 current routes at 320 x 568 with 120% text pressure after compact-density fixes for settings, shelf no-match, paywall, ProGate, and Recommendation Preferences. The sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-route-audit-compact-clipping.md`. Native simulator/device keyboard and Dynamic Type QA remain open.
  - Current 120% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route 120% text-pressure audit at 320 x 568, retained 320 x 480 stress, 390 x 844, and 430 x 932 viewports. The follow-up reproduced clearance issues in `/shelf/no-match`, `/settings/notifications`, `/settings/privacy`, `/shelf/manual`, `/community`, and `/recommendations/preferences`; post-fix, lower-priority recovery, policy, promotional, texture, and note-section controls either stay complete or start below the first viewport. All four final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`. Native simulator/device keyboard and Dynamic Type QA remain open.
  - Current 170% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route 170% text-pressure audit at 320 x 568, retained 320 x 480 stress, 390 x 844, and 430 x 932 viewports. The current-source follow-up reproduced `/settings/privacy` direct-entry rows peeking into the floating-tab zone, `/today?routine=PM` putting the empty-routine `Add products` CTA under the floating tab bar, 430 x 932 policy/paywall compliance controls, `/recommendations/preferences` texture chips, and `/shelf/no-match` recovery controls peeking at the viewport bottom, plus 390 x 844 Explore-first paywall copy/target pressure. Post-fix, direct privacy entries omit unrelated reminder rows, destructive and policy privacy actions stay below the first viewport, Today short-phone empty states keep the primary CTA complete above the bar, Recommendation Preferences and Shelf no-match defer lower-priority tall-phone controls below the first viewport, and contextual ProGate paywalls use compact header compliance plus shorter visible Explore-first copy with the full copy retained in the accessibility label. Final sweeps at 320 x 568, 320 x 480, 390 x 844, and 430 x 932 report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-compact-568-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-390-postfix-6/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-170-supported-phone-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 375 x 812 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit for a supported iPhone-class viewport. The current-source sweep reproduced a partial Recommendation Preferences `Oil` texture chip and a partial Notification Settings `Progress-photo nudge` switch at the bottom edge. Post-fix, Recommendation Preferences defers the lower-priority texture group below the first viewport and Notification Settings defers the third gentle-nudge control into its own below-fold card. The focused two-route rerun and final 49-route sweep report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-focused-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-iphone-375-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 375 x 667 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit for a shorter supported iPhone-class viewport. The first sweep reproduced the `/progress` contextual paywall's lower-priority `Explore first` card visible in the floating tab-bar hit zone, with its center resolving to the surrounding paywall wrapper instead of the button. Cache-cleared follow-ups also exposed lower-priority Recommendation Preferences, Shelf Manual, and Skin Notes controls peeking into the bottom edge. Post-fix, the support-floor Progress paywall keeps the primary purchase path and compliance controls complete while deferring `Explore first` below the first viewport, Recommendation Preferences and Skin Notes push lower-priority cards below the first viewport, and compact Shelf Manual keeps the first screen focused on essential name, brand/category, and Continue controls. Focused reruns plus the final cache-cleared 49-route sweep report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and reports are in `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-progress-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-prefs-shelf-postfix4-clear/`, `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-community-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix3-clear/`, `docs/e2e-bug-reports/2026-07-09-text-pressure-200-iphone-375-667-progress-paywall.md`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-iphone-375-667-follow-up-clearance.md`. Native simulator/device safe-area, screen-reader, store-sheet, keyboard, and Dynamic Type QA remain open.
  - Current 360 x 600 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit for a short Android-class viewport. The current-source sweep reproduced `/recommendations/preferences` exposing `Sustainable` as a 24 px partial target; after the first fix, the full rerun exposed the Budget chips as 8 px partial targets. Post-fix, 414 px-and-narrower 600-639 px text-pressure layouts keep the first three values complete and defer lower value and budget controls below the first viewport. The focused preferences rerun and full 49-route sweep report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-preferences-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-postfix2/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-360-600-text-pressure.md`. Native simulator/device safe-area, screen-reader, keyboard, and Dynamic Type QA remain open.
  - Current 360 x 740 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit for a supported Android-class mid-height viewport. The current-source sweep reproduced `/settings/notifications` exposing only 4 px of the lower-priority `Replenishment` switch at the bottom edge. Post-fix, the 360/390-wide 700-779 px text-pressure band pushes Gentle Nudges below the first viewport while keeping the primary morning/evening reminder controls complete. The focused notification rerun and full 49-route sweep report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-notifications-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-postfix/`, and `docs/e2e-bug-reports/2026-07-09-settings-notifications-android-360-740-text-pressure.md`. Native simulator/device safe-area, screen-reader, notification permission, and Dynamic Type QA remain open.
  - Current 360 x 700 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced the exact-height support-floor boundary where `/community` exposed a Sensitive Skin note as a 22 px partial target and `/shelf/scan` exposed `Add it by hand` as a 24 px partial target. Post-fix, the support-floor guards include height 700, and the full 49-route rerun reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-360-700-boundary.md`. Native simulator/device safe-area, screen-reader, camera, and Dynamic Type QA remain open.
  - Current 430 x 700 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced the exact-height Recommendation Preferences boundary where `Drugstore`, `Mid-range`, and `Premium` budget chips were 36 px partial targets at the viewport bottom. Post-fix, the support-floor preferences guard includes height 700, deferring lower-priority value and budget chips below the first viewport. The full 49-route rerun reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-700-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-700-postfix/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-430-700-text-pressure.md`. Native simulator/device safe-area, screen-reader, keyboard, and Dynamic Type QA remain open.
  - Current 390 x 740 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced `/settings/notifications` exposing only 1 px of the lower-priority `Streak & adherence` switch at the viewport bottom, then exposed direct `/paywall/upsell?feature=full_routine` `Start free trial` as a 19 px partial target after the notification fix. Post-fix, the 700-779 px notification text-pressure band pushes Gentle Nudges below the first viewport, and the 390-wide direct upsell sheet uses the short paywall layout with header compliance so the primary CTA is complete. The focused notification rerun, focused upsell rerun, final full 49-route 390 x 740 sweep, and 360 x 740 regression sweep report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-notifications-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-upsell-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-390-740-clearance.md`. Native simulator/device safe-area, screen-reader, notification permission, store-sheet, and Dynamic Type QA remain open.
  - Current 430 x 740 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced direct `/settings/privacy` exposing the `Privacy policy` row with its center blocked by the floating Shelf tab at y=697. Post-fix, the 430-wide 700-779 px direct privacy entry pushes the policy card below the first viewport while preserving complete Marketing and health-data controls above the bar. The focused privacy rerun, full 49-route 430 x 740 sweep, and focused 430 x 932 privacy regression report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-privacy-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-932-privacy-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-settings-privacy-430-740-text-pressure.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 360 x 780 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit for a supported Android-class mid-height phone. The current-source sweep reproduced reverse-trial ProGate body overflow in `/routine/reorder`, a partial Recommendation Preferences texture chip, and a follow-up `/progress` compliance-row hit-test failure near the floating tab bar. Post-fix, supported-width reverse-trial copy can wrap, Progress photo paywalls use header compliance with a compact dismiss control, and Recommendation Preferences moves lower-priority texture chips below the first viewport. The final sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix2/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-mid-360-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 412 x 915 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit for a supported Android-class modern phone. The current-source sweep reproduced the floating tab bar full `Progress` label overflowing its own frame by 3 px on `/settings/privacy`; the follow-up full route sequence then exposed privacy direct-entry scroll state that could leave `Withdraw health-data consent` partly under the floating tab bar. Post-fix, the tab bar compacts the visible Progress label to `Prog.` through the compact-phone band while preserving the full `Progress tab` accessibility label, and privacy direct entries re-scroll from the freshly measured privacy-card Y. The later tab-bar polish pass extends that compact visible label through 430 px. The final sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero text overflow, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-postfix2/`, `test-results/human-e2e/2026-07-09/navigation-tabbar-geometry-412-current/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-412-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 412 x 844 / 200% boundary ProGate evidence: 2026-07-09 headless Chrome Expo web re-ran the focused Progress and contextual upsell route audit after extending dense contextual paywall treatment to the 391-430 px wide, 840-899 px tall text-pressure band. `/progress`, `/progress/capture`, `/progress/review`, and `/paywall/upsell?feature=full_routine` report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-progate-current/`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 412 x 844 / 200% Recommendation Preferences evidence: 2026-07-09 headless Chrome Expo web reproduced `/recommendations/preferences` budget chips peeking into the bottom edge as 26 px partial targets. Post-fix, the route defers lower-priority budget chips below the first viewport for the supported modern/tall text-pressure height band while keeping visible value chips complete and hit-testable. The focused rerun reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-postfix3/` and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-412-boundary-text-pressure.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 414 x 896 / 200% boundary route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced contextual ProGate CTA clipping on `/progress`, `/cycle/disruption`, and `/cycle/procedure`, then exposed Recommendation Preferences budget-chip peeking after the entitlement-loading wait fix. Post-fix, contextual paywalls and Recommendation Preferences use boundary/tall text-pressure density, and the final 49-route sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-postfix3/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-boundary-414-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 390 x 640 support-band 170% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit after support-band density guards for contextual ProGate paywalls, Recommendation Preferences, Shelf scan/manual, and Skin Notes. The pass reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-current/`. Native iOS Dynamic Type, safe-area, screen-reader, keyboard, camera, and store-sheet QA remain launch-device gates; Android is compatibility follow-up.
  - Current 412 x 640 support-band 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the full 49-route text-pressure audit for a 412-wide Android-class viewport at the shortest supported 640 px height. The pass reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-640-current/`. Native iOS Dynamic Type, safe-area, screen-reader, keyboard, camera, and store-sheet QA remain launch-device gates; Android is compatibility follow-up.
  - Current 430 x 640 support-band 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced `/recommendations/preferences` Texture chips as partial targets, `/community` exposing a Sensitive Skin note as a partial target, and `/settings/privacy` exposing a policy row with a blocked center; follow-up full reruns then exposed lower value chips in Recommendation Preferences and a Shelf Scan fallback row whose center hit the camera-helper layer. Post-fix, 430-wide support-floor guards cover Recommendation Preferences, Skin Notes, Settings Privacy, and Shelf Scan, with lower-priority controls pushed below the first viewport. The focused reruns, final full 49-route 430 x 640 sweep, and affected-route 390 x 640 regression report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-focused-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-preferences-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-scan-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-640-affected-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-430-640-text-pressure.md`. Native iOS Dynamic Type, safe-area, screen-reader, keyboard, camera, and store-sheet QA remain launch-device gates; Android is compatibility follow-up.
- Current onboarding/paywall/detail support-band evidence: 2026-07-09 headless Chrome Expo web re-ran the focused 390 x 640 / 170% text-pressure route audit for `/onboarding/age`, `/onboarding/goals`, `/onboarding/products`, `/onboarding/paywall`, `/paywall/downgrade`, and the missing Shelf detail route after extending compact support-band guards. The pass reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-onboarding-paywall-detail-current/`. Native iOS Dynamic Type and safe-area QA remain launch-device gates; Android is compatibility follow-up.
- Current 430 x 640 onboarding/paywall support-band evidence: 2026-07-09 headless Chrome Expo web re-ran the focused 200% text-pressure route audit for `/onboarding/age`, `/onboarding/goals`, `/onboarding/products`, `/onboarding/paywall`, and `/paywall/downgrade` after extending those compact guards through 430 px width. The pass reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-onboarding-paywall-430-640-current/`. Native iOS Dynamic Type, safe-area, keyboard, screen-reader, and store-sheet QA remain launch-device gates; Android is compatibility follow-up.
- Current 390 x 844 onboarding products 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web re-ran focused `/onboarding/products` after extending its compact footer/category behavior to modern 390-wide, tall supported-phone text-pressure layouts. The route reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, zero text overflow, and zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-onboarding-products-390-844-current/`. Native iOS Dynamic Type, safe-area, keyboard, and screen-reader QA remain launch-device gates; Android is compatibility follow-up.
  - Current retained 320 x 480 stress-floor 100% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route audit at 320 x 480 after adding the native support-floor config contract and direct-entry density guards. Post-fix, `/ask`, `/community/note/missing-note-e2e`, `/recommendations/stale-local-rec`, `/settings/privacy`, `/settings/subscription`, `/shelf/no-match`, and `/shelf/opened` keep visible controls complete, center-hit-testable, and 44 px+, with lower-priority actions either complete above chrome or deliberately below the first viewport until scroll. The final sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-480-config-spacing-guard/`. Native iOS/Android safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current retained 320 x 480 stress-floor 170% / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit at 320 x 480 after current-source fixes for Settings Privacy, Settings Subscription, Recommendation Preferences, Ask, Shelf no-match, Community missing-note recovery, and stale Recommendation detail. Post-fix, compact stress-floor routes use shorter visible labels with full accessibility labels retained, suppress nonessential hints/subtitles, compact policy and restore rows, keep the destructive privacy action complete, show only the essential Shelf no-match recovery actions, and shorten the Recommendation Preferences heading. Final sweeps at 200% and 170% report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-support-floor-480-postfix-12/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-16/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-support-floor-480-clearance.md`. Native iOS/Android safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 140% route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route 320 x 568 compact phone sweep at 140% text pressure. The audit reproduced direct upsell CTA clipping, ProGate routine paywall compliance overlap/monthly-price overflow, and Recommendation Preferences chip groups peeking as partial targets. Post-fix, direct upsell and ProGate use a 320 px narrow-short density tier with icon dismiss, hidden nonessential body copy, hidden monthly-equivalent labels, and tighter price/CTA blocks; Recommendation Preferences keeps visible chips 48 px and moves lower chip groups below the first viewport. The final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-3/`, `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-7/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-140-compact-568-clearance.md`. Native simulator/device Dynamic Type remains open.
  - Current 150% split-short route-audit evidence: 2026-07-08 headless Chrome Expo web passed the 49-route 320 x 568 and 320 x 430 sweeps at 150% text pressure, then reproduced tighter 320 x 390 failures in Recommendation Preferences, Settings Notifications, Shelf manual add, Shelf scan, Shelf no-match, Ask, Community, and narrow tab labels. Post-fix, lower-priority value filters and notification controls move below the first viewport, manual-add Ingredients clears the fixed Continue footer, Shelf scan uses compact fallback rows, Shelf no-match and Ask use shorter compact visible copy with full accessibility labels preserved, Shelf skeleton filters match the loaded compact labels, Community pushes later narrow sections fully below the first viewport, the 320 px tab bar abbreviates only the visible Progress label, and rendered web chrome no longer emits the pointer-events warning. The final 320 x 390 / 150% sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-13/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-150-split-short-390-clearance.md`. Native simulator/device safe-area and Dynamic Type QA remain open.
  - Current 170% compact route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route 320 x 568 compact-phone sweep at 170% text pressure. The audit reproduced floating-tab `Progress` label overflow, Shelf filter clipping, Shelf no-match recovery peeking, and follow-up narrow-compact edge cases in Shelf scan/manual, Ask, Skin Notes, and missing-note recovery. Post-fix, compact visible labels preserve full accessibility labels, optional and lower-priority controls move fully below the first viewport, and Community recovery actions remain complete. The final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-170-compact-568-postfix-9/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-170-compact-568-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 200% compact route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route 320 x 568 compact-phone sweep at 200% text pressure. The audit reproduced partial controls in `/recommendations/preferences` and `/settings/notifications`, plus a `/settings/privacy` direct-entry row whose center was blocked by the floating tab bar. Post-fix, compact-short preference chips and notification nudges defer lower-priority controls below the first viewport, and privacy direct-entry scrolling clears the health-data consent row from the tab bar. The final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-200-compact-568-postfix/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-200-compact-568-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 320 x 430 / 200% route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route short-phone sweep at 200% text pressure. The audit reproduced a visible but disabled `/progress` paywall CTA in the preview store-unavailable state, a partial `Fragrance-free` chip in `/recommendations/preferences`, a partial `Streak & adherence` switch in `/settings/notifications`, and a follow-up partial `Add by hand` recovery button in `/shelf/search`. Post-fix, ProGate keeps the primary CTA tappable while purchase work is not pending so the store-unavailable feedback path can run, Recommendation Preferences pushes the first value-chip group clear of the bottom edge, Notification Settings moves Gentle Nudges below the ultra-short first viewport, and Shelf catalog search reserves a flexed result area so the manual-add fallback remains complete. The final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-200-short-phone-430-postfix/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-200-short-phone-430-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
- Current 320 x 390 / 320 x 360 / 200% route-audit evidence: 2026-07-08 headless Chrome Expo web first passed the split-short 320 x 390 sweep, then reproduced harsher 320 x 360 failures in contextual paywalls, direct upsell, Settings Privacy, Settings Notifications, Shelf no-match, compact Shelf filters, and stale Recommendation detail. Post-fix, micro-short paywalls use fitted title/price/CTA treatments, direct upsell store-unavailable CTAs stay tappable for route-owned feedback, narrow privacy direct entries defer the destructive health-data action below the first viewport, lower-priority notification and Shelf recovery controls move fully below the first viewport, stale Recommendation headers fit one line, and compact Shelf filters keep the short visible `7d` label with the full accessibility label. The final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-200-split-short-390-audit-current/`, `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
- Current 390 x 844 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced 16 modern-phone text-pressure failures across contextual paywalls, floating tab labels, Recommendation Preferences chips, Settings Privacy, Shelf scan/no-match, and Skin Notes. Post-fix, ProGate removes nonessential monthly-equivalent price pressure, the visible Progress tab label abbreviates at 390 px while preserving its accessibility label, preference chips densify, direct privacy policy rows stay below the first viewport, Shelf recovery/header targets are complete, and Skin Notes moves the later Sunscreen section below the first short modern-phone viewport. The final 49-route sweep and current-source rerun report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-current-rerun/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-390-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
- Current 430 x 932 / 390 x 844 supported modern-phone 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced tall supported-phone 200% failures in contextual ProGate paywalls, Skin Notes, Settings Privacy, Recommendation Preferences, and Shelf no-match. Post-fix, tall text-pressure ProGate paywalls use compact compliance/action density, lower-priority Skin Notes and Recommendation Preferences controls move below the first viewport, Privacy policy rows clear the floating tab-bar zone, and Shelf no-match keeps manual fallback scroll-reachable instead of a partial bottom-edge target. Final 49-route sweeps at 430 x 932 and 390 x 844 report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-5/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-7/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-430-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
- Current 414 x 896 / 200% boundary route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced contextual ProGate `Start free trial` CTA clipping on `/progress`, `/cycle/disruption`, and `/cycle/procedure`, then the hardened loaded-state rerun exposed Recommendation Preferences budget chips peeking as partial bottom-edge controls. Post-fix, contextual ProGate uses a 414-class text-pressure density tier with header compliance, compact body density, and complete primary/no-card actions; the text-pressure harness waits for `Checking your access` to clear before geometry capture; Recommendation Preferences defers lower-priority Budget controls below the first viewport in support-floor/boundary text-pressure states. The final 49-route sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero text overflow, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-postfix3/`, `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-progress-loaded-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-recprefs-postfix3/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-boundary-414-clearance.md`. Native iOS/Android safe-area, screen-reader, keyboard, store-sheet, and Dynamic Type QA remain open.
- Current 360 x 640 skipped-route / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the full 21-route skipped/direct-entry set for onboarding, paywall lifecycle, conflict/share recovery, shelf recovery, and progress recovery at the launch-blocking Android-class support floor. The sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, zero text overflow, and zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-360-640-current/`. Native simulator/device safe-area, keyboard, screen-reader, store-sheet, and Dynamic Type QA remain open.
- Current 390 x 844 skipped-route / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced a modern-phone skipped-route product-intake failure where `/onboarding/products` exposed only the lower part of the `Product name` input under the fixed `Skip for now` footer. Post-fix, the 390-wide modern high-text product intake defers lower-priority intro/progress copy and category controls while keeping the first input and skip path complete. The focused products rerun and full 21-route skipped/direct-entry rerun report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, zero text overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-products-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-postfix/`, and `docs/e2e-bug-reports/2026-07-09-onboarding-products-390-text-pressure.md`. Native simulator/device safe-area, keyboard, screen-reader, store-sheet, and Dynamic Type QA remain open.
- Current 375 x 667 skipped-route / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced support-floor failures in direct-entry onboarding and recovery routes that were omitted from the default 49-route sweep: DOB fields under Continue, the final goal card under Continue, product intake Add to shelf under Skip for now, onboarding paywall Explore first clipping, downgrade Terms/Privacy/Restore blocked by store-unavailable copy, plus follow-up account and stale shelf fallback clearance issues during reruns. Post-fix, onboarding/account uses a scrollable body and hides unavailable auth controls, affected onboarding/paywall/shelf fallbacks enter compact support-floor density, and the final 21-route skipped sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-375-667-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-375-667-postfix3/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-skipped-routes-375-clearance.md`. Native simulator/device safe-area, keyboard, screen-reader, store-sheet, and Dynamic Type QA remain open.
- Current 412 x 640 skipped-route / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced the same direct-entry support-floor class on supported 412 px phones: DOB fields, final goal/product controls, onboarding paywall Explore first, downgrade compliance controls, and a follow-up onboarding annual-card monthly-equivalent overflow. Post-fix, affected onboarding and downgrade routes enter compact support-floor density through 430 px width, the annual-card monthly-equivalent label reserves compact width, the full 21-route 412 x 640 skipped sweep reports zero failed routes, and a focused 430 x 640 regression also reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-640-focused-regression/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-skipped-routes-412-clearance.md`. Native simulator/device safe-area, keyboard, screen-reader, store-sheet, and Dynamic Type QA remain open.
- Current 430 x 640 skipped-route / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web expanded the prior focused 430 x 640 regression to the full 21-route skipped/direct-entry set for onboarding, paywall lifecycle, conflict/share recovery, shelf recovery, and progress recovery routes. The sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, zero text overflow, and zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-640-current/`. Native simulator/device safe-area, keyboard, screen-reader, store-sheet, and Dynamic Type QA remain open.
- Current 430 x 932 skipped-route / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced tall supported-phone skipped-route paywall failures: `/onboarding/paywall` clipped Terms, Privacy, and Restore at the bottom edge, and `/paywall/winback` initially let compliance controls share the CTA hit zone. Post-fix, compact onboarding paywalls always promote compliance controls into the header, winback keeps compact compliance above the CTA stack, the focused paywall rerun passes, and the full 21-route skipped/direct-entry sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, zero text overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-paywall-postfix3/`, `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-postfix/`, and `docs/e2e-bug-reports/2026-07-09-onboarding-paywall-430-932-skipped-route-text-pressure.md`. Native simulator/device safe-area, keyboard, screen-reader, store-sheet, and Dynamic Type QA remain open.
  - Current 320 x 430 / 170% route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route short-phone sweep at 170% text pressure after the compact 568 px pass. The audit reproduced partial first-viewport controls in `/community`, `/settings/notifications`, and `/recommendations/preferences`. Post-fix, later Skin Notes sections, the third notification nudge, and lower value-filter chips move fully below the first viewport on ultra-short narrow phones. The final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-170-short-phone-430-postfix-2/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-170-short-phone-430-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 320 x 430 / 120% route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the same 49-route text-pressure sweep at the shorter 320 x 430 viewport after ultra-short density fixes for `/settings/privacy`, `/settings/notifications`, `/shelf/no-match`, `/shelf/scan`, `/ask`, and ProGate paywalls. The final sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`. Native simulator/device keyboard and Dynamic Type QA remain open.
  - Current 320 x 430 / 130% route-audit evidence: 2026-07-08 headless Chrome Expo web reproduced seven contextual ProGate failures where the compact header let `Maybe later` block the `Restore` hit center and the monthly-equivalent price overflowed. Post-fix, ultra-short contextual ProGate paywalls stack compact compliance above `Maybe later` and hide the monthly-equivalent label below 460 px. The 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-postfix/` and `docs/e2e-bug-reports/2026-07-08-progate-text-pressure-130-header-overlap.md`. Native simulator/device keyboard and Dynamic Type QA remain open.
  - Current 320 x 370 / 320 x 360 / 130% route-audit evidence: 2026-07-08 headless Chrome Expo web reproduced two micro-short failures at 320 x 370, then used a harsher 320 x 360 follow-up to expose remaining first-viewport partial targets in settings, Shelf recovery, Skin Notes, contextual ProGate paywalls, the direct upsell sheet, and Recommendation Preferences. Post-fix, both 49-route sweeps pass at zero failed routes after sub-380 px density guards, split-short notification/manual-add spacing below 410 px, and deferred Recommendation Preferences value groups that keep visible value chips at 48 px. A 2026-07-09 current-source rerun reproduced a smaller follow-up set in Recommendation Preferences, Settings Notifications, Settings Privacy, and the Progress contextual paywall; the final 320 x 360 and 320 x 370 sweeps again report zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-current/`, `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-4/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-5/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-6/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-micro-short-370-clearance.md`. Native simulator/device safe-area and Dynamic Type QA remain open.

## Flow Template

```markdown
## Flow: [name]

- Goal:
- Persona:
- Entry state:
- Start screen/URL/window:
- Success state:
- Priority: Critical / Important / Nice
- Automate later: Yes / No
- Surface: iOS / Android / Expo web / Mixed
- Evidence folder:

### Path A: Happy Path

1. Action:
   Expected result:
   Evidence:

### Branches

- Branch: invalid input
  - Priority:
  - Automate later:
  - Action:
  - Expected result:
  - Evidence:
- Branch: empty state
  - Priority:
  - Automate later:
  - Action:
  - Expected result:
  - Evidence:
- Branch: loading or slow state
  - Priority:
  - Automate later:
  - Action:
  - Expected result:
  - Evidence:
- Branch: back, refresh, relaunch, or navigation
  - Priority:
  - Automate later:
  - Action:
  - Expected result:
  - Evidence:
- Branch: permission, privacy, auth, or account state
  - Priority:
  - Automate later:
  - Action:
  - Expected result:
  - Evidence:
- Branch: accessibility and keyboard
  - Priority:
  - Automate later:
  - Action:
  - Expected result:
  - Evidence:
```

## Flow: First-Run Onboarding

- Goal: A new user reaches the app's personalized starting state without unsafe claims, blocked navigation, or confusing consent.
- Persona: New skincare app user.
- Entry state: Fresh app install or cleared local state.
- Start screen/URL/window: App launch route.
- Success state: User reaches the intended post-onboarding area or a clearly gated paywall/account state.
- Priority: Critical
- Automate later: Yes
- Surface: iOS and Android first; Expo web if route parity is confirmed.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/onboarding/`
- Current local evidence: `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/`
- Current local evidence: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/`
- Current local evidence: `test-results/human-e2e/2026-07-07/onboarding-consent-quiz-resilience/`, `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/`, and `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/`
- Current clean first-session evidence: `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/`
- Current consent-before-goals and health-withdrawal evidence: `test-results/human-e2e/2026-07-15/health-consent-withdrawal-current/`
- Dev-only reset fixture: start Expo web with `EXPO_PUBLIC_E2E_LOCAL_RESET=1` and open `/?e2eReset=local` to clear local private state plus query cache, then return to `/`.

### Path A: Happy Path

1. Action: Launch the app, complete the neutral age gate, grant the dedicated health-data consent, then proceed through goals, quiz, products, analyzing/reveal, notifications, and account/paywall steps using safe local choices.
   Expected result: The enforced order is age -> consent -> goals -> quiz. No goal or quiz input mounts or persists before a current version/hash grant; each later step advances intentionally, copy stays within approved claims, and the final state is clear.
   Evidence: Screenshot or video of each major transition plus terminal/simulator logs.
   Historical predecessor evidence only: the 2026-07-08/09 runs under `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/`, `test-results/human-e2e/2026-07-09/onboarding-first-session-reveal-insight-current/`, and `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/` used age -> goals -> consent. They remain useful for layout/core-loop regression but do not satisfy the current consent-before-goals requirement.
   Current local partial evidence: The 2026-07-15 Expo-web run at 390 x 844 proves fresh reset -> Welcome -> age -> consent -> goals, with goals stable through timed route sampling and reload. It does not cover quiz and the later onboarding path, a hosted authoritative lifecycle, or physical-iPhone behavior; those remain open.
   Current complete Expo-web evidence: The 2026-07-26 supported 390 x 844 run in `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/` first proves direct `/today` entry fails closed to age, then completes age -> consent -> goals -> all 12 quiz questions -> three-product intake -> reveal -> notifications -> account skip -> paywall -> `Explore first` -> routine plan -> `Start today` -> AM and PM check-offs. It then re-enters age verification from the eligible session, submits a valid below-threshold DOB, proves the calm block state survives protected-provider teardown without retaining the DOB fields, and proves direct Today plus reload remain fenced by the minimized tombstone. `summary.json` records `verdict: pass`, all three re-verification route checks as `true`, the expected named products and derived profile, and zero horizontal overflow on every summarized screen. This is real Expo-web interaction with an explicit development-only anonymous-owner fixture; it is not hosted Supabase, signed iOS, physical-device, Apple sandbox, accessibility, or professional-review evidence.

### Branches

- Branch: underage or invalid age
  - Priority: Critical
  - Automate later: Yes
  - Action: Enter an impossible date such as February 30, a future date, and a valid DOB below the minimum age.
  - Expected result: Impossible or future dates keep Continue disabled with clear recovery copy; valid underage DOBs block progression with compliant age copy.
  - Evidence: Screenshot and reproduction notes.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 covers impossible date, future date, and valid underage DOB states. Invalid/future dates show `Enter a real birth date that is not in the future.`, underage valid DOB stays on `/onboarding/age` with the 16+ block copy, and all checked states have zero horizontal overflow and no visible sub-44 px controls.
- Branch: age-gate privacy copy punctuation
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/onboarding/age` on a compact phone viewport and inspect the age-gate privacy sentence.
  - Expected result: The copy says `We don't store your birth date.` with no mojibake punctuation, no clipped text, and the date fields plus Continue action remain visible and usable.
  - Evidence: Screenshot and text snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 shows `We don't store your birth date.` with no mojibake, complete day/month/year fields, a visible Continue control, zero horizontal overflow, and no visible sub-44 px controls.
  - Current support-floor text-pressure evidence: 2026-07-09 headless Chrome Expo web added a skipped-route sweep for omitted direct-entry routes at 320 x 480 / 170%. Before the fix, `/onboarding/age` put the day, month, and year inputs under the fixed Continue footer. Post-fix, the compact age gate scrolls above the footer, uses shorter support-floor copy, and the full 21-route skipped sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-current/`, `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-postfix/`, and `docs/e2e-bug-reports/2026-07-09-skipped-routes-text-pressure-clearance.md`.
- Branch: exact minimized age-policy receipt gates every private provider
  - Priority: Critical
  - Automate later: Yes
  - Action: Cold-open `/`, `/today`, `/shelf`, and `/settings/privacy` with a missing receipt, the old boolean/v1 receipt, malformed JSON, a future receipt version, a mismatched policy hash, a current eligible receipt, and a forced private-storage read failure. Repeat after foreground return, receipt removal, account switch, and account deletion.
  - Expected result: Only the exact current receipt (`receipt_version`, pinned policy hash, and `eligible: true`) permits protected providers to mount. No DOB, birth year, age, timestamp, threshold outcome, or underage reason is retained. Missing/stale/malformed/future/mismatched states route to the neutral age screen without mounting health-data providers; storage failure stays on a retryable fail-closed shell. A fresh non-affirmative evaluation immediately closes the live provider tree and atomically replaces any prior eligible receipt with the exact minimized re-verification tombstone. Account cleanup/export accounts for the receipt key, while health-purpose-only withdrawal does not erase this separate eligibility control.
  - Evidence: Root-provider source contract, minimized-receipt unit tests, storage byte snapshot, direct-route/foreground/account-boundary screenshots and logs, plus physical-iPhone lifecycle evidence.
  - Current source and Expo-web evidence: The v1 minimized receipt, exact re-verification tombstone, and root `AgePolicyGate` are implemented with exact-hash/status classification and focused tests. Protected providers close immediately on background/inactive or a fresh safe-route downgrade, remain closed through a fresh foreground storage read, ignore stale completions, and preserve an unavailable retry shell. The 2026-07-26 390 x 844 run proves direct `/today` recovers to age without mounting Today content, an eligible DOB reaches consent after the protected provider-tree transition, and the same session completes the core loop. It then proves a below-threshold re-verification tears down the protected tree, retains no DOB field across the navigator swap, and keeps direct Today closed before and after reload. Evidence is in `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/01a-direct-protected-age-gate.*`, `03a-after-age-submit.*`, `04-consent.*`, `25-age-reverification-before-submit.*` through `28-age-reverification-reload-today-blocked.*`, and `summary.json`; the fixed finding is recorded in `docs/e2e-bug-reports/2026-07-26-age-policy-downgrade-revocation.md`. A total storage-overwrite failure followed by process termination cannot claim durable revocation; native fault injection, AppState/account-boundary permutations, and physical-device lifecycle evidence remain required.
- Branch: Apple Declared Age Range launch boundary
  - Priority: Critical
  - Automate later: Yes
  - Action: On clean signed iOS 26.2+ sandbox builds for every final bundle ID, exercise eligible and ineligible regions, under-13, 13–15, 16–17, adult unconfirmed/confirmed accounts, share/decline, every declaration method, parental controls, communication limits, foreground/relaunch, and `RESCIND_CONSENT`.
  - Expected result: The exact signed archive contains the Boolean Declared Age Range entitlement. Only a shared lower bound at or above 16 may grant access; upper bound, declaration method, estimated/exact age, or DOB never grants access or enters retained bytes. Unavailable, declined, malformed, stale, old-OS/SDK, revoked, or jurisdictionally incomplete states fail closed before protected providers mount. Consent rescission immediately closes affected access and follows the reviewed retention/deletion policy.
  - Evidence: Signed archive entitlement report, build/toolchain log, Apple sandbox account matrix, physical-iPhone video and accessibility run, redacted adapter response snapshots, App Store Server Notifications V2 JWS/replay/idempotency trace, and named legal/privacy review.
  - Current source evidence: A first-party Expo iOS module, exact request-bound response decoder, lower-bound-only decision function, non-iOS fallback, source/autolinking tests, and Expo entitlement are implemented. The adapter remains literally `launch_blocked`; Windows source checks are not Swift compilation, signing, Apple sandbox, device, server-notification, or professional-review evidence.
- Branch: goal selection on shortest phone
  - Priority: Critical
  - Automate later: Yes
  - Action: After a current health-data grant, open `/onboarding/goals` on a 320 x 480 phone viewport and inspect all goal cards plus the fixed Continue action.
  - Expected result: All six goal choices are visible, readable, and hit-testable above the footer, with no goal card clipped underneath Continue, no horizontal overflow, and no visible control below 44 px. Continue advances to the quiz, not to consent, because consent is already established.
  - Evidence: Screenshot and small-phone control geometry snapshot.
  - Historical layout evidence: 2026-07-08 evidence in `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/`, `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/`, and `docs/e2e-bug-reports/2026-07-08-onboarding-goals-390-footer-overlap.md` proves card geometry only. Its Continue destination was consent and must not be treated as current flow evidence.
- Branch: direct goals or quiz entry without health-data consent
  - Priority: Critical
  - Automate later: Yes
  - Action: With no current health-data grant, open `/onboarding/goals` and `/onboarding/quiz` directly, including after decline, stale-version consent, malformed local consent, withdrawal, and refresh/relaunch.
  - Expected result: Neither goals nor quiz content mounts or persists. The app recovers to `/onboarding/consent` for an initial unconsented user, or to the account-preserving health-data paused shell for a withdrawing/withdrawn user. A stale local route cannot bypass the authoritative server lifecycle or processing epoch.
  - Evidence: Route/provider contract tests, local storage snapshot, screenshots before any health input appears, refresh/relaunch trace, and configured staging request log proving no health write.
  - Current local partial evidence: The 2026-07-15 Expo-web run directly requested `/onboarding/goals` after decline and recovered to consent without mounting goals. Direct quiz, stale/malformed records, hosted authoritative lifecycle denial, and native relaunch variants still require current evidence.
- Branch: consent declined
  - Priority: Critical
  - Automate later: Yes
  - Action: Decline health-data collection consent before the quiz.
  - Expected result: Consent remains unbundled and voluntary; the app does not enter goals or the health-data quiz, records the decline atomically when the backend is configured, and explains that personalized health features stay locked unless the user agrees. Decline does not delete the account or billing state.
  - Evidence: Screenshot and state notes.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 opens `/onboarding/consent`, taps `I don't agree`, shows `No consent recorded` plus the personalized-quiz-locked explanation, keeps the route on consent, and direct `/onboarding/quiz` after the decline recovers to consent without rendering quiz questions.
  - Current consent-before-goals evidence: The 2026-07-15 Expo-web replay again displayed `No consent recorded`; a direct goals request remained gated, and the subsequent single grant stayed on goals through 100 ms sampling to 1.9 seconds, a 6.5-second sample, and reload.
- Branch: historical direct-quiz local-gate predecessor
  - Priority: Critical
  - Automate later: Yes
  - Action: Retain the pre-authoritative-lifecycle direct-quiz evidence as a local route-gate regression case; use the combined direct goals/quiz branch above for current acceptance.
  - Expected result: Historical evidence can prove that the earlier local gate hid quiz questions, but it cannot prove consent-before-goals, server lifecycle/epoch authority, withdrawal routing, or zero pre-grant persistence.
  - Evidence: Historical screenshot, route snapshot, and browser console logs; fresh current evidence belongs to the combined branch above.
  - Historical local evidence: 2026-07-07 Expo web 320 x 568 direct `/onboarding/quiz` with a clean local context redirects to `/onboarding/consent`, does not render the first quiz question before consent, stays on consent after refresh, then opens `/onboarding/quiz` with the first question only after `I agree. Continue`; all checked states have zero horizontal overflow and no visible sub-44 px controls.
- Branch: notification permission denied
  - Priority: Important
  - Automate later: Yes
  - Action: Deny notification permission or skip notification setup.
  - Expected result: User can continue without pressure, and routine reminder preferences remain off instead of later appearing enabled.
  - Evidence: Screenshot or simulator permission state.
  - Current skip evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 opens `/onboarding/notifications`, verifies the soft-ask plus `Not now`, taps skip, reaches `/onboarding/account`, then opens `/settings/notifications` in the same session and verifies `Morning routine` and `Evening · tonight's step` switches both have `aria-checked=false`, 48 px switch targets, zero horizontal overflow, and no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/onboarding-notification-skip-current/`. Native iOS/Android OS prompt denial remains device QA.
- Branch: account creation local-first copy
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/onboarding/account` from the onboarding path and inspect the account-creation copy.
  - Expected result: Account creation copy stays honest about sign-in, subscription, and privacy controls; it must not imply routine/progress cross-device sync while routine checks remain local-first for beta.
  - Evidence: Screenshot, visible-text snapshot, console logs, and viewport notes.
  - Current local evidence: 2026-07-09 Codex in-app browser Expo web at 360 x 640 opens `/onboarding/account`, verifies `local-first on this device` is visible, verifies the old `routine and progress are yours on any device` claim is absent, keeps horizontal overflow at 0 px, and records an empty current-route warning/error log. Evidence is in `test-results/human-e2e/2026-07-09/onboarding-account-local-first-copy-current/`.
- Branch: anonymous account upgrade preserves identity and plan
  - Priority: Critical
  - Automate later: Yes
  - Action: From an active anonymous session with saved onboarding/shelf/routine data, request email account access, submit an invalid code, recover with a valid code, and repeat the upgrade contract for Apple and Google on configured native builds. Record the Supabase user ID before and after each attempt.
  - Expected result: Email uses `updateUser` plus an `email_change` OTP and Apple/Google use same-session identity linking. Success retains the exact anonymous user ID and produces a permanent identity; invalid codes, provider cancellation, identities owned by another account, offline failures, and rate limits do not fall back to a user-switching sign-in or clear local private data. Successful UI flow reaches the onboarding paywall only after account consent is recorded.
  - Evidence: Focused auth contract tests, browser screenshots/logs for deterministic email-code error and recovery, plus physical-device staging evidence with redacted before/after IDs for Apple, Google, and live email.
  - Local fixture: In development only, start Expo web with `EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE=email_same_user`; the deterministic email code is `424242`. This proves the route interaction and recovery path without claiming live Supabase/provider behavior.
  - Current local evidence: 2026-07-10 headless Chrome Expo web at the accepted 360 x 640 support floor completes the full first-session path, enters email on `/onboarding/account`, reaches code entry, verifies an invalid `111111` code shows the stable recovery message, replaces it with `424242`, reaches onboarding paywall, and continues through routine setup plus completed AM and PM check-offs. The repaired `Use a different method` target is 48 px; all captured steps have zero horizontal overflow and zero geometry issues, and no disallowed browser warnings/errors occurred. Evidence is in `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current/`; the pre-fix 40 px target and bug record are in `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-account-target-prefix/` and `docs/e2e-bug-reports/2026-07-10-onboarding-account-code-target.md`.
  - Current-source checkpoint: 2026-09-21 headless Chrome Expo web at the 375 x 667 launch viewport completed onboarding through email-code entry, rejected `111111` with visible recovery copy and a 60-second resend countdown, accepted fixture code `424242`, and reached the current paywall with truthful paid and free paths visible. The source route uses `Continue with the free plan`; the July `Explore first`/routine-plan continuation above is historical, not proof of the current full activation path. Evidence is in the ignored local `test-results/human-e2e/2026-09-21/onboarding-account-upgrade-checkpoint-current/`; live resend, email delivery, native identity, and full current activation remain unproven.
  - Open external evidence: `B-VERIFY-AUTH-LINKING` remains launch-blocked until Tas supplies configured staging and supported-device proof.
- Branch: email-code resend, expiry, rate limit, and offline recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: On `/onboarding/account`, request an email code for an anonymous account. Try to resend immediately, wait for the visible cooldown, enter an invalid code, then resend and verify. Repeat after the client validity window, with a provider rate-limit response, while offline, and after returning from `Use a different method`.
  - Expected result: Immediate resend is unavailable for 60 seconds; resend uses the pending `email_change` owner and address rather than a fresh sign-in. Local expiry disables Verify and permits a new request; the provider remains the OTP validity authority. Invalid, rate-limited, and offline requests show safe recovery copy without clearing the anonymous session, stored local data, or a still-pending challenge after a failed resend. A successful resend clears the entered code and starts a fresh cooldown. A changed owner cannot reuse the pending challenge. The developmental fixture demonstrates UI only, not email delivery.
  - Evidence: Focused challenge-state/auth tests, route contract, Expo-web screenshots and console log using `EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE=email_same_user`, and later live staging/native provider logs with redacted owner IDs.
  - Open external evidence: Hosted Auth template, rate-limit, actual delivery/expiry, secure email-change configuration, and supported-iPhone same-user verification remain required under AUTH-02 and `B-VERIFY-AUTH-LINKING`.
- Branch: Sign in with Apple credential lifecycle and publication fence
  - Priority: Critical
  - Automate later: Yes
  - Action: On a supported physical iPhone/TestFlight build, cancel Apple authorization; complete a valid first link/sign-in; interrupt provider exchange; relaunch before lifecycle capture settles; return from background with authorized, revoked, not-found, and transferred credential states; then deliver signed email and terminal server events before/after capture. On Expo web, directly open `/onboarding/account`, refresh, navigate back/forward, and verify the native Apple action is absent rather than simulated.
  - Expected result: Cancellation is neutral. A provisional Supabase Apple session never publishes account data until exact identity-token/nonce verification, one-use code exchange, encrypted refresh-token capture, and exact-session server preflight all succeed. Ambiguous exchange never reuses the code. Revoked/not-found/transferred evidence closes publication and clears every owner session. Signed terminal evidence creates or reuses the durable six-step deletion graph; evidence received before Auth identity commit is reconciled by first capture and returns committed `blocked` before code dispatch. Email/unknown events never send the raw subject to the database; terminal lookup uses it transiently and never stores it. Expo web exposes email/Google-compatible account choices only and never presents a fake Apple control.
  - Evidence: Physical-iPhone recording, redacted Apple/Supabase operation timeline, Edge/worker logs, signed-event delivery trace, lifecycle/deletion database evidence, and Expo-web screenshot/DOM/console evidence proving the non-native route remains usable with Apple hidden.
  - Current source evidence: Focused mobile/Edge/database contracts cover deferred publication, exact-session admission, cancellation, identity binding, one-use dispatch, encrypted vault capture, daily validation and key rotation, native invalidation, signed-event replay/order, pre-lifecycle terminal matching, pre-identity capture reconciliation, durable deletion, and stale-session denial. Expo-web human simulation proves only route/navigation/platform gating; it cannot establish native Apple UI, Keychain, provider, background, or live hosted behavior.
  - Current web evidence: 2026-07-15 Codex in-app browser Expo web completed the real onboarding sequence into `/onboarding/account`, verified the exact native Apple action count stayed zero at 375 x 667, 390 x 844, and 430 x 932, used the credential-free `Not now` continuation, and replayed back, forward, and reload with zero console errors. The unavailable local Supabase configuration was disclosed instead of presenting nonfunctional provider controls. Evidence is in `test-results/human-e2e/2026-07-15/apple-auth-web-platform-gate-current/`.
  - Open external evidence: Supported physical-iPhone/TestFlight proof, configured Apple Developer/Supabase credentials, hosted Cron/worker/event endpoint evidence, provider rate/capacity observations, and native cancellation/background/relaunch/VoiceOver/Dynamic Type runs remain launch gates.
- Branch: account change isolates private memory and persisted state
  - Priority: Critical
  - Automate later: Yes
  - Action: Populate account A Shelf, profile, routine, completion, and Progress query state; sign out, restore no session while owner metadata remains, or switch to account B; force one session-restore or local cleanup failure; retry; then open Welcome plus direct Shelf, Today, and Progress routes.
  - Expected result: Every data-bearing provider and route unmounts before cleanup starts. Rapid auth events serialize and same-user refreshes publish the latest session. Explicit sign-out removes persisted auth. New private operations are blocked; in-flight private reads, writes, removals, photo writes, and marker writes settle before deletion; all TanStack queries are cancelled and cleared before and after deletion; and only a neutral transition or recovery gate is visible. A private-cleanup control survives partial deletion, so retry cannot publish account B over residual account A data even when the owner hash was already removed. A separate auth-derived-cleanup control survives recovery-forced sign-out until session storage, query, notification, analytics, image-memory, and vendor resets all succeed. Session-restore or cleanup failure never publishes account B or remounts account A data. A signed-out restore with valid retained-owner metadata preserves quarantined data without mounting it; exact-owner reauthentication reopens it, while any different login wipes before publication. Account deletion uses the same root boundary once. A successful retry resets navigation; no account A product, profile, routine, completion, entitlement, or photo metadata is visible from the signed-out/new-account routes. Anonymous same-user upgrades and same-user token refreshes retain data.
  - Evidence: Hashed-owner and boundary-decision tests, delayed-write tests, route/provider source contracts, browser screenshots/logs, direct-route snapshots, and configured staging A-to-B proof with redacted account IDs.
  - Local fixture: In development only, start Expo web with `EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=signout_clear_retry`. It supplies a synthetic permanent account A, delays cleanup, fails the first cleanup attempt, and permits the retry; it does not claim live Supabase behavior.
  - Current local evidence: 2026-07-10 headless Chrome Expo web at the accepted 360 x 640 support floor populated account A through onboarding, Shelf, routine generation, and AM/PM check-offs; opened the signed-in account surface without reloading; forced the first cleanup attempt to fail; verified the recovery gate exposed no account A product names and kept a 56 px retry; retried through the neutral transition; reached signed-out Welcome; and used in-app navigation to direct Shelf and Today empty states with all three account A product names absent. Every captured state had zero horizontal overflow, no disallowed browser warnings/errors occurred, and the signed-out `Add products` action remained 56 px and hit-testable. Evidence is in `test-results/human-e2e/2026-07-10/onboarding-account-isolation-current/`; the fixed Critical finding is recorded in `docs/e2e-bug-reports/2026-07-10-account-transition-query-cache-leak.md`.
  - Open external evidence: Live Supabase sign-out, failed session restore, signed-out cold start with retained owner metadata, token-expiry, cold-start owner mismatch, and A-to-B transitions remain staging/device QA under `B-VERIFY-AUTH-LINKING` and `B-SUPABASE`.
- Branch: exact-owner cold start while remote publication preflight is offline
  - Priority: Critical
  - Automate later: Yes
  - Action: With encrypted local data and a locally restorable Supabase session for account A, cold-start offline so the deletion/publication preflight and RevenueCat publication cannot reach their services. Repeat with missing, malformed, expired, and account-B local session evidence.
  - Expected result: Only a locally validated session whose subject exactly matches the durable local-data owner may mount account A's local-first data. Commerce, entitlement refresh, paywalls, Restore, purchase, and server mutations remain closed until remote publication succeeds. Connectivity recovery retries publication without unmounting or exposing local data. Missing, invalid, expired, or differently owned session evidence never mounts account A data, and an authoritative deletion/session-rejection response still enters the hard deletion or rejected-session boundary.
  - Evidence: Cold-start screen recording, encrypted owner/session snapshots with identifiers redacted, offline network log, commerce-control assertions, connectivity-recovery trace, and focused publication-boundary tests.
  - Open external evidence: Supported physical iPhones must prove cold process start, airplane-mode relaunch, exact-owner recovery, owner mismatch, token expiry, and reconnect behavior against configured staging before this branch is release-ready. Android follow-up is non-launch resilience work.
- Branch: exact-owner foreground return while commerce refresh is offline
  - Priority: Critical
  - Automate later: Yes
  - Action: Publish account A online, background the app long enough to close remote commerce authority, disconnect networking, then foreground and navigate through Today, Shelf, Progress, a paywall, and an attempted server mutation. Reconnect and repeat.
  - Expected result: Account A's already validated local-first data remains mounted across true background and an offline foreground refresh. RevenueCat refresh, purchase/Restore, paywalls, and server mutations stay fail-closed while remote authority is unavailable; no stale commerce ticket is reused. Reconnection reacquires authority for the same owner and enables only the operations allowed by the newly committed state. An owner change or authoritative deletion/session rejection still unmounts private providers before cleanup.
  - Evidence: Foreground screen recording, AppState and publication trace, offline request log, local-route and commerce-control snapshots, reconnect trace, and focused lifecycle tests.
  - Open external evidence: Native iOS process/background behavior, StoreKit surfaces, and configured RevenueCat identity state remain release-device gates. Android/Play Billing follow-up is outside this iOS release contract.
- Branch: transient iOS inactive lifecycle state
  - Priority: Critical
  - Automate later: Yes
  - Action: On a supported iPhone, trigger Control Center, Notification Center, an incoming call/system interruption, Face ID or Sign in with Apple reauthentication, and the StoreKit side-button confirmation path so the app transitions through iOS `inactive` without first entering a true background state.
  - Expected result: App Lock/privacy shielding hides private content whenever required, but the transient `inactive` transition alone does not drain the account-scoped commerce ticket or detach an in-flight StoreKit operation. Returning directly to `active` continues under the same still-valid publication; any actual `background` transition closes commerce authority and requires reacquisition. No purchase, Restore, or account mutation crosses an owner change or closed publication boundary.
  - Evidence: Redacted physical-iPhone AppState timeline aligned with StoreKit/Face ID/Apple-auth video, commerce-ticket trace, caller completion result, and relaunch/background comparison.
  - Open external evidence: This branch cannot be accepted from Expo web or unit tests; physical-iPhone/TestFlight proof is mandatory.
- Branch: quiz and reveal draft copy
  - Priority: Critical
  - Automate later: Yes
  - Action: Agree to health-data collection, enter the quiz, and continue to the profile reveal.
  - Expected result: User-facing quiz and reveal copy contains no placeholder/scaffolding markers, stays claim-safe, and keeps B-QUIZ-COPY/legal-review caveats in source comments/tests rather than visible UI.
  - Evidence: Screenshot and text snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 completes the consent-to-quiz path, reaches the forced profile-save-failure state, retries, and renders `YOUR SKIN PROFILE`/`Type ...` reveal copy with no visible placeholder, scaffolding, `B-QUIZ-COPY`, or `B-PRIVACY-COPY` markers.
- Branch: sensitivities multi-select exclusivity
  - Priority: Important
  - Automate later: Yes
  - Action: On the sensitivities/allergies quiz step, select `None that I know of`, then select a concrete sensitivity such as `Fragrance`; repeat in the opposite order.
  - Expected result: `None that I know of` behaves as an exclusive option and cannot remain selected with concrete sensitivities. Multi-select chips meet the 44 pt phone touch target.
  - Evidence: Screenshot, UI state snapshot, and small-phone chip-geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 walks to the sensitivities step, verifies `None that I know of` selects alone, `Fragrance` clears `None`, `None that I know of` clears `Fragrance`, the step can advance to pregnancy, visible controls stay 44 px or taller, and horizontal overflow is zero.
- Branch: product intake category metadata
  - Priority: Important
  - Automate later: Yes
  - Action: Add first-run shelf products with categories such as Moisturiser, Oil / balm, Retinoid, and SPF, inspect the product-count cue after each add, then continue to the shelf/reveal path.
  - Expected result: Products are added once, the product-name placeholder fits without truncation on compact phones, the selected category uses a canonical shelf ID, PAO/default metadata is preserved rather than degrading to unknown because of a mismatched onboarding-only category, compact phones use a collapsed category selector that opens a dimmed bottom sheet with 48 px category chips instead of clipping under the fixed footer, the visible remove-product control is at least 44 x 44, the primary footer nudges toward the documented three-product first-insight target until three products are added, and a secondary continue path remains visible for users who choose to proceed with fewer products.
  - Evidence: Screenshot sequence, local shelf state or product metadata snapshot, and small-phone control-geometry snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web confirms `/onboarding/products` at 320 px renders the compact collapsed category selector with zero horizontal overflow, a 54 px product-name input, a 50 px `Choose product category` control, and a 56 px footer action in `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-safe-area/`. Source contracts now verify the picker sheet uses a route-local overlay rather than nested React Native `Modal` semantics, native bottom-inset padding when present, a height cap at viewport minus a 52 px dismiss reserve, one named modal dialog on web, hidden background content for accessibility while open, padded internal category chips, handled keyboard taps inside the scroll view, and a shrinkable chip list. Native iOS/Android safe-area and screen-reader QA remain open.
  - Current modal-open evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 completes goals, consent, and quiz to reach `/onboarding/products`, types `Barrier Screen SPF 52`, opens the named `Choose product category` sheet, verifies exactly one `role="dialog"` node with `aria-modal=true`, top=52, width=320, seven 48 px category chips, zero horizontal overflow, selects `SPF`, confirms the collapsed field exposes `Category, SPF`, adds the product, and verifies the 48 x 48 remove control. Evidence is in `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-320x480-postfix/`.
  - Current short-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 found the optional category trigger could occupy the footer zone on `/onboarding/products`. A follow-up 320 x 480 pass now verifies the empty state has no hidden category trigger, `Product name` and `Skip for now` are separated, typing `Retinol serum` renders exactly one visible footer-owned `Choose product category` action above `Add to shelf`, the category sheet opens with 48 px category chips, and selecting `Serum` returns to `/onboarding/products` with `Category, Serum` plus `Add to shelf`. Evidence is in `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/`.
  - Current clean first-session evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 starts from `0 of 3 products` after the reset fixture, shows only `Skip for now`, then adds `Retinol 0.3% Night Serum`, `Glycolic 7% Toner`, and `Mineral SPF 50` with categories Serum, Toner, and SPF. The footer correctly advances through `Add 2 more`, `Add 1 more`, and `Continue`, and no persisted prior shelf item appears. Evidence and bug report are in `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/` and `docs/e2e-bug-reports/2026-07-08-onboarding-first-session-local-reset.md`.
  - Current split-short full-activation evidence: 2026-07-09 headless Chrome Expo web at 320 x 430 uses the dev-only reset fixture, completes age, goals, health-data consent, the 12-question quiz, three-product shelf intake with `Retinol 0.3% serum`, `Glycolic 7% toner`, and `Mineral SPF 50`, verifies the reveal shows `FIRST INSIGHT` / `Timing handled`, skips notifications and account, chooses `Explore first`, opens the generated routine plan, taps `Start today`, and completes AM `Mineral SPF 50` plus PM `Glycolic 7%` check-offs to `1 of 1`. The core check-off controls are visible, 44 px+, center-hit-testable after the documented scroll where needed, horizontal overflow is zero, and only expected local placeholder warnings appear; this viewport remains stress evidence below the launch web support floor. Evidence and report are in `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/`, `docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md`, and `docs/e2e-bug-reports/2026-07-09-today-short-stress-recommendation-clearance.md`.
- Branch: back/relaunch during onboarding
  - Priority: Important
  - Automate later: Yes
  - Action: Navigate back, background/relaunch, refresh on Expo web, or directly open `/onboarding/reveal` or `/onboarding/analyzing` without completed quiz answers.
  - Expected result: Progress is preserved or reset intentionally with no broken state; reveal/analyzing must not fabricate a default skin profile and must recover to the quiz path.
  - Evidence: Video or before/after screenshots.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 covers a direct consent/quiz completion with no selected goals. Product skip recovers to `/onboarding/goals`, selecting a goal returns the already-completed quiz context to `/onboarding/products`, and the user can continue to the profile-save-failure retry/reveal path without a fabricated default goal or a dead end.
- Branch: profile save failure before reveal
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE=once`, complete the quiz, enter analyzing, and let the first local skin-profile save fail.
  - Expected result: The app does not advance to reveal as if onboarding were saved; it shows a retry path while preserving the quiz answers in memory. Tapping Try again consumes the one-shot failure and reaches reveal with the same quiz-derived profile.
  - Evidence: Error-state screenshot and retry/reveal route snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 with `EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE=once` selects a goal, grants consent, completes the quiz, skips product intake, shows `We could not save your profile.` on `/onboarding/analyzing` without revealing a profile, then `Try again` reaches `/onboarding/reveal` with `YOUR SKIN PROFILE`.
- Branch: exact quiz-provenance receipt and stale-profile recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: Complete the exact current quiz, relaunch, and directly open profile-consuming routes. Repeat with an unversioned/v1 profile, malformed/future envelope, altered content/scoring/combined hash, altered basis points, altered DSPT, unreadable local storage, a missing local profile with an exact server v2 row, and a missing local profile with a legacy or partially populated server row.
  - Expected result: The local v2 receipt contains only canonical derived outputs, one or two approved goals, completion time, and the exact content/scoring provenance; it contains no raw answers, question IDs, or answer hash. Raw answers remain in memory only while a local save is pending or failed, then are wiped after the durable v2 result succeeds. Only the exact current receipt is locally usable. Ordinary reads/writes preserve and fail closed on legacy, malformed, future, mathematically inconsistent, or contract-mismatched bytes. A fresh explicit quiz may atomically replace any unusable profile bytes; a storage failure preserves the prior bytes and retry answers. Server fallback occurs only when local status is genuinely missing and accepts only the exact v2 tuple; a stale local authority can never be bypassed. Server-only pregnancy remains conservative/unknown. The draft review status remains launch-blocked pending exact-hash professional review.
  - Evidence: Local/server parser and database constraint tests, private-storage/export snapshots, reload/direct-route screenshots, server-request filters, and physical-iPhone evidence.
  - Current source and Expo-web evidence: Deterministic content/scoring manifests, exact hashes, integer basis-point scoring, v2 local/server provenance, raw-answer post-save minimization, atomic explicit-quiz recovery, and fail-closed readers are implemented with focused source tests. The 2026-07-26 supported 390 x 844 run completes the exact 12-question UI, renders its derived OSPW profile through reveal/paywall/routine, and completes the first AM/PM cycle in the same session; see `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/`. Storage-byte inspection, exact server v2 fallback/RLS on hosted Supabase, relaunch/profile-consumer permutations, physical-iPhone verification, and professional review remain required.

## Flow: Routine Plan First Value

- Goal: A user sees a generated AM/PM routine that is clearly tied to their shelf and profile.
- Persona: New or returning user reaching the first routine plan from onboarding or direct routine entry.
- Entry state: User has either a real shelf/profile or the documented empty-shelf example state.
- Start screen/URL/window: `/routine/plan`.
- Success state: The plan explains whether it is using the user's profile or an example, surfaces an explicit first insight from generated plan data, shows no hardcoded mismatched skin profile, keeps a visible escape path, and lets the user start Today.
- Priority: Critical
- Automate later: Yes
- Surface: iOS and Android first; Expo web for profile-label and compact-layout checks.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/routine-plan/`
- Current local evidence: `test-results/human-e2e/2026-07-07/routine-plan-current-compact-check/`
- Current local evidence: `test-results/human-e2e/2026-07-07/routine-front-label-products-current/`
- Current local evidence: `test-results/human-e2e/2026-07-08/routine-plan-profile-label-current/`

### Path A: Generated Plan Review

1. Action: Open `/routine/plan`, inspect the profile label, review AM and PM cards, then tap Start today.
   Expected result: The profile label reflects the actual plan context, the first insight is visible and claim-safe, the routine cards fit the viewport, and Start today routes to Today without a dead end.
   Evidence: Screenshot, visible-text snapshot, and route snapshot.

### Branches

- Branch: empty-shelf example label
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan` with no shelf products or saved profile.
  - Expected result: The plan labels itself as an example and does not claim it was built for the user's real dry/sensitive profile.
  - Evidence: Screenshot and visible-text snapshot.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 opens `/routine/plan` with no local shelf/profile, verifies `EXAMPLE ROUTINE` and `Example only`, finds no hardcoded dry/sensitive profile label, and records zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/routine-plan-profile-label-current/`.
- Branch: real profile label
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan` with a saved profile whose sensitivity is neutral or resistant.
  - Expected result: The label reflects that profile state rather than hardcoding `dry, sensitive skin`.
  - Evidence: Screenshot and local profile fixture snapshot.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 seeds the real local profile store with oily/resistant axes plus a real shelf, opens `/routine/plan`, and verifies `BUILT FOR OILY, RESISTANT SKIN`, `Gel cleanser`, `Mineral SPF 50`, no dry/sensitive copy, a complete compact PM suffix, zero horizontal overflow, and 44 px+ visible controls. Evidence is in `test-results/human-e2e/2026-07-08/routine-plan-profile-label-current/`.
- Branch: sequencing review gate is closed or only partially reviewed
  - Priority: Critical
  - Automate later: Yes
  - Action: In development, set `EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE=closed`, add classifiable stable products, and inspect Reveal, Plan, Today AM, and Today PM. Repeat in a production-mode unit/integration fixture with only one role carrying review metadata and inject stale cycle data for a withheld active.
  - Expected result: Unreviewed products remain visible on the Shelf but are absent from both generated phases, Today check-offs, and cycle projections. The UI says automatic order is not set and never promises manual placement. It surfaces no starter or synthesized use instruction, missing-product gap advice, or “highest-impact” SPF recommendation. Start today still reaches Today without attempting a closed cadence write. A partially reviewed role cannot authorize a different role, while an exact reviewed role may publish only its own phase, order, and instruction.
  - Evidence: Reveal/Plan/Today screenshots and visible-text snapshots at supported phone sizes, browser logs, generated-plan and Today-projection snapshots, plus focused production-gate tests.
  - Open external evidence: Current source has focused unit/static coverage; a post-fix human-simulated Expo web pass and physical-iPhone review-build verification remain required.
- Branch: pregnancy and breastfeeding status stays consistent across settings, Plan, and Today
  - Priority: Critical
  - Automate later: Yes
  - Action: With a shelf containing a retinoid, BHA without confirmed-low concentration, and a moisturiser, open `/settings/skin-profile`; save `No`, inspect Plan and Today PM, then drive `Pregnant or trying`, `Breastfeeding`, `Prefer not to say`, reload, and restore `No`. Repeat with a stale consent record, one failed profile write, one failed consent write, and no local profile.
  - Expected result: Personal profile use/write requires the exact current consent version/hash. Only a successfully read explicit local `No` clears caution. Affirmative, prefer-not, missing/malformed, unreadable, stale-consent, and server-only status remain cautious without copy claiming pregnancy. Reviewed/dev safety rules remove retinoids and hydroquinone and remove BHA unless every threshold-bearing active percentage is unambiguously tag-associated and confirmed low; production does not bypass the clinical rule gate. Filtering precedes sequence/cycle/ramp/replacement recommendations/Today, and a closed cadence-review gate withholds treatment/exfoliant placement rather than making it daily. The editor persists encrypted, disables competing choices while saving, retries non-destructively, returns to its origin, supports current-consent regrant without trapping the user, and invalidates all profile consumers after edit/rebuild. Explicit `No` restores only eligible reviewed products.
  - Evidence: Status, consent, write-failure, and missing-profile screenshots; encrypted reload assertion; Plan/Today snapshots; control geometry; browser/network telemetry; and focused tests for server fallback, review gates, hydroquinone, replacement suppression, and adversarial multi-percentage BHA names.
  - Current local evidence: 2026-07-10 headless Chrome Expo web at 360 x 640 and 390 x 844 drives `none -> pregnant/trying -> breastfeeding -> prefer_not -> none`, retries one-shot profile/consent writes, verifies legacy consent stays cautious until current-text regrant, verifies missing-profile cautious recovery, proves Plan/Today consistency and encrypted prefer-not reload, restores explicit clear, and reports zero normal/200%-pressure sub-44 controls, horizontal overflow, vendor requests, dialogs, page errors, or disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/`. The UI fixture uses retinoid plus BHA without confirmed-low concentration; focused tests cover hydroquinone, reviewed/unreviewed rules, and low/high/unknown strength. Physical iOS/Android accessibility, persistence, offline/fault, and named clinical/legal proof remain open.
- Branch: multiple simultaneous treatment families use one canonical schedule
  - Priority: Critical
  - Automate later: Yes
  - Action: With an explicit-clear profile, seed cleanser, moisturiser, SPF, two retinoids, AHA, BHA, benzoyl peroxide, hydroquinone, and copper peptide; inspect Plan, Today AM, Today PM, and a scheduled product detail at supported phone sizes, then reload.
  - Expected result: Plan renders every retinoid/AHA/BHA product from the canonical scheduler with its real cycle-night numbers instead of selecting the first generic treatment/exfoliant. Benzoyl peroxide appears in Morning and Today AM with label-directed copy. Hydroquinone and copper peptide remain off Today because no reviewed cadence is defined, while Plan and both Today phases explicitly state that two active timings are not set. Today PM contains stable basics plus exactly the canonical active for tonight; product detail uses the same cycle-night numbers. Output remains deterministic when shelf input order changes, persists after reload, has no horizontal overflow or sub-44 visible controls, and remains readable at 200% browser text pressure.
  - Evidence: Plan/Today/product-detail screenshots, visible-text and canonical-cycle snapshots, reload snapshot, control geometry, browser/network telemetry, and focused cross-model tests.
  - Current local evidence: 2026-07-10 Codex in-app browser Expo web at 360 x 640 and 390 x 844 builds the ten-product fixture through the real Shelf/consent/profile UI, verifies all four canonical cycle products in Plan, BP in Morning/Today AM, an explicit two-product timing notice, exactly one PM active, persisted BP completion, and Retinol A product-detail nights 4/10/14. The first pass found and fixed a 17-slot compact strip, 390 px label ellipses, and a secondary teaser intersecting the floating tab zone. Final geometry reports zero horizontal overflow, sub-44 controls, tab intersections, or browser errors. Evidence is in `test-results/human-e2e/2026-07-10/multi-active-plan-today-current/`; native accessibility and a targeted 200% complex-fixture pass remain release-device work.
- Branch: direct-entry back recovery
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/routine/plan` directly and use the visible Back control.
  - Expected result: The user returns to the You tab instead of staying trapped on the plan route.
  - Evidence: Screenshot sequence and route snapshot.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 opens `/routine/plan` directly from a fresh browser context, taps the visible Back control, lands on `/you`, records zero horizontal overflow, and captures browser logs with no failed placeholder Supabase request after the consent backend guard. Evidence is in `test-results/human-e2e/2026-07-08/routine-plan-profile-label-current/`.
- Branch: direct-entry contextual Explore first
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan` directly as a first-time free user, choose the visible no-card `Explore first` path, then inspect the generated plan.
  - Expected result: The contextual full-routine paywall offers a value-first reverse-trial path before hard payment, `Explore first` unlocks the current route, and the generated AM/PM plan appears without requiring store pricing.
  - Evidence: Paywall screenshot, post-unlock plan screenshot, route snapshot, and entitlement state.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 direct `/routine/plan` renders the no-card paywall with 48 px+ visible controls and zero horizontal overflow; tapping `Explore first. 7 days of Pro` unlocks the `BUILT FROM YOUR SHELF` plan without store checkout.
- Branch: compact fixed-footer clearance
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan` through the no-card `Explore first` path at 320 px wide, inspect the evening card, scroll to the lower note, then tap `Start today`.
  - Expected result: The first viewport ends on complete plan content above the fixed CTA, lower notes are reachable by deliberate scroll, and `Start today` routes to Today.
  - Evidence: First-viewport screenshot, scrolled-bottom screenshot, route snapshot, and CTA geometry.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 shows the generated plan content above a visible 56 px `Start today` CTA, with zero horizontal overflow; tapping `Start today` routes to `/today`.
- Branch: manual front-label shelf products
  - Priority: Critical
  - Automate later: Yes
  - Action: Add `Retinol 0.3% Night Serum`, `Glycolic 7% Toner`, and `Mineral SPF 50` from the onboarding products surface, unlock with the no-card `Explore first` path, inspect `/routine/plan`, tap `Start today`, and complete the generated Today PM check-off.
  - Expected result: Common product-name shorthand is enough before catalog seed: Morning shows SPF and not glycolic, Evening shows glycolic as the exfoliant and retinol as the retinoid, Today PM opens to the matching Glycolic check-off, and the first check-off reaches `1 of 1`.
  - Evidence: Pre/post visible-text snapshots, phone screenshots, browser logs, and check-off state.
  - Current local evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 adds `Retinol 0.3% Night Serum`, `Glycolic 7% Toner`, and `Mineral SPF 50` through `/onboarding/products`, opens `/routine/plan`, and verifies `BUILT FROM YOUR SHELF`, `Timing handled`, Morning `Mineral SPF 50`, Night 1 `Glycolic 7%`, and Night 2 `Retinol 0.3% Night Serum`. `Start today` opens Today PM on the Glycolic check-off and tapping it reaches `1 of 1` with zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-07/routine-front-label-products-current/`.
  - Current 320 x 430 evidence: 2026-07-08 Codex in-app browser Expo web covers the same first-session path from a reset install state. The plan places `Mineral SPF 50` in Morning, `Glycolic 7%` on Night 1, and `Retinol 0.3% Night Serum` on Night 2; `Start today` opens the current morning routine and completes `Mineral SPF 50` at `1 of 1`, and direct `/today?routine=PM` shows Night 1 `Glycolic 7% Toner` and completes at `1 of 1`. Evidence is in `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/`.
  - Current maintained 320 x 430 evidence: 2026-07-09 headless Chrome Expo web promotes this path into the maintained `npm run e2e:onboarding-first-session` harness. From reset onboarding it adds `Retinol 0.3% serum`, `Glycolic 7% toner`, and `Mineral SPF 50`, chooses `Explore first`, verifies the routine plan includes the first insight plus SPF/glycolic/retinol placement, taps `Start today`, forces AM and PM dev routine states, and completes both Today check-offs to `1 of 1`. Evidence is in `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/`.
  - Current 390 x 844 exact-flow evidence: 2026-07-12/13 headless Chrome Expo web reproduced a semantic-radio driver failure, a hidden navigation-stack input selection, and loss of goals/quiz state when the required `/shelf/opened` detour unmounted the route-local onboarding provider. Post-fix, the maintained first-session harness resets local state, completes consent and all 12 quiz questions, adds three named products with explicit opened-date provenance, renders the shelf-derived `Timing handled` insight, uses Explore first, verifies the generated routine plan, and completes both AM and PM check-offs to `1 of 1`. All recorded checkpoints have zero horizontal overflow and no disallowed browser warnings/errors. Evidence and report are in `test-results/human-e2e/2026-07-12/backlog-current-smoke/onboarding-first-session-390x844/` and `docs/e2e-bug-reports/2026-07-12-onboarding-opened-date-radio-driver.md`; native iPhone QA remains open.
  - Current analytics evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 adds `Retinol 0.3% Night Serum`, `Glycolic 7% Toner`, and `Mineral SPF 50` through manual Shelf UI, generates the routine plan, opens direct `/today?routine=PM`, and completes Night 1 `Glycolic 7% Toner` from `0 of 1` to `1 of 1` with the checkbox marked true and zero horizontal overflow. Unit and phase gates verify this final PM cycle-night check-off emits the privacy-safe `cycle_night_completed` payload without product, slot, skin, or goal details. Evidence is in `test-results/human-e2e/2026-07-08/today-cycle-completion-analytics-current/`.
- Branch: sparse shelf without night actives
  - Priority: Critical
  - Automate later: Yes
  - Action: Add only a daytime product such as `Mineral SPF 50`, open `/routine/plan`, inspect the evening card, tap `Start today`, and inspect Today if the local clock lands on PM.
  - Expected result: The plan remains labeled as built from the user's shelf, the morning card includes the daytime product, and the plan/Today PM evening states do not claim `skin cycling`, `Recover`, or `ceramide only` until a real night active or barrier product exists.
  - Evidence: Phone screenshot, visible-text snapshot, local shelf state, and Today route snapshot when tested in PM.
  - Current local evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 removes the night actives from the same onboarding shelf so only `Mineral SPF 50` remains, then verifies `/routine/plan` stays labeled `BUILT FROM YOUR SHELF`, shows Morning `Mineral SPF 50`, renders `EVENING` with `No night steps yet.`, and contains no skin-cycling, `Recover`, retinol, or glycolic copy. `Start today` lands on the PM Today empty evening state without stale cycle or night-active copy and with zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-07/routine-front-label-products-current/`.
- Branch: unclassified shelf item
  - Priority: Critical
  - Automate later: Yes
  - Action: Add a shelf product with a name, no category, and no ingredient clue, then open `/routine/plan`.
  - Expected result: The first insight says `Product needs details`, names the unknown product as needing a category or ingredient clue, the unknown product is not placed into AM or PM steps, `Start today` remains reachable, and the route has no raw error text, footer text sliver, or horizontal overflow.
  - Evidence: Phone screenshot, visible-text snapshot, local shelf state, and route/console snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 on port 8164 with `EXPO_PUBLIC_E2E_ENTITLEMENT=pro` adds `Mystery drops` with no category through `/shelf/manual`, opens `/routine/plan` from Shelf, and verifies `Product needs details` names `Mystery drops` as needing a category or ingredient clue, the product is not placed in Morning or Evening rows, `Start today` remains visible, horizontal overflow is zero, no raw error text or JavaScript dialog appears, the previous footer text sliver is gone, and current-route warning/error logs are zero. Tapping `Start today` routes to `/today` with zero horizontal overflow and no raw error text. Evidence is in `test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/`.

## Flow: Runtime Brand Identity Smoke

- Goal: A user sees one coherent public app identity across high-visibility runtime surfaces.
- Persona: New or returning user using a build configured with the working rebrand candidate.
- Entry state: Local Expo web build with `EXPO_PUBLIC_APP_DISPLAY_NAME=Layerwell` and `EXPO_PUBLIC_APP_SCHEME=layerwell`.
- Start screen/URL/window: Direct routes `/ask`, `/paywall/upsell?feature=full_routine`, and `/settings/subscription`.
- Success state: High-visibility Ask, Pro, subscription, and public-card copy use `Layerwell` through runtime configuration; the rejected working identity is absent from the checked surfaces.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web smoke; iOS and Android after final native identifiers are cleared.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/runtime-brand-identity/`
- Historical evidence reference (not present in this checkout): `test-results/human-e2e/2026-07-07/runtime-brand-identity/`. A fresh Layerwell pass is required.

### Path A: Configured Runtime Copy

1. Action: Start Expo web with the working public display name, open `/ask`, `/paywall/upsell?feature=full_routine`, and `/settings/subscription`, then inspect visible page copy.
   Expected result: `/ask` renders `Ask Layerwell`; the paywall/subscription surfaces render `Layerwell Pro`; no checked surface displays the rejected working identity.
   Evidence: Screenshots, visible-text snapshots, and browser console logs. Historical local evidence: 2026-07-07 Expo web at 320 x 568 rendered the then-configured working identity in Ask, paywall, and subscription settings, with no earlier-brand labels reported visible and no browser console errors. The recorded pass predates Layerwell, its evidence directory is not present in this checkout, and it cannot verify current branding. Final brand/legal clearance and native identifier QA also remain open.

### Branches

- Branch: share-card placeholder identity
  - Priority: Important
  - Automate later: Yes
  - Action: Inspect the runtime share-card constants without a final brand domain.
  - Expected result: The card watermark uses `Layerwell`, the URL fallback uses a reserved `.example` domain, and the deep link uses the configured public scheme.
  - Evidence: Unit test output and source snapshot.
- Branch: public-copy sweep smoke
  - Priority: Critical
  - Automate later: Yes
  - Action: Start Expo web with the working public display name, open `/onboarding/age`, `/s/[shareId]`, `/shelf/search`, `/settings/timing`, and the local reverse-trial path before `/routine/widgets`.
  - Expected result: Visible public copy on the age gate, catalog search, and timing lock-screen preview uses `Layerwell` and does not show the rejected working identity; every `/s/[shareId]` path renders the same product-free `Public sharing is unavailable.` recovery without deriving content from the path; widgets remain the existing native-widget deferred surface until device QA enables them.
  - Evidence: Phone-width screenshots, visible-text snapshots, local reverse-trial route snapshot, and browser console logs.
  - Historical local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with the previous working display name verified the pre-CORE-07A `/s/sharecard01` surface alongside the age, catalog, timing, and widget surfaces. Evidence is in `test-results/human-e2e/2026-07-08/public-copy-smoke-current/`; the former public-share behavior and previous brand identity are superseded and are not current acceptance evidence. Final trademark clearance, store listings, native identifiers, final domain, and App/Universal Links remain external blockers.
- Branch: public share landing attribution
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/s/[shareId]` with both ordinary and sensitive-looking query parameters, then repeat with a different or invalid path value.
  - Expected result: Every path and query renders the same product-free `Public sharing is unavailable.` recovery. The route does not parse or validate an identifier, derive a projection, fetch a record, emit attribution or analytics, expose private shelf/profile/product/health data, or create a public token, signed URL, or JWT. `Go to Shelf` and `Add a product` navigate only into the local private flow.
  - Evidence: Phone-width screenshots, visible-text snapshot, browser console/network logs, route URL snapshot, focused zero-admission source-contract output, and navigation snapshots.
  - Current source boundary: CORE-07A statically binds every `/s/[shareId]` path to the same product-free recovery and the source-contract rejects path/query reads, payload reconstruction, network or storage reads, token handling, and analytics. A fresh human-simulated phone-floor pass remains required before launch.
  - Historical local evidence: 2026-07-09 evidence in `test-results/human-e2e/2026-07-09/share-landing-attribution-current/` predates CORE-07A and is retained only as regression history; its former public shelf-check landing and `Scan a product` / `Add manually` expectations are superseded.
- Branch: Phase 8 public-site identity smoke
  - Priority: Critical
  - Automate later: Yes
  - Action: Serve `docs/phase-8/public-site` locally, open `index.html`, `share.html`, `support.html`, and `waitlist.html` at phone width, and inspect titles plus visible copy.
  - Expected result: The branded launch pages use `Layerwell`, show no rejected working identity, preserve the no-score/not-medical-advice boundaries, and keep final app association IDs as placeholders until store-console identity is cleared. `share.html` instead remains a brand-neutral, inert `Public links are unavailable.` recovery that does not derive content from the address. `support.html` discloses the V1 support floor: iOS 17.0+, Android 10 / API 29+, iPhone 375 pt+, Android 360 dp+, 360 x 640 compact-phone testing, no V1 tablet/foldable/landscape/split-screen support, and 320-wide browser checks as stress coverage only.
  - Evidence: Phone-width screenshots, visible-text snapshots, static-server transcript, and brand audit output.
  - Historical local evidence: 2026-07-10 headless Chrome opened `support.html` from the static Phase 8 public site at 390 x 700. Its saved visible-text snapshot uses the previous working identity and verifies the V1 device floor (iOS 17.0+, iPhone 375 pt+, Android 10 / API 29+, Android 360 dp+), the 360 x 640 compact-phone test floor, no V1 tablet/foldable/landscape/split-screen/smaller-phone support, and 320-wide browser checks as stress coverage only. The pass recorded zero horizontal overflow, no raw `__SUPPORT_EMAIL__` token, no placeholder mailto link, and zero browser warn/error logs. Evidence is in `test-results/human-e2e/2026-07-10/phase8-public-support-device-floor-current/`; it does not verify Layerwell branding.
- Branch: Phase 8 public-site placeholder store links
  - Priority: Critical
  - Automate later: Yes
  - Action: Serve `docs/phase-8/public-site` locally before final store URLs are substituted. Open `index.html` at phone width and tap one App Store/Google Play waitlist fallback; separately inspect `share.html` as the inert unavailable route.
  - Expected result: On `index.html`, raw `__APP_STORE_URL__` and `__PLAY_STORE_URL__` tokens are never clickable `href` values, placeholder store buttons visibly route to `/waitlist.html`, and final substitution promotes only validated App Store and Play Store HTTPS URLs. `share.html` contains no anchor, button, form, iframe, script, token parsing, beacon, analytics, or store destination and displays only the neutral unavailable state.
  - Evidence: Phone-width screenshots, visible-text/link snapshots, click-through URL snapshot for `index.html`, inert-surface DOM/network snapshot for `share.html`, and source-level final-substitution check.
  - Historical local evidence: 2026-07-08 evidence and the report in `test-results/human-e2e/2026-07-08/phase8-public-store-link-fallback/` and `docs/e2e-bug-reports/2026-07-08-phase8-public-store-placeholder-hrefs.md` predate CORE-07A. Their `index.html` placeholder-store verification remains useful history; the former `share.html` waitlist/store destinations are superseded and are not current acceptance evidence.

## Flow: Today Routine Completion

- Goal: A returning user can understand and complete today's routine steps.
- Persona: Returning user with seeded routine data.
- Entry state: User has completed onboarding and has a routine fixture.
- Start screen/URL/window: Today tab.
- Success state: Routine step completion is visible, persisted, and reflected in streak/progress logic where applicable.
- Priority: Critical
- Automate later: Yes
- Surface: iOS and Android first; Expo web if route parity is confirmed.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/today/`
- Current local evidence: `test-results/human-e2e/2026-07-07/today-checkoff-persistence/`
- Current local evidence: `test-results/human-e2e/2026-07-08/today-empty-and-cycle-current/`
- Current local evidence: `test-results/human-e2e/2026-07-08/today-checkoff-append-only/`
- Current CORE-05 source boundary: local Shelf and completion records are strict
  encrypted v3 structures; Today persists the visible check-off and replay
  event together; the offline coordinator drains Shelf before completion;
  migrations `0068`/`0069` provide owner-derived adherence and sync RPCs,
  deletion-wins stable product identity, and minimized replay receipts. The
  historical UI evidence above predates this exact replay bridge and does not
  prove hosted, two-device, native-storage, withdrawal/export, or
  archive-identical behavior.

### Path A: Happy Path

1. Action: Open Today, review routine steps, complete a step, tap the completed row again, navigate away/back or reload, and verify the completed state.
   Expected result: Completion is responsive, visually clear, append-only, and persists after navigation away and back. A repeated tap on an already-completed row does not remove the completion and does not re-trigger the first check-off activation path. Legacy completion logs still mark the install/account as already activated before future check-offs. Routine product names remain readable without visual ellipses for normal shelf names, and routine instruction lines remain complete or use concise display copy on compact phones. When a streak is visible, the Today streak/adherence pill shows singular/plural copy correctly, remains a buffered 48 px phone target, and opens the adherence surface, or its contextual Pro gate for free users.
   Evidence: Screenshot before completion, after completion, after repeated tap, and after navigation or reload.

### Branches

- Branch: empty routine
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Today with no routine fixture.
  - Expected result: Empty state gives a clear next action and does not look broken.
  - Evidence: Screenshot.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 opens `/today?routine=AM` with empty local shelf/profile state and verifies `No routine yet`, `Build a routine from your shelf.`, and a 56 px `Add products` action. The example `Cream cleanser` and `Morning routine` check-off rows are absent, horizontal overflow is zero, and tapping `Add products` routes to `/shelf/manual`. Evidence is in `test-results/human-e2e/2026-07-08/today-empty-and-cycle-current/`.
  - Current retained stress evidence: 2026-07-09 Codex in-app browser Expo web at 320 x 480 opens `/today?routine=AM`, verifies the short empty-routine card keeps `Build a routine from your shelf.`, intentionally drops lower helper copy on the first viewport, renders `Add products` as a complete 238 x 56 px button with no clipped/sub-44/blocked-control issues and zero horizontal overflow, then taps `Add products` and reaches `/shelf/manual`. Evidence is in `test-results/human-e2e/2026-07-09/today-empty-support-floor-current/`.
- Branch: offline or sync pending
  - Priority: Important
  - Automate later: Yes
  - Action: Complete a step with the network disabled, relaunch, add/update/delete its Shelf product while still offline, then reconnect with controlled response loss on the Shelf and completion RPCs.
  - Expected result: Local completion and the exact original event identity remain preserved. Shelf replay drains first. Network, authorization, thrown-RPC, and malformed-response ambiguity retain the exact FIFO head; only an exact accepted/idempotent four-field response acknowledges it. Relaunch does not invent a new event, duplicate completion, or success claim.
  - Evidence: Today/Shelf screenshots, encrypted v3 state snapshots before/after relaunch, ordered network/RPC trace, event/operation IDs, and server readback.
- Branch: terminal Shelf fact with correctable completion dependency
  - Priority: Critical
  - Automate later: Yes
  - Action: Queue a completion whose product upsert receives an exact terminal Shelf result. Leave unrelated Shelf and completion work behind it; then queue a corrected Shelf upsert or deletion and retry.
  - Expected result: The missing product completion first receives `COMPLETION_PRODUCT_RETRY_LATER`. If the Shelf record has that unresolved terminal fact and no pending correction, the client atomically moves the exact step plus the remaining same-routine/date pending group through its routine-day marker to the durable outbox tail. Unrelated work drains within the bounded replay budget. No original event enters a permanent dependency quarantine or is deleted. A later correction replays the exact original event. The marker never overtakes an earlier step.
  - Evidence: Local v3 journal/outbox/terminal snapshots for every transition, ordered RPC trace, corrected replay readback, and crash/relaunch checkpoints around the atomic deferral.
  - Open external evidence: Current source has focused tests; exact-current app-surface, physical-iPhone process-death, and hosted two-device evidence remain required.
- Branch: remote-terminal completion cascades routine-day marker
  - Priority: Critical
  - Automate later: Yes
  - Action: Make any scheduled PM step receive each exact remote terminal code, including a step that is terminal before the final check-off appends the routine-day marker and the final step immediately preceding an existing marker.
  - Expected result: The original step remains in the local journal and enters the terminal receipt lane. Any same-routine/date routine-day marker is removed from pending replay and receives `COMPLETION_DEPENDENCY_TERMINAL` with the terminal step event IDs in journal order. The marker is never dispatched. A terminal step cannot manufacture adherence, a milestone, or a server routine-day row.
  - Evidence: Visible Today/adherence state, local terminal receipt snapshot, zero marker-RPC trace, server rows, relaunch proof, and exact code coverage.
  - Open external evidence: Current source has focused tests; fresh UI/native/hosted evidence has not been retained.
- Branch: deletion wins across missing upsert and delayed completion
  - Priority: Critical
  - Automate later: Yes
  - Action: On two authenticated sessions, exercise missing upsert then delete, delete response loss/retry, an upsert after the tombstone, completions at/before and after the effective deletion cutoff, and a cross-owner UUID race.
  - Expected result: Same-owner delete creates only a minimal content-free identity/tombstone and is idempotent. Later upsert cannot resurrect content. A completion at or before the cutoff can reconcile; a later one is terminal. Cross-owner reuse is an ownership conflict. Direct table mutation stays denied, and withdrawal/account deletion removes identity and receipt residue.
  - Evidence: Two-session ordered trace; exact identity/content/completion/receipt rows; direct-DML denial; withdrawal/account-deletion zero counts; and response-loss replay.
  - Open external evidence: Local database contracts do not replace hosted two-device, stale-session, worker, backup, or physical-iPhone proof.
- Branch: legacy UUID or timezone cannot construct replay work
  - Priority: Critical
  - Automate later: Yes
  - Action: Relaunch with legacy/v1/v2 completion bytes, incompatible legacy Shelf identifiers/names/barcodes, unavailable or invalid timezone, a later valid IANA timezone, and repeated UUID-collision fixtures.
  - Expected result: Historical completion schemas never invent routine IDs, step IDs, timestamps, adherence, or replay work. Incompatible Shelf records stay repair-required. A visible check-off that cannot construct canonical sync evidence stays in explicit encrypted unsynced state and can promote its original event after a valid timezone is available. UUID generation is lowercase v4, bounded, collision-aware, and fails closed instead of reusing identity.
  - Evidence: Byte-identical legacy snapshots, repair/unsynced UI and export snapshots, recovered event identity, timezone/date trace, and focused source/native relaunch tests.
- Branch: partial routine does not become adherence
  - Priority: Critical
  - Automate later: Yes
  - Action: Complete one AM step, then one of several PM steps, and open Streak & adherence.
  - Expected result: Step check-offs persist, but neither a partial AM nor partial PM routine creates a completed night, advances the streak, earns a cycle milestone, or triggers the seven-day review moment. The day qualifies exactly once only after every currently projected PM or recovery step is durably complete.
  - Evidence: Before/after Today screenshots, adherence screen snapshot, private completion-envelope snapshot, analytics/haptic log, and relaunch verification.
- Branch: governed App Store review request after durable value
  - Priority: Important
  - Automate later: Yes
  - Action: On a supported iPhone development build, reach the seventh durable completed routine day and separately save an exact reviewed conflict choice. Repeat with a partial or failed completion, failed conflict save, data export, payment, disabled flag, malformed or future prompt history, the same app version, cooldown/cap exhaustion, simultaneous qualifying outcomes, backgrounding, consent withdrawal, and account switch. Dismiss the system sheet where it appears and repeat with VoiceOver.
  - Expected result: Only the two successful governed value moments may request StoreKit, after the saved action finishes and a two-second settled-state pause. At most one attempt is reserved per app version, no more than three in 365 days, and attempts remain at least 30 days apart. Every denial branch stays silent. StoreKit display or dismissal never blocks, reverses, gates, rewards, or pressures the completed product action, and focus returns safely when the system sheet closes.
  - Evidence: Exact build/version, screen recording or screenshots, sanitized logs, encrypted attempt-state snapshots, simultaneous-call trace, account/consent-boundary trace, VoiceOver focus notes, and focused source tests. StoreKit nondisplay is an allowed system outcome and must not be misreported as proof that the request was never made.
  - Open external evidence: Source tests pass, but Windows and Expo web cannot render the native StoreKit review sheet; signed iOS and physical-device verification remain required.
- Branch: completion storage unreadable or write unconfirmed
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Today with malformed/future-version/unreadable completion state; separately make a check-off persistence operation reject before commit and ambiguously after commit.
  - Expected result: Today never renders an invented unchecked state, disables completion controls, explains that check-offs are unavailable, and offers retry. A failed or unconfirmed write produces no success haptic, analytics, milestone, review prompt, or navigation success and preserves bytes unless exact rollback is verified.
  - Evidence: Error/retry screenshots, accessibility snapshot, storage transcript, and zero-success-side-effect log.
- Branch: relaunch after completion
  - Priority: Important
  - Automate later: Yes
  - Action: Complete a step, relaunch the app, and return to Today.
  - Expected result: The state remains correct.
  - Evidence: Video or screenshot sequence.
- Branch: compact PM cycle strip labels
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the PM Today tab at a 320 px phone width with the skin-cycling strip visible.
  - Expected result: Exfoliate, Retinoid, and Recover phase labels remain readable without ellipses or clipped glyphs while the active phase still has a clear visual state.
  - Evidence: Phone-width screenshot and cycle-label geometry snapshot.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 seeds a local sensitive/barrier profile plus cleanser, retinol, glycolic, ceramide, and SPF shelf products, opens `/today?routine=PM`, and verifies the six-night skin-cycling strip renders split two-line Exfoliate/Retinoid/Recover labels with full accessibility labels, no visual ellipses, zero horizontal overflow, and 44 px+ visible controls. Evidence is in `test-results/human-e2e/2026-07-08/today-empty-and-cycle-current/`.
- Branch: local date and clock display
  - Priority: Important
  - Automate later: Yes
  - Action: Open Today in the evening routine state.
  - Expected result: The header uses the current local date and clock time, never a static design-placeholder time.
  - Evidence: Screenshot and visible-text snapshot.
- Branch: live 17:00, midnight, foreground, and timezone transition
  - Priority: Critical
  - Automate later: Yes
  - Action: Keep Today open from 16:59 through 17:00 and from 23:59 through midnight; separately background the app, change day or timezone, and foreground it.
  - Expected result: The visible clock refreshes, AM becomes PM at 17:00, the local-date completion and progress query keys change at midnight, and foregrounding immediately adopts the current local date/phase without writing a completion to the stale day or phase.
  - Evidence: Fake-timer/AppState transcript plus native foreground and DST/timezone video.
- Branch: one/two missed nights and three-night lapse
  - Priority: Critical
  - Automate later: Yes
  - Action: Complete qualifying PM/recovery routines around one and two missed nights, then repeat with three missed nights.
  - Expected result: One or two interior misses are absorbed automatically with calm protected copy and no guilt; a third miss lapses the active run without shrinking the historical best, and the next qualifying routine produces a neutral welcome-back state.
  - Evidence: Adherence/welcome-back screenshots, client/server parity fixture, relaunch/cross-device proof, and analytics publication evidence when legally admitted.
- Branch: CORE-05 combined data export and withdrawal
  - Priority: Critical
  - Automate later: Yes
  - Action: With pending, accepted, and terminal Shelf/completion sync facts, request a combined export; then withdraw health-data consent and request/export again only through the lifecycle states the UI permits.
  - Expected result: The current-device export labels local pending/terminal v3 records as `shelf_and_sync_state` and `completion_and_sync_state`. Server schema v4 includes exact subject-facing stable identity and receipt fields through three owner-derived projections and excludes internal `request_sha256`. Every active export read uses the initial lifecycle-derived health epoch and aborts if lifecycle changes. Stable withdrawn/never-active state yields exact empty health sources under the deny epoch; synthetic nonactive residue fails closed. Withdrawal erases local sync state, stable identities, and both minimized ledgers without deleting Auth or billing.
  - Evidence: Export JSON and manifest; owner/count/checksum/column results; lifecycle transition trace; exact pre/post database/local counts; raw-payload/digest absence; and account/billing preservation.
  - Open external evidence: Hosted export completeness/concurrency, native share/cache cleanup, processor/backup handling, final policy/App Privacy answers, `request_sha256` rights treatment, and counsel/App Review remain open.

## Flow: Shelf Product Add

- Goal: A user can add or find a skincare product and understand any match/conflict result.
- Persona: User building their shelf.
- Entry state: User has completed onboarding or has a seeded account/local state.
- Start screen/URL/window: Shelf tab.
- Success state: Product is added, or the user receives a clear no-match/manual-add/retry path without an automatic report, queued lookup, or Shelf mutation.
- Priority: Critical
- Automate later: Yes
- Surface: iOS 17+ is the launch surface. Expo web may verify compatible
  navigation, recovery, async, and layout behavior but cannot prove camera,
  permission, SecureStore/Keychain, or physical-device behavior. Android is
  resilience-only under the current launch contract.
- Launch-blocking web-compatible viewports: 375 x 667, 390 x 844, and 430 x 932. The 360-wide and 320-wide browser sizes are resilience/stress evidence,
  not the launch support floor.
- Evidence folder: `test-results/human-e2e/2026-07-18/cat04-catalog-recovery-current/`
- Retained governed local evidence: the deterministic Expo-web matrix bound to
  the pre-CAT-06 source passed 45/45 matched, wrong-match, no-match,
  offline/error, permission/Settings failure, malformed-identity, OCR-capture
  fallback, and manual-barcode validation scenario executions plus 18/18
  consent bootstraps at 375 x 667, 390 x 844, and 430 x 932. It retains 365
  tracked files and 144 screenshots with zero browser failures. The packet is
  now historical/stale after the shared camera lifecycle changed and must be
  regenerated against the accepted CAT-06 source. It records
  `nativeDeviceProof=false`: neither the retained packet nor a regenerated web
  packet proves native camera, SecureStore/relaunch, hosted
  reconnect/reporting, physical-iPhone accessibility, or backend behavior.
- Historical local evidence: `test-results/human-e2e/2026-07-07/shelf-product-detail-routine-role-current/`,
  `test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/`, and
  `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/`.

### Path A: Happy Path

1. Action: Open Shelf, search for a known reviewed fixture product, choose `Use this match`, complete opened/freshness intake, save, and confirm the detail/Shelf state.
   Expected result: Only an exact reviewed, currently servable first-party catalog projection is accepted; search controls stay within every supported iPhone-class viewport; one deliberate save creates one Shelf row; and no recommendation, source-rights, or freshness fact is invented.
   Evidence: Supported-viewport screenshots, step/result JSON, browser/network logs, and focused decoder/save contracts. Native catalog acceptance still requires the physical-iPhone and hosted lanes below.

### Branches

- Branch: product detail routine role
  - Priority: Critical
  - Automate later: Yes
  - Action: Open a real product detail from Shelf, inspect the routine role card, and tap its routine action.
  - Expected result: The detail hub explains whether the product is already used in the generated routine or is not placed yet, and the routine action routes to `/routine/plan` without leaving the user at an inventory dead end.
  - Evidence: Product detail screenshot, visible-text snapshot, and routine-plan destination snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 opens `Mineral SPF 50` from Shelf, shows `ROUTINE ROLE` with `Used in your Morning routine`, exposes the `Review routine placement` action, and routes to `/routine/plan` with zero horizontal overflow.
- Branch: product detail lifecycle and catalog-report recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: Add or open a real Shelf product, open product detail, tap More options, close the remove/discard sheet, tap Report an issue, and choose a catalog issue while the catalog backend is unavailable.
  - Expected result: Lifecycle and catalog-report choices stay inside named route-owned sheets, use 48 px+ controls, open no native or JavaScript dialog, keep the product detail at zero horizontal overflow, and render raw-error-free inline report feedback after a failed catalog report.
  - Evidence: Product-detail screenshots, sheet dialog snapshot, inline alert snapshot, dialog-state check, control-geometry snapshot, and browser logs.
  - Historical local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 adds `Route Owned Balm`, opens product detail, verifies `Remove from shelf?` and `Report catalog issue` are named `role="dialog"` sheets with modal semantics and 48 px+ controls, submits `Wrong product match` against the unavailable catalog backend, and sees inline `Report not sent` feedback with no JavaScript/native dialog and zero horizontal overflow. The first pass found unnamed dialog nodes; post-fix evidence is in `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/`. This predates the explicit identity/recipient confirmation and does not prove the current report flow.
  - Current glyph/dock recheck: 2026-07-08 Codex in-app browser Expo web at 320 x 568 adds `Glyph Gel`, opens product detail, verifies the product-detail `More options` glyph remains a 48 x 48 accessible `More options` button after replacing the literal ellipsis text, confirms the best-before row is fully reachable after scroll instead of sitting under the lifecycle dock, opens the named `Remove from shelf?` dialog, keeps lifecycle controls 48 px+, has zero horizontal overflow, and records no current-origin browser warn/error logs. Evidence and report are in `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/` and `docs/e2e-bug-reports/2026-07-08-shelf-detail-more-options-glyph-dock.md`.
- Branch: no search result
  - Priority: Critical
  - Automate later: Yes
  - Action: Search for a product that should not match, tap `Report missing product`, then use `Add by hand`.
  - Expected result: No-match state offers a separate missing-product report and manual add. Before `Send report`, the user can confirm or edit the product name and sees the exact identity, account linkage, first-party operator recipient, export/deletion treatment, and no-third-party-catalog-recipient boundary. Cancel sends nothing. When catalog reporting is unavailable, the route renders inline `Report not sent` feedback without a native or JavaScript dialog, then preserves the typed product name through manual add.
  - Evidence: Screenshot, visible-text snapshot, console/network log snapshot, route snapshot, and control-geometry snapshot.
  - Current local evidence: 2026-07-08 in-app browser Expo web at 320 x 568 uses `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match`, searches `definitely missing sunscreen`, verifies the no-match copy offers `Add by hand`, and confirms the fallback opens `/shelf/manual` with zero horizontal overflow and 50 px+ visible controls. Evidence is in `test-results/human-e2e/2026-07-08/shelf-add-recovery-current/`.
  - Historical missing-product report evidence: 2026-07-09 Codex in-app browser Expo web uses `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match` at 390 x 844 to search `definitely missing sunscreen`, verifies `Report missing product` is a 155 x 48 px hit-testable action, taps it, sees inline `Report not sent` feedback with no JavaScript dialog or current-route warn/error logs, and continues through `Add by hand` with the missing query preserved in Product name. A 360 x 640 support-floor spot check verifies Back, Search, Report missing product, and Add by hand remain fully visible, 48 px+, center-hit-testable, and at zero horizontal overflow. Evidence and report are in `test-results/human-e2e/2026-07-09/catalog-missing-product-report-current/`. It predates the current confirmation/disclosure step and remains stress evidence only; live Supabase report insertion remains environment QA.
- Branch: wrong catalog match before add
  - Priority: Critical
  - Automate later: Yes
  - Action: Search for a fixture product that returns an incorrect catalog match, tap `Not this product`, then continue through `Add by hand`.
  - Expected result: Search results make `Use this match` and `Not this product` equally clear before the product is added. `Not this product` opens a separate confirmation that displays the exact catalog product identity and recipient/data-rights treatment; Cancel sends nothing. A failed submission uses truthful inline `Report not sent` recovery, never opens a native/JavaScript dialog, and preserves the search query through manual add.
  - Evidence: Search result screenshot, inline feedback snapshot, manual recovery snapshot, 360 x 640 support-floor geometry spot check, and browser logs.
  - Historical local evidence: 2026-07-09 headless Chrome Expo web uses `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=wrong_match` with the dev-web `e2eQuery` seed to search `ceramide cleanser`, verifies `Use this match` and `Not this product` are 48 px hit-testable actions, reports the wrong match, sees inline `Report not sent` feedback with no dialog, then opens `/shelf/manual` with `Product name` preserved as `ceramide cleanser`. A 360 x 640 support-floor spot check verifies Back, Search, Use this match, Not this product, and Add by hand remain visible, 48 px+, center-hit-testable, and at zero horizontal overflow. Evidence and report are in `test-results/human-e2e/2026-07-09/catalog-search-wrong-match-current/`. It predates the current confirmation/disclosure step and remains stress evidence only; live Supabase report insertion remains environment QA.
- Branch: stale search response, thrown request, and retry
  - Priority: Critical
  - Automate later: Yes
  - Action: Start one slow search, immediately submit a different query, resolve the newer request first and the older request last; separately force a thrown/offline request and retry without retyping.
  - Expected result: The older response cannot replace the newer query/result or clear its state. A rejected request leaves the last submitted text intact, ends the busy state, shows route-owned raw-error-free recovery, and allows another Search action. No unmounted route receives a late state update.
  - Evidence: Deterministic deferred-promise integration contract, supported-viewport search screenshots, step JSON, and browser console/network logs.
- Branch: malformed or identifier-free catalog report
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the no-match route directly without a normalized barcode, and separately attempt wrong-match reporting with a malformed/non-UUID product ID or missing product identity.
  - Expected result: No report action appears without actionable identity, and the service rejects malformed or identity-free missing/wrong reports before its service-only RPC. A valid report is always a separate explicit action, never an automatic consequence of search, scan, manual add, or retry.
  - Evidence: Direct-entry screenshot, route contract, Edge privacy test, and request/RPC ordering assertion.
- Branch: scan match and wrong-product recovery before add
  - Priority: Critical
  - Automate later: Yes
  - Action: Scan a deterministic reviewed match, choose it once, then repeat and choose the exact `Not this product` action. Separately exercise `Product not found` from a genuine no-match result.
  - Expected result: The exact reviewed UUID and normalized barcode are preserved into the intake or wrong-match confirmation path. The confirmation displays that identity and the recipient/data-rights boundary before `Send report`; Cancel sends nothing. An external, unreviewed, malformed, extra-field, or barcode-mismatched candidate is treated as no match. No Shelf row exists until opened/freshness intake is deliberately saved.
  - Evidence: Matched and wrong-product screenshots at 375 x 667, 390 x 844, and 430 x 932; decoder tests; route and report payload assertions; native camera remains a separate physical-iPhone gate.
- Branch: offline/error scan and explicit retry-when-online
  - Priority: Critical
  - Automate later: Yes
  - Action: Produce offline and server-error scan outcomes, inspect all immediate fallbacks, explicitly tap `Retry when online`, repeat the tap, background/foreground, and reconnect.
  - Expected result: Nothing is queued automatically. The explicit action stores one deduplicated normalized barcode in encrypted, account/health-epoch-bound device storage; it exposes clear saved/already-saved/failure feedback, preserves manual/search/label fallbacks, uses bounded backoff and a seven-day expiry, and never sends lookup content to analytics or an external catalog source.
  - Evidence: Supported-viewport screenshots and step JSON, encrypted queue/foreground tests, analytics payload assertions, and network logs. SecureStore/Keychain, process-death, account switch, and real reconnect remain native/hosted gates.
- Branch: reconnect candidate review, accept, reject, or changed result
  - Priority: Critical
  - Automate later: Yes
  - Action: From Shelf, open a ready reconnect match linked to an existing Shelf row and compare both cards. Accept once with catalog identity unchecked, repeat with the identity checkbox checked, reject another candidate, and force gone/changed/offline revalidation. Repeat with an unlinked candidate and save/cancel/fail its new-product intake.
  - Expected result: Shelf visibly presents every ready candidate for review. Confirmation rechecks the first-party lookup and exact eligible product. The default preserves user-entered name, brand, category, ingredients, and all freshness data; opting into catalog identity changes only name, brand, and category. Ingredients and freshness never come from the queued candidate. A linked mutation uses stale-write protection; an unlinked result remains queued until one idempotent Shelf save succeeds. Reject removes only that candidate. Gone, changed, offline, canceled, failed, or stale outcomes change nothing and keep or remove the queue item only as the visible action promises.
  - Evidence: Candidate/current comparison screenshots, checkbox/accessibility state, accepted/rejected/changed step JSON, queue/store atomicity tests, reload trace, and browser/network logs.
- Branch: manual barcode formatting and checksum recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: Type a complete checksum-bearing GTIN-8, UPC-A/GTIN-12, EAN-13, GTIN-14, or eight-digit UPC-E with spaces or hyphens where applicable; then try incomplete six/seven-digit UPC-E data, a recognized value with a bad checksum, arbitrary letters/punctuation, too few/many digits, and a valid optional blank.
  - Expected result: Permitted separators normalize without changing identity; a complete eight-digit UPC-E expands deterministically to the catalog UPC-A key; incomplete manual UPC-E, recognized bad checksums, undefined GTIN lengths, and lossy/non-numeric input block Continue with inline guidance; optional blank remains valid. The normalized value, not the presentation string, is persisted.
  - Evidence: Form screenshots, keyboard/accessibility inspection, barcode unit tests, and saved Shelf record assertion.
- Branch: uncertain or repeated Shelf save
  - Priority: Critical
  - Automate later: Yes
  - Action: Submit opened/freshness intake, simulate an uncertain response, and retry the same submission before and after relaunch.
  - Expected result: A stable operation UUID returns the existing created row rather than duplicating it; choices remain available after failure; a reconnect candidate is consumed only after the same successful Shelf result is durably associated with it.
  - Evidence: Store/idempotency/queue tests, final Shelf row count, and reload trace.
- Branch: empty Shelf compact phone overflow
  - Priority: Important
  - Automate later: Yes
  - Action: Open the empty Shelf tab at a 320 px phone width.
  - Expected result: The empty-state bottle illustration, headline, helper copy, Scan a barcode action, Add by hand
    action, and floating tab bar stay within the viewport with no horizontal page overflow or side-scroll.
  - Evidence: 320 px screenshot and overflow geometry snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web opens a fresh `localhost:8171` origin at `/shelf` with a 320 px compact phone viewport and no shelf data. The empty Shelf shows the bottle illustration, headline, helper copy, `Scan a barcode`, `Add by hand`, and the floating tab bar in the first viewport; document horizontal overflow is zero, both add actions are 50 px+ tall, each tab target is 54 px tall, no JavaScript dialog is present, and current-origin warn/error logs are empty. Evidence is in `test-results/human-e2e/2026-07-08/shelf-empty-compact-current/`.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web opens a fresh `localhost:8202` origin at `/shelf` with a 320 x 480 viewport and no shelf data. The empty Shelf keeps the bottle illustration, headline, helper copy, `Scan a barcode`, `Add by hand`, and floating tab bar visible in the first viewport; horizontal overflow is zero, all visible user-facing controls are 48 px+, center hit-tests pass, `Add by hand` routes to `/shelf/manual`, `Scan a barcode` routes to `/shelf/scan`, no JavaScript dialog appears, and current-origin warn/error logs are empty. Evidence is in `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/`, `test-results/human-e2e/2026-07-08/commerce-attribution-and-short-phone-ui/`, and `docs/e2e-bug-reports/2026-07-08-shelf-paywall-short-phone-bottom-actions.md`.
- Branch: manual category picker on short phones
  - Priority: Important
  - Automate later: Yes
  - Action: Open Shelf manual add in a 320 px phone viewport, enter product and brand, open the category picker, scroll through all category options, and select the lower "Something else" option.
  - Expected result: The category picker opens as a named bottom sheet instead of an inline list, category rows remain at least 48 px targets, lower options are reachable by scroll, visible option taps are not intercepted by the fixed Continue footer, and the collapsed category field stays polished on compact phones.
  - Evidence: Screenshot sequence and hit-test geometry.
  - Current local evidence: 2026-07-07 in-app browser E2E at 320 x 568 opens `/shelf/manual`, enters `Barrier Balm` / `Layerwell Test`, opens the category picker, scrolls the modal sheet to `Something else`, verifies the row is visible and center-tappable, selects it, confirms the collapsed field reads `Other`, and continues to `/shelf/opened` with zero horizontal overflow and no clipped or sub-44 px visible controls.
  - 2026-07-08 current safe-area follow-up: Source contracts now require the route-local sheet to own its viewport height, reserve a 48 px outside-dismiss space, add native bottom-inset padding only when present, expose a named web dialog, pad the internal category list, and keep the collapsed category accessibility label aligned with the visible compact label. Codex in-app browser Expo web at 320 x 480 opens `/shelf/manual`, fills product and brand, opens the named `Choose product category` dialog, verifies no open-state control issues or horizontal overflow, scrolls to fully visible `Something else`, selects it, confirms the collapsed field exposes `Category, Other`, continues to `/shelf/opened`, and records zero unexpected warn/error logs. Evidence is in `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-320x480-postfix/`; native iOS/Android safe-area, Dynamic Type, keyboard, and screen-reader traversal remain open QA.
  - 2026-07-08 320 x 430 / 320 x 440 follow-up: a shortest-height route sweep found `/shelf/manual` Ingredients hit-blocked by the sticky Continue footer, `/shelf/ocr` clipping `Continue with manual text`, and `/shelf/no-match` clipping and blocking `Add it by hand`. Post-fix Codex in-app browser evidence verifies `/shelf/manual`, `/shelf/ocr`, and `/shelf/no-match` have zero user-facing clipped controls, hit-blocked controls, tiny targets, horizontal overflow, or unexpected route logs. A later 320 x 440 pass added extra ultra-short category-sheet bottom padding so `Something else` scrolls fully into view before selection, verified OCR capture-failure/manual-text continuation into `/shelf/manual`, and added explicit no-match row accessibility labels. The 320 x 430 / 120% text-pressure pass then hid no-match subtitles below 460 px so all three recovery rows remain complete under enlarged text. The broader 49-route post-fix sweep confirms shelf routes are no longer in the failure list. Evidence and bug reports are in `test-results/human-e2e/2026-07-08/shelf-short-phone-430-clearance/`, `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/`, `test-results/human-e2e/2026-07-08/shelf-ultrashort-manual-ocr-current/`, `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/`, `docs/e2e-bug-reports/2026-07-08-shelf-short-phone-430-intake-clearance.md`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`; native iOS/Android safe-area, keyboard, Dynamic Type, barcode camera, and OCR capture remain open QA.
  - 2026-07-08 320 x 370 / 320 x 360 / 130% micro-short text-pressure follow-up: the initial route sweep found `/shelf/manual` exposing the optional Ingredients textarea under the sticky Continue footer. Post-fix, manual add reserves extra split-short spacing below 410 px before optional ingredients and the final 49-route sweeps report zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-current/`, `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-micro-short-370-clearance.md`; native iOS/Android safe-area, keyboard, Dynamic Type, barcode camera, and OCR capture remain open QA.
  - 2026-07-09 layout-constant follow-up: Codex in-app browser Expo web on `localhost:8255` reverified `/shelf/manual` after split-short manual spacing calibration. The retained 320 x 480 stress viewport keeps Cancel, Add by hand, Product name, Brand, Category, and Continue complete with zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. A 320 x 400 non-blocking resilience stress pass keeps the same first-viewport controls complete while Ingredients remains below the first viewport. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
  - 2026-07-09 supported-phone 120% text-pressure follow-up: the route audits found `/shelf/manual` optional Ingredients entering the sticky Continue footer zone and `/shelf/no-match` manual recovery clipping on supported compact heights. Post-fix, manual add defers optional Ingredients below the first viewport and no-match keeps the manual recovery row complete or scroll-reachable. The 320 x 568, 320 x 480, 390 x 844, and 430 x 932 final sweeps report zero failed routes with evidence in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/`, and `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/`.
- Branch: barcode no-match or offline lookup
  - Priority: Critical
  - Automate later: Yes
  - Action: Scan a barcode that returns no catalog match, an external/unreviewed candidate, or an offline/failed lookup; from no-match recovery, explicitly report the identified missing/wrong product or continue by search, label capture/manual transcription, or manual add.
  - Expected result: The scan sheet never dead-ends. It shows a matched candidate, no-match copy, identity-bound report recovery with confirmation before `Send report`, explicit encrypted `Retry when online` for offline/error states, or manual/search/label fallbacks. Legacy `shelf_scans` is purged and sealed; retained server analytics contains only owner-linked lookup type/result/timestamps, while the general analytics event contains only a bounded result bucket.
  - Evidence: Supported-viewport screenshots, step/network logs, inline report-feedback snapshot, migration/Edge assertions, encrypted-queue proof, and analytics payload assertion.
  - Historical local evidence: 2026-07-08 in-app browser Expo web at the stress-only 320 x 568 viewport used `EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=offline`, verified `/shelf/scan` showed offline catalog copy plus label, search, and manual fallbacks, and verified `/shelf/no-match` exposed the same recovery paths without contribution-back or unsafe source claims. Evidence is in `test-results/human-e2e/2026-07-08/shelf-add-recovery-current/`. It predates the encrypted retry/review lane and is not CAT-04 acceptance evidence. There is no request-time OBF lookup.
  - 2026-07-09 retained stress-floor spacing follow-up: before the current 360 x 640 launch floor was accepted, Codex in-app browser Expo web on `localhost:8255` verified `/shelf/no-match` at 320 x 480 and 390 x 844. On the 320 x 480 stress viewport, Search catalog, Scan ingredients, and Add it by hand are all visible 264 x 48 px recovery controls with passing center hit-tests, zero horizontal overflow, no JavaScript dialog, and zero current-origin warn/error logs; clicking them routes to `/shelf/search`, `/shelf/ocr`, and `/shelf/manual`. The 390 x 844 pass keeps the full `Scan the ingredient list` label and all three 334 x 68 px recovery controls visible and hit-testable. Evidence and report are in `test-results/human-e2e/2026-07-09/shelf-no-match-supported-floor-spacing/`; native barcode camera and OCR capture remain device QA.
  - Historical 2026-07-09 missing-product report follow-up: Codex in-app browser Expo web opens `/shelf/no-match?barcode=012345678905` at 390 x 844, verifies Search catalog, Scan ingredients, Add it by hand, and Report missing product are distinct 48 px+ recovery controls with no overlap, taps Report missing product, sees inline `Report not sent` feedback with no JavaScript dialog and zero current-route warn/error logs, then continues to `/shelf/manual`. A 360 x 640 support-floor spot check verifies Close, Search catalog, Scan ingredients, Add it by hand, and Report missing product are fully visible, 48 px+, center-hit-testable, and at zero horizontal overflow. Evidence and report are in `test-results/human-e2e/2026-07-09/catalog-missing-product-report-current/`. It predates the confirmation/disclosure step and is not current CAT-04 report evidence; native barcode camera and live Supabase insert QA remain open.
  - 2026-07-08 shortest-phone follow-up: a 320 x 480 audit found `/shelf/no-match` clipping the `Add it by hand` fallback below the viewport. Post-fix Codex in-app browser evidence at 320 x 481 verifies all three recovery rows are visible, the manual row is a 54 px hit target with no blocked hit-test, clipped controls, horizontal overflow, JavaScript dialog, or current-route warning/error logs, and tapping its visible center routes to `/shelf/manual`. Evidence and bug report are in `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/` and `docs/e2e-bug-reports/2026-07-08-shelf-no-match-short-phone-fallback.md`.
  - 2026-07-08 320 x 430 / 120% text-pressure follow-up: the route audit found `/shelf/scan` fallback content could block the top `Close` button and `torch` switch centers when the camera preview was unavailable. Post-fix, the scan route reserves the header strip, omits the unavailable preview on sub-460 px fallback screens, compacts fallback rows, and the final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`; native camera and torch behavior remain device QA.
  - 2026-07-08 320 x 370 / 130% micro-short text-pressure follow-up: `/shelf/no-match` now switches to a sub-380 px recovery layout that keeps Close in the top-right hit zone, removes the decorative question mark from the first viewport, and moves the manual fallback fully below the first viewport rather than letting it peek as a partial target. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`; native camera and torch behavior remain device QA.
  - 2026-07-08 320 x 360 / 200% text-pressure follow-up: the harsher sweep found the second Shelf no-match recovery row peeking as an 11 px partial target at the bottom edge. Post-fix, the secondary scan/manual recovery block is deferred below the first viewport on micro-short phones while Search catalog remains complete and the other recovery actions remain scroll-reachable. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`; native camera and torch behavior remain device QA.
  - 2026-07-09 390 x 844 / 200% text-pressure follow-up: the modern-phone sweep found the Shelf no-match Scan ingredients action peeking as a partial bottom target after the broader paywall/settings pass. Post-fix, the compact Scan row is lifted into a complete 48 px hit target while Add by hand remains scroll-reachable, and the final 49-route sweep plus current-source rerun report zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-current-rerun/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-390-clearance.md`; native camera and torch behavior remain device QA.
  - 2026-07-09 430 x 932 / 170% text-pressure follow-up: the supported tall-phone sweep found lower Shelf no-match recovery controls could still approach the viewport edge under heavy text pressure. Post-fix, the tall-phone no-match layout adds recovery spacing so lower-priority actions stay scroll-reachable instead of peeking as partial first-viewport targets, and the final 430 x 932 sweep reports zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-170-supported-phone-clearance.md`; native camera and OCR behavior remain device QA.
  - 2026-07-09 430 x 640 / 200% scan support-band follow-up: the full support-band sweep found `/shelf/scan` showing `Scan ingredient label` as a complete visible row whose center hit the camera-helper copy layer instead of the row. Post-fix, the 430-wide scan support-floor guard uses the compact fallback-row layout, and the focused scan rerun plus full 49-route 430 x 640 sweep report zero failures. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-scan-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-430-640-text-pressure.md`; native camera and torch behavior remain device QA.
  - 2026-07-09 360 x 700 / 200% scan boundary follow-up: the full supported Android-class sweep found `/shelf/scan` exposing `Add it by hand` as a 24 px partial bottom-edge target because the compact scan guard excluded exactly 700 px height. Post-fix, 360 x 700 uses the compact fallback-row layout, and the full 49-route rerun reports zero failures. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-postfix/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-360-700-boundary.md`; native camera and torch behavior remain device QA.
- Branch: native OCR disabled scan fallback copy
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/shelf/scan` while native OCR is not enabled and inspect the label-scan fallback row before navigating to `/shelf/ocr`.
  - Expected result: The scan fallback must not imply working OCR. It should offer label capture plus manual typing/review, preserve the `/shelf/ocr` fallback path, keep the control 44 pt+, and show no `Review editable OCR` copy while `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`.
  - Evidence: Screenshot, visible-text snapshot, route snapshot, control-geometry snapshot, and browser logs.
  - Current local evidence: 2026-07-09 focused `shelfRoutes` contract coverage verifies the fallback copy says `Capture label, then type from it`, preserves the full accessibility label, and contains no `Review editable OCR` copy. The 320 x 480 full-route rerun also verifies `/shelf/scan` has zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/current-main-short-phone-480-rerun/`.
  - Current focused evidence: 2026-07-09 Codex in-app browser Expo web at 360 x 640 opens `/shelf/scan`, verifies the compact `Scan label` fallback exposes the honest accessibility label `Scan ingredient label. Capture label, then type from it`, verifies the old `Review editable OCR` copy is absent, taps the fallback, reaches `/shelf/ocr`, and verifies `On-device OCR is not enabled in this build yet` with zero horizontal overflow and zero current-route warning/error logs. Evidence is in `test-results/human-e2e/2026-07-09/shelf-scan-native-ocr-disabled-copy-current/`.
- Branch: CAT-05 staging-only source-candidate gate
  - Priority: Critical
  - Automate later: Yes
  - Action: Inspect and exercise the label-recognition route from the exact EAS profile under test.
  - Expected result: Only the internal `staging` profile sets `EXPO_PUBLIC_NATIVE_OCR_ENABLED=true`; `development` and `production` remain false. A missing, unavailable, or contract-mismatched native module fails into explicit manual-entry recovery rather than implying OCR works. Enabling the flag alone does not satisfy the gate.
  - Evidence: Exact source/profile/build binding, native-module availability result, signed-archive inspection, and physical-iPhone route capture. The deterministic Expo-web fixture below may mirror enabled UI states but is not an EAS staging binary.
- CAT-05 evidence freshness note: every CAT-05 deterministic Expo-web artifact
  below is retained historical evidence bound to
  `fec382eddd0e79f73b4c38b5de30d996928a8fc9`. CAT-06 subsequently changed
  `/shelf/ocr` camera admission and Progress shutter ownership, so those
  artifacts are stale for the current source until regenerated. The recorded
  UI observations remain useful for comparison, but they are not current
  exact-source evidence and never prove native behavior.
- Branch: CAT-05 deterministic recognized review, Retake, and Continue
  - Priority: Critical
  - Automate later: Yes
  - Action: At 375 x 667, 390 x 844, and 430 x 932, use the development-only `recognized` fixture, tap Capture label, wait through the reading state, inspect the Unicode transcript and uncertainty/truncation cues, Retake, capture again, and Continue.
  - Expected result: Reading stays visibly busy without blocking typing; the Unicode transcript is preserved exactly; ambiguous/review lines are named in words; incomplete output is disclosed; no confidence is called percent accurate; Retake returns to capture; and Continue carries only the reviewed editable text to manual entry.
  - Evidence: Governed exact-source `recognized-review-retake-continue` artifacts at all three viewports, including accessible-name/alert/live-region snapshots, text-field value, control geometry, sanitized browser logs, and manual-route handoff, are retained in `test-results/human-e2e/2026-07-18/cat05-native-ocr-web-ui-current/`. The 375 x 667 manual-handoff PNG does not show the Ingredients field or prefill, so compact visual handoff is not proven by that screenshot.
- Branch: CAT-05 edit fence and explicit suggestion adoption
  - Priority: Critical
  - Automate later: Yes
  - Action: Type a Unicode correction while the deterministic recognized result is still pending, then inspect and explicitly adopt the recognized suggestion.
  - Expected result: A late result never overwrites the user's text. The route says the edits were kept and exposes `Use recognized text`; only that explicit action replaces the edit, and the suggestion action then disappears.
  - Evidence: Governed exact-source `edit-fence-suggestion-adoption` artifacts at all three supported viewports are retained in `test-results/human-e2e/2026-07-18/cat05-native-ocr-web-ui-current/`, alongside review-state/coordinator tests. Native cancellation and late-result races remain physical-device/exact-build evidence.
- Branch: CAT-05 no-readable-text manual recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: Run the deterministic `no_text` fixture, then type multilingual Unicode ingredient text and Continue.
  - Expected result: `No readable text found` is an alert; Retake and the editable manual field remain available; the user-entered Unicode text reaches manual add without a fake match or automatic Shelf mutation.
  - Evidence: Governed exact-source `no-text-manual-recovery` artifacts at all three supported viewports are retained in `test-results/human-e2e/2026-07-18/cat05-native-ocr-web-ui-current/`.
- Branch: CAT-05 timeout manual recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: Run the deterministic `timed_out` fixture, then type multilingual Unicode ingredient text and Continue.
  - Expected result: A stable `Label reading took too long` alert appears; Retake and manual entry remain usable; no native error or transcript is logged or shown; and manual handoff succeeds.
  - Evidence: Governed exact-source `timeout-manual-recovery` artifacts at all three supported viewports are retained in `test-results/human-e2e/2026-07-18/cat05-native-ocr-web-ui-current/`. Exact native 12-second timeout/cancellation evidence on physical iPhones remains open.
- Branch: CAT-05 generic failure manual recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: Run the deterministic `failed` fixture, then type multilingual Unicode ingredient text and Continue.
  - Expected result: A stable generic label-not-read alert appears; Retake and manual entry remain usable; raw native failure detail stays hidden; and manual handoff succeeds.
  - Evidence: Governed exact-source `failure-manual-recovery` artifacts at all three supported viewports are retained in `test-results/human-e2e/2026-07-18/cat05-native-ocr-web-ui-current/`. Exact-build native failure and missing/misconfigured-module checks remain open.
- Branch: CAT-05 navigation, cancellation, and temporary-photo cleanup
  - Priority: Critical
  - Automate later: Yes
  - Action: Leave during capture and recognition through the visible Back action and every supported navigation-removal gesture/action; separately Retake, Continue, force cleanup failure/retry, terminate after raw camera capture, cold relaunch, and attempt both Shelf-label and Progress shutters around a failed/then-successful startup listing.
  - Expected result: The route guard is armed before capture, waits for capture completion, drains OCR cancellation, awaits idempotent deletion, and only then redispatches the original navigation action. Failed drain/deletion leaves the route blocked with retry instead of authorizing departure. Retake and Continue use the same drain-before-delete order. Both repository shutters await the shared startup drain before `takePictureAsync`. Snapshot acquisition may retry only while both shutters remain gated and before the first successful listing. That first app-boot snapshot is immutable; bounded deletion retries use only its remaining names and never relist a post-boot capture as stale. App exit/process death is outside `usePreventRemove` and therefore requires cold-relaunch cleanup proof.
  - Evidence: Source lifecycle/navigation and Progress-capture tests plus exact-build Back/swipe/pop/reset, both-shutter startup gating, failed-listing retry, immutable-snapshot, interruption, process-death, bounded-delete retry, managed-cache, Expo Camera cache, and Expo Image/SDWebImage path/digest/signature reports. Expo web cannot prove this branch.
- Branch: CAT-05 deterministic-web evidence boundary
  - Priority: Critical
  - Automate later: Yes
  - Action: Run the five CAT-05 deterministic scenarios across 375 x 667, 390 x 844, and 430 x 932 after the source checkpoint is committed.
  - Expected result: The governed run has 15 scenario executions and four consent bootstraps, records `nativeDeviceProof=false`, and labels itself development-only Expo-web UI-state evidence. It must not be cited as Apple Vision, Swift, camera, iOS binary, physical-iPhone, OCR accuracy/latency, privacy, zero-network, cleanup, VoiceOver, archive, App Review, legal, or release proof.
  - Evidence: The retained packet at `test-results/human-e2e/2026-07-18/cat05-native-ocr-web-ui-current/` is bound to source `fec382eddd0e79f73b4c38b5de30d996928a8fc9` and passed 15/15 scenarios plus 4/4 consent bootstraps with zero browser failures, 139 non-summary artifacts, and 55 PNGs. It is stale for the current source after CAT-06 and must be regenerated. It records `nativeDeviceProof=false`; the macOS compile remains unverified/pending, the 375 x 667 manual-handoff PNG does not show Ingredients/prefill, and the multilingual fixture has no Arabic/Hebrew RTL sample. It is not Vision, Swift, camera, iOS-binary, physical-device, native privacy-cleanup, accuracy, latency, native-accessibility, archive, App Review, legal, release, or revenue proof.
- Branch: CAT-06 shared permission, foreground, and preview lifecycle
  - Priority: Critical
  - Automate later: Yes
  - Action: On each camera route, begin from undetermined permission, deny and retry, permanently deny and open Settings, make Settings opening fail once, grant in Settings, background/foreground, blur/refocus, trigger a native interruption, fail camera mount/ready, retry, and deliver a queued native callback from the invalidated camera generation.
  - Expected result: No preview mounts before verified grant or while the app/route/business gate is inactive. The OS permission prompt can finish normally, but its explicit request result is invalidated when iOS reports `inactive`; the camera stays closed and a fresh foreground query is authoritative before remount. Only one preview is active; operations remain blocked until camera-ready; mount retry creates a fresh keyed generation; stale permission, ready, mount, barcode, and still-photo callbacks cannot navigate or mutate. Permanent denial exposes one Settings action, failure is visible/retryable, and Scan/OCR keep non-camera recovery reachable.
  - Evidence: Shared lifecycle unit tests and route contracts; then the exact signed-archive CAT-06 packet with both required physical iPhones, permission-state timestamps, interruption video/logs, fresh-query ordering, mount-generation proof, and VoiceOver/Dynamic Type results. Expo web can cover only deterministic UI state and cannot close this branch.
- Branch: CAT-06 exact-build evidence boundary
  - Priority: Critical
  - Automate later: Yes
  - Action: Complete the schema-v1 camera-lifecycle artifact for `/shelf/scan`, `/shelf/ocr`, and `/progress/capture` on the supported-floor iOS 17.x and current flagship physical iPhones.
  - Expected result: All nine governed suites run on every route/device: permission, Settings, lifecycle, mount, camera operation, offline, interruption, accessibility, and privacy. The two-phone floor contains 54 unique runs and proofs. The artifact binds the exact committed source, EAS build, signed archive, final `Info.plist` camera purpose string, device/install receipts, network and cleanup reports, accessibility report, scenario index, and three named signoffs. `PHASE5_CAMERA_PERMISSION_QA_PASS` is ignored.
  - Evidence: `docs/phase-5/camera-lifecycle-evidence-runbook.md`, one validated evidence JSON under `docs/phase-5/evidence/camera-lifecycle/`, its hash-verified attachments, and passing strict camera/device packet commands. No completed artifact exists yet.
- Branch: camera permission denied
  - Priority: Important
  - Automate later: Yes
  - Action: Attempt scan/OCR with camera permission denied.
  - Expected result: The app shows a clear recovery path, including Open settings when the OS will not prompt again; if Settings cannot open, the app shows a stable unavailable alert instead of appearing inert.
  - Evidence: Screenshot, alert text, and simulator permission state.
  - Current local evidence: 2026-07-08 in-app browser Expo web at 320 x 568 uses `EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION=denied_no_retry` and `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1` to cover `/shelf/scan` and `/shelf/ocr`. Both routes show exactly one `Open settings` action, the forced Settings failure renders inline `Camera settings unavailable` recovery with no JavaScript dialog, no raw fixture text, zero horizontal overflow, and 48 px+ visible controls. Scan keeps Search catalog, Scan ingredient label, and Add it by hand fallbacks visible; OCR keeps `Continue with manual text`, accepts `Aqua, Glycerin, Niacinamide`, and carries it into `/shelf/manual`. Evidence and report are in `test-results/human-e2e/2026-07-08/shelf-camera-permission-denied-current/`; physical iOS/Android OS permission-sheet, real Settings handoff, barcode camera, and OCR camera QA remain open.
- Branch: camera start or label capture failure
  - Priority: Important
  - Automate later: Yes
  - Action: Open Shelf OCR on a device where the camera cannot start, or force the label photo capture call to reject.
  - Expected result: The user sees stable camera-unavailable or label-not-captured copy and can continue with manual ingredient text instead of being returned to an unexplained camera state. On short phones, the manual review text area and final Continue action do not overlap.
  - Evidence: Alert text, visible fallback state, and route snapshot.
  - Current local evidence: 2026-07-08 in-app browser Expo web at 320 x 568 uses `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once` to force `/shelf/ocr` label capture rejection. The route shows inline `Label wasn't captured` recovery copy with no dialog, exposes a visible 48 px `Try label photo again` action, keeps the manual text field and final `Looks right. Continue` action non-overlapping after scroll/focus, carries `Aqua, Glycerin, Niacinamide` into `/shelf/manual`, hides the raw fixture error, and logs no current-origin browser errors. Evidence and report are in `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/`; physical iOS/Android camera mount, permission-denied, and real capture-rejection QA remain open.
- Branch: opened date or replenish edge case
  - Priority: Important
  - Automate later: Yes
  - Action: Set an opened date or replenish state at a boundary date.
  - Expected result: The app explains expiration/replenish status clearly, and the opened-date sheet shows all three core opened-state choices without clipping on short phones before the user scrolls to PAO or save actions.
  - Evidence: Screenshot.
  - Historical evidence only: The 2026-07-08 Expo-web packet at `test-results/human-e2e/2026-07-08/shelf-opened-replenish-boundary-current/` proved the then-current three opening choices and corrected manufactured-scarcity copy, but its replacement action automatically opened the new unit. CAT-07 now requires a fresh explicit replacement opening choice, so this packet is stale for replacement semantics and cannot support current acceptance. Native bottom-sheet, screen-reader, Dynamic Type, and restart-persistence QA remain open.
  - Current ultra-short direct-entry evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the no-draft `/shelf/opened` backdrop `Dismiss` control being reported as a clipped visible control in the post-Recommendations route sweep. Post-fix, the no-draft opened-date recovery sheet hides the backdrop from accessibility, keeps the visible Close and `Add product by hand` controls complete, and tapping `Add product by hand` routes to `/shelf/manual` with no clipped controls, no sub-44 controls, and no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/` and the fresh 49-route zero-failure sweep `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
- Branch: complete Shelf freshness and replacement provenance lifecycle
  - Priority: Critical
  - Automate later: Yes
  - Entry state: Reset local app state at `/onboarding/products`, with no product draft or Shelf rows.
  - Action: Add products covering every evidence row: unopened with/without a physical-package printed date entered by the user; opened with a winning user-entered printed date; opened with a winning direct label PAO; reviewed catalog-delivered product-specific `label`, `brand_label`, and `catalog` PAO rows; a reviewed catalog row that also carries `expiry_source='printed'`; a category-only catalog row; and unknown. Exercise one product-specific row plus a matching category row, same-month duplicate product-specific rows, exact PAO values `120` and `121`, printed-versus-PAO precedence, and an exact tie. Enter impossible/future opened dates, reload, then replace a unit and explicitly choose today, an exact past opening date, and unopened in separate runs. Seed a canonical v1 local envelope containing a catalog-linked date, read without mutation, perform one successful authorized mutation, force a failed mutation, and exercise explicit package-date reconfirmation.
  - Expected result: Onboarding cannot bypass the opening-state choice and invalid/future dates cannot start a PAO clock. Unopened units retain `opened_at=null`; without a user-entered/reconfirmed package date they remain `unknown` with no app-derived date. Even an exact reviewed/source-bound/region-matched product-level catalog `expiry_date` does not populate Shelf because it lacks a lot/package binding. Ambiguous historical catalog-linked dates are retained only in the non-actionable legacy-unverified quarantine and never drive time-pressure UI or recommendations unless the user separately reconfirms the date from this physical package. Direct product-label entry persists Shelf `label`; exactly one reviewed matching-source/region catalog-delivered product-specific `label`, `brand_label`, or `catalog` row persists Shelf `catalog`, and actor-neutral label copy never claims who entered historical v1 data. Matching duplicate product-specific rows fail closed even when their months agree; a category row does not invalidate one product-specific winner. A category-only current payload and v1 upgrade fail to `unknown` because they cannot prove reviewed `product_categories` authority; `estimated` intake stays unavailable until an exact bounded server-attested category marker is retained locally and both the database guard and named chemistry review prove the exact non-sunscreen rule. The 120-month technical ceiling remains eligible and 121 fails closed without implying a typical or legally approved lifetime. `printed` and `pao_computed` states identify the actual winning evidence, and an exact tie resolves to `printed`. `estimated`, once supportable, stays visibly approximate; `unknown` shows neither a date nor estimate. Only physical-package `printed` or label/catalog-PAO states can drive countdown, expired, Expiring-filter, or replenishment UI. Replacement archives the prior unit, creates a new UUID, preserves product/PAO provenance, clears inherited printed expiry, and uses the user's explicit opening state rather than automatically opening today. Canonical v1 bytes remain byte-for-byte unchanged on read and failed mutation, then become canonical v2 only after a successful authorized atomic mutation.
  - Invalid/empty/recovery branches: Exact date input rejects malformed, impossible, and future dates; `Not on label` clears PAO/source; direct `/shelf/opened` without a draft recovers safely; Back/Close from an onboarding-origin sheet returns to onboarding; category estimate and unknown produce no automatic replenishment signal; non-canonical or future-version local envelopes remain byte-preserved and reject mutation.
  - Responsive/accessibility branch: Verify 360 x 640 and 390 x 844 with zero horizontal overflow, complete 48 px controls, named exact-date fields, explicit radio states, route-owned inline validation, no JavaScript dialog, and clean current-origin browser logs.
  - Evidence: Supported-phone screenshots, accessibility/geometry snapshots, reload assertions, byte/digest assertions for v1→v2 migration, browser/device logs, source contracts, focused lifecycle tests, hosted migration/RLS/catalog readback, qualified chemistry/legal review, and an exact-build E2E report.
  - Current evidence boundary: The 2026-07-11 Expo-web packet in `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/` remains useful historical UI evidence, but it predates CAT-07's explicit replacement opening choice, category-estimate exclusion, and v1→v2 byte-preservation contract. It is stale for current source acceptance and cannot prove native encrypted storage/relaunch, live migration/RLS/catalog truth, physical-device accessibility, notifications, or named chemistry/legal review. CAT-07 remains `in_progress`.
- Branch: replenish remains commerce-free at COM-01A literal zero admission
  - Priority: Critical
  - Automate later: Yes
  - Action: Set a product to a PAO boundary and open `/shelf/replenish` while
    positive-looking commerce flags and legacy consent exist.
  - Expected result: The route exposes no commerce, retailer, consent,
    where-to-buy, paid-link, or `See similar options` CTA. The user can complete
    only the ordinary non-commerce replenish/replacement flow.
  - Evidence: The 2026-07-29 Expo-web packet passed `/shelf/replenish` at
    360 x 640, 390 x 844, and 430 x 932 with commerce and similar-options copy
    absent and zero current-run console errors or warnings. Evidence is in
    `test-results/human-e2e/2026-07-29/com01a-zero-commerce-current/`.
  - Historical/stale evidence: The 2026-07-08 positive consent and
    `See similar options` packet predates COM-01A and cannot support current
    acceptance or a future positive commerce successor.
- Branch: active shelf empty with archive history
  - Priority: Critical
  - Automate later: Yes
  - Action: Add one product, mark it finished or discarded, then return to the Shelf tab with no active products.
  - Expected result: The empty Shelf still exposes a `View archive` action with the archived count, the action meets the 44 pt phone touch target, and tapping it opens the archive with the finished/discarded product visible.
  - Evidence: Screenshot sequence, visible route snapshot, and touch target measurement.
  - Current local evidence: 2026-07-08 in-app browser Expo web at 320 x 568 adds `E2E Archive Balm` manually, opens product detail, taps `Mark finished`, and verifies the empty Shelf exposes a fully visible 48 px `View archive (1)` action above the floating tab bar with zero horizontal overflow. The first pass found the archive action covered by the tab bar; `bug-001-empty-shelf-archive-covered.md` records the bug and the layout fix. Post-fix, tapping the archive action opens `/shelf/archive` with `E2E Archive Balm` visible. Evidence is in `test-results/human-e2e/2026-07-08/shelf-add-recovery-current/`.
- Branch: direct-entry back or close navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/shelf/add` (compatibility alias to `/shelf/manual`), `/shelf/search`, `/shelf/ocr`, `/shelf/scan`, `/shelf/no-match`, `/shelf/opened`, `/shelf/catalog-recovery`, `/shelf/archive`, `/shelf/[id]`, and `/shelf/replenish` directly, including stale/malformed catalog-recovery parameters and stale `/shelf/replenish?id=[missing]`, then use the visible Back, Close, Cancel, Not now, Back to Shelf, Add a product, or backdrop Dismiss control.
  - Expected result: The user returns to the Shelf tab instead of getting stuck on a direct-entry screen or modal sheet with no navigation history. `/shelf/add` must open the manual-add intake instead of being captured by the dynamic product-detail route. A missing/expired/malformed `/shelf/catalog-recovery` candidate must show `Match unavailable`, state that Shelf is unchanged, and expose retry when the encrypted read failed plus Back to Shelf. Stale `/shelf/[id]` entries must explain that the product is unavailable and provide `Back to Shelf` plus `Add a product` recovery actions. Stale `/shelf/replenish` entries must explain that the replacement prompt is no longer active, avoid reusing freshness or shopping prompts, and provide `Back to Shelf` plus `Add a product`. Direct `/shelf/opened` without an intake draft must recover to manual add instead of saving a generic product. Visible route exits meet the 44 pt phone touch target, `/shelf/search` keeps its manual fallback buffered above the phone bottom edge, add/replenish/recovery content stays scroll-reachable on supported phones, and sheets that can fill the viewport expose a visible Close control and dialog semantics instead of relying on a tiny backdrop.
  - Evidence: Screenshot sequence, visible route snapshot, and small-phone touch target measurements.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 and 390 x 568 covers direct `/shelf/add`, `/shelf/manual`, `/shelf/search`, `/shelf/ocr`, `/shelf/scan`, `/shelf/no-match`, `/shelf/opened`, `/shelf/archive`, stale `/shelf/[id]`, and stale `/shelf/replenish`. `/shelf/search` keeps the 56 px `Add by hand` fallback 32 px above the bottom edge, recovery clicks route to `/shelf/manual` or `/shelf`, every checked route has zero horizontal overflow, and focused `shelfRoutes.test.ts` route contracts pass.
  - Current governed evidence and remaining gate: The 2026-07-18 deterministic web matrix covers missing/malformed `/shelf/catalog-recovery` route state at 375 x 667, 390 x 844, and 430 x 932. Because the checked-in runner deliberately does not fabricate a production offline lookup becoming ready across restart, linked, unlinked, expired, changed, offline-revalidation, accept, reject, cancel, and failed-save states still require a real hosted ready-candidate cycle plus native persistence/account-boundary evidence.
  - Current shared-sheet evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 verifies `/shelf/no-match` exposes exactly one modal dialog, a 48 px Close action, zero horizontal overflow, no sub-44 exposed controls, and a non-accessible 12 px backdrop strip with `aria-hidden=true` and `tabIndex=-1`; Close returns to `/shelf`. Shared `Sheet` safe-area padding now only overrides bottom padding when a real native bottom inset exists, preserving compact web sheet density.

## Flow: Photo Progress

- Goal: A user can capture or review progress without accidental cloud exposure or misleading claims.
- Persona: User tracking skin progress.
- Entry state: User has completed onboarding and has photo consent state defined.
- Start screen/URL/window: Progress tab.
- Success state: Photo capture/review works locally and privacy expectations are explicit.
- Priority: Critical
- Automate later: Yes, after native harness is selected.
- Surface: iOS and Android; Expo web for consent-copy and layout route checks.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/progress/`
- Current local evidence: `test-results/human-e2e/2026-07-07/progress-current-compact-check/`
- Current local evidence: `test-results/human-e2e/2026-07-07/progress-capture-safe-area/`
- Current local evidence: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/`
- Current local evidence: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/`
- Current local evidence: `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/`

### Path A: Happy Path

1. Action: Open Progress, add or view a progress photo using safe local fixture behavior.
   Expected result: The photo flow is clear, private by default, and does not imply diagnosis or guaranteed improvement. When the comparison surface is populated, the Photo CTA, Compare/Timeline tabs, No scores link, Side-by-side toggle, and date-change chips meet the 44 pt phone touch target without clipping on small phones.
   Evidence: Screenshots or simulator video.
   Current local evidence: 2026-07-07 Expo web 320 x 568 covers the first-photo entry and non-destructive capture-consent branch: `/progress` shows a 56 px `Take my first photo` CTA with zero horizontal overflow, `/progress/capture` shows complete local-only consent copy plus 52 px `Take photos. On device only` and 48 px `Not now` controls, and `Not now` returns to `/progress`.
   Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced the first-photo CTA center being blocked by the floating Shelf tab and the first-use consent `Not now` action clipping below the viewport. Post-fix `/progress` renders `Take my first photo` as a 56 px unblocked action above the floating tab bar; `/progress/capture` and redirected `/photos/capture` render 52 px `Take photos. On device only` and 48 px `Not now` controls fully inside the viewport with zero horizontal overflow, zero blocked controls, and zero sub-44 visible controls; tapping `Not now` returns to `/progress`. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/` and `docs/e2e-bug-reports/2026-07-08-progress-first-photo-short-phone-tabbar-consent.md`.
   Current populated evidence: 2026-07-07 Codex in-app browser Expo web with `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated` verifies the populated Compare view after the local Pro preview, including `12 weeks · 3 photos · all on this phone`, Compare/Timeline/No scores controls, zero horizontal overflow, no sub-44 controls, one named `Choose the first photo` dialog, a named dismiss target, three contextual photo-tile labels, dismiss recovery, and a successful first-photo update to `May 12`.

### Branches

- Branch: sensitive image cache and lifecycle boundary
  - Priority: Critical
  - Automate later: Yes, with a native filesystem/memory harness after the native E2E decision.
  - Action: Open populated Progress, show encrypted photos in Compare and Timeline, background/foreground, lock/unlock, delete a visible photo, and cross an account boundary. Relaunch and inspect the application cache/temp directories on a supported physical device.
  - Expected result: Private `PhotoImage` sources use no Expo Image disk or memory cache and no crossfade. Mounted views drop resolved data URIs on inactive/background, memory warning, app lock, photo-timeline lock, and account isolation; unlocked foreground views decrypt again without showing the previous owner or deleted photo. No recoverable plaintext remains in Expo Image, SDWebImage, Coil, application cache, or temporary directories after relaunch. Functional web/simulator evidence may prove visibility and relock behavior, but only physical-device filesystem and memory inspection can close the native privacy gate.
  - Evidence: Before/background/locked/resumed screenshots or video, lifecycle logs containing only fixed event enums, native filesystem inventory, memory trace, and account-boundary/delete sequence.

- Branch: camera/photo permission denied
  - Priority: Critical
  - Automate later: Yes
  - Action: Deny camera or photo permission.
  - Expected result: User sees a clear recovery path and no broken UI, including a visible alert if the OS Settings handoff fails.
  - Evidence: Screenshot, alert text, and permission state.
  - Historical local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION=denied_no_retry`, `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`, and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verified `/progress/capture` started on the local-only consent gate, consent reached the denied/no-retry permission gate with one `Open settings` action, no `Capture photo` control, and no JavaScript dialog, failed Settings handoff rendered inline `Camera settings unavailable` alert copy with no dialog or raw fixture text, visible alert/actions were 48 px+ with zero horizontal overflow, and `Not now` returned to `/progress`. Evidence is retained in `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/`, but it predates CAT-06 and is stale for the current source. It does not prove the native iOS permission sheet or Settings round trip.
- Branch: Progress shutter, gate replacement, and exact raw-photo cleanup
  - Priority: Critical
  - Automate later: Yes
  - Action: Start a Progress shutter, then request Back/Close or replace the capture content with entitlement, app-lock, or storage recovery. Separately force raw-file deletion failure after capture, retry cleanup, background/foreground during capture, and transfer one successful still to review and encrypted save.
  - Expected result: First-use photo consent is saved before the OS permission request. The route-level owner survives child-gate replacement, blocks route removal while the shutter or exact raw-file lifecycle is pending, invalidates the camera lease, drains the native operation, and then deletes or atomically transfers the same trusted URI. A deletion failure keeps a route-owned cleanup alert/retry reachable outside every replacing gate; navigation remains blocked until cleanup succeeds; retry does not duplicate encrypted storage. The preview remains mounted during an admitted shutter but unmounts on focus/background/consent/cleanup invalidation. No late callback navigates or mutates.
  - Evidence: Progress capture privacy/routes/navigation contracts and shared lifecycle tests; exact signed-build Back/swipe/pop/reset, app-lock and storage-gate replacement, foreground/interruption, raw-file path/digest, cleanup-failure retry, encrypted-store count, network capture, and cold-relaunch evidence on both required physical iPhones. No completed CAT-06 artifact exists.
- Branch: first-use photo consent save failure
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`, open Progress capture without prior `photo_capture` consent and tap the first-use photo consent CTA.
  - Expected result: The camera does not open, the app shows stable photo-choice-not-saved copy, the consent CTA is retryable, `Not now` remains visible and tappable on a 320 x 568 phone, no camera permission prompt appears before consent is saved, and the next CTA tap consumes the one-shot failure and opens the normal permission/capture path.
  - Evidence: Failure screenshot/text, `role="alert"` copy, no pre-consent camera copy, compact button-geometry snapshot, retry into the normal permission/capture path, and browser warn/error logs.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once` and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verifies direct `/progress/capture` starts on the local-only consent gate, a forced consent-save failure keeps the camera and permission path closed, renders route-owned `Photo choice not saved` feedback with `role="alert"`, opens no JavaScript dialog, keeps the retry CTA 52 px and `Not now` 48 px inside the viewport, has zero horizontal overflow, shows no raw fixture error, and retry reaches the normal web camera-permission path. The same slice removed the leftover native `Alert.alert` call from the consent persistence failure path while leaving camera-capture failure alerts unchanged. Evidence is in `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/`.
- Branch: first-use local-only device-loss tradeoff
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/progress/capture` without prior `photo_capture` consent and inspect the consent gate at a compact phone size.
  - Expected result: The consent gate says photos stay on-device, no faceprint or biometric template is stored, cloud backup is not available in this build, and the lost-phone tradeoff is visible before the first capture. Capture-frame labels, shutter copy, and camera preview chrome are not rendered until photo consent is saved. The Take photos and Not now controls remain readable and tappable on 320 x 568 and shortest 320 x 480 phone viewports.
  - Evidence: Phone screenshot, visible-text snapshot, and 320 px button-geometry snapshot.
  - Current local evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 verifies direct `/progress/capture` renders the complete local-only consent gate with no pre-consent capture chrome, 52 px `Take photos. On device only`, 48 px `Not now`, zero horizontal overflow, and safe recovery to `/progress` after tapping `Not now`. The overlay source now adds top and bottom safe-area insets to its scroll padding; native notch/home-indicator verification remains device QA.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 verifies direct `/progress/capture` and legacy `/photos/capture` keep the local-only consent copy, hide only the prep reminder on shortest phones, show no camera chrome before consent, keep `Take photos. On device only` and `Not now` fully visible and hit-testable, and recover to `/progress` after `Not now`. Evidence is in `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/`.
- Branch: cloud backup unavailable in current V1
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/settings/privacy`, inspect the Security card, then open locked `/progress` in a build with app lock enabled.
  - Expected result: Settings shows `Progress photo storage`, `Device only`, and explicit unavailable-backup copy with no backup switch or actionable backup control. Locked Progress shows the same device-only boundary without a chevron or settings handoff. Startup removes any stale pre-update backup-enable preference. Local photo save emits no `cloud_backup_opted_in` event and performs no automatic Supabase photo image or metadata insert. App lock and unrelated privacy controls remain operable, visible controls meet the 44 pt floor, horizontal overflow is zero, and no route opens a native or JavaScript dialog.
  - Evidence: Settings and locked-Progress screenshots, visible-text/role snapshots, control geometry, stale-preference unit evidence, source privacy gate, browser logs, network requests, and explicit absence of an encrypted-cloud-backup switch.
  - Current local evidence: 2026-07-10 headless Chrome against fresh Expo web origins verifies the visible You-tab Security card and populated locked Progress surface at the supported 360 x 640 floor and a 390 x 844 modern phone. Both surfaces show the device-only boundary; no backup switch, action, settings handoff, dialog, PostHog/Sentry request, Supabase photo/storage request, or `cloud_backup_opted_in` payload appears. A seeded stale backup preference is removed at startup, app-lock/unlock controls are 48-56 px, center hit-tests are clear, clicking static storage copy does not navigate, and horizontal overflow is zero. Evidence is in `test-results/human-e2e/2026-07-10/progress-device-only-backup-current/`; physical iOS/Android encryption, app-lock prompts, VoiceOver, and TalkBack remain device QA.
- Branch: camera start or photo capture failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Progress capture on a device where the camera cannot start, or force the still photo capture call to reject.
  - Expected result: The app shows stable camera-unavailable or photo-not-captured copy, keeps the timeline unchanged, and does not leave a tappable shutter that appears inert.
  - Evidence: Alert text, visible fallback state, and route snapshot.
  - Historical local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once` and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` forced `/progress/capture` still-photo rejection from the capture surface. The route opened no dialog, rendered inline `Photo wasn't captured` copy with `role="alert"`, foregrounded 56 px `Try photo again` and 48 px `Not now` controls while the background shutter was disabled, hid the raw fixture error, and logged no current-origin browser errors. Tapping retry consumed the fixture and showed the normal web permission gate with readable wrapped heading copy; `Not now` returned to `/progress`. Evidence and report are retained in `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/`, but they predate CAT-06 and are stale for the current source. Physical-iPhone camera mount, permission, real `takePictureAsync` rejection, raw cleanup, and encrypted persistence remain open.
- Branch: measured post-capture framing and lighting review
  - Priority: Critical
  - Automate later: Yes, with native image fixtures after the development build is installed on supported physical devices.
  - Action: Capture one front-facing photo, then repeat with the face off-center, no face, multiple faces, poor/uneven light, and the local analyzer unavailable or timed out.
  - Expected result: The live camera never claims alignment, lighting quality, or automatic readiness from generated values. Review analyzes only the captured local file on-device, immediately reduces native output to bounding-box coordinates plus finite Euler angles, retains no landmark, contour, tracking ID, face template, or image analytics, and reports one-face framing separately from exposure/light balance. Missing, partial, or nonfinite pose cannot match. No-face, multiple-face, analyzer error, timeout, and unavailable results remain explicit instead of falling back to a positive score. Low or unavailable quality never disables Save; only unresolved plaintext derivative cleanup blocks Save/Retake/Close, retains the raw still, and exposes an exact retry. Timeout, URI replacement, navigation, save, unmount, and account change drain analyzer work before raw persistence/deletion; native results cannot publish after an account/URI abort. A gate/account-forced unmount retains the exact failed analyzer/raw disposal in a process owner, and the next shutter retries it before creating another still. Process death continues to rely on startup raw-cache and plaintext-journal scavenging. A failed encrypted save stays on review with inline recovery and never fires capture-success analytics. Encrypted local save makes no automatic Supabase photo image or metadata request under any current UI state. Composite quality scores never claim directional darkness. Web uses an unavailable adapter and cannot load the native ML Kit module. Visible review controls remain 44 pt or larger, copy remains no-score and non-diagnostic, and Retake/Close recover safely after cleanup.
  - Evidence: Measured, adjustment, no-face, and unavailable review screenshots; visible-text and control-geometry snapshots; no-dialog and browser-log checks; native module autolinking output; focused measurement tests; and supported physical-device framing/lighting calibration evidence before launch.
  - Current local evidence: 2026-07-10 bundled system Chrome Expo web at the supported 390 x 844 viewport uses the development-only analysis fixture to render matched, adjustment, no-face, and unavailable post-capture review states around a real 48 x 64 bitmap. Each state keeps Close, Retake, and Save enabled at 48-56 px with successful center hit-tests, zero horizontal overflow, no dialogs, state-appropriate good/adjust/neutral treatment, and clear non-score copy; Retake recovers to `/progress/capture` and Close to `/progress`. At the 360 x 640 support floor, a real web persistence rejection remains on review, renders inline `Photo not saved` recovery, and keeps Retake/Save reachable and center-hit-testable after user-like scroll. Browser logs contain no native-module error or other disallowed warning/error, and no PostHog/Sentry request occurs. Android and iOS autolinking both resolve ML Kit face detection plus image manipulation. Evidence and the web/native boundary bug record are in `test-results/human-e2e/2026-07-10/progress-capture-analysis-current/` and `docs/e2e-bug-reports/2026-07-10-progress-capture-analysis-web-native-boundary.md`. This proves the review-state UI, web failure recovery, and platform boundary, not real-device ML Kit output, threshold calibration, native encrypted save, or assistive-technology behavior.
  - Current source checkpoint (2026-09-26): focused executable tests cover native-result minimization, missing/partial/nonfinite pose, journal-before-generation ordering, generated-file adoption failure, retained cleanup retry, startup-recovery retry wiring, URI replacement/timeout abort and drain, post-native-await account abort, forced-unmount lifecycle retention/retry, and analyzer-before-raw-delete ordering. This does not complete PHOTO-03 or replace the physical-device, signed-archive, filesystem-residue, latency, accessibility, and zero-egress evidence above.
- Branch: empty timeline
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress with no photos.
  - Expected result: Empty state gives a clear next action.
  - Evidence: Screenshot.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced the empty-state `Take my first photo` CTA sitting visually under the floating tab bar with only about 2 px of clearance. Post-fix, the CTA is 272 x 52 px at y=315-367, has 33.6 px clearance above the floating tab bar, center hit-tests to itself, has zero horizontal overflow, and tapping it opens the `/progress/capture` local-only photo consent gate. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/` and `docs/e2e-bug-reports/2026-07-08-progress-empty-short-phone-clearance.md`.
- Branch: local timeline time-lapse playback
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress with populated local photos, switch to Timeline, and tap `Play`.
  - Expected result: The Timeline opens a named full-screen local player, renders real local photo bytes oldest to newest, advances through a finite sequence, stops on the latest frame, and exposes 48 pt or larger close, previous, pause/play/replay, and next controls without a native or JavaScript dialog. Closing returns to the populated Timeline with no state loss. When the OS requests reduced motion, automatic playback is suppressed and the previous/next controls remain available for frame-by-frame review. The player sends no image, file-path, date, or photo identifier analytics and keeps the no-score/local-only boundary visible.
  - Evidence: Opening, mid-playback, completion, close-recovery, and reduced-motion screenshots; accessible-name/control snapshot; route state; dialog check; browser logs; and geometry snapshot.
  - Current local evidence: 2026-07-10 bundled Chromium Expo web at the supported 390 x 844 viewport opens the populated local Timeline, renders a real bitmap frame, and opens one named `Quiet photo time-lapse` modal dialog. The sequence starts on Apr 1, advances oldest to newest, pauses stably on May 12, steps to Jun 24, stops at `3 of 3` with Next disabled, replays to the first frame, and closes back to `/progress`. Close, Previous, Play/Pause/Replay, and Next are 48-56 px with clean center hit-tests and zero horizontal overflow. A separate OS reduced-motion context remains on Apr 1 after more than one frame interval, exposes no automatic-play control, and supports manual Next/Previous. The run records no unexpected browser logs, no PostHog/Sentry request, and no native/JavaScript dialog. Evidence and report are in `test-results/human-e2e/2026-07-10/progress-timelapse-current/`; the dialog-semantic finding and fix are in `docs/e2e-bug-reports/2026-07-10-progress-timelapse-dialog-semantics.md`. Physical iOS/Android encrypted-photo loading, app backgrounding, and VoiceOver/TalkBack adjustable actions remain device QA.
- Current source checkpoint (2026-09-26): the player now uses a deterministic controller that waits for the encrypted image view to report a successful display before starting each dwell, cancels active and pending playback on backgrounding, and does not resume when foregrounded. The shared live Reduce Motion preference cancels automatic playback, while normal-motion autoplay and manual replay remain available. Rendered-component tests cover frame-ready gating, background/foreground behavior, a real `PhotoImage` request resolving only to a memory data URI with native cache disabled, no fetch call, accessibility escape, and scrollable large-text content; separate source contracts exclude direct share/file-write/analytics/observability dependencies and cover modal focus entry/restoration plus localized dates. This is not archive-level no-egress evidence and supersedes neither the 2026-07-10 screenshots nor the still-required current physical-device checks for encrypted frame rendering, background timer behavior, VoiceOver/TalkBack focus/actions, extreme Dynamic Type geometry, and zero-egress traffic/filesystem residue.
- PHOTO-07 source-copy checkpoint (2026-09-27): the welcome claim now matches the explicit-share exception already disclosed at capture: photos stay encrypted on the phone unless the user chooses to share one. Capture still states no automatic upload, no cloud backup, no faceprint/template, and possible loss with the phone. Current exact-source UI, policy, accessibility, deletion, export, key-loss, and signed-device evidence remains open.
  - Previous local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, and app lock disabled covered the earlier unavailable-state affordance. That evidence is retained in `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/` but no longer proves the implemented playback contract.
- Branch: contextual photo-timeline paywall on short phones
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress as a free user in a 320 px wide phone viewport.
  - Expected result: The contextual photo-timeline paywall keeps the annual price, Start free trial CTA, no-card `Explore first` CTA, Terms, Privacy, Restore, Maybe later, and floating tab bar readable and tappable with no overlaps or clipped text, including when store pricing is unavailable and the disabled-pricing reason is visible.
  - Evidence: Screenshot and 320 px geometry snapshot.
  - Current 320 x 480 header-compliance evidence: 2026-07-08 Codex in-app browser Expo web with the dev-only local reset fixture verifies `/progress/capture`, `/progress/review`, and tabbed `/progress` as a clean free user. All three routes keep Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first present, 48 px or larger, unclipped, center-hit-testable, and at zero horizontal overflow; `/progress/review` `Maybe later` was tapped and dismissed to `/progress`. Current-run warn/error logs for `localhost:8154` were empty. Evidence is in `test-results/human-e2e/2026-07-08/progress-photo-paywall-header-compliance-current/`.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced direct `/progress/capture` and `/progress/review` pushing Terms, Privacy, and Restore below the first viewport. Post-fix, both direct entries use the compact photo paywall treatment and show annual price, Start free trial, Explore first, Terms, Privacy, Restore, and Maybe later with zero hit-blocked controls, zero sub-44 controls, zero visible clipped controls, zero horizontal overflow, and no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/short-phone-480-paywall-compliance-final/`.
  - Current 320 x 480 ProGate follow-up: 2026-07-08 bundled Playwright Chrome Expo web verifies `/progress` uses the shared sub-520 px ProGate header compliance treatment rather than bottom compliance under the floating tab bar. Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first all remain present with zero target issues, zero visible-control issues, zero horizontal overflow, zero dialogs, and no unexpected browser logs. Evidence is in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`.
  - Current 320 x 430 ProGate follow-up: 2026-07-08 Codex in-app browser Expo web verifies `/progress` uses the shared sub-520 px compliance header plus a sub-460 px density band. Terms, Privacy, Restore, Maybe later, annual price, store-unavailable reason, and disabled Start free trial remain visible, 44 px or larger, not clipped, and not center-hit blocked; lower-priority `Explore first` is allowed to drop out of the sub-460 px first viewport. Evidence is in `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/`.
  - Current 320 x 390 / 130% split-short Progress-tab evidence: 2026-07-08 headless Chrome Expo web verifies the locked `/progress` photo-timeline paywall hides lower-priority body copy, keeps the compact `Maybe later` icon plus Terms, Privacy, Restore, and Start free trial at 48 px or larger, center-hit-testable, fully in viewport, and at zero horizontal overflow, while keeping the store-unavailable reason visible. The 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-130-split-short-390-postfix-4/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-130-split-short-390-route-clearance.md`.
  - Current 320 x 568 text-pressure follow-up: 2026-07-08 118% text-pressure audit reproduced `/progress` bottom compliance controls sitting inside the floating tab-bar hit zone. Post-fix, compact Progress photo paywalls use header compliance even above the sub-520 px band, and Codex in-app browser Expo web verifies `/progress`, `/progress/capture`, and `/progress/review` at 320 x 568 with zero blocked, clipped, or sub-44 user-facing paywall targets. Evidence and report are in `test-results/human-e2e/2026-07-08/text-scale-120-compact-audit/`, `test-results/human-e2e/2026-07-08/progress-progate-text-pressure-postfix/`, and `docs/e2e-bug-reports/2026-07-08-progress-progate-text-pressure-tabbar-overlap.md`; native Dynamic Type remains device QA.
  - Current 320 x 430 / 120% text-pressure follow-up: 2026-07-08 headless Chrome Expo web verifies shared contextual ProGate routes keep Terms, Privacy, Restore, Maybe later, annual price, store-unavailable reason, and the primary CTA complete under 120% text pressure. Below 460 px, the lower-priority `Explore first` CTA is hidden instead of peeking into the floating-tab zone. The 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`; native Dynamic Type remains device QA.
  - Current 320 x 430 / 130% text-pressure follow-up: 2026-07-08 headless Chrome Expo web verifies shared contextual ProGate routes keep Terms, Privacy, Restore, Maybe later, annual price, store-unavailable reason, and the primary CTA complete under 130% text pressure after the ultra-short header stacks compliance above dismiss and omits the monthly-equivalent label. The 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-postfix/` and `docs/e2e-bug-reports/2026-07-08-progate-text-pressure-130-header-overlap.md`; native Dynamic Type remains device QA.
  - Current 320 x 370 / 130% micro-short text-pressure follow-up: 2026-07-08 headless Chrome Expo web verifies contextual ProGate paywalls use a sub-380 px band that hides nonessential body copy and tightens the price and CTA stack while preserving the 48 px Start free trial action, compact compliance, dismiss, annual price, and store-unavailable reason. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`; native Dynamic Type remains device QA.
- Branch: relaunch after adding photo
  - Priority: Important
  - Automate later: Yes
  - Action: Add a photo, relaunch, and return to Progress.
  - Expected result: Local state is preserved as designed.
  - Evidence: Video or screenshot sequence.
- Branch: direct-entry back, close, and permission escape
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/progress/capture`, `/progress/review`, `/progress/about`, and a missing `/progress/[id]` detail directly, then use the visible Close, Back, or Not now control. Repeat legacy `/photos/capture`, `/photos/review`, and `/photos/[id]` direct entries.
  - Expected result: The user returns to the Progress tab instead of being trapped on a camera, review, permission, consent, or missing-photo screen with no navigation history. Direct `/progress/review` without a captured photo shows photo-not-captured recovery copy and never shows a fake preview or `Save to my phone`. Missing `/progress/[id]` detail entries show clear photo-unavailable copy plus `Take a new photo` and `Back to Progress` recovery actions instead of a dead one-line empty state. Legacy `/photos/*` entries must recover into the matching Progress photo surface instead of showing an unmatched-route page. Visible route exits and Not now controls meet the 44 pt phone touch target with readable dark-surface contrast, capture permission/recovery gates scroll on short phones, and comparison photo-picker sheets expose a single named modal dialog, a named dismiss action, and contextual photo-tile labels without unlabeled inert sheet-body controls.
  - Evidence: Screenshot sequence and 320 px button-geometry snapshot.
  - Current local evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated` verifies the populated `/progress` Compare surface after the local Pro preview, a 72 x 48 `Apr 1` date chip, a named `Choose the first photo` picker with named dismiss backdrop, three 92 x 123 contextual photo-tile controls, zero horizontal overflow, dismiss recovery, and selection of `May 12` dismissing the picker and updating the comparison chip in `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/`. Source contracts verify the sheet keeps 40 px compact web padding and adds native bottom-inset padding when present; native home-indicator, real-image rendering, and screen-reader traversal remain device QA.
- Branch: single-photo share unavailable or rejected
  - Priority: Important
  - Automate later: Yes
  - Action: Open a single-photo detail, tap Share photo, confirm, and simulate native sharing being unavailable, the temporary export failing, or the share sheet rejecting.
  - Expected result: The app shows stable share-unavailable copy, leaves the user on the photo detail, deletes any temporary decrypted export, and does not include notes or promise redaction.
  - Evidence: Alert text, route state, share helper cleanup assertion, and native share-sheet log when available.
  - Current local evidence: 2026-07-08 In-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, and `EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE=1` opens `/progress/e2e-front-2026-04-01`, verifies the photo detail actions are fully visible 48 px controls, taps the share icon, shows a route-owned confirmation panel with fully visible Cancel and Share photo controls, confirms share failure, stays on the same photo route, and renders the share-unavailable copy as an accessible alert with zero horizontal overflow and no browser warn/error logs. Evidence is in `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/`.
- Branch: single-photo delete confirmation failure
  - Priority: Important
  - Automate later: Yes
  - Action: Open a single-photo detail, tap Delete photo, cancel once, then tap Delete photo again and simulate local photo deletion failing.
  - Expected result: The app shows a route-owned confirmation panel, never opens a native or JavaScript dialog, keeps the user on the same photo detail after failure, renders stable local-delete recovery copy, hides raw fixture errors, keeps the photo private on-device, and keeps visible controls at least 44 pt.
  - Evidence: Screenshot sequence, route state, dialog check, browser logs, and 320 px geometry snapshot.
  - Current local evidence: 2026-07-08 In-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, and `EXPO_PUBLIC_E2E_PHOTO_DELETE_FAILURE=1` opens `/progress/e2e-front-2026-04-01`, verifies the detail actions are visible 48 px controls, taps Delete photo, shows a route-owned confirmation panel with 48 px Cancel and Delete photo controls, cancels back to the action row, repeats delete, forces local deletion failure, stays on the same detail route, renders stable inline recovery copy with `role="alert"`, hides the raw fixture error, keeps horizontal overflow at zero, and opens no JavaScript dialog. Current-run warn/error logs are empty. Evidence is in `test-results/human-e2e/2026-07-08/progress-photo-detail-delete-inline-recovery-current/`.
- Branch: app-lock coverage for direct Progress routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Enable app lock, cold-open `/progress`, `/progress/capture`, `/progress/review` with a captured-photo parameter, and `/progress/[id]` directly; unlock the app-wide gate but cancel the photo-timeline prompt. Then authenticate the timeline, move among the sensitive Progress routes, background the app, and return.
  - Expected result: No photo, note, camera, captured review image, or Progress query mounts before the encrypted app-lock preference resolves and both required unlocks complete. Every sensitive direct route shows the same timeline lock after the app-wide unlock. One successful timeline unlock remains valid while navigating among Progress routes in the active session, then resets when the app leaves the foreground. The generic `/progress/about` explainer does not require the second timeline unlock. Free users still reach the contextual paywall before the timeline lock.
  - Evidence: Cold-start/direct-route screenshots, visible-text snapshot proving sensitive markers are absent, auth-call ordering assertion, route navigation after one timeline unlock, background/foreground relock evidence, control geometry, dialog state, and browser/native logs.
  - Current local evidence: 2026-07-10 headless system Chrome against Expo web checks `/progress`, `/progress/capture`, `/progress/review` with a captured URI, and populated `/progress/[id]` at 360 x 640 and 390 x 844. All eight direct entries render one shared timeline lock with a 52 px Unlock action, hide timeline/camera/review/detail markers, keep zero horizontal overflow, and produce zero dialogs, page errors, unexpected browser errors, analytics requests, or photo-backend requests. A separate 390 x 844 active-session pass authenticates the timeline once, moves from populated Progress into detail and capture without another gate, then simulates background/foreground and verifies the lock returns with timeline metadata hidden. Evidence and the fixed Critical bypass report are in `test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/` and `docs/e2e-bug-reports/2026-07-10-progress-direct-route-app-lock-bypass.md`; physical iOS/Android prompt ordering and screen-reader focus remain device QA.
- Branch: encrypted Progress storage unavailable or temporarily locked
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/progress`, `/progress/capture`, `/progress/review` with a captured-photo parameter, and populated `/progress/[id]` after entitlement and any configured biometric gates have passed, then force the encrypted local metadata read to fail. Retry once while failure persists, then repeat with a one-shot failure that resolves on retry.
  - Expected result: Every data-bearing Progress route shows one shared private-storage recovery surface after the biometric gate. The app must not present first-photo, missing-photo, camera, captured-review, reference-photo, note, or timeline content while the encrypted read is unresolved or failed. No photo mutation mounts from the blocked route, no ciphertext or raw fixture error is shown, no local record is removed or rewritten, and no analytics or photo-backend request is emitted. Retry performs a real encrypted-store reread, remains available after persistent failure, and reveals the correct route only after success. Direct capture, review, and detail routes also expose a 48 pt `Back to Progress` escape; the tab keeps the floating navigation available. The recovery surface has no horizontal overflow at the 360 x 640 launch floor or a 390 x 844 modern viewport.
  - Evidence: Failure and post-retry screenshots for the tab and direct routes, visible-text/role snapshots proving false empty and sensitive route markers are absent, retry and exit geometry, route state after one-shot recovery, dialog/page-error/browser-log checks, network request log, and encrypted-store non-mutation unit evidence.
  - Current local evidence: 2026-07-10 headless system Chrome against two clean Expo web origins forces persistent encrypted metadata failure on `/progress`, `/progress/capture`, captured-photo `/progress/review`, and populated `/progress/[id]` at 360 x 640 and 390 x 844. All eight route/viewport scenarios show the shared recovery after entitlement/lock ordering, hide false first-photo, missing-photo, camera, review, reference, note, and timeline markers, preserve a 56 px retry after repeated failure, keep direct exits at least 50 px, and have zero horizontal overflow, dialogs, page errors, unexpected browser errors, raw fixture leaks, analytics, or photo-backend requests. The detail exit reaches tabbed Progress recovery. A separate one-shot failure on direct captured-photo review proves retry calls the real encrypted read and reveals Review plus `Save to my phone` only after success. Evidence and the fixed Critical report are in `test-results/human-e2e/2026-07-10/progress-storage-recovery-current/` and `docs/e2e-bug-reports/2026-07-10-progress-encrypted-storage-false-empty-state.md`; native Keychain/Keystore fault injection and assistive-technology behavior remain device QA.
- Branch: biometric app-lock prompt unavailable or rejected
  - Priority: Critical
  - Automate later: Yes
  - Action: Enable app lock, open the app-wide lock overlay or the locked Progress timeline, and force the local-auth prompt to reject or become unavailable.
  - Expected result: The app stays locked, shows stable app-lock-unavailable copy only for native prompt failure, keeps user cancellation quiet, leaves the Unlock control available for retry, and uses device-neutral copy that reads correctly on iOS and Android.
  - Evidence: Inline alert text, route state, native auth log, and helper status assertion.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=true`, `EXPO_PUBLIC_E2E_APP_LOCK_AUTH=unavailable`, `EXPO_PUBLIC_E2E_APP_LOCK_READY=available`, populated Progress photos, and store Pro entitlement opens `/progress`, keeps the app-wide lock overlay visible, renders route-owned `App lock is not available on this device right now.` feedback, leaves the topmost Unlock button 106 x 48 px, opens no JavaScript/native dialog on initial prompt or retry, and keeps horizontal overflow at zero. A second run with app lock disabled and `EXPO_PUBLIC_E2E_APP_LOCK_READY=unavailable` verifies the You-tab App lock switch remains off, renders row-local `Choice not saved` / app-lock-unavailable copy, leaks no raw native/provider text, opens no dialog, and keeps the switch 52 x 48 px. Evidence is in `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/`.

## Flow: Photo Trend Insights

- Goal: A user cannot be asked to consent to or enable photo-trend processing while no validated Trend engine ships in the app.
- Persona: Progress user who follows a stale or direct Trend link.
- Entry state: User has completed onboarding; the Trend engine capability is hard-disabled regardless of environment flags.
- Start screen/URL/window: Progress tab, You privacy row, direct `/trend/optin`, direct `/trend/fairness`, or deferred Trend routes.
- Success state: Every Trend direct entry shows explicit unavailable copy, offers no consent control, and returns safely to Progress.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route recovery; iOS and Android for native photo/toggle confirmation.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/trend-routes/`
- Current local evidence: `test-results/human-e2e/2026-07-07/trend-routes-current/`

### Path A: Launch-Blocked Direct Entry

1. Action: Open `/trend/optin` and `/trend/fairness` directly, including a build with `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`.
   Expected result: Both routes remain deferred, show no toggle or `photo_trend_insights` consent request, and expose a `Back to Progress` action. Literal `phase7Capabilities.trendEngine=false`, `phase7Flags.trend=false`, and machine `trendInsightAdmission` zero admission win over every environment, development, E2E, domain, or QA input.
   Evidence: Screenshot sequence, visible-text snapshot, exact route identity, and confirmation that no consent ledger mutation, photo/profile/Monk/Trend-store read, simulated metric, result copy, content analytics, network request, native call, or file side effect occurs. The former enabled Trend evidence is historical and does not describe the current launch contract.

### Branches

- Branch: direct-entry Trend exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/trend/optin` and `/trend/fairness` directly, then use the visible recovery action.
  - Expected result: Both deferred routes return to the Progress tab without exposing an opt-in, consent save, score, or engine claim. The recovery action meets the 44 pt phone touch target.
  - Evidence: Screenshot sequence and visible route snapshot.
  - Current local evidence: 2026-07-12 Codex in-app browser Expo web at the 375 x 667 launch floor reproduced `/trend/optin` being canonicalized to `/trend/fairness` by the layout-level fallback. After moving the hard capability gate into each child, direct `/trend/optin` and `/trend/fairness` preserve their exact URLs, render zero inputs or switches, expose 55.99 px `Back to Progress` controls, have zero horizontal overflow, and recover to `/progress`. Evidence and the bug report are in `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/` and `docs/e2e-bug-reports/2026-07-12-trend-direct-route-layout-redirect.md`.
  - Current navigator/privacy evidence: 2026-07-13 Codex in-app browser plus human-driven Chrome Expo web at the 375 x 667 launch floor caught an attempted early-return group guard reintroducing the same `/trend/optin` to `/trend/fairness` canonicalization. Post-fix, the layout always mounts its `Stack` and uses a navigator-preserving `screenLayout` gate; both exact direct URLs survive refresh, disabled child scenes and the fairness Monk-band hook do not mount, both routes visibly show the complete truthful unavailable surface with zero inputs/switches and zero horizontal overflow, and the 55.99 px recovery controls replace to `/progress` even when another Trend route is already in history. Unexpected browser warn/error count is zero. Evidence and the bug report are in `test-results/human-e2e/2026-07-13/trend-route-group-gate-current/` and `docs/e2e-bug-reports/2026-07-13-trend-layout-guard-route-canonicalization.md`.
- Branch: installed-base reconsent
  - Priority: Critical
  - Automate later: Yes
  - Action: Simulate a returning user with photo history and any legacy Trend consent state.
  - Expected result: Trend insight stays hidden, no consent is requested or refreshed, and no previous photo user is silently enrolled into an unavailable engine.
  - Evidence: Screenshot and local consent state.
  - Historical superseded evidence: The 2026-07-08 local enabled-fixture run in `test-results/human-e2e/2026-07-08/installed-base-trend-reconsent-current/` exercised an experimental on-device Trend card. It is not evidence for the current launch contract. The current capability is hard-disabled, legacy photo users are not silently enrolled, and 2026-07-12 evidence above proves direct entries expose no Trend consent control.
- Branch: environment flag accidentally enabled
  - Priority: Critical
  - Automate later: Yes
  - Action: Start a dev build with `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, then open `/trend/optin` and `/trend/fairness`.
  - Expected result: The frozen missing-engine capability wins over the environment flag; both routes stay deferred and no Trend consent control mounts.
  - Evidence: Screenshot sequence plus Phase 7 launch-flag and route-contract tests.
- Branch: forged positive inputs and historical state
  - Priority: Critical
  - Automate later: Yes
  - Action: Populate historical local/database Trend state, caller consent, positive delta, Monk tone, fixture and E2E overrides, then open Progress and both direct Trend routes.
  - Expected result: Progress shows no Trend card or opt-in, direct routes remain truthful unavailable recovery, and no `consistent`, `change_observed`, `inconclusive_lighting`, or `insufficient_data` result is produced. The private photo timeline and no-score explanation remain usable.
  - Evidence: Screenshot and route snapshots; seeded-state before/after; no positive consent mutation; no Trend-result write; and network, analytics, console, and native/file side-effect absence.
- Branch: explicit legacy withdrawal cleanup
  - Priority: Critical
  - Automate later: Yes
  - Action: Seed legacy Trend consent/state, invoke the explicit revoke/health-withdrawal path, interrupt and retry where supported, then revisit Progress and direct Trend routes.
  - Expected result: Cleanup remains available and idempotent, legacy state is deleted according to the governed data-rights lifecycle, no new grant or result is created, and all Trend presentation remains unavailable.
  - Evidence: Before/after consent and state snapshots, cleanup receipt, interruption/retry transcript, and no Trend-result/content-analytics output.

PHOTO-05A source-refusal evidence is not human-simulated E2E. The next current
run must retain all branch evidence at the supported iPhone viewports and bind
it to the exact source/archive under test. See
[`PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md`](./hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md).

## Flow: Pro Feature Gating

- Goal: A free user cannot reach Pro-only surfaces by direct navigation, while a Pro or reverse-trial user can.
- Persona: Free user evaluating the app, and reverse-trial/Pro user with local entitlement.
- Entry state: Fresh free app state for locked checks; Pro entitlement state for unlocked checks.
- Start screen/URL/window: Direct routes for Pro surfaces such as `/cycle/week`, nested `/cycle/*`, routine-builder routes, and `/progress/*`. `/routine/widgets` is a separate launch-blocked recovery route and must not be paywalled.
- Success state: Free users see a contextual paywall or safe fallback with no premium content flash; Pro users reach the intended feature surface.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route-gating parity; iOS and Android for native camera/widget behavior.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/pro-gating/`
- Current local evidence: `test-results/human-e2e/2026-07-07/pro-gating-current/`

### Path A: Direct-Link Lock

1. Action: Open each Pro-only route directly as a fresh free user.
   Expected result: The app renders the matching contextual paywall or safe fallback, not the premium screen.
   Evidence: 2026-07-07 fresh Chrome context at 320 x 568 verified `/cycle/settings` and `/routine/plan` render the correct contextual paywalls in free state, with no premium content, zero horizontal overflow, no browser errors, and visible 48 px+ controls. Its widgets-paywall observation is superseded by the current launch-honesty contract.

### Branches

- Branch: nested scheduler routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, and `/cycle/procedure` directly.
  - Expected result: Free users remain gated for the full scheduler route group. Reverse-trial or Pro users reach the intended scheduler surfaces; cycle settings rows read as scheduled outputs, not deferred drag-and-drop controls.
  - Evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 verifies fresh free direct `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, and `/cycle/procedure` all render `Unlock your full skin-cycling scheduler.`, expose no scheduler route-body content, keep visible controls 48 px+, and have zero horizontal overflow. From the same contextual paywall, `Explore first. 7 days of Pro` starts the local no-card reverse trial and unlocks the nested route group. A manual retinol plus glycolic shelf fixture, followed by the visible phased-intro `Add it now anyway` override for the staged acid, verifies `/cycle/settings` renders scheduled `Night 1` glycolic and `Night 2` retinol rows with `Scheduled` badges and no deferred drag/drop copy; `/cycle/why-tonight` renders the APART trace with `Recommendation, not a rule`; `/cycle/disruption` renders all four disruption choices; `/cycle/phased-intro` and `/cycle/procedure` render their intended sheets/screens; `/cycle/recovery` renders both the empty fallback and the active recovery state after `Start recovery`, with `Ease back in` returning to `/today`. Evidence is in `test-results/human-e2e/2026-07-08/nested-scheduler-routes-current/`; native iOS/Android bottom-sheet, safe-area, Dynamic Type, and screen-reader QA remain open.
  - Current 320 x 480 contextual ProGate follow-up: 2026-07-08 bundled Playwright Chrome Expo web verifies direct `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, `/cycle/procedure`, and `/cycle/week` keep Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first reachable in the compact header/body layout, with zero target issues, zero visible-control issues, zero horizontal overflow, zero dialogs, and no unexpected browser logs. Evidence is in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`.
- Branch: full routine intelligence routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan`, `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, and `/routine/adaptation` directly.
  - Expected result: Free users see the full-routine contextual paywall, not the routine builder, sequencing, ramp, tolerance, or adaptation screen. First-time free users can choose the no-card `Explore first` path from that paywall; lapsed entitlement users remain on the paid re-offer path.
  - Evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 verifies fresh free direct `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, and `/routine/adaptation` all show `Unlock your full routine.`, `Explore first. 7 days of Pro`, no premium route-body markers, zero horizontal overflow, and no sub-44 px visible controls. Tapping `Explore first. 7 days of Pro` starts the local reverse trial and unlocks adaptation; direct reverse-trial `/routine/reorder` renders the sequencing editor, `/routine/ramp` renders `Low and slow, on your terms.`, and `/routine/tolerance` renders the optional non-diagnostic check-in. Evidence is in `test-results/human-e2e/2026-07-08/full-routine-intelligence-current/`. Earlier 2026-07-07 evidence verifies direct `/routine/plan` free paywall and reverse-trial plan unlock.
  - Current 320 x 480 contextual ProGate follow-up: 2026-07-08 bundled Playwright Chrome Expo web verifies direct `/routine/plan`, `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, and `/routine/adaptation` keep Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first reachable in the compact header/body layout, with zero target issues, zero visible-control issues, zero horizontal overflow, zero dialogs, and no unexpected browser logs. Evidence is in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`.
  - Current lapsed-paid evidence: 2026-07-08 System Chrome Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store` verifies direct `/routine/plan` shows `Restore Pro for` and `Renew Pro`, hides `Explore first. 7 days of Pro` and `Start free trial`, exposes no routine-plan content, keeps Renew/Terms/Privacy/Restore/Maybe later controls 48 px+ tall, and has zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/`. Native RevenueCat expiry/restore states remain Phase 6 QA.
- Branch: persistent Morning and Evening application order
  - Priority: Critical
  - Automate later: Yes
  - Action: Build a real multi-step shelf, open the phase-specific editor from Plan, move a Morning step and an Evening step, save, reopen the editor, reload the app, add another eligible product, and inspect Plan plus Today. Repeat once with `EXPO_PUBLIC_E2E_ROUTINE_ORDER_SAVE_FAILURE=once`.
  - Expected result: Save writes separate stable product-ID orders before leaving; Cancel does not write; Morning and Evening choices survive reopening, reload, and deterministic recompute; a new product enters at a deterministic canonical neighbour without erasing existing relative order; duplicate names do not collide; Today uses the saved order after the canonical scheduler selects tonight's active. A failed save stays on the editor, keeps the previous routine active, exposes one inline alert and a retry, and emits no successful-edit analytics. Safety/cadence exclusions and cycle-night assignments are never changed by application order. The encrypted record is included in current-device export and removed by account cleanup.
  - Evidence folder: `test-results/human-e2e/2026-07-10/routine-order-persistence-current/`
  - Current local evidence: 2026-07-10 Codex in-app browser Expo web at 360 x 640 and 390 x 844 adds a real cleanser, toner, moisturiser, retinol, and later face oil through Shelf; saves distinct Morning/Evening orders; verifies reopen, reload, Cancel, Today, and new-product recompute; forces one inline save failure and succeeds on retry; and keeps the cautious safety-excluded retinol out of the plan. The pass found and fixed 43.99 px Plan actions, retinoid-specific cleanser copy without a scheduled retinoid, and missing `aria-selected` phase state. Final Plan/editor/Today geometry reports zero horizontal overflow, clipped controls, or sub-44 visible controls, with no JavaScript dialog or unexpected browser errors. Native encrypted-storage relaunch and VoiceOver/TalkBack remain Phase 5 device work.
- Branch: reminders and streak routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/streak` and `/routine/welcome-back` directly.
  - Expected result: Free users see the reminders contextual paywall, not streak or welcome-back content. Paywall copy promises only the implemented reminder and forgiving-streak value.
  - Evidence: 2026-07-08 evidence for streak and welcome-back remains relevant. Any widgets/paywall claims in that historical evidence are superseded.
- Branch: unavailable native widgets direct route
  - Priority: Critical
  - Automate later: Yes
  - Action: As free, reverse-trial, and Pro users, open `/routine/widgets` directly with `EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED` both false and true, then activate `Back to Today`.
  - Expected result: Every state bypasses the Pro paywall and shows the same explicit unavailable surface. No native-widget preview, Live Activity control, fake check-off, or purchase solicitation appears; the recovery action returns to Today.
  - Evidence: Screenshot sequence, visible-text/control snapshot, navigation result, and Phase 7/9 route/paywall regression checks. The 2026-07-08 interactive preview evidence is historical and intentionally superseded.
  - Current local evidence: 2026-07-12 Codex in-app browser Expo web at the 375 x 667 launch floor verifies direct `/routine/widgets` preserves its route, bypasses the widget upsell, states that no native widget or Live Activity target ships in the current build, offers no preview or OS control, has zero horizontal overflow, and exposes a 55.99 px `Back to Today` recovery control. The free fixture reaches the normal entitlement re-offer after targeting Today. Evidence is in `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/`; native iPhone widget implementation and device evidence remain launch blockers under the all-features contract.
- Branch: conflict check quota and direct routes
  - Priority: Critical
  - Automate later: Yes
  - Action: As a fresh free user, open one conflict detail, then open a different `/conflict/[ruleId]` route directly. Repeat the route as a Pro or reverse-trial user.
  - Expected result: The first free conflict check renders the conflict detail. A second distinct conflict check shows the conflict-checks contextual paywall with no conflict-detail flash. Pro users can open the full conflict detail.
  - Evidence: 2026-07-07 fresh Chrome context at 320 x 568 seeded real retinol/glycolic and retinol/BHA conflicts. The first free direct `/conflict/00000000-0000-4000-8000-000000000001` rendered the AHA detail, the second direct `/conflict/00000000-0000-4000-8000-000000000002` showed the `conflict_checks` paywall with zero sampled detail-flash frames, tapping `Explore first. 7 days of Pro` unlocked the BHA detail, and reloading the same direct route as reverse-trial Pro kept the detail visible instead of the paywall. Evidence is in `test-results/human-e2e/2026-07-07/conflict-quota-direct-routes-current/`.
- Branch: loading or slow entitlement state
  - Priority: Critical
  - Automate later: Yes
  - Action: Load a gated route while entitlement is still resolving.
  - Expected result: No premium content flashes before the entitlement decision.
  - Evidence: Screenshot or trace.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store` and `EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS=2200` opens direct `/routine/plan`, verifies the neutral `Checking your access` state is visible during entitlement resolution, samples no premium routine-plan text through the delay, then resolves to the lapsed paid renewal paywall. The final paywall has zero horizontal overflow, Renew/Terms/Privacy/Restore/Maybe later controls are 48 px+ tall, and evidence is in `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/`. Native offline/cache and live RevenueCat slow-network states remain Phase 6 QA.
- Branch: store pricing loading or unavailable
  - Priority: Important
  - Automate later: Yes
  - Action: Open onboarding, contextual, and lifecycle paywalls before RevenueCat pricing is available, or with the local development fallback.
  - Expected result: The price area uses approved fallback labels while loading and a clear unavailable state when pricing truly fails; lifecycle purchase actions such as paid-expiry renewal explain why the action is disabled; it must never render `Unavailable` as if it were the billed amount, and visible fallback copy must not expose infrastructure names, package setup detail, or production-build diagnostics.
  - Evidence: Screenshot and visible-text snapshot.
  - Current local evidence: 2026-07-07 in-app browser E2E at 320 x 568 verifies Progress, `/routine/plan`, `/onboarding/paywall`, and `/paywall/upsell?feature=full_routine` keep the monthly equivalent on a one-line `$4.16/mo` label instead of a cramped `$4.16 /mo` split, preserve the annual amount as the most conspicuous price, keep zero horizontal overflow, and expose no sub-44 px visible controls. Evidence is in `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/`.
- Branch: PAY-08 closed iOS win-back admission and ordinary-Pro recovery
  - Priority: Critical
  - Automate later: Yes; keep the source contract and add signed-build native automation when the iOS harness is selected.
  - Action: With the versioned no-offer admission and `EXPO_PUBLIC_IOS_WIN_BACK_ENABLED=false`, open `/paywall/winback` directly, refresh it, activate its primary and decline actions, and open Subscription settings with an expired paid entitlement. Repeat at 375 x 667, 390 x 844, and 430 x 932. Separately inject eligible, ineligible, malformed, missing, and failed provider results in tests, and exercise StoreKit messages on a physical iPhone.
  - Expected result: Disabled, ineligible, malformed, missing, and failed paths never present a welcome-back discount, crossed-out amount, percentage savings, urgency, or an offer purchase action. The deep route truthfully says no welcome-back offer is available, shows only the standard annual Pro option, and its primary action reaches the ordinary contextual Pro paywall. Expired Subscription settings likewise routes directly to ordinary Pro options unless both the reviewed source authority and exact SDK `canPurchase` evidence are positive. Ordinary Pro offering retrieval may still configure RevenueCat and fetch localized standard-plan terms, but it skips win-back eligibility discovery. The dedicated disabled win-back purchase returns before RevenueCat configuration, offering retrieval, eligibility, or native purchase calls. RevenueCat automatic messages remain disabled; the explicit message list retains billing issue, price-increase-consent, and generic messages but excludes `WIN_BACK_OFFER`. Only a separately versioned positive admission plus exact native eligibility may show localized offer price, original price, discount, and purchase. App Store Connect and Manage Subscriptions surfaces remain an external exact-product/storefront evidence gate because app source cannot suppress an offer already configured by Apple.
  - Evidence: Supported-phone screenshots, visible-text/control and route snapshots, browser console observations, PAY-08 adversarial contract output, provider call-count assertions, final bundle/config binding, exact App Store Connect and RevenueCat configuration captures, and physical-iPhone sandbox/TestFlight StoreKit-message and purchase traces.
  - Current source and local web evidence: The 2026-08-04 PAY-08 source checkpoint adds a literal no-offer launch admission, two-key runtime resolution, all-profile build refusal, zero-call disabled win-back eligibility and purchase tests, explicit StoreKit message filtering, neutral UI routing, and rejection of the retired hardcoded `$34.99` / 30% discount. Codex in-app browser Expo web at the configured 375 x 667, 390 x 844, and 430 x 932 supported-phone profiles verifies the direct route and refresh retain only the neutral standard-Pro presentation; forbidden welcome-back availability, `$34.99`, percentage-off, and eligible-offer strings remain absent; horizontal overflow is zero; every visible control is at least 47.99 CSS px tall; the primary action reaches `/paywall/upsell?feature=full_routine`; and `Not now` reaches `/today`. Browser logs contain only the known development-only Supabase-placeholder, Expo notifications, pointer-events, and repeated-context GoTrue warnings, with no new route error. The run also found and bounded an uninterruptible HTTP/CDP readiness path in the checked-in text-pressure harness; the final controlled recheck fails with an actionable deadline and cleans both ports instead of hanging, as recorded in `docs/e2e-bug-reports/2026-08-04-text-pressure-runner-unbounded-readiness.md`. This environment still cannot complete that headless-CDP sweep, and Expo web cannot prove App Store Connect state, native StoreKit messaging, eligibility, purchase, renewal, or signed-build behavior.
- Branch: PAY-07 purchase-success entitlement authority, direct-entry recovery, and compact confirmation
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/paywall/success` directly as a fresh free user, with an expired or stale entitlement, while the current entitlement check is loading, and after a failed refresh. Use `Check access again` and `Subscription options`. Separately reach the route after a current active exact-owner trial or paid entitlement is confirmed, and repeat on a 320 px wide phone viewport.
  - Expected result: Direct or stale entry without current active exact entitlement evidence shows only safe recovery. While checking, the route says that purchase details wait for verified active access; after an unconfirmed result, it states that the page did not charge the user or unlock Pro. It makes no purchase-success, renewal, billing, trial, price, or premium-unlock claim, exposes a retry action and a `Subscription options` action, and never flashes the confirmed-success surface. The confirmed state may render only after a post-mount exact-owner query succeeds with freshly verified authority metadata and its own active, future `expiresAt`; cached, pending, failed, wall-clock-expired, stale-verification, or incomplete-authority states stay closed. The route revalidates at the earliest expiry/verification boundary and on foreground. Renewal and price copy requires an exact billing store, `willRenew=true`, the entitlement's own price, and cadence derived from the configured product ID. App-granted reverse trials, RevenueCat-granted out-of-store/non-billing promotions, non-renewing access, and incomplete billing facts use separate no-charge/no-renewal or billing-unknown copy. Trial copy on every paywall requires an exact eligible per-product result for the current iOS customer; unknown/ineligible/no-offer/error results use ordinary subscription copy. The success badge renders a clean checkmark, renewal metadata stays readable without duplicate `/year` or orphaned `yr`, and the Today CTA remains visible with a clear bottom buffer.
  - Fixture boundary: Positive `EXPO_PUBLIC_E2E_ENTITLEMENT` fixtures are permitted only for Expo web in a browser development build used for human-simulated visual evidence. They are not native entitlement authority, must resolve to no grant in iOS and Android bundles even when the environment value is present, and cannot satisfy StoreKit, RevenueCat, TestFlight, physical-iPhone, purchase, restore, or release acceptance.
  - Evidence: Direct/stale/loading/retry screenshots and navigation results; a visible-text and no-confirmed-content-flash trace; browser network/provider-call notes; exact expiry/authority state snapshot; 320 px control-geometry snapshot; native source/bundle contract proving the positive fixture is absent; and separate native sandbox purchase/restore evidence before release.
  - Current source and local web evidence: On 2026-08-04, PAY-07 pure behavior tests cover cached-pre-mount, pending, failed, expired, malformed, stale-verification, exact active, app-granted, RevenueCat-granted promotional, renewing store, non-renewing store, missing-price, duplicate-cadence, live-clock, verification-mismatch, legacy-cache, and introductory-eligibility lanes. Codex in-app browser Expo web at 390 x 844 opens a fresh/free direct route with no entitlement fixture, confirms only `Pro access not confirmed` plus the explicit no-charge/no-unlock alert, verifies zero confirmed/billing copy, zero horizontal overflow, and two 56 px recovery controls, then proves `Check access again` stays closed and `Subscription options` reaches `/settings/subscription`. The refreshed isolated web-only `store_pro` visual fixture renders `$49.99/year` and `set to renew $49.99/yr`, with the Today CTA reaching `/today`. With no store eligibility result, onboarding and contextual upsell render `Subscribe to Pro` rather than a trial claim; the onboarding free-plan action and upsell dismiss both reach Today, while unavailable checkout returns inline recovery. The run found and fixed the duplicate `$49.99/year/year` bug and later removed the development fallback's synthesized trial eligibility. The gitignored `test-results/human-e2e/2026-08-04/pay07-entitlement-admission-current/` screenshots/summary and iOS export bundle are local, volatile diagnostic artifacts, not retained release proof; refreshed semantic interactions were not promoted into retained proof. The bug-report candidate is `docs/e2e-bug-reports/2026-08-04-paywall-success-annual-price-duplication.md`. The export excludes all six positive-fixture markers, but this proves Metro native JavaScript source exclusion only; current 320 px, signed archive, StoreKit/RevenueCat, Trusted Entitlements, sandbox/TestFlight, physical-iPhone, and App Review evidence remain open.
  - Historical layout evidence only: A 2026-07-07 fresh Chrome context at 320 x 568 after a local reverse-trial fixture verified `/paywall/success` rendered a clean checkmark, readable title/body, contained renewal metadata, and a visible 56 px `See tonight's routine` CTA with zero horizontal overflow. That browser fixture predates the current PAY-07 authority boundary and proves layout only; it does not prove a charge, native entitlement, active renewal, StoreKit/RevenueCat result, exact-owner authority, or current acceptance.
- Branch: policy and billing link handoff failure
  - Priority: Important
  - Automate later: Yes
  - Action: Tap Terms, Privacy, Restore, and Manage subscription while the OS/browser cannot open external URLs.
  - Expected result: Policy and billing links show clear unavailable feedback instead of silently doing nothing; Restore still reports success/failure through the purchase state and leaves visible status on the current surface.
  - Evidence: Alert text or row-local feedback, visible route snapshot, and control-geometry snapshot.
  - Current local evidence: 2026-07-08 System Chrome CDP Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all` verifies direct `/paywall/upsell?feature=full_routine` renders row-local `Link unavailable` after Terms/Privacy failure and `No active subscription was found for this account.` after Restore. The Start free trial control is 264 x 54, Terms/Privacy/Restore controls are 48 px+ tall, and horizontal overflow is zero. Follow-up Codex in-app browser evidence at 320 x 568 verifies the same direct paywall restore branch opens no JavaScript dialog, renders exactly one route-owned `role="alert"` restore message, exposes no raw RevenueCat/provider text, keeps all controls 48 px+ tall, and keeps horizontal overflow at zero. Latest evidence also verifies the web-preview store-unavailable state keeps purchase disabled with honest preview copy while compliance restore remains reachable. Evidence is in `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/`, `test-results/human-e2e/2026-07-08/paywall-restore-inline-recovery-current/`, and `test-results/human-e2e/2026-07-08/paywall-inline-recovery-current/`. Native RevenueCat purchase-sheet failure, native restore, and OS billing-management handoff remain Phase 5/6 device QA.
- Branch: Store transaction completion becomes unconfirmed
  - Priority: Critical
  - Automate later: Yes, with a native iOS harness after the release harness is selected; retain the pure behavioral tests for owner binding and admission.
  - Action: Exercise four durable states: generic completion-unconfirmed, RevenueCat `PAYMENT_PENDING_ERROR`, a foreign-owner record, and the ownerless tombstone created only after server-verified terminal account deletion. Force account-publication closure/caller detachment before and after the awaited write-ahead hook; force-quit during Restore; navigate, lock/unlock, background/foreground, reload, sign out, and switch accounts. Attempt another purchase, verified-empty Restore, verified-active Restore, Manage subscription, Support, and a later unsolicited active CustomerInfo listener write.
  - Expected result: The write-ahead record commits and is read back immediately before the native SDK call; configuration/offering/admission failures before that hook leave no false block, and failed, dropped, corrupt, or unreadable persistence prevents the native sheet. After native invocation, generic uncertainty stays blocked until an exact-owner, user-initiated Restore durably persists either empty or active provider evidence; an unsolicited listener result is not correlated to that action and never clears the warning. A fulfilled purchase with no active entitlement remains generic-unconfirmed. `PAYMENT_PENDING_ERROR` has explicit store-instruction copy, survives verified-empty Restore and process death with its original timestamp, and clears only when an exact-owner, user-initiated Restore durably persists active provider evidence; its anchored 30-day `expiresAt` value is a review marker that mutable device time never uses to reopen checkout. RevenueCat's no-new-charge cancellation code clears this attempt and visible feedback directs users who expected existing access to Restore (the SDK's deprecated `userCancelled` flag is derived from the same code). Every unresolved record blocks device-wide purchase admission; the durable exact-owner schema retains only the owner binding, state, reason, creation timestamp, and optional payment-pending review marker—not action or acknowledgement—and a foreign account sees no owner/reason detail. Acknowledgement is process-local, performs no storage write, and hides only for the current foreground. The alert is above routes but behind App Lock, renders only while `AppState` is active, and scrolls at large Dynamic Type. Malformed/unavailable storage fails closed.
  - Account-deletion branch: Deletion intake is never conditioned on resolving a valid commerce warning. Terminal server-verified finalization atomically replaces matching exact-owner commerce records with one fresh ownerless bit containing only `kind`, `createdAt`, and `expiresAt`; it contains no old owner binding, action, provider/product ID, or original timestamp. `expiresAt` is a 30-day review marker only: mutable device time never removes the bit or reopens admission. Any authenticated user sees generic deleted-account copy plus user-initiated Restore, Manage store subscription, and configured Support actions. Manage/Support, verified-empty Restore, and unsolicited listener updates never clear it; only an exact-owner, user-initiated Restore that durably persists active provider evidence clears it without touching other owners' exact records. Resolution-bound retention and any future provider-trusted release rule remain counsel/native gates. A malformed or unavailable journal still blocks intake/finalization and therefore remains an explicit Apple/counsel recovery gate rather than launch-ready deletion evidence.
  - Development-only web fixtures: Start Expo web with `EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=signout_clear_retry` and one of `EXPO_PUBLIC_E2E_STORE_TRANSACTION_NOTICE=purchase_unconfirmed|payment_pending|deleted_account_pending|foreign_pending`. These fixtures are accepted only in a `__DEV__` development runtime and use the real redacted schema. They prove only root-alert copy/actions, lock/background hiding, acknowledgement, route-unmount, reload, geometry, and generic isolation—not StoreKit, RevenueCat, deletion-provider, or Restore behavior.
  - Evidence plan: `test-results/human-e2e/2026-07-13/store-transaction-unconfirmed-web/` for the Expo web-compatible subset at 375 x 667 (optional 360 x 640 resilience). Redacted physical-iPhone/TestFlight evidence remains required for write-ahead/SDK ordering, caller-detached and force-quit recovery, Ask-to-Buy approval and decline, forward/rollback device-clock tests proving the review marker never releases the block, exact/foreign Apple-ID combinations, active/empty Restore, proof that an unsolicited active listener cannot resolve the journal, one App Store subscription group, App Lock/background snapshots, Dynamic Type, and VoiceOver. Counsel approval of the retention/liveness policy and live RevenueCat transfer/alias configuration remain launch gates.
- Branch: Pro entitlement state
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the same routes with an active Pro or reverse-trial entitlement.
  - Expected result: The intended Pro surface renders and remains usable.
  - Historical entitlement-routing evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 verified that local reverse-trial entitlement passed the subscription gate for `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, `/cycle/procedure`, `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, `/routine/adaptation`, `/routine/streak`, and `/routine/welcome-back`. That packet predates the independent cadence, recovery/stop-refer, and explainability-copy admission gates, so it proves only subscription routing and historical geometry—not that sensitive nested guidance is currently available. Widgets are no longer an entitlement-controlled surface; they stay deferred for every account state. Earlier 2026-07-07 evidence similarly verifies only the subscription route into `/routine/plan`.
- Branch: unreviewed routine-cadence production gate
  - Priority: Critical
  - Automate later: Yes
  - Action: With an active Pro or reverse-trial entitlement in a development build forced to the production-closed state through `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed`, directly open `/cycle/week`, `/cycle/settings`, `/cycle/why-tonight`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/phased-intro`, `/cycle/procedure`, `/routine/ramp`, and `/routine/tolerance`. Refresh each route, use every visible safe exit, and repeat at 375 x 667, 390 x 844, and 430 x 932.
  - Expected result: Every route shows only neutral review-gate copy before cadence data or mutation hooks mount. Daily AM/PM routine availability may be stated, but draft frequencies, nights, ramp pace, tolerance choices, recovery duration, procedure controls, phased-introduction timing, pause/skip/travel controls, mutation success analytics, and promises that adding an active will build a cycle remain absent. Direct refresh stays closed, safe exits return to a non-sensitive route, all exposed controls are at least 44 pt, and no supported viewport has horizontal overflow or clipped controls.
  - Evidence: Per-route supported-phone screenshots or UI snapshots, visible-text and control-geometry snapshots, safe-exit route results, refresh results, browser console/dialog/network observations, cadence route-contract output, and proof that protected hooks/mutations do not mount or execute.
  - Historical outer-gate evidence: 2026-07-26 Codex in-app browser Expo web at confirmed 375 x 666, 390 x 844, and 430 x 932 CSS-pixel viewports with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed` verified all nine direct-entry routes remained on neutral review-gate copy across 27 of 27 route/viewport observations. All nine refreshes remained closed; 11 of 11 screen, sheet, and CTA exits returned to `/today`; visible controls were at least 48 px; and horizontal-overflow, clipped-control, forbidden-draft-copy, JavaScript-dialog, and browser-error counts were zero. Visual review found and fixed the repo-local Metro `.tmp` package collision and unreviewed `moisturizer → SPF` copy on the closed Week card. The local ignored packet and two tracked `2026-07-26-core03-*` bug reports record that pass. The 375 x 666 observation is a one-pixel-shorter stress boundary because the selected controller could not produce exact 375 x 667. The packet predates later source-artifact, recovery, explainability, ramp-cache, notification, and stale-state hardening and therefore is not exact-current-source proof. It is working-tree-bound and not manifest-registered. Current-exact-source partial-admission, exact 375 x 667, compact/text-pressure, native safe-area/Dynamic Type/VoiceOver, physical-iPhone, archive-identical, and reviewer-signoff evidence remain open. The earlier three-route 320 x 568 packet remains historical evidence only.
- Branch: independently closed recovery and explainability authority
  - Priority: Critical
  - Automate later: Yes
  - Action: In a development build with cadence available, first leave `EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE` and `EXPO_PUBLIC_E2E_ROUTINE_EXPLAINABILITY_COPY_GATE` closed. Open recovery, procedure, tolerance, Why Tonight, and Phased Introduction directly; seed stale recovery/ramp state; and invoke ramp-up plus de-escalation notification paths. Repeat only in a non-production test fixture with the individually named `open_fixture` gate required for the specific path under test.
  - Expected result: Cadence availability alone cannot expose recovery/irritation controls or claim-bearing explainability copy. Closed recovery state publishes neutral values without rewriting stored bytes. Closed ramp state is not read or cached. Direct ramp-up/de-escalation notification calls return before preferences, leases, scheduling, logging, or analytics. Ordinary streak behavior remains available, but no cycle milestone is synthesized without a real admitted cycle. Fixture-open results are clearly development-only and never constitute professional review or publication authority.
  - Evidence: Current focused unit tests and the mandatory CORE-03 source contract cover the code boundary. Current-exact-source supported-phone screenshots, storage byte snapshots, notification side-effect spies/logs, refresh/relaunch behavior, and a manifest/commit-bound packet remain open.
- Branch: cycle disruption persistence and deterministic resume
  - Priority: Critical
  - Automate later: Yes
  - Action: With Pro, the cadence development fixture available, and the separately named recovery fixture `EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE=open_fixture`, pause from `/cycle/disruption`, reopen the disruption sheet from Today or Week, resume, start procedure recovery, finish recovery early, and repeat a mutation with `EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE=once` before retrying.
  - Expected result: Pause, travel, skip, recovery, phased-introduction, and variant changes write the encrypted current-owner cycle configuration before navigation or success analytics. A paused cycle exposes a reachable `Resume my routine` action and resumes on the same cycle night by shifting the anchor only by elapsed paused days. Starting recovery settles any prior pause; finishing or expiring recovery shifts only the elapsed or configured recovery interval once. Pause and recovery never remain active together. While saving, competing controls are disabled. A failed write stays on the current route, shows one inline alert, keeps the previous cycle and schedule active, emits no success analytics, and succeeds on retry. Reloaded Today, Week, Why Tonight, and cycle settings consume the same reconciled projection. Visible controls remain at least 44 pt with no clipping or horizontal overflow on supported phone sizes.
  - Evidence: Supported-phone screenshots for pause, resume, active recovery, failed write, and retry; cycle-config snapshots before/after; visible accessibility state and control geometry; browser warn/error logs; focused store and route-contract tests.
  - Evidence folder: `test-results/human-e2e/YYYY-MM-DD/cycle-disruption-reconciliation-current/`
  - Historical persistence/geometry evidence: 2026-07-10 Codex in-app browser Expo web at supported 390 x 844 and 360 x 640 with the then-current cadence fixture verified failed pause, recovery, variant, Start Today, and irritation-recovery writes stayed on their source route with one inline alert and no dialog; retry succeeded; pending controls including the sheet backdrop were disabled; pause survived reload and exposed `Resume my routine`; and the recovery/variant/anchor flows reconciled. The pass also fixed the AM Today preview contradicting paused state and verified 48 px controls, scroll recovery, zero overflow, and clean diagnostics. It predates the independent recovery/stop-refer admission gate and therefore does not prove that recovery is available or exact-current-source behavior. Evidence is in `test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/`; a current run must use the named recovery fixture. Native encrypted-storage relaunch, timezone-change, VoiceOver/TalkBack, and iOS/Android Dynamic Type verification remain release-device QA.
- Branch: full authored cycle settings and deterministic reconciliation
  - Priority: Critical
  - Automate later: Yes
  - Action: With Pro and the cadence development fixture available, open `/cycle/settings`, enter Custom, change the 1-14-night length, add/remove an eligible active, change its frequency, assign nights, Cancel once, then Save. Reload, inspect Settings, Week, Plan, and Today; switch to a preset and back to Custom; repeat Save with `EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE=once`. Inspect Why Tonight only under the separately named `EXPO_PUBLIC_E2E_ROUTINE_EXPLAINABILITY_COPY_GATE=open_fixture` development fixture.
  - Expected result: Custom starts from the Auto-recommended projection once, then persists one stable product ID or recovery per night without changing the anchor or ramp. Cancel is non-mutating. Save commits the whole versioned definition before cache publication, navigation, or success analytics; repeated Custom edits do not emit a false variant-change event. Visible controls, Android/system Back, swipe removal, and browser Back cannot leave while persistence is pending, but committed success can exit normally. One product per night, at least one recovery night, safety filtering, phased introduction, and the shared length-aware ramp/reviewed weekly budget remain authoritative. A closed cadence-review gate withholds Custom rather than labeling known products missing. Cadence-excess or temporarily ineligible intent remains saved and does not block unrelated Save/length edits, while the preview shows requested versus currently scheduled cadence and projects withheld occurrences as recovery with an exact Why Tonight reason. New shelf products are not silently inserted; explicitly selected staged products preview and save as introduced; removed products become recovery and prune on explicit save. Presets recalculate without deleting Custom, and returning to Custom restores it. A valid legacy cycle migrates to isolated `layerwell.cycle.v2`; current v2 requires an explicit schema; malformed, unreadable, missing-schema, and future-schema current data is preserved and fails closed. Device export uses v2 as authoritative and labels the retained v1 value as legacy. A failed write leaves the previous projection active, keeps the complete draft and retry visible, and disables competing edits/exits while pending. Every downstream surface consumes the same committed projection with no stale intermediate frame, and paused/skipped/recovery-only PM completions do not advance the active-cycle milestone.
  - Evidence: Supported-phone screenshots at 360 x 640 and 390 x 844; Save/Cancel/reload/preset-round-trip state snapshots; failed-write and pending-control snapshots; Settings/Week/Why Tonight/Plan/Today agreement; 44 pt geometry, overflow, selected/disabled accessibility state, dialog count, and browser logs; focused customization/store/route tests.
  - Evidence folder: `test-results/human-e2e/YYYY-MM-DD/cycle-customization-current/`
  - Historical persistence/geometry evidence: 2026-07-10 to 2026-07-11 Codex in-app browser Expo web at supported 390 x 844 and 360 x 640 verified Auto-to-Custom initialization, assignment, cadence-safe extension to 14 nights, non-mutating Cancel, encrypted reload, retained over-cap intent, preset round trip, one-shot failed save with draft retention, pending Back prevention, retry, and downstream agreement. It also historically observed Why Tonight, but predates the independent explainability-copy admission gate and is not current proof that this route may open. The 360 x 640 audit found zero overflow and no interactive dimension below 48 px, and the pass fixed a Metro import cycle, wrapped trace label, and web pending-Back escape. Evidence is in `test-results/human-e2e/2026-07-10/cycle-customization-current/`. A current Why Tonight run must use the named explainability fixture. Physical iOS/Android secure-storage relaunch, process death, native Back/swipe gestures, timezone/DST, Dynamic Type, and VoiceOver/TalkBack proof remains Tas-owned.
- Branch: Pro direct-entry route exits
  - Priority: Important
  - Automate later: Yes
  - Action: With an active Pro or reverse-trial entitlement, open scheduler and routine routes such as `/cycle/week`, `/cycle/why-tonight`, `/routine/reorder`, `/routine/tolerance`, and `/routine/widgets` directly, then use the visible Back, Done, Got it, Skip, Dismiss, Not yet, or sheet backdrop Dismiss control.
  - Expected result: The user returns to the Today tab instead of being trapped on a direct-entry Pro surface or modal sheet with no navigation history. Deferred widget routes use a destination-specific `Back to Today` CTA instead of generic Back copy. Visible Pro route exits and the Widgets recovery action meet the 44 pt phone touch target, empty Pro states still expose an exit, `/routine/welcome-back` keeps its primary action fully visible with a rendered bottom buffer on short phones, projected cycle-night rows open the selected night's explainability sheet instead of an inert haptic-only button, projected row labels and settings active-night labels use wrapped, user-facing cycle-night copy such as `Night 1`, `Night 2`, and `Nights 3-4` instead of terse or impossible row numbers such as `N0`, `N5`, or `N3-4`, repeated retinoid or repeated exfoliant-slot nights are separated by recovery instead of appearing back-to-back, cycle safety/fallback notes render as readable text instead of inert buttons, phased-introduction cycle notes are the only tappable note CTA and meet the 44 pt phone touch target, and modal Pro sheets remain scrollable on short phones.
  - Evidence: Screenshot sequence, visible route snapshot, cycle-night spacing snapshot, and small-phone button-geometry snapshot.
  - Evidence applicability: The sensitive scheduler/recovery/explainability/ramp/tolerance packets below predate the independent CORE-03 cadence, recovery/stop-refer, and explainability-copy gates. They remain historical geometry and navigation evidence only. They do not prove present availability, current exact-source behavior, or publication authority; a current fixture-open run must name every independently required development gate.
  - Current cycle-label evidence (2026-07-07): In-app browser E2E at 320 x 568 with local reverse trial and two shelf actives reproduced terse `/cycle/week` and `/cycle/settings` labels (`N1`, `N2`, etc.), then verified the fix. Post-fix `/cycle/week` and `/cycle/settings` render `Night 1`, `Night 2`, etc., contain no `N#` visible labels, keep zero horizontal overflow, and expose no clipped or sub-44 px visible controls. Evidence is in `test-results/human-e2e/2026-07-07/cycle-night-labels-current/`.
  - Current shared-sheet evidence (2026-07-07): Codex in-app browser Expo web at 320 x 568 verifies direct `/cycle/disruption` renders one compact modal dialog with all four disruption choices, zero horizontal overflow, no sub-44 exposed controls, a non-focusable hidden backdrop, and the intended compact 24 px web bottom padding after the shared `Sheet` safe-area hardening.
  - Current shortest-phone disruption evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced `/cycle/disruption` clipping `I had a facial or peel` to a 42.6 px visible bottom sliver. Post-fix the same route renders all four disruption choices fully visible with 56 px+ hit targets, zero horizontal overflow, zero blocked controls, and zero sub-44 visible controls; tapping `I had a facial or peel` routes to `/cycle/procedure`. Evidence and report are in `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/` and `docs/e2e-bug-reports/2026-07-08-cycle-disruption-short-phone-choice-clipping.md`.
  - Current shortest-phone phased-intro evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced `/cycle/phased-intro` clipping `Sounds good` below the viewport and hiding the secondary `Add it now anyway` override. Post-fix the same route renders both actions fully visible at about 264 x 48 px, with zero horizontal overflow, zero blocked controls, zero visible clipped controls, zero sub-44 visible controls, and tapping `Sounds good` returns direct entries to `/today`. Evidence and report are in `test-results/human-e2e/2026-07-08/cycle-phased-intro-short-phone-480/` and `docs/e2e-bug-reports/2026-07-08-cycle-phased-intro-short-phone-action-clipping.md`.
  - Current nested scheduler recovery evidence (2026-07-08): Codex in-app browser Expo web at 320 x 568 verifies `/cycle/procedure` starts a 5-day recovery window, redirects to active `/cycle/recovery`, shows both retinol and glycolic as paused, keeps visible controls 48 px+, has zero horizontal overflow, and `Ease back in` returns to `/today`. Evidence is in `test-results/human-e2e/2026-07-08/nested-scheduler-routes-current/`.
  - Current reminders/widgets exit evidence (2026-07-08): Codex in-app browser Expo web at 320 x 568 verifies `/routine/welcome-back` keeps a fully visible `Tonight's step` action and returns direct entries to `/today`; deferred `/routine/widgets` uses `Back to Today` and returns to `/today`; both routes keep visible controls 48 px+ with zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/reminders-streak-welcome-current/`.
  - Current full-routine exit evidence (2026-07-08): Codex in-app browser Expo web at 320 x 568 opens direct `/routine/reorder`, `/routine/tolerance`, `/routine/adaptation`, and `/routine/ramp` in fresh tabs with local reverse-trial entitlement. `Done`, `Skip`, `Looks good`, and `Back` each return to `/today`, with zero horizontal overflow and no sub-44 px visible controls. Evidence is in `test-results/human-e2e/2026-07-08/full-routine-intelligence-current/`.
- Branch: back, refresh, relaunch, or navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Refresh the browser, navigate away and back on a locked direct route, or directly open `/paywall/upsell?feature=full_routine` and `/paywall/winback`.
  - Expected result: Gating stays stable and dismissing a direct-entry paywall returns to a safe app surface, not a blank or dead-end history state. On short phones, paywall bodies scroll above fixed actions, Terms/Privacy/Restore and decline controls meet the 44 pt touch target with a rendered buffer, the win-back fallback reason stays readable above its current-plan CTA when a native offer is unavailable, and the contextual upsell exposes a real visible dismiss action instead of relying on a tiny scrim-only target.
  - Evidence: Screenshot sequence plus 320 px button-geometry snapshot.
  - Current evidence (2026-07-07): `/paywall/upsell?feature=reminders_widgets` at 320 x 568 in `test-results/human-e2e/2026-07-07/paywall-upsell-reminders-compact/` verifies zero horizontal overflow, no clipped elements, 48 px+ visible controls, readable fallback store copy, and `Maybe later` recovery to `/today`.
  - Current monthly-price evidence (2026-07-07): `/paywall/upsell?feature=full_routine` at 320 x 568 in `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/` verifies the upsell sheet renders `$4.16/mo` on one readable line, with zero horizontal overflow and no sub-44 px visible controls.
  - Current lifecycle evidence (2026-07-07): `/paywall/reoffer` and `/paywall/downgrade` at 320 x 568 and 390 x 568 in `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/` verify Terms/Privacy/Restore can scroll above fixed footer actions with 48 px controls, the decline actions keep a 32 px bottom buffer, unavailable-store copy stays readable, no visible controls clip or fall below 44 px, and `Continue on free` / `Keep using free` recover to `/today`.
  - Current shortest-phone lifecycle evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced `/paywall/winback`, `/paywall/downgrade`, and `/paywall/reoffer` covering Terms, Privacy, and Restore with compact footer content. Post-fix, those three lifecycle routes render compliance inside the compact action footer; Terms, Privacy, Restore, primary purchase/current-plan action, and decline action are visible and hit-testable with zero blocked controls, zero sub-44 controls, zero visible clipped controls, zero horizontal overflow, and no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/short-phone-480-paywall-compliance-final/`.
  - Current skipped-route text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/paywall/reoffer` compact annual price text overflow at 320 x 480 / 170% because `$49.99/year` stayed in one nowrap group. Post-fix, the compact billing block separates fitted price and period text, and the 21-route skipped-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-current/`, `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-postfix/`, and `docs/e2e-bug-reports/2026-07-09-skipped-routes-text-pressure-clearance.md`.
  - Current 320 x 480 contextual ProGate follow-up: Contextual ProGate paywalls now use a sub-520 px treatment that moves Terms, Privacy, and Restore into a compact header row, keeps `Maybe later` at 48 px in the same top band, hides duplicate bottom compliance, and trims only the paywall body spacing. 2026-07-08 bundled Playwright Chrome Expo web verifies `/progress`, `/routine/plan`, `/routine/ramp`, `/routine/tolerance`, `/routine/reorder`, `/routine/adaptation`, `/cycle/settings`, `/cycle/disruption`, `/cycle/procedure`, `/cycle/phased-intro`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/week`, `/routine/streak`, and `/paywall/upsell?feature=full_routine` at 320 x 480 with zero target issues, zero visible-control issues, zero horizontal overflow, zero dialogs, and no unexpected browser logs. Its widgets-paywall observation is superseded because `/routine/widgets` now bypasses ProGate. A later 320 x 568 text-pressure audit found the Progress photo paywall needed the same header compliance even outside the sub-520 px band; ProGate now applies that treatment to compact `/progress*` photo paywalls too. The 320 x 390 / 120% sweep verifies direct `/paywall/upsell?feature=full_routine` keeps `Maybe later`, Terms, Privacy, Restore, and Start free trial complete and center-hit-testable with zero overflow. Evidence and reports are in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`, `test-results/human-e2e/2026-07-08/progress-progate-text-pressure-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/`, `docs/e2e-bug-reports/2026-07-08-progate-short-phone-compliance-clipping.md`, and `docs/e2e-bug-reports/2026-07-08-progress-progate-text-pressure-tabbar-overlap.md`; native iOS/Android safe-area and Dynamic Type behavior remain release QA.
  - Current 430 x 932 tall-phone contextual ProGate evidence: 2026-07-09 Codex in-app browser Expo web verifies `/progress` uses the compact compliance header on the tall supported-phone viewport. Terms, Privacy, Restore, and Maybe later render as 48 px top-band controls, `Start free trial` renders as a complete 382 x 54 px CTA above the floating tab bar, the Explore-first visible body compacts to `No card needed.` while retaining the full accessibility label, horizontal overflow is zero, no dialog opens, and tapping Maybe later returns to `/today`. Evidence and report are in `test-results/human-e2e/2026-07-09/progate-tall-phone-header-current/`; native iOS/Android Dynamic Type and store-sheet behavior remain release QA.
  - Current 320 x 430 / 130% contextual ProGate follow-up: 2026-07-08 headless Chrome Expo web reproduced compact-header overlap on routine and cycle locked routes. Post-fix, ultra-short contextual ProGate paywalls reserve a stacked 96 px header band for compliance plus dismiss and hide the monthly-equivalent label, and the 49-route 130% text-pressure sweep reports zero failures. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-postfix/` and `docs/e2e-bug-reports/2026-07-08-progate-text-pressure-130-header-overlap.md`; native iOS/Android safe-area and Dynamic Type behavior remain release QA.
  - Current 320 x 370 / 320 x 360 / 130% contextual upsell follow-up: 2026-07-08 headless Chrome Expo web verifies the sub-380 px contextual ProGate band and direct upsell sheet keep compact compliance, dismiss, annual price, store-unavailable reason, and Start free trial complete while dropping nonessential body copy and the monthly-equivalent price where needed. A 2026-07-09 follow-up gave the micro-short contextual CTA a raised one-line hit target after the loaded `/progress` paywall CTA center resolved to surrounding paywall content. The final 49-route sweeps report zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-5/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-6/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, and `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`; native iOS/Android safe-area and Dynamic Type behavior remain release QA.
  - Current 320 x 390 / 320 x 360 / 200% contextual upsell follow-up: 2026-07-08 headless Chrome Expo web passed the 320 x 390 sweep, then found the 320 x 360 direct upsell CTA and contextual Progress CTA could land as partial or blocked targets under 200% text pressure. Post-fix, direct upsell and contextual ProGate use micro-short fitted titles, one-line price/CTA treatments, compact compliance, and a tappable store-unavailable CTA path so the user receives route-owned feedback instead of a dead disabled control. The final 49-route 320 x 360 sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`; native iOS/Android safe-area, Dynamic Type, and store-sheet behavior remain release QA.
  - Current 320 x 568 / 140% contextual upsell follow-up: 2026-07-08 headless Chrome Expo web reproduced direct upsell CTA clipping and routine/cycle ProGate header overlap at 140% text pressure. Post-fix, narrow 320 px short paywalls use an icon dismiss, omit nonessential body copy, hide the monthly-equivalent price, and keep annual price, store-unavailable reason, compliance links, dismiss, and Start free trial complete and hit-testable. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-3/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-140-compact-568-clearance.md`; native iOS/Android Dynamic Type behavior remains release QA.
  - Current 390 x 740 / 200% direct-upsell follow-up: 2026-07-09 headless Chrome Expo web found direct `/paywall/upsell?feature=full_routine` exposing `Start free trial` as a 19 px partial target whose center hit the surrounding sheet instead of the button. Post-fix, the 390-wide 700-779 px text-pressure band uses the short paywall layout with header compliance, compact action spacing, complete `Start free trial`, and no partial bottom-edge purchase target. The focused upsell rerun and final 49-route 390 x 740 sweep report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-upsell-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-postfix2/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-390-740-clearance.md`; native iOS/Android safe-area, Dynamic Type, and store-sheet behavior remain release QA.
  - Current shortest-phone contextual upsell evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 opens direct `/paywall/upsell?feature=full_routine` and `/paywall/upsell?feature=reminders_widgets`, verifies Layerwell Pro copy, preview-store fallback copy, `Start free trial`, Terms, Privacy, Restore, and `Maybe later` are visible without scrolling, visible user-facing controls are 48 px+, horizontal overflow is zero, no center hit-test is blocked, no JavaScript dialog appears, and `Maybe later` recovers to `/today`. The only sub-44 geometry node in the follow-up run was an `aria-hidden="true"` / `tabindex="-1"` sheet spacer, not a user-facing target. Evidence is in `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/`, `test-results/human-e2e/2026-07-08/commerce-attribution-and-short-phone-ui/`, and `docs/e2e-bug-reports/2026-07-08-shelf-paywall-short-phone-bottom-actions.md`.
- Branch: accessibility and keyboard
  - Priority: Important
  - Automate later: Yes
  - Action: Inspect focusable controls and use keyboard activation on the paywall actions.
  - Expected result: Controls have roles, labels, and visible feedback without trapping focus.
  - Evidence: UI snapshot or accessibility notes.

## Flow: IOS-02 Native Widgets And Layerwell Live Activity

- Goal: A supported iPhone user can glance at current routine state, deep-link
  safely into Today, and complete an eligible step from an interactive widget
  without cross-account disclosure, lost actions, or stale Live Activity
  residue.
- Persona: A signed-in iOS 17+ user with current health-data authority, plus
  users whose authority expires or changes while a widget or Live Activity is
  still installed.
- Entry state: A signed QA build containing the exact reviewed app, WidgetKit
  extension, App Group, App Intent, and ActivityKit target; test accounts A and
  B; App Lock and device-lock fixtures; and controllable current, stale,
  malformed, oversized, foreign, and unclaimed native state.
- Start screen/URL/window: `LayerwellToday` in `systemSmall`,
  `systemMedium`, `accessoryInline`, and `accessoryRectangular`; the
  `LayerwellEvening` Live Activity on the Lock Screen/Dynamic Island; and
  the app in warm, cold, killed, signed-out, switching-account, and
  post-reboot states.
- Success state: Every valid action converges exactly once through the
  canonical completion path; every invalid or obsolete state fails generic;
  every authority-ending transition purges/redacts shared state and ends the
  Live Activity; and no route or assistive-technology announcement bypasses
  authentication, App Lock, or health-data authority.
- Priority: Critical
- Automate later: Yes. Retain source contract/model tests, then add signed
  native harness assertions and human physical-iPhone evidence.
- Surface: Signed iOS 17+ physical-device builds only. Simulator, unit,
  snapshot, Expo web, and unsigned source inspection cannot satisfy this flow.
- Evidence folder:
  `docs/phase-5/evidence/widget-lifecycle/<source-sha>/<build-id>/` plus the
  human run under
  `test-results/human-e2e/YYYY-MM-DD/ios-02-widget-lifecycle/`.
- Current source status (2026-07-16): An implemented source candidate now
  includes the generation-bound app lifecycle host/native bridge and an App
  Group SQLite owner/snapshot/outbox lifecycle protected by a POSIX lock and
  immediate transactions, with native compare-and-swap reconciliation and
  lock-held lease-close quiescence. Quiescence durably captures the exact final
  outbox and permits one exact receipt-bound commit for a nonempty capture; an
  empty capture revokes its structured receipt under the same lock before
  returning. Typed `outbox_pending`/stale-Activity outcomes retry without
  purging accepted actions. A parse-independent, boundary-first privacy lane
  durably verifies `privacy-closing-v1` and returns a closed-admission receipt
  before its queued purge. Live Activity stale/recovery/end-request paths exist,
  but a close receipt does not prove ActivityKit removed the presentation. The
  source has not been compiled or signed on macOS and has no physical-iPhone
  proof.
  `LayerwellWidgetInteractivePublicationEnabled` and
  `LayerwellLiveActivityStartEnabled` remain literal generated-Info.plist
  `false`; `ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED` and
  `phase7Capabilities.nativeWidgets` also remain literal `false`. Ordinary
  shipping config does not generate the extension or advertise Live
  Activities. The five-minute health-status lease also makes personalized
  display short-lived pending a reviewed longer local-display authorization,
  and synchronous exclusive-`flock`/read-write-SQLite rendering still requires
  Instruments evidence. No branch below is currently passed.

### IOS-02 Critical Branches

- Branch: four declared WidgetKit families
  - Priority: Critical
  - Automate later: Yes
  - Action: Add `LayerwellToday` as `systemSmall`, `systemMedium`,
    `accessoryInline`, and `accessoryRectangular`. Exercise current,
    partially completed, completed, stale, and generic/redacted timelines in
    light/dark mode on the oldest-supported and current iPhone classes.
  - Expected result: All four—and only the four declared launch
    families—render family-appropriate, bounded content without clipping,
    placeholder leakage, user/owner identifiers, or unsupported controls.
    Stale or unauthorised state renders generic rather than last-known private
    detail.
  - Evidence: Signed-target family declaration, one timestamped screenshot per
    family/state/device class, timeline receipt, source/build/identity hashes,
    and device console excerpt with no extension crash.
- Branch: health-authority display lifetime
  - Priority: Critical
  - Automate later: Yes
  - Action: Publish immediately after a fresh health-status verification and
    again late in the same lease; observe every family through the
    30-second-headroom boundary and lease expiry. Repeat after background,
    foreground, relaunch, clock change, withdrawal, and re-consent. Separately
    exercise any proposed longer purpose-limited local-display authorization.
  - Expected result: Current source never presents personalized detail beyond
    the exact health-authority deadline and becomes generic no later than the
    five-minute lease less reconciliation headroom. A longer display lifetime
    ships only if its distinct purpose, duration, withdrawal behavior, copy,
    and local-only data handling are implemented and approved; no status lease
    is silently repurposed into indefinite home-screen authority.
  - Evidence: Server-status/lease receipt, publication/stale timestamps,
    frame-by-frame family recording, background/relaunch log, proposed
    authorization contract, and named privacy/legal/release decision.
- Branch: WidgetKit SQLite render performance under contention
  - Priority: Critical
  - Automate later: Yes
  - Action: Use Instruments and extension diagnostics on the oldest supported
    and current iPhone while provider/render reads overlap App Intent append,
    app publication, quiescence, cleanup, process relaunch, and device lock.
  - Expected result: Synchronous exclusive-`flock` acquisition, read-write
    SQLite open/schema/read work, memory, and fallback behavior stay inside
    predeclared extension budgets with no watchdog termination, blank/private
    fallback, unbounded wait, or interaction loss.
  - Evidence: Instruments traces, signposts, raw duration/memory samples,
    contention matrix, extension/watchdog logs, predeclared thresholds, and
    named performance signoff bound to source/build/device identity.
- Branch: warm, cold, and killed-app deep links
  - Priority: Critical
  - Automate later: Yes
  - Action: Tap every widget and Live Activity link with the app foregrounded,
    terminated from memory, and cold after reboot; repeat while signed out,
    App Lock is engaged, and health-data authority is resolving or closed.
  - Expected result: The link reaches the canonical Today destination only
    after the normal session, App Lock, and private-data gates. It never
    flashes another owner's routine, exposes a stale step, lands on a dead
    modal, or treats `/routine/widgets` as a native management screen.
  - Evidence: Uncut warm/cold/killed screen recording, launch/deep-link logs,
    final route snapshot, App Lock focus order, and process-state timestamps.
- Branch: concurrent and repeated interactive actions
  - Priority: Critical
  - Automate later: Yes
  - Action: With the app killed and then while app reconciliation overlaps,
    press two distinct valid actions concurrently and repeat the same action
    rapidly before and after a timeline reload. Relaunch and repeat after a
    forced process kill between native append and app reconciliation. Finally,
    race a valid tap immediately before, during, and after health-lease
    quiescence.
  - Expected result: Each App Intent durably appends before returning; distinct
    eligible actions are retained, the repeated token is idempotent, canonical
    completions occur exactly once, and the replacement snapshot/outbox
    acknowledgement commits natively before the private registry is
    acknowledged. Quiescence takes the same native lock, captures every append
    that won the boundary and rejects every later append, then permits exactly
    one receipt/authority/owner/snapshot/revision-bound final commit for a
    nonempty capture before ordinary closed admission resumes. An empty capture
    revokes the receipt under the lock before returning. No whole-timeline or
    lease-close race loses or resurrects an accepted action.
  - Evidence: Redacted native SQLite/outbox receipts, canonical completion-log
    diff, intent/reconciliation ordering log, pre/post-relaunch widget
    screenshots, and an exact-once assertion report.
- Branch: unknown, stale, expired, and foreign actions
  - Priority: Critical
  - Automate later: Yes
  - Action: Invoke an unknown action token; a token from an older snapshot; a
    token exactly at and after `staleAtMs`; an already acknowledged token;
    and a token bound to another owner generation or invalidated authority.
  - Expected result: None creates or mutates a canonical completion. The
    extension and app fail closed, obsolete outbox state is redacted or
    rejected, the current owner's valid state is not overwritten, and no token,
    owner, product, or step detail appears in feedback or logs.
  - Evidence: One redacted native/canonical before-and-after report per case,
    boundary-time trace, visible generic state, and log privacy audit.
- Branch: malformed, future-schema, and oversized shared payload
  - Priority: Critical
  - Automate later: Yes
  - Action: Inject truncated JSON, wrong types, duplicate/overlong fields, a
    future schema version, an oversized timeline/outbox/props payload, corrupt
    SQLite bytes, and a malformed bridge response; then trigger render,
    interaction, reconciliation, and privacy cleanup.
  - Expected result: Rendering and interaction fail generic with no crash,
    partial private render, canonical completion, or fallback acceptance.
    Present-but-malformed/future native state is not mistaken for
    not-configured state. The privacy kill lane can durably verify the
    `privacy-closing-v1` sentinel, return a closed-admission receipt, rotate
    authority, purge raw shared state, reload timelines, and end activities
    without first decoding the corrupt payload; any cleanup failure remains
    closed and retryable. The receipt alone does not prove ActivityKit finished
    dismissal.
  - Evidence: Fault-injection manifest and hashes, extension/app crash logs,
    generic-state screenshots, cleanup receipt, post-cleanup App Group
    inspection, and retry proof.
- Branch: locked-state and shared-surface redaction
  - Priority: Critical
  - Automate later: Yes
  - Action: Lock the device and engage App Lock while current routine details
    exist; inspect all four widget families and every Live Activity region
    before unlock, during unlock, after backgrounding, and after authority
    becomes unavailable.
  - Expected result: Lock Screen, shared, unavailable-authority, and transition
    frames reveal only approved generic copy—never product, active, condition,
    step, adherence, account, user ID/hash, owner generation, or action token.
    Unlock republishes detail only after current authority is recaptured; no
    stale frame bridges owners or foreground sessions.
  - Evidence: Lock/unlock recording, screenshots of every shared region,
    frame-by-frame privacy review, and shared-container/log string audit.
- Branch: expiry, sign-out, switch, deletion, withdrawal, foreign, and unclaimed cleanup
  - Priority: Critical
  - Automate later: Yes
  - Action: Separately trigger health-lease expiry, sign-out, A→B and B→A
    account switches, server-confirmed account deletion, health-data consent
    withdrawal, a foreign owner generation, and native state with no claimable
    owner. Interrupt each path before/during cleanup and relaunch.
  - Expected result: The account/privacy boundary closes native admission and
    encrypted action capabilities before JavaScript writer drains or
    replacement-owner publication. The process-global serialized lifecycle
    then rotates native authority, destroys snapshot/outbox/private token
    mappings, reloads WidgetKit, and requests immediate generic ActivityKit end
    before ownership proofs are released. Account B never sees A's state;
    foreign and unclaimed state is purged/redacted rather than adopted. A
    cleanup failure retains the minimum quarantine/owner proofs needed for safe
    retry, exposes no private content, and cannot be bypassed by relaunch or a
    new sign-in. Evidence must separately prove when ActivityKit actually
    removes the presentation; a closed-admission receipt is insufficient.
  - Evidence: Separate before/after App Group and private-registry reports for
    all seven cases, activity enumeration, timeline reload log, forced-failure
    retry trace, cross-account screenshots, and zero-residual assertion.
- Branch: `LayerwellEvening` lifecycle, process death, and reboot
  - Priority: Critical
  - Automate later: Yes
  - Action: In an explicitly enabled signed QA build, opt in and start the
    evening activity; update every step; let it become stale; complete early;
    disable it; kill the app during each phase; and reboot with active, stale,
    malformed, and already-completed instances.
  - Expected result: Start/update accepts only current strict props with a
    deterministic bounded `staleDate` and the exact signed Layerwell deep
    link, then reauthorizes after the ActivityKit operation and immediately
    requests generic end if the boundary changed. Post-start typed stale
    handling rereads current JS instances and awaits their end requests before
    retry. Global push-to-start token observation/emission remains absent;
    per-activity push remains signed `false` and current-authority-gated.
    Recovery enumerates and reconciles existing instances after process death;
    completion, stale timeout, disablement, invalid authority, cleanup, and
    withdrawal request immediate approved generic final content/end. Device
    evidence proves the actual dismissal interval and eventual zero-instance
    state. Reboot cannot revive private or completed state, create duplicates,
    or leave an orphaned activity.
  - Evidence: Full lifecycle/reboot recordings, ActivityKit instance reports,
    stale-date timestamps, start/update/end ordering logs, lock-screen/Dynamic
    Island screenshots, and zero-orphan assertion.
- Branch: VoiceOver and Dynamic Type
  - Priority: Critical
  - Automate later: Yes
  - Action: With VoiceOver enabled, traverse and activate every exposed widget
    and Live Activity control. Repeat every family/state at all supported
    Dynamic Type sizes, including accessibility sizes, in light/dark mode and
    with generic redaction active.
  - Expected result: Reading order, labels, values, hints, and action outcomes
    are concise and unambiguous; private hidden text is neither visible nor
    announced; controls remain operable; and important state is not conveyed
    only by colour. Text may simplify within WidgetKit's fixed geometry but
    never clips into misleading or privacy-revealing fragments.
  - Evidence: VoiceOver transcript and uncut activation recording, screenshot
    grid for every family/type-size/state combination, contrast audit, and
    named accessibility signoff.
- Branch: customer flags and unavailable web route remain closed
  - Priority: Critical
  - Automate later: Yes
  - Action: Build ordinary development, preview, and production configs without
    the explicit native QA opt-in; try environment overrides; then open
    `/routine/widgets` on Expo web as free, reverse-trial, and Pro users.
  - Expected result: Ordinary builds omit the widget extension and Live
    Activity advertisement, interactive publication and public capability stay
    false, and production rejects an unsafe override. Expo web always shows the
    same explicit unavailable surface with no preview, check-off, Activity
    control, or purchase solicitation; `Back to Today` remains usable. This
    branch stays closed until the signed IOS-02 evidence gate intentionally
    changes the product contract.
  - Evidence: Generated-config diffs, flag/route contract tests, production
    rejection output, and the existing/current 375 x 667 web route recording.

## Flow: Personalized Recommendations

- Goal: A user can review only positively admitted, independent For You
  guidance, see an honest no-product state when product-specific authority is
  absent, tune recommendation preferences, and escape stale/direct
  recommendation links without getting trapped.
- Persona: Returning user deciding what to add, replace, or skip.
- Entry state: User has completed onboarding or has seeded profile/shelf/routine state.
- Start screen/URL/window: You tab, Today recommendation teaser, or direct recommendation routes.
- Success state: Current-source output is limited to admitted type-first or
  Shelf-context provenance; product-specific and goal-active content remains
  absent while its positive gates are closed; unavailable profiles and
  unreadable preference/dismissal records withhold suggestions; commerce
  admission remains unconditionally false and makes no retailer request; and
  direct-entry recommendation screens recover to the correct parent surface.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route recovery; iOS and Android for native commerce/share surfaces.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/recommendations/`
- Current local evidence: `test-results/human-e2e/2026-07-07/recommendation-dismissal-cold-start/`
- Current local evidence: `test-results/human-e2e/2026-07-07/recommendation-accept-manual-add/`
- Current local evidence: `test-results/human-e2e/2026-07-07/recommendation-preferences-compact-current/`
- Current local evidence: `test-results/human-e2e/2026-07-07/recommendation-stale-detail-recovery/`
- Current local evidence: `test-results/human-e2e/2026-07-07/recommendations-hub-compact-card-fit/`
- Current local evidence: `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/`
- Current local evidence: `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/`
- Current ultra-short evidence: `test-results/human-e2e/2026-07-08/recommendations-ultrashort-430-current/`
- Current local evidence: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/`
- Evidence qualification: all listed packets predate the CORE-06A positive
  recommendation-admission boundary. They remain useful geometry/navigation
  history, but they do not establish exact-current admission, product-specific
  suppression, goal provenance, commerce network absence, native behavior, or
  launch acceptance.

### Path A: For You Hub

1. Action: Open `/recommendations`, inspect grouped suggestions or the "you're set" state, then open Preferences and return.
   Expected result: The hub is advisory, not storefront-like, and preferences return to the For You hub.
   Evidence: Screenshot sequence and visible route snapshot.

### Branches

- Branch: product-specific mode closed with zero admitted products
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the hub, a recommendation detail, and the Today teaser with an
    empty Shelf, one-product Shelf, and a forged/full local catalog candidate
    while product-specific mode is closed.
  - Expected result: No catalog product name, product image, candidate fit
    score, buy action, retailer availability, price, or affiliate disclosure is
    rendered. The surface may show admitted structural type guidance or an
    honest no-product/review-pending state. A forged candidate, mutable review
    string, quality score, absent correction, feature flag, or caller-supplied
    recommendation-type/copy collection cannot create product provenance.
  - Evidence: Exact-source/build identity, screenshots and accessibility
    snapshots for all three Shelf states, recommendation/provenance snapshot,
    negative catalog-name query, and browser/network log proving zero retailer
    requests.
- Branch: goal-active admission remains closed
  - Priority: Critical
  - Automate later: Yes
  - Action: Exercise the goal recommendation path with the Phase 7 flag off,
    flag on but missing/stale health consent, missing/stale profile or goal
    provenance, and current inputs but an empty review-clearance set.
  - Expected result: Every state withholds the goal-active suggestion and shows
    calm unavailable/review-pending recovery without substituting another
    active or implying product safety. Only a later exact-current positive
    clearance plus a server-minted, server-verified receipt bound to the exact
    account, health-processing lifecycle, profile completion, goal set, review
    scope, and expiry may admit the reviewed output. The current structured
    goal-provenance envelope alone is not authorization.
  - Evidence: Gate-state matrix, screenshots, exact local record snapshots, and
    absence of goal-active analytics/product/retailer traffic.
- Branch: no-product and product lookup failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Open a type-first recommendation when there is no admitted matching
    product, then simulate candidate service unavailable, timeout, malformed
    response, owner/market mismatch, stale serving receipt, and an open
    correction/hold.
  - Expected result: The type explanation remains truthful if independently
    admitted, but no product is invented, cached as current, or described as
    reviewed/available. The user sees an honest no-product state and can return
    to For You or add their own Shelf item.
  - Evidence: Screenshot sequence, bounded error-state transcript, cache
    snapshot, serving-receipt checks, and absence of leaked raw errors.
- Branch: commerce fetch is impossible for current provenance
  - Priority: Critical
  - Automate later: Yes
  - Action: Enable the commerce environment flag and grant local commerce
    consent, then open every current `type_first` and `shelf_context` detail and
    attempt direct where-to-buy routes. Separately inject unavailable, timeout,
    malformed, redirect, non-HTTPS, and wrong-product retailer responses into a
    later product-provenance test fixture.
  - Expected result: Current provenance never renders or invokes where-to-buy,
    regardless of shape, flag, or consent, because current commerce admission
    returns `false` unconditionally, and generates zero retailer/affiliate
    traffic. The later fixture requires an exact SKU/market/admission receipt
    and fails closed without changing ranking, product identity, or
    recommendation provenance while giving a calm retry/back path.
  - Evidence: Source-bound provenance matrix, network log with a zero-retailer
    assertion, screenshot/accessibility snapshots, and ranking equality before
    and after all commerce fixtures.
- Branch: recommendation inputs are unavailable or unreadable
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the hub, Today teaser, and a detail route with an unavailable
    profile, unreadable preference envelope, and unreadable dismissal envelope;
    relaunch each state and then restore the exact original bytes.
  - Expected result: Every state withholds all suggestions, renders the calm
    suggestions-unavailable recovery, does not replace unreadable bytes with
    defaults or an empty set, and emits no product, goal-active, analytics, or
    retailer traffic. Restoring valid input permits only the independently
    admitted current output.
  - Evidence: Before/after encrypted-byte hashes, screenshots and accessibility
    snapshots, reload transcript, recommendation snapshot, and network/analytics
    log.
- Branch: Today recommendation teaser and SPF gap prompt
  - Priority: Important
  - Automate later: Yes
  - Action: Open Today with a shelf/profile state that produces an SPF gap, inspect the inline prompt, then tap See why or dismiss it.
  - Expected result: The prompt stays advisory and dismissible, the visible close, See why, and Not now controls meet the 44 pt phone touch target, and no text or action overflows on a 320 px phone.
  - Evidence: Small-phone screenshot, button-geometry snapshot, and local dismissed recommendation state when dismissing.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 uses the real manual shelf flow to add `Gentle cleanser` and `Barrier moisturizer`, opens `/today?routine=AM`, and verifies the compact SPF prompt renders full readable `No SPF this morning`, visible `See why` and `Not now` actions, 56 x 176 px and 48 x 86 px controls, zero horizontal overflow, `/recommendations/gap:mineral_spf` detail routing with SPF rationale, dismissal, and reload persistence. Evidence is in `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/`.
- Branch: compact you're-set state
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations` with a complete, non-expiring shelf state that produces no recommendation cards, inspect the first viewport, then scroll on a very short phone viewport.
  - Expected result: The honest "you're set" trust copy uses a scrollable compact layout, does not overlap the For You subtitle in the first viewport, keeps the footnote fully visible at 320 x 568, keeps it reachable after scroll at 320 x 480, and has zero horizontal overflow.
  - Evidence: Phone-width screenshot, scroll snapshot, and UI geometry JSON.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 and 320 x 480 verifies the seeded complete-shelf you're-set state has no first-viewport subtitle overlap, no horizontal overflow, no sub-44 px controls, one scrollable empty-state region, a fully visible 320 x 568 footnote, and a fully reachable 320 x 480 footnote after scroll.
- Branch: direct-entry recommendation exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations`, `/recommendations/preferences`, and a stale `/recommendations/[id]` route directly, then use the visible Back or Back to For you control.
  - Expected result: The direct For You hub returns to the You tab; nested recommendation routes return to `/recommendations` instead of remaining on a no-history screen. Visible hub Back/Preferences controls, nested Back controls, stale-detail Back to For you, and preference chips meet the 44 pt phone touch target.
  - Evidence: Screenshot sequence, visible route snapshot, and small-phone button-geometry snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 opens `/recommendations`, taps the 48 px Back control, and lands on `/you`; opens `/recommendations/preferences`, verifies Back plus all visible value/budget/texture chips are at least 48 px tall, taps Back, and lands on `/recommendations`; opens stale `/recommendations/stale-local-rec`, verifies the 48 px route Back plus 113.59 x 48 px `Back to For you`, taps `Back to For you`, and lands on `/recommendations`. All checked states have zero horizontal overflow, no sub-44 controls, no JavaScript dialog, and only expected local Supabase placeholder / Expo web notification warnings. Evidence is in `test-results/human-e2e/2026-07-08/recommendations-direct-entry-exits-current/`.
  - Current supported-phone 120% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/recommendations/preferences` peeking the Texture chip group at 390 x 844 / 120%. Post-fix, the Texture group starts below the first modern-phone viewport while visible preference chips remain complete and 48 px+, and the 390 x 844 final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`.
  - Current 412 x 844 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced `Drugstore` and `Mid-range` budget chips as 26 px partial targets at the first viewport bottom. Post-fix, Recommendation Preferences applies the stronger modern/tall text-pressure spacer so the lower-priority budget group starts below the first viewport while Back and visible value chips stay complete and center-hit-testable. The focused route audit reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-postfix3/` and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-412-boundary-text-pressure.md`.
  - Current 430 x 640 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced `Non-comedogenic` and `Sustainable` as 8 px partial targets at the first viewport bottom after the first support-band fix. Post-fix, the wide support-band route defers lower-priority value chips below the first viewport while Back and the first three value chips remain complete and center-hit-testable. The focused preferences rerun, full 49-route 430 x 640 sweep, and affected-route 390 x 640 regression report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-preferences-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-640-affected-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-430-640-text-pressure.md`.
- Branch: stale recommendation detail
  - Priority: Important
  - Automate later: Yes
  - Action: Open a recommendation detail ID that is no longer present after shelf/profile changes.
  - Expected result: The app explains the suggestion is no longer current and provides a working Back to For you path.
  - Evidence: Screenshot and route snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 direct `/recommendations/stale-local-rec` shows the stale suggestion copy, exposes a 48 px `Back to For you` action, returns to `/recommendations`, and has zero horizontal overflow.
  - Current 320 x 360 / 200% text-pressure evidence: 2026-07-08 headless Chrome Expo web reproduced a 15 px horizontal overflow in the stale detail header when `Recommendation` was scaled to 200%. Post-fix, the header label fits on one line with font fitting beside the 48 px Back control, and the final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`.
- Branch: recommendation accept and dismiss
  - Priority: Critical
  - Automate later: Yes
  - Action: Open a real recommendation detail, dismiss it, then open another and accept it into manual add or conflict detail.
  - Expected result: Dismissal persists, acceptance goes to the correct next step, and copy remains independent and claim-safe.
  - Evidence: Screenshot sequence and local recommendation state.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 dismisses `A ceramide moisturiser` from `/recommendations/gap:ceramide_moisturiser`; the hub returns with only the remaining cleanser card and zero horizontal overflow. The remaining `A gentle cleanser` recommendation accepts into `/shelf/manual?presetCategory=cleanser`, with the category control prefilled as `Cleanser`, visible controls at least 48 px tall, and zero horizontal overflow.
- Branch: dismissed recommendation cold-start state
  - Priority: Important
  - Automate later: Yes
  - Action: Dismiss a recommendation, close or reload the app, then return to `/recommendations` while private recommendation preferences/dismissals are still loading.
  - Expected result: The dismissed card does not flash or reappear before local private state is loaded.
  - Evidence: Visible loading/result state and local dismissed recommendation state.
  - Current local evidence: 2026-07-07 Expo web reload poll captured 25 startup samples after dismissal; the dismissed moisturiser card never reappeared, the remaining cleanser card stayed visible, and `scrollWidth` equaled `clientWidth` throughout.
- Branch: mobile recommendation card width
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations` on a 430 px or narrower short-phone viewport with long evidence labels.
  - Expected result: Evidence/footer labels wrap within the card, the `See how` action remains visible and tappable, and compact phones do not cut a visible recommendation card before its evidence/CTA row.
  - Evidence: Phone-width screenshot and visible-text snapshot.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 and 390 x 568 verifies the For You hub has zero horizontal overflow, no sub-44 px controls, and no partial small visible controls. At both tested widths, the first two recommendation cards are fully visible in the initial viewport and the third card stays below the fold instead of peeking in as a clipped tappable sliver.
  - Current shortest-phone evidence: 2026-07-08 Expo web at 320 x 480 reproduced the second recommendation card clipping below the viewport on `/recommendations`. Post-fix, the same route uses the sub-520 px hub/card density so the visible recommendation controls are fully readable, 48 px+ Back/Preferences remain visible, horizontal overflow is zero, and the second card no longer clips before its evidence/CTA row. Evidence and bug report are in `test-results/human-e2e/2026-07-08/recommendations-short-phone-480-card-fit/` and `docs/e2e-bug-reports/2026-07-08-recommendations-short-phone-card-clipping.md`.
  - Current ultra-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the second recommendation card clipping in the current-main route sweep, then verified the sub-460 px For You density. Post-fix `/recommendations` keeps Back and Preferences 48 px, keeps visible recommendation cards fully readable and hit-testable, and has zero clipped controls, zero sub-44 controls, zero blocked center hit-tests, and no horizontal overflow. Evidence and bug report are in `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/` and `docs/e2e-bug-reports/2026-07-08-recommendations-ultrashort-hub-preferences-clipping.md`.
- Branch: compact recommendation budget and texture preferences
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations/preferences` on 320 x 568 and 390 x 568 phone viewports and inspect the Drugstore, Mid-range, Premium, Gel, Cream, Fluid, Balm, and Oil chips.
  - Expected result: Budget chips remain on one row, texture chips do not peek or clip at the viewport edge, labels are fully visible without clipping or overflow, and each chip remains at least 44 pt in both dimensions.
  - Evidence: Phone-width screenshots, chip geometry snapshots, and visible-text snapshots.
  - Current local evidence: 2026-07-07 Expo web in `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/` shows `Drugstore`, `Mid-range`, and `Premium` on one row at 320 x 568 with a 34 px bottom buffer, shows all five texture chips fully visible in one row at 390 x 568 with a 32 px bottom buffer, keeps all checked chips 48 px or taller/wider, and has zero horizontal overflow.
  - Current ultra-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the `Sustainable` value chip peeking below the viewport in the current-main route sweep, then verified `/recommendations/preferences` keeps value and budget chips at a real 48 px hit target, moves texture chips below the first viewport instead of clipping, keeps the scrolled texture section fully usable, and lets a user tap `Sustainable` successfully with zero clipped controls, zero sub-44 controls, and zero blocked center hit-tests. Evidence and bug report are in `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/` and `docs/e2e-bug-reports/2026-07-08-recommendations-ultrashort-hub-preferences-clipping.md`.
  - Current 320 x 360 / 130% evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route text-pressure sweep after short-height preference spacing follow-up. `/recommendations/preferences` keeps Back plus visible value chips complete at 48 px, splits lower value chips into a deferred below-fold group on split-short screens, moves budget and texture chips below the first viewport instead of clipping them, has zero text overflow, zero horizontal overflow, zero blocked center hit-tests, and zero failed route issues. A 2026-07-09 rerun tightened the sub-380 px first value-chip buffer after the `Cruelty-free` chip peeked at 320 x 360; the final 320 x 360 and 320 x 370 route sweeps pass with zero failed routes. Evidence is in `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, and `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`.
  - Current 140% text-pressure evidence: 2026-07-08 headless Chrome Expo web reproduced `Drugstore`/`Mid-range` and then Texture chips peeking as partial targets at 320 x 568 / 140% text pressure. Post-fix, compact Recommendation Preferences keeps visible value/budget chips complete at 48 px and pushes lower chip groups fully below the first viewport until scroll. The final 49-route sweeps report zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-3/`, `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-7/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-140-compact-568-clearance.md`.
  - Current 390 x 844 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced `Drugstore`, `Mid-range`, and `Premium` label overflow on the modern-phone budget chip row. Post-fix, budget/value toggles use dense fitted labels at this pressure tier and the final 49-route sweep plus current-source rerun report zero failed routes. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-current-rerun/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-390-clearance.md`.
  - Current 430 x 932 / 170% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced the Texture chips as barely visible bottom-edge targets on the tall supported-phone viewport. Post-fix, the tall-phone texture group starts below the first viewport while visible value and budget chips remain complete and hit-testable; the final 430 x 932 sweep reports zero failed routes. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-170-supported-phone-clearance.md`.
  - Current 375 x 812 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced a partial `Oil` texture chip on the supported iPhone-class viewport. Post-fix, the lower-priority texture group starts below the first viewport, the focused 360 x 780 and 390 x 812 reruns pass, and the full 49-route 375 x 812 sweep reports zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-mid-supported-prefs-notifications-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-height-prefs-notifications-current/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-iphone-375-clearance.md`.
  - Current 360 x 600 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced lower value and budget preference chips peeking into the first viewport as partial targets. Post-fix, the 600-639 px short text-pressure band keeps only the first three values visible and complete while deferring lower value and budget sections below the first viewport; the focused route rerun and full 49-route sweep report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-preferences-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-postfix2/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-360-600-text-pressure.md`.
  - Current 430 x 640 / 200% support-band text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced lower-priority Recommendation Preferences texture chips and then lower value chips peeking into the bottom edge. Post-fix, the 430-wide 640-699 px support band keeps the first value chips complete and defers lower value, budget, and texture controls below the first viewport. The focused preferences rerun, full 49-route 430 x 640 sweep, and affected-route 390 x 640 regression report zero failures. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-preferences-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-640-affected-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-430-640-text-pressure.md`.
  - Current modern/stress-floor follow-up: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/recommendations/preferences` after modern texture-group spacing calibration. The 390 x 844 modern-phone pass keeps visible value, budget, and texture chips complete with all texture chips visible and hit-testable; the retained 320 x 480 stress pass keeps visible value controls complete while lower sections remain scroll-reachable. Both passes report zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
- Branch: recommendation preference save failure
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations/preferences`, tap a value, budget, or texture chip while forcing local private preference persistence to reject.
  - Expected result: Chips are disabled while saving, the new state is applied only after persistence succeeds, failures show stable route-owned copy without a blocking native dialog, and the For You hub does not recompute from an unsaved preference.
  - Evidence: Alert-region text, absence of a JS/system dialog, disabled chip state, and local preference state.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once` and `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS=1200` verifies `Vegan` stays `aria-selected=false` and disabled while the failed save is pending, shows stable `Preference not saved` copy after rejection with no JS/system dialog, disables again during retry, becomes `aria-selected=true` only after the successful save, persists after reload, keeps zero horizontal overflow, and keeps visible controls 48 px tall. Evidence is in `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/`.

## Flow: COM-01A Commerce Literal Zero Admission

- Goal: A user who reaches a stale or direct commerce URL sees truthful unavailable recovery while the app performs no commerce read, grant, click, navigation, attribution, polling, or analytics side effect.
- Persona: Returning user following a stale commerce link or checking a surface that formerly exposed where-to-buy behavior.
- Entry state: User has completed onboarding; adversarial commerce flags, final-looking domains, legacy consent, fixtures, and provider credentials may be present but cannot create authority.
- Start screen/URL/window: You tab, For You recommendation detail, Shelf/replenishment, `/commerce/stacks`, `/commerce/transparency`, `/commerce/consent`, or `/commerce/stack/[slug]`.
- Success state: Every direct commerce route presents the same analytics-free unavailable surface and replaces to You; You, recommendations, and Shelf expose no commerce entry, consent grant, retailer row, creator stack, or similar-options handoff; no catalog/click/order/provider side effect occurs.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route recovery, visible-state, layout, and console
  observation; supported physical iPhones remain required for any future
  positive external-link or consent successor.
- Evidence folder:
  `test-results/human-e2e/2026-07-29/com01a-zero-commerce-current/`
- Source authority: [COM-01A checkpoint](hugeToDo/COM-01-COMMERCE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md).
- Current evidence: 2026-07-29 human-simulated Expo web passed at
  360 x 640, 390 x 844, and 430 x 932 with zero current-run console errors and
  zero warnings. This packet did not retain a network capture and is not native,
  legal, privacy, App Review, or launch clearance.
- Historical evidence notice: Every positive commerce, consent, paid-link,
  development-stack, retailer, attribution, and direct-route observation from
  2026-07-06 through 2026-07-08 is historical/stale. It predates COM-01A, does
  not describe current behavior, and cannot satisfy COM-01 through COM-07.

### Path A: Direct Commerce Route Refusal

1. Action: With every commerce-related environment input set to a plausible
   positive value, open `/commerce/stacks`, `/commerce/transparency`,
   `/commerce/consent`, and
   `/commerce/stack/sensitive-skin-starter-set` directly; activate
   `Back to You`.
   Expected result: Every route retains that exact URL until the user acts,
   renders one shared unavailable surface with exactly one `Back to You`, and
   contains no stack, transparency, consent-allow, paid-link, retailer, price,
   commission, external-link, or positive commerce copy. `Back to You` replaces
   the route with `/you`.
   Evidence: The 2026-07-29 three-viewport packet passed all four exact routes,
   exact pre-action URLs, one `Back to You` per route, absence of positive copy,
   and post-action `/you`. Console capture reports zero errors and zero warnings.

### Path B: No Indirect Commerce Entry

1. Action: Inspect You and Shelf/replenishment with legacy consent and
   positive-looking flags, then trigger ordinary non-commerce controls.
   Expected result: You exposes neither commerce nor Trend. Shelf/replenishment
   exposes no commerce or similar-options CTA. Ordinary non-commerce navigation
   remains usable.
   Evidence: The 2026-07-29 packet passed You and Shelf/replenishment at all
   three viewports with those positive labels and actions absent.

### Branches

- Branch: route-group layout canonicalization
  - Priority: Critical
  - Automate later: Yes
  - Action: Open each direct commerce URL from a fresh browser navigation,
    inspect the address before interaction, and activate the only recovery CTA.
  - Expected result: The route-group layout is a transparent `Slot`; it neither
    redirects nor renders a competing deferred surface. The leaf route owns the
    unavailable state, retains the exact direct URL, and replaces to `/you`.
  - Current evidence: The initial 2026-07-29 run exposed a layout
    canonicalization defect. Replacing the commerce layout body with a
    transparent `Slot` fixed it. The same three-viewport rerun passed all four
    exact direct URLs and the `/you` replacement.
- Branch: positive commerce copy stays absent
  - Priority: Critical
  - Automate later: Yes
  - Action: Inspect visible text, roles, links, and controls on all four direct
    routes with positive-looking commerce inputs.
  - Expected result: Each route contains one `Back to You` and no allow/consent,
    paid-link, retailer, price, commission, external-link, stack, or
    transparency content.
  - Current evidence: All four routes passed at 360 x 640, 390 x 844, and
    430 x 932. The retained console report contains zero errors and zero
    warnings.
- Branch: indirect commerce entry remains absent
  - Priority: Critical
  - Automate later: Yes
  - Action: Inspect You and Shelf/replenishment at all three viewports.
  - Expected result: You contains no commerce or Trend entry. Shelf/replenishment
    contains no commerce, retailer, consent, or similar-options CTA.
  - Current evidence: The 2026-07-29 packet passed both surfaces at all three
    viewports.
- Branch: evidence boundary
  - Priority: Critical
  - Automate later: No
  - Action: Review the retained packet and state only what it captured.
  - Expected result: The packet is described as Expo-web human-simulated
    visible-state, route, layout, and console evidence. It is not described as a
    network capture, native iOS behavior, physical-iPhone proof, provider or
    hosted proof, legal/privacy approval, App Review clearance, launch
    clearance, or revenue evidence.
  - Current evidence:
    `test-results/human-e2e/2026-07-29/com01a-zero-commerce-current/`.

## Flow: Skin Notes Community Trust Layer

- Goal: A user can inspect expert Skin Notes and recover safely from unavailable posting or aggregate routes without being asked for consent or shown invented social proof.
- Persona: Returning user looking for calm, evidence-backed explanations who follows a stale community-action link.
- Entry state: User has completed onboarding; question submission and community aggregates are hard-disabled regardless of environment flags.
- Start screen/URL/window: You tab Skin Notes row, direct `/community`, direct `/community/note/[id]`, direct `/community/ask`, or direct `/community/people-like-you`.
- Success state: The library stays expert-led; ask and aggregate routes remain clearly unavailable and non-actionable; direct-entry exits return to the right parent surface.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route recovery; iOS and Android for native consent and moderation behavior.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/community-routes/`
- Current local evidence: `test-results/human-e2e/2026-07-07/community-current-compact-check/`
- Current local evidence: `test-results/human-e2e/2026-07-07/community-deferred-routes/`
- Current local evidence: `test-results/human-e2e/2026-07-07/community-missing-note-current-check/`
- Current local evidence: `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/`

### Path A: Expert Skin Notes

1. Action: Open `/community`, inspect topic groups, open a note detail, and return.
   Expected result: Notes are topic-structured and evidence-labeled, not ranked by popularity or author following; note detail returns to the Skin Notes hub.
   Evidence: Screenshot sequence and visible route snapshot.
   Current local evidence: 2026-07-07 Expo web 320 x 568 shows topic groups and evidence labels, includes `a library, not a feed. No likes, no authors to follow, no ranking by popularity`, opens the niacinamide/vitamin C note with claim/evidence/reviewer context, and Back returns to `/community` with zero horizontal overflow.
   Current local evidence: 2026-07-07 in-app browser verifies compact `/community` at 320 x 568 and 390 x 568 with zero horizontal overflow and no sub-44 px controls. The 320 x 568 viewport renders the first three Skin Notes fully, while the 390 x 568 viewport renders the first four note cards fully.
   Current shortest-phone evidence: 2026-07-08 Expo web at 320 x 480 reproduced the third Skin Note clipping below the viewport on `/community`. Post-fix, the same route uses the sub-520 px Skin Notes hub/card density so the visible note cards are fully readable, the 48 px Back control remains visible, the flag-dependent Ask control remains 48 px by source contract when exposed, horizontal overflow is zero, and the third visible card no longer clips below the viewport. Evidence and bug report are in `test-results/human-e2e/2026-07-08/community-short-phone-480-card-fit/` and `docs/e2e-bug-reports/2026-07-08-community-short-phone-card-clipping.md`.
   Current ultra-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the third Skin Note clipping by about 3 px in the post-Recommendations route sweep. Post-fix, `/community` adds a sub-460 px scroll-content density so the third note is fully visible and tappable; tapping `Is "natural" always gentler for sensitive skin?` opens the note detail with zero clipped controls, zero sub-44 controls, and zero blocked center hit-tests. Final 320 x 430 clearance evidence also verifies `/community` in the four-route focused pass, and the fresh 49-route 320 x 430 sweep reports zero failed routes. Evidence is in `test-results/human-e2e/2026-07-08/community-short-phone-430-card-fit/`, `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/`, and `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
   Current 390 x 844 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web found the first Sunscreen note card entering the bottom edge as an 18 px partial target. Post-fix, the short modern-phone Skin Notes hub moves that later topic section below the first viewport, keeping all visible note cards complete and hit-testable. The final 49-route sweep and current-source rerun report zero failed routes with evidence in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-current-rerun/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-390-clearance.md`; native Dynamic Type remains device QA.
   Current 430 x 932 / 120% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced the later Sunscreen section as a partial bottom-edge target on `/community`. Post-fix, the modern-phone Skin Notes spacing applies below 980 px height, and the 430 x 932 final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`; native Dynamic Type remains device QA.
   Current stress/modern evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` verified `/community` at 390 x 844 and retained 320 x 480 stress size after compact layout calibration. The route keeps visible Skin Notes cards complete and hit-testable, avoids partial lower-topic targets, reports zero clipped controls, zero blocked hit centers, zero sub-44 visible controls, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin browser logs. Evidence and bug report are in `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/support-floor-summary-final.json` and `docs/e2e-bug-reports/2026-07-09-community-support-floor-partial-card.md`; native iOS/Android rendering remains device QA.
   Current 393 x 852 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced the Retinoids `Does retinol thin your skin?` Skin Note peeking into the bottom edge as a 26 px partial target on a supported modern Android midpoint. Post-fix, the 391-414 px / 840-899 px Skin Notes hub defers the Retinoids section below the first viewport while keeping the first two Sensitive Skin cards complete. The focused Community route contract and fresh 49-route rerun report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-full-rerun/`, and `docs/e2e-bug-reports/2026-07-09-community-393-text-pressure-retinoids-partial.md`; native Dynamic Type remains device QA.
   Current 430 x 640 / 200% support-band text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced the second Sensitive Skin note as an 18 px partial bottom-edge target. Post-fix, the support-floor Skin Notes deferral covers 430-wide 640-699 px viewports, keeping visible note cards complete while later topic cards start below the first viewport. The focused three-route rerun, full 430 x 640 sweep, and affected-route 390 x 640 regression report zero failures. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-focused-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-640-affected-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-430-640-text-pressure.md`; native Dynamic Type remains device QA.
   Current 360 x 700 / 200% boundary evidence: 2026-07-09 headless Chrome Expo web reproduced the second Sensitive Skin note as a 22 px partial bottom-edge target because the support-floor Skin Notes deferral excluded exactly 700 px height. Post-fix, the deferral covers the exact 700 px boundary, keeps visible note cards complete, and the full 49-route sweep reports zero failures. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-postfix/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-360-700-boundary.md`; native Dynamic Type remains device QA.

### Path B: Posting Gate

1. Action: Open `/community/ask` and `/community/people-like-you`, then repeat with `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED=true`.
   Expected result: Both routes remain deferred and return to the Skin Notes hub. Ask shows no age gate, consent control, question input, or submit action; people-like-you shows no illustrative aggregate presented as user data.
   Evidence: Screenshot sequence, visible-text/control snapshot, and confirmation that no consent or submission state changes.
   Current local evidence: 2026-07-12 Codex in-app browser Expo web at the 375 x 667 launch floor verifies exact `/community/ask` and `/community/people-like-you` direct entries remain read-only, mount no question input or consent control, show no invented peer aggregate, have zero horizontal overflow, and expose 55.99 px `Back to Skin Notes` recovery controls. Activating the ask-route recovery returns to `/community`. Evidence is in `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/`.

### Branches

- Branch: direct-entry Community exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/community`, `/community/note/[id]`, `/community/ask`, and `/community/people-like-you` directly, then use the visible recovery control.
  - Expected result: Direct `/community` returns to the You tab; nested note, ask, and people-like-you surfaces return to `/community`. Deferred routes use a destination-specific `Back to Skin Notes` CTA instead of generic Back copy. Visible hub/note controls and deferred recovery actions meet the 44 pt phone touch target.
  - Evidence: Screenshot sequence, visible route snapshot, and small-phone button-geometry snapshot.
  - Current local evidence: 2026-07-12 focused `communityRoutes.test.ts` route contracts plus Codex in-app browser Expo web verify direct `/community/ask` and `/community/people-like-you` fallback controls are 55.99 px tall, use `Back to Skin Notes`, and return to `/community` with zero horizontal overflow.
  - Current 320 x 370 / 130% micro-short text-pressure evidence: 2026-07-08 headless Chrome Expo web verifies the Skin Notes hub keeps the first topic section complete on the first viewport and pushes later sections below the fold instead of peeking as partial targets. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`; native iOS/Android safe-area and Dynamic Type behavior remain device QA.
- Branch: missing note detail
  - Priority: Important
  - Automate later: Yes
  - Action: Open a stale `/community/note/[id]` route that is no longer present.
  - Expected result: The app explains the Skin Note is unavailable, says the note may have been updated or removed during expert review, and provides a visible `Back to Skin Notes` action that returns to `/community` without relying on navigation history.
  - Evidence: Screenshot and route snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 opens a stale note route, shows `NOTE UNAVAILABLE`, explains the note may have been updated or removed during expert review, exposes a 56 px `Back to Skin Notes` CTA, and returns to `/community` with zero horizontal overflow.
  - Current split-short evidence: 2026-07-08 headless Chrome Expo web at 320 x 390 / 120% text pressure verifies `/community/note/missing-note-e2e` keeps Back and `Back to Skin Notes` complete and center-hit-testable, has zero clipped controls, zero sub-44 controls, zero horizontal overflow, and zero disallowed browser logs after the split-short stale-note density pass. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/` and `docs/e2e-bug-reports/2026-07-08-community-missing-note-split-short-clearance.md`.
- Branch: expert note share failure and outbound context
  - Priority: Important
  - Automate later: Yes
  - Action: Open a Skin Note, tap Share note, and simulate the native share sheet being unavailable or rejected.
  - Expected result: The outbound note text keeps the claim-safe disclaimer plus source/reviewer context, and a failed share sheet shows clear route-owned failed-share feedback without also opening a blocking native alert.
  - Evidence: Route alert-region text, absence of a JS/native dialog, and share payload snapshot.
  - Current local evidence: 2026-07-08 Expo web 320 x 568 with `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1` opens `/community/note/note-niacinamide-vitc`, verifies the claim-safe note detail and 128 x 48 `Share note` control, taps the real control, stays on the note route, opens no JS dialog, and renders the failed-share recovery copy plus both 48 px action controls fully in the viewport with zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/community-note-native-alert-current/`.
- Branch: unavailable anonymous ask cannot collect or submit data
  - Priority: Critical
  - Automate later: Yes
  - Action: Start a dev build with `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED=true`, then open `/community/ask`.
  - Expected result: The frozen missing-submission capability wins over the environment flag. No 16+ or community consent is solicited, no text input or `Submit for review` action mounts, and no `question_submitted` analytics event can fire.
  - Evidence: Screenshot/control snapshot plus Phase 7 launch-flag, route-contract, and analytics-registry tests. The 2026-07-08 enabled-composer evidence is historical and intentionally superseded.

## Flow: Shelf Conflict Checks And Zero-Admission Sharing

- Goal: A user can inspect only admitted private conflict guidance while every
  conflict-card export and public-link path remains truthfully unavailable
  until separate publication authority exists.
- Persona: User checking whether two shelf products can be used together or
  attempting to open/share a conflict path.
- Entry state: User has completed onboarding or has seeded local shelf state.
- Start screen/URL/window: Shelf tab or direct conflict/share routes.
- Success state: Production never turns an unreviewed or uncovered pair into a
  compatibility result. Interaction-specific guidance, choices, scheduling,
  Ask answers, recommendations, and detail exist only for the exact admitted
  corpus/rule hash. Even admitted private guidance does not authorize sharing.
  Share and public-link admissions remain separately false; denied paths create
  no capture/file/link/network/native-share/analytics side effect, reveal no
  private field or record-existence bit, and recover safely.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for current route recovery; iOS for any future admitted
  native share-sheet behavior. Android is outside the current release contract.
- Current human-E2E evidence folder:
  `test-results/human-e2e/2026-07-26/core02-conflict-admission-current/`
- Historical geometry/navigation evidence:
  `test-results/human-e2e/2026-07-07/conflict-share-routes-current/`.
  It predates the exact-corpus admission boundary and is not current CORE-02
  acceptance evidence.
- Current verified source boundary: the CORE-02 source contract is 16/16
  passing, and the focused intelligence/recommendation regression suite is
  81/81 passing. A local, folder-specific 390 x 844 Expo-web observation records
  Shelf, Ask, typed-pair refusal, stale detail, invalid public share, and paywall
  non-sale/disclosure states against commit
  `c78208ef1da9dd4b3c5f385d421541f8741dba3c`. No CORE-02 packet contract is
  registered in `e2e:human:manifest`, which also stops first on the pre-existing
  absent 2026-07-22 CAT07 packet. The exhaustive database replay and
  native/physical-iPhone acceptance remain separate gates.

### Path A: Fail-Closed Production Coverage

1. Action: In an ordinary development build with no reviewed-content fixture,
   add two active products whose parsed tags form a candidate interaction pair.
   Expected result: Shelf shows a generic `Interaction guidance is unavailable`
   state and says it will not show a compatibility result until review is
   complete. It exposes no rule, ingredient-pair, severity, evidence,
   reproductive-status, resolution, override, detail, or share action.
2. Action: Inspect Plan, Today, Week, Recommendations, and Ask for the same
   products, then reload and relaunch.
   Expected result: No surface invents interaction timing, compatibility,
   reassurance, safety exclusion, replacement, or a "you're set" result. Ask
   returns a generic unavailable/refusal response, does not proactively lead
   with conflict guidance, and does not offer the conflict suggested prompt.
   Routine/fit prompts may remain where the layout supports them. The same
   fail-closed state survives reload without storing an active legacy choice.
3. Action: Open an old or fabricated conflict/share link directly.
   Expected result: The route shows a non-claim stale/unavailable recovery and
   returns to Shelf or Add a product. It does not render candidate corpus copy,
   product names, or a share card.
4. Action: Repeat with the current combined `Pregnant or trying` profile
   choice, breastfeeding, prefer-not-to-answer, and unavailable/unknown
   profile states.
   Expected result: Breastfeeding, prefer-not, and unavailable/unknown remain
   distinct and never borrow pregnancy-only candidate copy. The current
   combined selection is never represented as a separately proven pregnancy or
   trying-to-conceive fact; any future safety corpus must explicitly review the
   combined state or wait for a separately versioned profile split.

The current zero-admission Shelf/Ask behavior is source- and unit-verified. A
folder-specific human-simulated Expo-web observation at 390 x 844 is tracked in
`test-results/human-e2e/2026-07-26/core02-conflict-admission-current/`.
The screenshots record stale/public-link and paywall non-sale/disclosure states;
the tester observed `Back to Shelf` return to `/shelf`, but no post-click trace
or screenshot is retained. Compact-phone text pressure, process relaunch, native
sharing, VoiceOver, Dynamic Type, signed-archive, and physical-iPhone behavior
remain open.

### Path B: CORE-07A Literal Zero Share And Public Links

1. Action: In a development fixture, make every Phase 7/8 share/public-link
   flag and final-domain input look enabled while the machine admission remains
   false. Open `/share/conflict/[ruleId]`.
   Expected result: The independent admission wins. No private conflict object
   reaches the renderer, no exact or generic card is captured, no temporary
   file or URL is created, no network or native share API runs, and no share,
   link, sheet, destination, or payload analytics fires. The route explains
   unavailability and offers a safe Shelf exit.
2. Action: Open `/s/not-valid`, an unknown valid-looking identifier, and any
   legacy identifier; refresh, relaunch, and use back/forward.
   Expected result: Every value reaches one neutral unavailable state. Copy
   does not say a reviewed card exists, distinguish malformed from unknown,
   reveal product/rule/profile data, or emit landing/store-click/`share_id`
   telemetry. Static public HTML behaves the same and makes no record-derived
   request.
3. Action: Attempt to pass a raw `DetectedConflict`, product, Shelf, profile,
   pregnancy/safety, reviewer, receipt, provenance, or unknown key across the
   card boundary.
   Expected result: The boundary refuses it. Only a deliberately constructed
   exact allowlist projection type can be accepted by the renderer, and zero
   admission prevents even that projection from reaching export.
4. Action: Repeat after setting legacy `reviewedBy`, exact owned-product match,
   final domain, and all broad QA evidence flags.
   Expected result: None is publication or token authority. Phase 7, Phase 8,
   and Phase 9 packets remain blocked by the machine admissions.

Evidence required now: source contract, focused unit/route tests, browser text
and navigation snapshots at supported/compact/text-pressure sizes, and network/
analytics/native-call spies proving zero side effects. This source checkpoint
does not replace future positive-path native or professional evidence.

### Future Path C: Admitted Conflict Detail

This path is a required future acceptance flow, not a currently available
production path. It may be exercised only after the exact U.S. corpus, source
registry, applicability, user copy, market-scope policy, and per-rule hashes
have independent dermatologist and chemistry/pharmacy approvals, separate
regulatory-counsel clearance, trusted authority/signature verification, and a
passing exact-build review gate.

Remaining launch gates include signed review artifacts for the exact corpus
hash from the required independent professional roles; counsel review of U.S.
intended use, claims/classification, privacy/App Privacy disclosures, terms,
store metadata, reviewer-access instructions, and material connections; a
native detached-signature verifier with a release trust root and packaged
artifact; archive verification; physical-iPhone accessibility, persistence,
share, and failure-path E2E; and Apple's independent App Review outcome.
Passing source tests does not satisfy any of those gates.

1. Action: Add a real retinoid and AHA, open the conflict from Shelf, and verify the detail URL carries the rule plus both product IDs regardless of detection order.
   Expected result: The conflict sheet names the exact pair, stays calm and claim-safe, gives timing advice without claiming shelf-only placement, and never substitutes another pair that happens to use the same rule.
2. Action: Choose Keep alternate nights, return to Shelf, reload, then inspect both product detail and the generated Plan/Today/cycle surfaces.
   Expected result: The exact pair remains accepted after reload, the Shelf banner and downstream conflict recommendation/Ask prompt do not repeat it, product detail says the schedule keeps the pair apart, and the guided checklist still contains at most one potent active per night.
3. Action: Reopen the exact pair from product detail, change to Use together anyway, reload, and inspect Shelf, Recommendations, Ask, Today, Week, and Why Tonight.
   Expected result: The changed choice persists without a duplicate record or repeat advisory; Today/Week do not keep presenting the rejected separation rationale; Why Tonight/product detail explain that guided check-offs still use the reviewed one-potent-active schedule; retinoid and exfoliant never share a night.
   Historical/superseded evidence: the 2026-07-10 Expo-web run used starter
   content before the current exact-corpus admission boundary. Its geometry and
   navigation observations may be retained, but its conflict claims, choices,
   and schedule behavior are not production-content or launch evidence.

### Branches

- Branch: untrusted corpus, receipt, reviewer, or applicability data
  - Priority: Critical
  - Automate later: Yes
  - Action: Attempt to mark the candidate corpus approved; add three
    self-asserted reviewer identities/receipts; tamper a source, rule, copy,
    market-scope, policy-file, or per-rule hash; omit one professional role;
    use an expired/rejected receipt; leave any applicability dimension
    review-required; and satisfy an exact fact on the wrong product side.
  - Expected result: Admission remains null, production rules remain empty, and
    no UI/schedule/choice/share surface renders the candidate. Swapping product
    detection order does not change exact participant applicability.
  - Evidence: CORE-02 source contract, corpus/admission unit tests, engine
    wrong-side/swapped-order fixtures. Ordinary-build app-surface evidence is
    still required.
- Branch: mixed shelf with an unparsed product
  - Priority: Critical
  - Automate later: Yes
  - Action: Add two tagged products plus one product whose ingredient parser
    produces no supported tags, then repeat with an active reproductive context.
  - Expected result: Every physical pair involving the unparsed product has a
    distinct non-identifying `unassessable_pair` coverage key, and the unparsed
    product has a separate active-safety-context key. These keys are unioned
    with parsed-pair coverage, so a parsed pair cannot hide an unassessable pair
    or cause `compatible`/`not_applicable`.
  - Evidence: Current focused engine regression and 16/16 source-contract
    checks. Human-simulated mixed-shelf E2E remains required.
- Branch: overlapping or incomplete reviewed severity branches
  - Priority: Critical
  - Automate later: Yes
  - Action: Exercise an admitted-rule fixture in which more than one reviewed
    severity branch matches, then one in which required branch facts are absent.
  - Expected result: Overlap returns `unsupported_ambiguous_branches`; missing
    facts return `unsupported_missing_facts`. Array order never chooses a
    severity, coverage stays unsupported, and Recommendations exclude the
    affected type even if another known conflict exists.
  - Evidence: Current focused engine/recommendation regression and 16/16
    source-contract checks. Admitted-corpus UI E2E remains required.
- Branch: exact typed Ask pair resolution
  - Priority: Critical
  - Automate later: Yes
  - Action: On a shelf of at least three products, type a conflict question
    containing exactly two complete stored product names. Repeat with a
    duplicate name, a partial name, and more or fewer than two resolved names.
  - Expected result: Only the exact unambiguous pair can reach its admitted
    conflict. Duplicate, partial, ambiguous, or wrong-cardinality input fails
    closed. The canned shelf-wide conflict prompt is available only when
    admitted coverage exists.
  - Evidence: Current focused Ask regression and 16/16 source-contract checks.
    Human-simulated typed-input E2E remains required.
- Branch: reproductive-context replacement withholding
  - Priority: Critical
  - Automate later: Yes
  - Action: Create finished/expiring retinoid, hydroquinone, and BHA products
    under exact pregnant/combined, breastfeeding, trying, unknown, and
    prefer-not profile states; repeat with an unrelated vitamin C product and
    with only the legacy coarse `pregnancySafety: caution` field.
  - Expected result: Repurchase/replenishment copy for the three gated active
    classes is withheld unless the exact context has admitted clearance.
    Unrelated replenishment remains eligible. The legacy coarse field alone
    never invents a reproductive status or a clearance/exclusion.
  - Evidence: Current focused recommendation regression and 16/16
    source-contract checks. Native persistence and UI E2E remain required.
- Branch: development preview isolation
  - Priority: Critical
  - Automate later: Yes
  - Action: Exercise any explicit preview-only rule fixture in a development
    test, then run the ordinary app path without that fixture.
  - Expected result: Preview data cannot enter production consumers, write an
    active choice, mirror to the server, render a share card, or change a
    release flag. Preview screenshots are labeled fixture-only and cannot be
    cited as content approval.
  - Evidence: Source-import scan, release-flag tests, negative presentation and
    choice tests, and separate fixture/ordinary-build transcripts.
- Branch: encrypted choice write fails
  - Priority: Critical
  - Automate later: Yes
  - Action: With the one-shot conflict-choice failure fixture enabled, choose either action, inspect the inline state, then retry.
  - Expected result: The sheet stays open, exposes an accessibility alert that the choice was not saved, emits no success navigation/analytics, leaves the previous schedule and prompt state unchanged, prevents duplicate submits while pending, and succeeds on retry.
  - Evidence: Screenshot, encrypted-storage snapshot, route state, and analytics/network log.
  - Historical fixture evidence: The one-shot private-KV fixture retained the exact route, exposed `Choice not saved`, kept both retry controls complete, preserved the prior accepted choice, and persisted Use together on retry. Pending-state disabling was observed before the delayed rejection. The local run predates current CORE-02 acceptance and does not replace native encrypted-storage or live analytics/network QA.
- Branch: stale version, safety row, or mismatched pair identity
  - Priority: Critical
  - Automate later: Yes
  - Action: Exercise a newer rule version, a safety-class row, an incomplete/mismatched product-pair URL, and two pairs governed by the same rule.
  - Expected result: An old choice does not suppress new guidance; safety has no timing-override actions; a mismatched pair fails to the non-stale recovery state; each real pair has an independent choice and route identity.
  - Evidence: Unit/integration fixtures plus direct-route screenshots.
  - Current evidence: Focused tests cover stale versions, safety/reassurance exclusion, two same-rule pairs, and one-sided safety identity. The current 390 x 844 Expo-web screenshot records a stale canonical rule URL and the generic `Timing note unavailable` dialog without product/rule claims. The tester observed `Back to Shelf` return to `/shelf`, but no post-click screenshot or trace is retained. Admitted exact-pair routing still requires a future professionally reviewed fixture and native acceptance evidence.
- Branch: supported-phone geometry and text pressure
  - Priority: Critical
  - Automate later: Yes
  - Action: Run the unresolved, saving, failed, accepted, and use-together states at 360 x 640 and 390 x 844, including 200% text pressure where supported.
  - Expected result: No horizontal/text overflow, clipped actions, blocked hit targets, sub-44 px controls, dialog escape, or incoherent overlap; the exact-pair and safety-boundary copy remains readable.
  - Evidence: Geometry JSON, screenshots, browser logs, and interaction transcript.
  - Current evidence: The current screenshots visually record the ordinary 390 x 844 zero-admission Shelf, Ask, typed-refusal, stale-detail, public-share, and paywall states. No current DOM geometry or text-pressure measurement is retained. Historical populated-pair evidence reported 55.99 px and 48 px actions plus focus trapping, but admitted populated-pair native Dynamic Type remains release-device QA.

- Branch: direct-entry conflict and share exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/conflict/[ruleId]` and `/share/conflict/[ruleId]` directly. Use the visible recovery action; exercise private conflict choices only in an exact admitted private-content fixture.
  - Expected result: The zero-admission share route always exposes only `Back to Shelf` and returns to `/shelf`, with no card, product, rule, capture, link, or native-share action. The user never remains trapped on a direct-entry route with no navigation history.
  - Historical evidence: 2026-07-07 Expo web at 320 x 568 verified `/conflict/missing-rule-e2e` `Back to Shelf`, default `/share/conflict/missing-rule-e2e` deferred `Back to Shelf`, and the former share-card-enabled unshareable `Done` path. The latter is superseded and is not current share-route acceptance evidence.
  - Current evidence: The 2026-07-26 Expo-web screenshot at 390 x 844 records the stale detail route before recovery, and the tester observed `Back to Shelf` return to `/shelf`; no post-click screenshot or trace is retained. The same packet records a product-free invalid public share state. Native sharing and admitted populated-pair exits remain release-device QA.
- Branch: missing or unshareable conflict
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/conflict/[ruleId]` and `/share/conflict/[ruleId]` for a rule that is not present in the current shelf; use Back to Shelf from the missing detail state and the add-product escape hatch.
  - Expected result: The missing conflict detail explains that the timing note is no longer active because the shelf or safety setting changed, never falsely says a product pair was removed, never reuses stale routine advice, Back to Shelf returns to `/shelf`, Add a product opens `/shelf/manual`, and the share-card fallback still returns to Shelf without exposing private shelf details.
  - Evidence: 2026-07-07 Expo web at 320 x 568 verified the missing state copy, stale-routine warning, `/shelf` recovery, `/shelf/manual` escape hatch, default share-card fallback, and enabled unshareable share-card state without private product names.
  - Historical partial evidence: A 2026-07-08 in-app-browser run at 320 x 568 rechecked direct `/conflict/missing-rule-e2e` after a compact-sheet fallback fix. Pre-fix evidence captured `maxHeight: 0px` with the actions below the viewport; post-fix evidence confirms a 524 px dialog, `aria-modal`, `Timing note unavailable` accessibility label, zero horizontal overflow, no mojibake, and visible 56 px / 48 px actions. Evidence is in `test-results/human-e2e/2026-07-08/conflict-detail-safe-area/`; it is not current-head CORE-02 acceptance.
  - Historical support-floor text-pressure evidence: A 2026-07-09 headless Chrome Expo-web run found the missing conflict sheet clipped `Back to Shelf` at the bottom of the 320 x 480 / 170% skipped-route sweep. Post-fix, short missing-conflict sheets put recovery actions before the explanatory card, and the same 21-route sweep reported zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-current/`, `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-postfix/`, and `docs/e2e-bug-reports/2026-07-09-skipped-routes-text-pressure-clearance.md`. Compact/text-pressure and native reruns are still required; the supported 390 x 844 packet currently records the stale-detail and product-free invalid-share states only.
- Future branch: native share unavailable
  - Priority: Important
  - Automate later: Yes
  - Action: After a positive exact-content receipt, reviewed projection, and
    exact-payload confirmation exist, attempt export on a surface without native
    sharing support.
  - Expected result: The app explains sharing is unavailable without losing
    the user, exposing private Shelf details, leaving a temporary file, or
    emitting success/link/sheet analytics.
  - Evidence: Screenshot or platform log.
  - Historical fixture evidence: A 2026-07-08 Expo-web run with explicit preview/share fixtures exercised the unavailable-share recovery and retained the card and controls. Evidence is in `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/`. Because it used seeded candidate content before the current admission boundary, it is geometry/recovery evidence only and cannot establish reviewed content, native sharing, or current CORE-02 acceptance.

## Flow: Settings Account Controls

- Goal: A user can manage subscription, reminder, and beta-support settings without getting trapped when settings routes are opened directly.
- Persona: Returning user reviewing account, reminder, or beta-feedback preferences.
- Entry state: User has completed onboarding or has seeded local account/reminder state.
- Start screen/URL/window: You tab or direct settings routes.
- Success state: Settings changes, feedback handoffs, and exits are clear, and direct-entry settings screens recover to the You tab.
- Priority: Important
- Automate later: Yes
- Surface: Expo web for route recovery; iOS for release-native subscription and
  notification settings behavior. Android remains compatibility follow-up.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/settings/`
- Current local evidence: `test-results/human-e2e/2026-07-07/settings-privacy-policy-buffer/` and `test-results/human-e2e/2026-07-07/settings-privacy-data-rights-current/`
- Current policy-link evidence: `test-results/human-e2e/2026-07-08/settings-policy-link-failure/`
- Current reminder evidence: `test-results/human-e2e/2026-07-07/settings-reminder-timing-current/`

### Path A: Subscription Settings

1. Action: Open `/settings/subscription`, review plan, Restore, Terms, Privacy, and Manage subscription controls.
   Expected result: The account state is understandable, cancellation/restore paths are honest, and no unsupported billing action is implied.
   Evidence: Screenshot and visible-text snapshot.

### Branches

- Branch: direct-entry settings exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/settings/subscription`, `/settings/notifications`, `/settings/timing`, `/settings/beta-feedback`, `/settings/skin-profile`, and `/settings/privacy` directly, then use the visible Back control where the route has its own screen.
  - Expected result: The user returns to the You tab instead of remaining on a direct-entry settings screen with no navigation history. `/settings/privacy` lands inside the You tab privacy-control surface instead of showing an unmatched-route page. Visible Back controls, You tab navigation rows, active privacy/security switches, the non-interactive device-only Progress photo status, reminder timing pills/list rows, notification edit rows, and secondary subscription exits meet the 44 pt phone touch target where interactive. On compact phones, the You tab first viewport ends on complete rows with a clear buffer above the floating tab bar, and covered lower rows do not receive accidental hits until the user scrolls them into view.
  - Evidence: Screenshot sequence, visible route snapshot, and small-phone button-geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web verifies `/settings/privacy` redirects to `/you?section=privacy` at 320 x 568 and 390 x 568. The direct entry lands on complete privacy controls, leaves the `POLICIES` rows below the first viewport, has zero horizontal overflow, and has no non-tab controls in the floating tab-bar zone. Native iOS/Android rendering remains a device QA follow-up.
  - Current stress/modern evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` verified `/settings/privacy` at 390 x 844 and at the retained 320 x 480 stress viewport after direct-entry scroll/spacer calibration. Both direct entries resolve to `/you?section=privacy`, keep visible privacy controls complete and 44 px+, leave lower-priority policy rows fully below the first viewport, and report zero clipped controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin browser logs. The same focused sweep verifies `/today`, `/recommendations/preferences`, `/shelf/scan`, `/shelf/no-match`, `/routine/plan`, and `/community` across retained stress or modern-phone viewports. Evidence and report are in `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/support-floor-summary-final.json`, `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/report.md`, and `docs/e2e-bug-reports/2026-07-09-settings-privacy-support-floor-direct-entry.md`.
  - Current policy-spacing evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/settings/privacy` after policy support-row spacing calibration. The retained 320 x 480 stress and 390 x 844 modern-phone viewports resolve to `/you?section=privacy`, keep visible privacy controls complete and 44 px+, keep policy rows present but fully below the first viewport, and report zero clipped controls, zero blocked hit centers, zero sub-44 visible controls, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-privacy-policy-support-spacing-current/`.
  - Current layout-constant evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/settings/privacy` at 320 x 480 and 390 x 844 after the narrow withdraw-row spacer calibration. Both viewports resolve to `/you?section=privacy`, keep visible privacy controls complete, keep policy/data rows below the first viewport, and report zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
  - Current retained stress-floor withdraw evidence: 2026-07-09 Codex in-app browser Expo web reverified `/settings/privacy` at 320 x 480 after the compact withdraw spacer was tightened. The first viewport resolves to `/you?section=privacy`, keeps Marketing emails and Photos/no-AI controls complete, leaves `Withdraw health-data consent` fully below the first viewport instead of peeking under the floating tab bar, and reports zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, and zero unexpected current-origin logs. A user-like scroll reaches a complete 232 x 72 px `Withdraw health-data consent` button with no blocked center. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/` and `docs/e2e-bug-reports/2026-07-09-settings-privacy-support-floor-withdraw-peek.md`.
  - Current direct-entry timing evidence: 2026-07-09 headless Chrome Expo web targeted `/settings/privacy` at retained 320 x 480 stress size after adding an immediate layout-time privacy-card scroll retry. The route resolves to `/you?section=privacy`, anchors the privacy surface without waiting for a later effect, keeps the 52 x 48 `Marketing emails` switch complete, shows `Withdraw health-data consent` as a complete 232 x 48 button at y=152-200 with its center hit-test landing inside the button, keeps all visible controls 44 px+, reports zero clipped controls, zero blocked hit centers, zero horizontal overflow, and records zero disallowed browser logs. Evidence is in `test-results/human-e2e/2026-07-09/settings-privacy-direct-entry-current/`.
  - Current Terms policy-row evidence: 2026-07-09 Codex in-app browser Expo web reverified `/settings/privacy` at retained 320 x 480 stress size after adding the direct-entry Terms policy-row spacer. A user-like scroll reaches a complete 232 x 55 px `Terms` row above the floating tab bar, its center hit-test resolves to the row, tapping it renders route-owned `Link unavailable` recovery with no dialog, and horizontal overflow stays zero. The same pass spot-checks 390 x 844 with complete privacy controls above the bar and zero current-origin warn/error logs. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-privacy-terms-support-floor-current/`.
  - Current 430 x 640 / 200% support-band privacy evidence: 2026-07-09 headless Chrome Expo web found `/settings/privacy` exposing `Privacy policy` as a 16 px partial row whose center was blocked by underlying You-tab content. Post-fix, the 430-wide privacy direct-entry policy spacer applies from the 640 px support floor through the 700-779 px band, keeping visible privacy controls complete while policy rows start below the first viewport. The focused privacy/community/preferences rerun, full 430 x 640 route sweep, and affected-route 390 x 640 regression report zero failures. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-focused-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-640-affected-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-recommendation-preferences-430-640-text-pressure.md`.
  - Current 320 x 568 / 120% text-pressure evidence: 2026-07-08 headless Chrome Expo web reproduced compact privacy and policy row hints overflowing when the shared You-tab row forced one-line hints. Post-fix, compact hints wrap with a readable 16 px line height and the route audit reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/` and `docs/e2e-bug-reports/2026-07-08-settings-privacy-text-pressure-overflow.md`.
  - Current 320 x 430 / 120% text-pressure evidence: 2026-07-08 headless Chrome Expo web verifies `/settings/privacy` redirects into the You tab privacy section with ultra-short direct-entry density: secondary hints are hidden where needed, privacy rows stay complete above the floating tab bar, and the route reports zero clipped controls, blocked hit-tests, sub-44 visible controls, horizontal overflow, or disallowed browser logs in the final 49-route sweep. A 2026-07-09 320 x 360 / 130% rerun found the health-data withdrawal row could appear while its hit center resolved to the underlying You tab content; post-fix it remains in the active privacy card hit layer and the paired 360/370 px sweeps pass. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`, `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-micro-short-370-clearance.md`.
  - Current supported-phone 120% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/privacy` direct-entry policy/data rows peeking into the floating-tab zone at 320 x 480, 390 x 844, and 430 x 932. Post-fix, direct privacy entries keep policy and data rows below the first viewport until the user scrolls, and the 320 x 568, 320 x 480, 390 x 844, and 430 x 932 final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`.
  - Current compact/modern 170% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/privacy` direct-entry first viewports exposing the Reminders card at 320 x 568, the `Withdraw health-data consent` row under the floating tab bar at retained 320 x 480 stress size, and lower policy rows including `Consumer health privacy` as partial 430 x 932 bottom-edge targets. Post-fix, direct privacy entries suppress the unrelated Reminders card and push destructive health-data and lower-priority policy actions fully below the first compact/tall-phone viewport until scroll. The 320 x 568, 320 x 480, 390 x 844, and 430 x 932 final 170% sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-compact-568-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-390-postfix-6/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-170-supported-phone-clearance.md`.
  - Current You-section 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/you` and direct You-section query states exposing routine rows inside the floating tab-bar hit zone at 360 x 640 and 430 x 932. Post-fix, high-text You-tab density keeps `Your plan` as the first-viewport routine action and defers secondary routine rows below the first viewport until scroll. The 7-route You/settings sweeps at 360 x 640, 375 x 667, 390 x 844, and 430 x 932 report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, zero text overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-360-640-postfix4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-375-667-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-390-844-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-430-932-postfix4/`, and `docs/e2e-bug-reports/2026-07-09-you-tab-text-pressure-routine-clearance.md`.
  - Current 320 x 360 / 200% text-pressure evidence: 2026-07-08 headless Chrome Expo web reproduced `Withdraw health-data consent` as a fully visible row whose center resolved to the underlying You tab/floating tab content. Post-fix, narrow direct privacy entries keep Marketing and photo privacy controls complete in the first viewport and defer the destructive health-data action below the first viewport until the user scrolls. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`.
- Branch: active reverse-trial subscription options
  - Priority: Critical
  - Automate later: Yes
  - Action: Seed an active app-granted reverse-trial entitlement, open `/settings/subscription`, then tap the Pro options row.
  - Expected result: The screen shows the reverse-trial/free-until state, a no-card status label, and a keep-Pro options row that opens the Pro keep-options paywall. It must not open App Store or Google Play subscription management, must not imply there is a card on file, and must not show expired-trial copy while the reverse trial is still active. On compact phones, the annual price and store-unavailable reason must appear before the keep-Pro CTA, and Terms, Privacy, and Restore must remain reachable without clipped controls.
  - Evidence: Screenshot sequence, visible route snapshot, and local entitlement fixture snapshot.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 reproduced the compact keep-options bug where the CTA appeared before the annual price/store-unavailable reason, then verified the fix through `/settings/subscription` -> `Keep Pro after your week` -> `/paywall/reoffer` at 320 x 568 and 390 x 568. Post-fix state has active no-card copy, no expired-trial copy, annual price and preview-checkout reason before the CTA, zero horizontal overflow, no sub-44 px visible controls, no clipped controls, and scroll-reachable 48 px Terms/Privacy/Restore above the fixed footer. Evidence is in `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/`.
- Branch: subscription billing and policy handoff failure
  - Priority: Important
  - Automate later: Yes
  - Action: Seed a store-backed Pro entitlement, open `/settings/subscription`, then tap Manage in App Store, Restore purchases, Terms, and Privacy while external handoffs fail.
  - Expected result: The screen keeps the user in Subscription Settings, exposes visible row-local feedback for billing-management and policy-link failure, Restore reports an empty/success/failure state, and all rows remain at least 44 px tall on compact phones.
  - Evidence: Alert text or row-local feedback, visible route snapshot, and control-geometry snapshot.
  - Current local evidence: 2026-07-08 System Chrome CDP Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all` verifies `/settings/subscription` shows `Layerwell Pro`, `Manage in App Store`, Restore, Terms, and Privacy. Manage failure renders `We could not open subscription management...`, Terms/Privacy failure renders `Link unavailable`, Restore renders `No active subscription was found for this account.`, controls are 52-53 px tall, and horizontal overflow is zero. Follow-up Codex in-app browser evidence on the same fixture verifies Manage, Terms, and Restore all render route-owned `role="alert"` feedback, open no JavaScript dialog, keep the route on `/settings/subscription`, keep current-run warn/error logs empty after expected local placeholder warnings, and keep horizontal overflow at zero. Evidence is in `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/` and `test-results/human-e2e/2026-07-08/paywall-inline-recovery-current/`. Native iOS RevenueCat Restore and App Store management-sheet evidence remain Phase 5/6 launch QA; Android is a later compatibility pass.
  - Current ultra-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the free-plan `Privacy` compliance row clipping in the post-Recommendations route sweep. Post-fix, `/settings/subscription` uses a sub-460 px density for the free-plan card and compliance rows while keeping Restore, Terms, and Privacy as complete 48 px controls; tapping Restore purchases stays on Subscription Settings, renders route-owned feedback, and opens no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/` and the fresh 49-route zero-failure sweep `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
  - Current split-short text-pressure evidence: 2026-07-08 headless Chrome Expo web at 320 x 390 / 130% verifies `/settings/subscription` keeps the free-state card, Restore, Terms, Privacy, and upgrade action complete without clipping or blocked hit centers after dropping lower-priority free-plan body copy below 410 px. The 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-130-split-short-390-postfix-4/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-130-split-short-390-route-clearance.md`; native Dynamic Type remains device QA.
- Branch: policy link handoff failure
  - Priority: Important
  - Automate later: Yes
  - Action: Tap Privacy, Consumer Health Privacy, Terms, Support, account deletion help, or data export help while the browser cannot open the URL.
  - Expected result: The app shows a clear unavailable alert or row-local recovery message instead of swallowing the failed handoff, keeps the user on Settings, and keeps policy/help rows at least 44 px tall on compact phones.
  - Evidence: Alert text or row-local feedback, visible route snapshot, and control-geometry snapshot.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser` opens `/settings/privacy`, taps Privacy policy, Consumer health privacy, Terms, Support, Account deletion, and Data export, and verifies each failed handoff renders row-local `Link unavailable` recovery copy. All six rows are 70-94 px tall, each recovery message is 48 px tall, horizontal overflow is zero, and the route remains `/you?section=privacy`. Browser logs include expected Supabase placeholder network failures because live backend remains blocked.
  - Current support-contact evidence: 2026-07-09 Codex in-app browser Expo web at 390 x 844 opens `/you?section=privacy`, taps the Support policy row, and verifies the local unavailable support URL renders route-owned `Link unavailable` recovery with zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, and zero unexpected current-origin browser logs. The support row now emits literal beta-safe `support_contact_opened` or `support_contact_failed` analytics with only `source=settings` and `result=opened|unavailable`; event registry, sanitizer, route-contract, privacy-payload, and Phase 10 beta analytics audits cover drift. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-support-contact-analytics-current/`. Live support URL, support desk categories/SLA, and native iOS/Android external-link handoff remain external Phase 10 QA.
- Branch: beta feedback categorized support handoff
  - Priority: Important
  - Automate later: Yes
  - Action: Open the You tab, tap Beta feedback, choose an issue type and priority, then open support while the configured support URL is unavailable or forced to fail.
  - Expected result: The route uses fixed support categories and P0-P3 priority buckets, never asks for free text, keeps all visible controls at least 44 px tall, sends only `source=beta_feedback`, `category`, and `severity` enum params to the HTTPS support URL, tracks beta-safe support open/failure analytics, and renders route-owned unavailable feedback without a JavaScript/native dialog when the handoff cannot open.
  - Evidence: Screenshot sequence, URL-param/analytics contract tests, route snapshot, browser log check, and control-geometry snapshot.
  - Current local evidence: 2026-07-09 Codex in-app browser Expo web at 390 x 844 with `EXPO_PUBLIC_SUPPORT_URL=https://support.example.com/beta` and `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser` opened `/you`, tapped `Beta feedback`, selected `Catalog match issue` and `Core flow blocked`, verified `Open support` became enabled, tapped it, and saw inline `Support is not configured in this build` recovery with no JavaScript dialog. The route has zero text inputs, zero horizontal overflow, visible controls at 48 px or taller, clean current-origin browser warn/error logs, and Back returns to `/you`. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-beta-feedback-current/`.
  - Current compact-height evidence: 2026-07-09 Codex in-app browser Expo web at 390 x 640 opened `/settings/beta-feedback`, verified the compact high-text-pressure chrome uses `Category and priority only` and hides the longer explanatory paragraph, confirmed the fixed category rows use support-floor spacing, selected `Catalog match issue` and `Core flow blocked`, tapped `Open support`, and saw inline support-unavailable recovery with no JavaScript dialog. The route has zero free-text inputs, zero horizontal overflow, and zero current-origin warn/error logs. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-beta-feedback-compact-floor-current/`. Live support URL, support desk categories/SLA, and native iOS/Android external-link handoff remain external Phase 10 QA.
  - Current text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced `/settings/beta-feedback` issue-type rows clipping into the bottom edge at 360 x 640 / 200% text pressure and the `Progress photos` row becoming a 32 px target at 390 x 844. Post-fix, the route collapses the intro chrome under high text pressure, keeps compact support rows, and uses targeted first-viewport category breaks for compact-phone widths so visible controls remain at least 44 px and hit-testable. Focused route audits now pass at 360 x 640, 360 x 740, 375 x 667, 390 x 844, 412 x 915, and 430 x 932 with zero failed routes. Evidence is in `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-360-640-final-guard/`, `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-360-740-final-guard/`, `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-375-667-final-guard/`, `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-390-844-final-guard/`, `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-412-915-final-guard/`, and `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-430-932-final-guard/`; bug report is `docs/e2e-bug-reports/2026-07-09-beta-feedback-text-pressure-clearance.md`.
- Branch: privacy and security choice save failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/settings/privacy` on a compact phone viewport, tap the Marketing emails switch while consent persistence is unavailable, then repeat with keyboard activation.
  - Expected result: The switch uses a real 44 pt or larger touch target, failed persistence does not silently flip visible state, no native or JavaScript dialog blocks the user, row-local `Choice not saved` recovery copy appears near the changed control, no raw backend/provider error leaks, and the layout keeps zero horizontal overflow.
  - Evidence: Screenshot sequence, dialog-state check, switch state, alert-region geometry, and horizontal-overflow snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with local Supabase placeholders unavailable verifies `/settings/privacy` redirects to `/you?section=privacy`, the Marketing emails switch is 52 x 48 px and unchecked before interaction, pointer tap and keyboard activation both render an inline `role="alert"` message (`Choice not saved` / retry copy), the switch remains unchecked, no JS dialog appears, the alert is 232 x 68 px between the marketing row and the next privacy row, raw backend text is hidden, and horizontal overflow is zero. Evidence is in `test-results/human-e2e/2026-07-08/settings-privacy-choice-inline-feedback/`. Native iOS/Android switch and consent-service evidence remain device QA.
- Branch: combined account and local-device data export
  - Priority: Critical
  - Automate later: Yes
  - Action: Inspect the `YOUR DATA` section, then export with no configured backend, with a configured backend that fails, and with an OS share sheet that is unavailable, cannot be detected, or rejects after the temporary JSON file is created.
  - Expected result: Before action, Settings names the account plus current-device scope, including profile, shelf, routine settings, completion history, preferences, and Progress notes, while stating that Progress image files/thumbnails stay encrypted and must be shared individually. The mobile JSON wrapper version and server-scope status are explicit; every registered local private-data key is covered; local shelf/photo paths, image/thumbnail bytes, note ciphertext, keys, credentials, and cache files are absent. A backend-free build can prepare a marked device-only artifact. A configured server failure never falls back silently or writes a partial file. Share failure shows route-owned `role="alert"` feedback, opens no native or JavaScript dialog, does not trigger review completion, preserves the scope disclosure, and deletes any temporary plaintext export file.
  - Evidence: Scope-disclosure screenshot/text, exhaustive local-key registry test, representative JSON snapshot/redaction assertions, configured-server fail-closed test, inline alert text, dialog state, mutation state, and cache cleanup assertion.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 verifies `/settings/privacy` resolves to `/you?section=privacy`, `Export my data` is unique, the local backend-unavailable failure renders the visible privacy-request recovery copy, visible data-rights controls are 56 px tall, horizontal overflow is zero, and focused settings action tests cover unavailable share/cache cleanup plus destructive delete/withdraw fallback behavior. Live Supabase and native share-sheet evidence remain external QA.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with placeholder Supabase unavailable verifies `/settings/privacy` resolves to `/you?section=privacy`, tapping `Export my data` renders inline `Export failed` recovery with `role="alert"`, opens no JavaScript/native dialog, leaks no raw backend/provider text, keeps visible controls 56 px tall, and keeps horizontal overflow at zero. Evidence is in `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/`.
  - Prior scope-only evidence: 2026-07-10 headless Chrome Expo web verified the earlier complete `YOUR DATA` card at 360 x 640 and 390 x 844, its explicit image-file exclusion, route-owned backend-unavailable failure, 56 px Export action, zero dialogs/analytics/requests/overflow, and non-default footer copy. That evidence predates the combined local-device export and remains in `test-results/human-e2e/2026-07-10/data-export-local-photo-disclosure-current/`; the current combined scope requires fresh evidence below.
  - Current local evidence: 2026-07-10 headless Chrome Expo web verifies the combined account/current-device disclosure and backend-free action at 360 x 640 and 390 x 844. The full `YOUR DATA` card visibly names profile, shelf, routine settings, completion history, preferences, and Progress notes; separately excludes photo files/thumbnails; keeps Export/Delete at 56 px; and has zero overflow. Tapping Export emits no Edge or analytics request and shows route-owned raw-error-free `Export failed` recovery because Expo web lacks the native cache/share handoff, with zero dialogs, page errors, or unexpected logs. Focused tests prove exhaustive private-key coverage, representative local record/note inclusion, media/path/ciphertext/key redaction, explicit `backend_not_configured` scope, configured-server fail-closed behavior, and temporary-file cleanup. Evidence is in `test-results/human-e2e/2026-07-10/data-export-combined-device-current/`; bug record is `docs/e2e-bug-reports/2026-07-10-account-export-omitted-local-first-data.md`. Seeded staging artifact and native share/cache evidence remain assigned to Tas.
- Branch: account change interrupts an in-flight export
  - Priority: Critical
  - Automate later: Yes
  - Action: Start a configured export for account A, delay the owner-scoped Edge response, then sign out or switch to account B; repeat with the boundary starting immediately after the plaintext cache write. Also exercise a same-user token refresh without an account change.
  - Expected result: One cancellable account-generation lease covers authenticated-owner capture, local snapshot, Edge request, plaintext write, native availability check, share sheet, and unconditional deletion. A real account boundary aborts the Edge request, blocks new exports, waits for the full operation and cache deletion, and never publishes account B while account A export work remains. The server `user_id` must exactly equal the initiating authenticated user. A stale generation cannot write or share, a file written just before invalidation is deleted, and same-user refresh does not invalidate an otherwise current export.
  - Evidence: Delayed-operation and nested-boundary tests, exact-owner mismatch test, cache-write race assertion, root session-boundary source contract, supported-phone transition/recovery screenshots, browser logs, and configured staging A-to-B/native share-sheet proof with redacted account IDs.
  - Open external evidence: Live Supabase A-to-B transition and native share-sheet interruption remain staging/device QA under `B-VERIFY-AUTH-LINKING` and `B-SUPABASE`.
- Branch: non-destructive health-consent withdrawal, paused shell, and fresh reconsent
  - Priority: Critical
  - Automate later: Yes
  - Action: From an active health-processing epoch with a signed-in account, seeded health-purpose local/server data, a store-backed or no-card entitlement, and owned photo Storage objects, open Privacy, review and cancel the first withdrawal confirmation, then confirm. Interrupt separately before server acceptance, after the local freeze, during database cleanup, during Storage deletion, and after terminal server completion but before local commit. Relaunch offline/online, background/foreground, retry status/work, attempt direct health routes and stale writes, export, manage/restore subscription, sign out, and account deletion. After terminal `withdrawn`, review the fresh disclosure and opt in again.
  - Expected result: Confirmation states plainly that health-purpose data and personalization are deleted/reset while the account, sign-in, billing, entitlements, and App Store subscription remain. A durable local marker closes health reads/writes and unmounts the health-data app tree before cleanup; the server appends withdrawal, establishes the barrier, and rejects current/stale-epoch writes. The paused shell exposes status/retry, privacy/support, export when the lifecycle permits a complete truthful artifact, account deletion, sign-out, and truthful App Store subscription manage/restore controls. It never calls full account deletion, Apple revocation, RevenueCat identity reset, or subscription cancellation. Nonterminal states cannot reconsent. Terminal absence is committed only after relational, local, Storage, and the operation-bound processor inventory reconcile. Fresh reconsent uses current version/hash copy, creates a strictly newer processing epoch, starts at goals with empty health state, and cannot restore deleted answers, shelf, routines, completions, conflicts, recommendations, photos, Ask/trend/community health state, or reminders.
  - Error/legacy outcomes: Unknown status, invalid/mismatched owner, account-deletion barrier, worker exhaustion, unsafe legacy Storage path, inventory version/hash mismatch, legacy unconsented health residue, local key failure, and network outage stay fail-closed with retry/support or `action_required`; no state is reported as withdrawn while residue remains. A separately initiated full account deletion may supersede and cascade the health lifecycle without being blocked by it.
  - Evidence: Source processor-inventory hash audit; two-reset migration/pgTAP/lint/shadow proof; Edge/mobile unit and concurrency tests; local private-key/photo/cache/notification absence; account/billing/entitlement/store-journal preservation assertions; exact server row and Storage zero counts; two-user/two-session stale-writer denial; worker-without-requesting-device continuation; export lifecycle result; screenshots/video for every pause/retry/terminal/reconsent state; physical-iPhone process-death, background, StoreKit, keychain, Dynamic Type, VoiceOver, and notification evidence; final privacy/legal/security review tied to exact hashes.
  - Source-candidate references: `docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md`, `docs/hugeToDo/health-processor-inventory-v1.json`, migration `20260715000054`, `supabase/functions/consent-withdrawal/healthLifecycleCore.ts`, `supabase/functions/health-consent-worker/`, and `supabase/ops/health-consent-work-lane.sql`.
  - Current local evidence: `test-results/human-e2e/2026-07-15/health-consent-withdrawal-current/` records the 390 x 844 active-privacy confirmation/cancel/confirm flow, the account-preserving paused shell (`Status: withdrawn. Local cleanup complete.`), paused reload, fresh-disclosure refusal, terminal reconsent, goals stability through 100 ms sampling to 1.9 seconds plus 6.5 seconds, and goals reload. A 360 x 640 replay keeps agree, decline, and policy controls reachable. This placeholder-Supabase run made no hosted destructive call.
  - Current external evidence gap: Hosted worker/Cron/Vault/Storage and version-2 zero-residue proof, two-device and process-death behavior, physical-iPhone/TestFlight/VoiceOver/Dynamic Type, production processor/backup controls, approved final copy, and privacy/legal/security/App Review approval remain open. All 15 installed legal-copy tuples are `draft_blocked`; local web evidence does not close this launch gate. Historical Settings screenshots that used account-closing behavior remain predecessor geometry/failure evidence only.
- Branch: durable account deletion, restart recovery, Apple fallback, and failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Tap Delete account on a compact phone viewport, inspect and cancel the first confirmation, then confirm while the data-rights backend is unavailable. On native iOS, test exact accepted, lost-response, relaunch, delayed, invalid, expired, terminal-completed, Apple-manual-notice, A-to-B account-switch, second-device active-barrier, an already active/withdrawn health lifecycle, and legacy support-only branches against authorized non-production fixture accounts. For credential-free Expo web evidence, use only the development-gated `EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY=pending_then_completed_manual|invalid|expired|invalid_support_only` fixtures; never perform a real destructive request from those fixtures.
  - Expected result: Account deletion requires an inline second confirmation with visible Cancel and destructive confirm controls, explains before deletion that an Apple fallback may require iPhone Settings, and opens no native or JavaScript dialog. Native v2 intake captures and server-verifies the initiating session, binds independent 256-bit idempotency and status-capability tokens to that exact owner before sending the exact `begin` body, and uses only the captured bearer. Only an exact HTTP 202 commits `accepted`; a response-lost transport result commits `ambiguous`. Both wake the capability-only pre-Auth recovery gate, which verifies retained Auth and the complete private-cleanup/owner/retained/quarantine proof tuple before any destructive cleanup. For the exact owner, ambiguous intake retains only the verified Supabase session for one idempotent retry while isolated/vendor/query cleanup runs; accepted or pending intake clears that session too. An exact verified foreign, missing, or authoritatively rejected session is removed with auth-derived/vendor/query state, but a durable retained-owner marker prevents immediate or later cold-start erasure of another owner's private data. Ownerless data receives a durable no-adoption quarantine before forced sign-out, so every later login wipes before claiming it. A separate auth-derived-cleanup marker is committed before session removal and cold restore retries it before reading Auth until all session/vendor/ephemeral resets succeed. Transient, storage, malformed, or unclassified Auth proof failures instead retain the retry session behind the gate. A matching local owner can finish cleanup after Auth disappears, and legacy ownerless/nonterminal state is support-only. Every cross-device `clear` or `active` preflight carries its authenticated owner subject in the same response; a cached-session subject mismatch is rejected, exact `clear` uses the response subject as the publication target, exact `active` clears matching local state, and valid foreign state is durably retained before sign-out while unreadable proof stays retry-gated. Pending or delayed status keeps account activity paused. Exact completion is first committed locally and then retries owner-authorized cleanup idempotently, so a prior partial or preterminal cleanup cannot be mistaken for terminal proof. An attested `remove_apple_authorization` notice is queued and shown while the completed capability remains durable; only explicit notice acknowledgement removes that secure state. Invalid, expired, malformed, offline, ownership-mismatch, or cleanup-failure outcomes retain recovery evidence and show a raw-error-free Check status / retry / support state instead of silently reopening account activity. An active or terminal health-withdrawal record cascades with the Auth account and cannot preserve health data or block full deletion.
  - Evidence: Confirmation screenshots, pending/delayed/recovery screenshots, manual-revocation completion and failed-handoff screenshots, a relaunch transcript, dialog-state check, control-geometry snapshot, browser/network logs proving no destructive request in fixture mode, SecureStore/native device evidence, and focused intake/status/state/finalization unit contracts.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 verifies `Delete account` opens an inline confirmation, `Cancel` removes it, confirming with the backend unavailable renders inline `Deletion failed`, no JavaScript/native dialog opens, raw backend/provider text is hidden, confirmation buttons are 200 x 56 and nudged above the floating tab bar, the route remains `/you?section=privacy`, and horizontal overflow is zero. The same run's health-withdrawal interaction is historical geometry/failure evidence only and is not evidence for the new non-destructive branch. Evidence is in `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/`.
  - Current durable-contract evidence: 2026-07-13 focused mobile tests pass exact owner-bound intake, captured-bearer dispatch, A-to-B interruption, foreign-owner no-overwrite/no-erasure, transport ambiguity, capability-only status, terminal local commit, invalid/expired and ownerless-legacy preservation, owner-proof-last cleanup, SecureStore registry, and pre-Auth provider-order contracts. Codex in-app Chromium then exercised the non-destructive Expo-web fixtures on the saved 1279 x 720 capture surface: pending recovery, manual `Check status now`, the durable Apple-manual completion notice, signed-out continuation, invalid recovery with retained retry controls, expired recovery with support guidance, and ownerless legacy recovery with support-only controls. No destructive request is permitted in fixture mode. Six screenshots and the run report are in `test-results/human-e2e/2026-07-13/account-deletion-durable-recovery-current/`; compact-phone and physical-iPhone reruns remain open.
  - Current source evidence and open native gates: The server/client two-phase publication fence now reserves before session publication, activates only after exact-session preparation, renews bounded authority, and drains before account boundaries. Account deletion takes a synchronous temporary hold, verifies the exact owner's store-safety journal, starts exact-subject RevenueCat quiescence as the final generation action, and waits for full closure before creating a deletion capability; durable deletion barriers remain distinct from the temporary hold. Focused race tests cover fresh/closed, foreign subject, delayed native operation, timeout/quarantine, retry, and A-to-B admission. This closes the prior source-only lease gap, but it does not prove provider behavior. Physical-iPhone Keychain persistence, process-kill/relaunch recovery, real background polling cadence, live staging capability-only status, transport interruption after committed intake, local cleanup retry, Sign in with Apple revocation/manual fallback, second-device/provider recreation/late settlement, RevenueCat live lease behavior, and VoiceOver/Dynamic Type focus remain required. Expo web fixture evidence proves UI/state routing only and cannot satisfy these native/live gates.
- Branch: device-only photo-storage status
  - Priority: Important
  - Automate later: Yes
  - Action: Open the You tab Security section and the locked Progress screen on supported compact and modern phone viewports.
  - Expected result: Both surfaces describe photo storage as device-only and cloud backup as unavailable. No backup switch, disclosure dialog, settings handoff, backup analytics event, or automatic photo/metadata network request is exposed. The device-loss tradeoff remains readable without crowding the app-lock control or Progress actions.
  - Evidence: Surface screenshots, absence-of-control query, dialog-state check, control geometry, network requests, and browser logs.
  - Current local evidence: 2026-07-10 headless Chrome Expo web verifies the visible Security card and locked Progress surface at 360 x 640 and 390 x 844 with zero backup controls, dialogs, navigation handoffs, analytics/photo-backend requests, unexpected logs, or horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-10/progress-device-only-backup-current/`.
- Branch: reminder timing and discretion
  - Priority: Important
  - Automate later: Yes
  - Action: Open notification settings, observe the current OS authorization state, toggle reminder purposes, edit AM/PM timing and quiet hours, then return to settings.
  - Expected result: Fresh notification purposes are off. Stored toggles render effectively off when OS authorization is unavailable or denied. A denied state names the device Settings block and offers an Open Settings recovery action; a failed native handoff renders inline recovery, and foreground return refreshes the observed state. User-set times, contextual timing-control and picker-row labels for assistive tech, 44 pt reminder-tier switches, and discreet lock-screen copy remain clear and calm, with no notification-pressure copy. Time picker sheets expose a single named modal dialog, a named dismiss action, and no unlabeled inert sheet-body controls. Matching quiet-hour start/end is explicitly described as off. Scheduled routine and weekly-photo reminders inside the quiet window move to its end; immediate event-triggered suggestions are skipped. Trial billing reminders are explicitly identified as following the checkout date instead.
  - Evidence: Screenshot sequence, local preference snapshot, and small-phone accessibility/geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 verifies `/settings/notifications` tier rows and switches, `/settings/timing` time pills, the Morning reminder time-picker sheet, AM time update from 7:30 AM to 8:00 AM, return to the notifications hub with the updated time, quiet-hours copy, generic lock-screen preview, zero horizontal overflow, and 48 px visible controls. Focused notification tests cover quiet-hours scheduling, delivery caps, lock-screen discreet copy, preference persistence, and route/touch-target contracts; native OS permission/scheduling QA remains external.
  - Current safe-area evidence: 2026-07-07 Codex in-app browser Expo web verifies the hand-built `/settings/timing` Morning picker keeps 40 px zero-inset web bottom padding, zero horizontal overflow, 48 px visible picker rows, one named dialog, and a 44 px named dismiss target in the compact observed viewport after sheet-height capping; selecting `8:00 AM` closes the modal and updates the Morning pill. Evidence is in `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/`. Native iOS/Android home-indicator and screen-reader verification remains device QA.
  - Current ultra-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the `Replenishment` switch clipping in the post-Recommendations route sweep. Post-fix, `/settings/notifications` uses sub-460 px row density that preserves 48 px switches and complete visible controls; tapping Replenishment toggles the switch with no JavaScript dialog, no clipped controls, no sub-44 controls, and zero blocked center hit-tests. Evidence is in `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/` and the fresh 49-route zero-failure sweep `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
  - Current 320 x 430 / 120% text-pressure evidence: 2026-07-08 headless Chrome Expo web verifies `/settings/notifications` keeps visible notification switches complete and 48 px+ under enlarged text, while the lower promotional row starts below the first viewport instead of peeking behind the floating tab bar. The final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`.
  - Current compact 120% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/notifications` still peeking the lower promotional switch section at retained 320 x 480 stress and 320 x 568 compact heights. Post-fix, the promotional section starts fully below the first viewport while the visible reminder switches remain complete and 48 px+, and the 320 x 568 and 320 x 480 final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`.
  - Current 320 x 370 / 320 x 360 / 130% micro-short text-pressure evidence: 2026-07-08 headless Chrome Expo web reproduced `/settings/notifications` peeking the lower-priority `Progress-photo nudge` switch by a few pixels at the viewport bottom. Post-fix, notifications use a split-short band below 410 px that keeps visible switches complete and moves `Progress-photo nudge` fully below the first viewport, while `/settings/timing` compacts the header, time rows, quiet-hours card, and helper copy for the sub-380 px envelope. A 2026-07-09 rerun corrected the micro-short nudge spacer so `Streak & adherence` and `Replenishment` stay complete instead of one row peeking at 320 x 360. The final 49-route sweeps report zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-current/`, `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-micro-short-370-clearance.md`; native iOS/Android notification permission, scheduling, safe-area, and Dynamic Type QA remain external.
  - Current stress/modern layout-constant evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/settings/notifications` after promotional section spacer calibration. The retained 320 x 480 stress and 390 x 844 modern-phone viewports keep visible notification controls complete and hit-testable, with zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
  - Current retained stress-floor nudge evidence: 2026-07-09 Codex in-app browser Expo web found the non-micro split-short `/settings/notifications` spacer still let `Progress-photo nudge` peek by roughly 5 px at 320 x 480. Post-fix, 320 x 480, 320 x 568, and 390 x 844 all report zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero current-run unexpected warn/error logs; tapping `Replenishment` changes `aria-checked`. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/` and `docs/e2e-bug-reports/2026-07-09-settings-notifications-support-floor-nudge.md`.
  - Current CORE-05 local-contract evidence: 2026-07-26 Codex in-app browser development Expo web displays the exact 7:30 AM / 9:30 PM onboarding proposal, verifies `Not now`, observes six effectively-off switches when browser notification authorization is unavailable, and renders the scheduled-shift/event-skip/billing-exception quiet-hours scope plus the matching-time off state. The run found `WEB-NOTIF-001`, a denied-toggle attempt to call native `Linking.openSettings()` on web; the guarded source was replayed in a clean tab, the Morning switch remained `aria-checked="false"`, and no current-run browser error appeared. Evidence is in `test-results/human-e2e/2026-07-26/core05-notification-local-contract/` and `docs/e2e-bug-reports/2026-07-26-notification-settings-web-open-settings-crash.md`. Screenshots are 1279 x 720 rasters, not retained CSS-viewport proof. Compact/text-pressure, native authorization/Settings handoff, scheduled inventory, foreground revocation, relaunch/offline/DST, accessibility, network, physical-iPhone, and signed-archive evidence remain open.
  - Current 360 x 640 / 200% and 390 x 640 / 170% supported text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/notifications` let the lower-priority `Streak & adherence` switch peek into the first viewport by 5 px at 360 x 640 / 200% and by 30 px at 390 x 640 / 170%. Post-fix, the route pushes Gentle Nudges below the first viewport for 360/390-class supported text-pressure layouts while preserving complete utility reminder controls. The 49-route reruns at both sizes report zero failed routes, zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and reports are in `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-postfix/`, `docs/e2e-bug-reports/2026-07-09-settings-notifications-360-640-text-pressure.md`, and `docs/e2e-bug-reports/2026-07-09-settings-notifications-support-band-text-pressure.md`.
  - Current 360 x 740 / 200% Android-class text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/notifications` exposing only 4 px of `Replenishment` at the first viewport bottom. Post-fix, the 700-779 px dense Android band moves Gentle Nudges below the first viewport while keeping Morning and Evening reminder controls complete; the focused route rerun and full 49-route sweep report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-notifications-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-postfix/`, and `docs/e2e-bug-reports/2026-07-09-settings-notifications-android-360-740-text-pressure.md`.
  - Current 390 x 740 / 200% Android-class text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/notifications` exposing only 1 px of `Streak & adherence` at the first viewport bottom. Post-fix, the same 700-779 px dense Android band moves Gentle Nudges below the first viewport at 390-wide wrapping while keeping Morning and Evening reminder controls complete; the focused route rerun, full 390 x 740 sweep, and 360 x 740 regression sweep report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-notifications-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-postfix2/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-android-390-740-clearance.md`.
  - Current 430 x 740 / 200% Android-class privacy evidence: 2026-07-09 headless Chrome Expo web found `/settings/privacy` exposing the `Privacy policy` row under the floating tab bar, with its center resolving to the Shelf tab. Post-fix, the 430-wide 700-779 px privacy direct-entry guard moves policy rows below the first viewport while keeping Marketing emails and Withdraw health-data consent complete and hit-testable above the bar. The focused privacy rerun, full 430 x 740 route sweep, and 430 x 932 privacy regression report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-privacy-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-932-privacy-regression-postfix/`, and `docs/e2e-bug-reports/2026-07-09-settings-privacy-430-740-text-pressure.md`.
  - Current 375 x 812 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced a partial `Progress-photo nudge` switch on the supported iPhone-class viewport. Post-fix, Notification Settings defers that lower-priority row on iPhone-height text-pressure layouts, the focused 360 x 780 and 390 x 812 reruns pass, and the full 49-route 375 x 812 sweep reports zero failed routes while keeping visible utility reminder controls complete. Evidence and bug report are in `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-mid-supported-prefs-notifications-current/`, `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-height-prefs-notifications-current/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-iphone-375-clearance.md`.
- Branch: exact-time notification onboarding and permission outcomes
  - Priority: Critical
  - Automate later: Yes
  - Action: On a fresh install, open the notification onboarding step; verify both proposed times are visible before pressing the affirmative action. Exercise authorized, provisional/ephemeral where available, denied, permanently blocked, unchanged, native-error, and Not now branches. Reopen notification settings after OS revocation and foreground return.
  - Expected result: The surface visibly proposes Morning at 7:30 AM and Evening at 9:30 PM and labels the action Use these times. Accepting persists and schedules only those exact AM/PM purposes after a deliverable OS state; every optional nudge purpose remains off. Not now, denial, blocked, unchanged, and error outcomes leave every purpose off and do not report a system prompt as shown or an API failure as a denial. No reminder is scheduled after authorization revocation. Settings exposes recovery without requiring notifications for ordinary app access.
  - Evidence: Compact and modern-phone screenshots before the OS request, OS authorization-state transcript, scheduled-notification inventory, local preference snapshot, foreground-revocation sequence, and absence-of-analytics/network proof.
- Branch: device-local notification cap and privacy boundary
  - Priority: Critical
  - Automate later: Yes
  - Action: Seed two event-triggered scheduling-attempt reservations, fire ten simultaneous eligible triggers, relaunch, and repeat while offline. Separately enable the weekly progress-photo reminder and inspect network traffic.
  - Expected result: Exactly one further event-triggered suggestion is admitted on that device within the rolling seven-day cap; malformed or unavailable encrypted ledger state schedules nothing. A reservation remains cap-counted across relaunch even if native scheduling fails. The weekly progress-photo reminder is described separately from the event-triggered cap. Reminder times, timezone, quiet hours, purpose toggles, and scheduling-attempt metadata remain device-local; no `notification_preferences`, `notification_log`, or analytics request is emitted.
  - Evidence: Atomic-ledger snapshot, concurrency transcript, scheduled-notification inventory, relaunch/offline transcript, and network log.
- Branch: notification tap, cold-launch response, and account-boundary cleanup
  - Action: Schedule each enabled local purpose, tap it from foreground, background, and a terminated signed build, then sign out or complete account deletion while scheduled and delivered notifications exist. Repeat with a malformed payload, a mismatched purpose/destination, an unknown category, and a non-default action.
  - Expected result: Each valid first-party notification opens only its fixed non-parameterized destination after the account, private-data, age, and health gates are ready. A cold response is consumed once; a recognized response arriving during an account boundary is consumed without navigation; malformed, extended, mismatched, or custom-action payloads do not navigate. Sign-out and account deletion cancel pending notifications, dismiss delivered notifications, clear Expo's retained last response, and clear the app badge before another account can publish. Remote push and token collection remain unavailable while the reviewed local-only contract is active.
  - Evidence: Focused source tests cover the exact payload/category allowlist, warm/cold response de-duplication, custom-action rejection, zero-badge startup, and account-boundary cancellation/dismissal/badge cleanup. Native foreground/background/terminated routing, Notification Center inventory, sign-out race, signed-archive behavior, and physical-iPhone proof remain open.

## Flow: Ask Layerwell Deterministic Advisor

- Goal: A user can open the free deterministic Ask advisor without cloud
  consent, while unavailable cloud Ask and unadmitted interaction guidance stay
  honestly deferred.
- Persona: Free user exploring shelf/routine guidance.
- Entry state: Fresh local app state or seeded shelf state; `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=false`.
- Start screen/URL/window: Direct route `/ask`, or Today Ask teaser when available.
- Success state: `/ask` renders the Ask Layerwell advisor surface and hides
  its proactive conflict lead and conflict suggested prompt while exact
  interaction coverage is unavailable. `/ask/consent` renders the cloud Ask
  deferred screen while the cloud flag is off.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route parity; iOS and Android for native app confirmation.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/ask-deterministic/`
- Historical geometry/navigation evidence:
  `test-results/human-e2e/2026-07-07/ask-current-compact-advisor/`. It predates
  zero-admission prompt hiding and is not current acceptance evidence.

### Path A: Deterministic Ask Opens

1. Action: Open `/ask` directly with cloud Ask disabled.
   Expected result: The Ask Layerwell advisor renders with
   deterministic/free copy. At zero admission it shows neither a proactive
   conflict turn nor `Is there a conflict on my shelf?`; routine/fit prompts
   may remain where the supported-phone layout permits. It must not show the
   cloud Ask deferred beta screen or imply interaction review is active.
   The composer disclosure footer stays fully visible and legible above the bottom edge on a 320 x 568 phone.
   Evidence: Screenshot and visible-text snapshot.
   Current evidence: The 16/16 CORE-02 source contract verifies both
   zero-admission conflict-prompt gates. The supported 390 x 844 Expo-web pass
   confirms the proactive turn and conflict prompt are absent, while routine
   and fit prompts plus the local-only disclosure remain visible.

### Branches

- Branch: cloud consent direct route while cloud Ask is disabled
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/ask/consent` directly with cloud Ask disabled.
  - Expected result: The route shows the cloud Ask deferred screen and does not offer a usable consent toggle for an unavailable cloud feature. Its `Back to Ask` deferred CTA returns to `/ask` on direct entry.
  - Evidence: Screenshot and visible-text snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 shows `Ask Layerwell is not in this beta`, privacy/model/support/observability readiness copy, a 56 px `Back to Ask` CTA, and the CTA returns to `/ask` with zero horizontal overflow.
  - Current navigation evidence: 2026-07-08 system Chrome Expo web at 320 x 568 directly opens `/ask/consent`, verifies the cloud Ask deferred beta surface with a 272 x 56 `Back to Ask` CTA, then taps it and recovers to `/ask` with zero horizontal overflow and no browser errors. Evidence is in `test-results/human-e2e/2026-07-08/ask-navigation-direct-entry/`.
- Branch: exact Ask grant and withdrawal disclosure in development/staging
  - Priority: Critical
  - Automate later: Yes
  - Action: With the cloud Ask development flag enabled and a controlled authenticated staging fixture, open `/ask/consent` at 375 x 667 and 390 x 844. Before turning the switch on, read the complete canonical grant text; after an authoritative successful grant, read the complete canonical withdrawal text before turning it off. Retry with a failed status lookup, then direct-entry refresh. Repeat a production-mode build with the same flag and draft-blocked registry.
  - Expected result: The exact text whose UTF-8 SHA-256 is recorded is visible and accessible before each explicit switch choice; pending or failed status cannot enable the switch; a failed mutation does not flip visible state; production remains on the deferred surface while the grant copy is draft-blocked. The older pre-rebrand hash tuples remain historical database records and are never relabeled as current approval.
  - Evidence: Supported-phone screenshots, visible-text/accessibility snapshots, switch state and network/consent receipt, reload result, and production deferred-route screenshot. Source and unit tests alone are not human-simulated UI or hosted consent evidence.
  - Current status: Source candidate only. Exact migration, Edge, and mobile hash tests pass; current-revision Expo web, native, hosted, and professional review evidence remains open.
- Branch: cloud consent save or withdrawal failure
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only`, open `/ask/consent`, toggle `Enable Ask Layerwell` on, retry the grant, toggle it off, then retry the withdrawal.
  - Expected result: Failed grant and withdrawal attempts do not open a native or JavaScript dialog, do not flip the visible consent state before persistence, render persistent route-owned `Choice not saved` feedback with `role="alert"`, keep retry possible on a 320 x 568 phone viewport, clear the alert after successful retry, and show no raw backend/provider error.
  - Evidence: Screenshot sequence, dialog count, compact control geometry, route text snapshot, and browser warn/error logs.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only` verifies the switch starts off, failed grant keeps it off with route-owned `Choice not saved` alert and no JavaScript dialog, retry turns it on and clears the alert, failed withdrawal keeps it on with the same inline alert, retry turns it off and clears the alert, visible controls remain 48 px+, horizontal overflow is zero, no raw fixture/provider error appears, and current-run browser warn/error logs are empty. The first pass found the shared web `ToggleSwitch` was inert because web disabled `onPress`; `docs/e2e-bug-reports/2026-07-08-toggle-switch-web-inert.md` records the bug and fix. Evidence is in `test-results/human-e2e/2026-07-08/ask-consent-failure-current/`.
- Branch: empty shelf state
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/ask` with no shelf products stored.
  - Expected result: The advisor still renders with honest empty-state
    guidance. At zero admission it omits the conflict prompt; routine/fit
    prompts may remain when the layout has room.
  - Evidence: Screenshot.
- Branch: first available zero-admission prompt on a short phone
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/ask` at 320 x 568 and 320 x 480 with an empty shelf and zero
    admission. Confirm `Is there a conflict on my shelf?` is absent, tap the
    available routine prompt, and inspect the first conversation state without
    manually scrolling.
  - Expected result: The available routine question, deterministic badge,
    empty-shelf answer, report control, fixed composer, and disclosure footer
    remain readable; the first user message is not auto-scrolled under the
    header, and no prompt or report control peeks partially underneath the
    fixed composer. At the 320 x 430 ultra-short layout, no prompt is preferable
    to exposing the unavailable conflict prompt.
  - Evidence: Screenshot, scroll-position snapshot, and small-phone control-geometry snapshot.
  - Historical/superseded evidence: The 2026-07-07 and 2026-07-08 short-phone
    runs tapped the conflict prompt before zero-admission prompt hiding. Their
    geometry observations may be retained, but the prompt behavior is
    superseded and not current acceptance. Evidence is in
    `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/`,
    `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/`,
    and
    `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/`.
- Branch: back, refresh, relaunch, or navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Refresh `/ask`, directly open `/ask` and use the Back control, then directly open `/ask/consent` and use the deferred Back CTA.
  - Expected result: Deterministic Ask remains reachable, only the cloud consent route is deferred while the flag is off, and direct-entry Back controls return to a safe app surface instead of no-oping. Visible Ask Back, report-answer, CTA, and send controls meet the 44 pt phone touch target.
  - Evidence: Screenshot sequence and small-phone button-geometry snapshot.
  - Current local evidence: 2026-07-08 system Chrome Expo web at 320 x 568 verifies direct `/ask` renders Ask Layerwell, reload preserves the deterministic advisor, the 48 px Back control routes to `/today`, direct `/ask/consent` shows the deferred cloud surface, and its 272 x 56 `Back to Ask` CTA routes to `/ask`. Ask Back, composer, and Send controls are 48 px tall, horizontal overflow is zero in all five states, and no browser errors were recorded. Evidence is in `test-results/human-e2e/2026-07-08/ask-navigation-direct-entry/`.
- Branch: accessibility and keyboard
  - Priority: Important
  - Automate later: Yes
  - Action: Tab through prompt chips, text input, and send controls.
  - Expected result: Interactive controls have usable roles/labels, 44 pt visible touch geometry where applicable, suggested prompts and the disclosure footer do not sit underneath or clip against the fixed composer on short phones, and keyboard focus does not trap the user.
  - Evidence: UI snapshot or accessibility notes.
  - Current shortest-phone evidence: 2026-07-08 `/ask` at 320 x 480 verifies the visible prompt buttons, report control, input, and Send are 48 px or taller/wider where applicable, their center hit-tests resolve to the intended controls, and the disclosure footer remains visible without intercepting prompts. Evidence is in `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/`.

## Flow: CAT-08 Internal Catalog Operator Console

- Goal: A named operator can review catalog sources/reports without direct
  database editing, and a held product can return to serving only after current
  repair authority and independent release.
- Persona: Trained catalog triage, decision, repair-attestation, or release
  operator. Schema v1 has no console audit-reader role.
- Entry state: Separate internal-console origin; approved nonproduction project;
  nonanonymous named account; email OTP; verified TOTP; current capability grant;
  synthetic correction/source fixtures; server-authoritative incident/freeze
  admission open.
- Start screen/URL/window: `apps/catalog-operator-console/` deployment, never a
  consumer Expo route.
- Success state: The requested decision is durably audited, any required product
  hold is visible and serving-fail-closed, and the operator is shown the current
  version/next permitted step without raw database access.
- Priority: Critical.
- Automate later: Yes.
- Surface: Separate internal web console plus hosted Supabase/Edge/database.
- Evidence folder:
  `test-results/human-e2e/YYYY-MM-DD/cat08-catalog-operator-console/`
- Current evidence: Source candidate, deterministic tests, and a current local
  ignored synthetic-fixture browser packet at
  `test-results/human-e2e/2026-07-25/cat08-catalog-operator-console-current/`.
  It visually covers email OTP -> `aal1` -> TOTP -> `aal2`, invalid TOTP,
  claim-before-detail screens, a displayed optimistic conflict, a later
  correction-success screen, hold-release/empty screens, source
  acknowledgement, sign-out, and 375 x 667 plus 430 x 932 production-preview
  layouts. The screenshots predate deeper fixture-authority hardening and are
  not exact-source-bound browser evidence. They do not prove backend auth
  ordering or token binding, live claim/version enforcement, conflict-to-
  reclaim linkage, independent release against a current repair, durable source
  state, or server-side token invalidation. A separate post-capture Node
  adversarial contract passes those synthetic fixture checks, but the browser
  flow was not rerun against that exact source. This packet therefore remains
  fixture-only visual evidence, is not current governed acceptance evidence,
  and covers only a subset of the required branches below. No hosted, real-MFA,
  named-operator human-simulated evidence exists. The candidate still lacks a
  verified named-operator/build/capability display and server-authoritative
  incident/freeze state, so this acceptance flow is not currently executable
  end to end.

### Required paths and branches

1. **Admission and denial.** Enter a named email, complete OTP and verified TOTP,
   start the operator session, then repeat with anonymous, `aal1`, unverified-
   factor, revoked/stale Auth session, expired grant, wrong capability, expired
   ten-minute work session, and direct URL states. Only the exact live authority
   reaches a queue; every denial clears sensitive state and offers a safe
   reauthentication path. Verify the surface displays the authenticated named
   operator, exact effective capabilities, environment, deployed revision, and
   server-authoritative incident/freeze state. A client-only banner fails.
2. **Queue and claim.** Exercise empty, loading, bounded cursor next-page, error,
   five-minute claim, claim-before-detail, duplicate response-loss retry,
   expired claim, reclaim, and two-operator collision. The database clock and
   CAS version control authority; a stale client cannot read sensitive detail or
   overwrite newer work.
3. **Triage hold.** Claim an `open` correction and triage it. The console shows
   the independent hold, and barcode/search/recommendation/product/child probes
   all suppress the product. An unreviewed open report does not suppress it.
4. **Independent disposition.** A different decision operator records
   `accepted` and, in a separate fixture, `rejected`. Both leave the existing
   hold active. The triage actor cannot decide or release the same issue.
5. **Reporter erasure.** Withdraw/delete the reporter's consent/account fixture.
   Personal correction intake and ephemeral claim state disappear; the
   reporter-free product hold, served-state mutation event, and minimized
   operator audit remain. No erased field appears in UI, logs, or network
   responses.
6. **Repair and release.** Complete a synthetic non-fixture CAT-02 repair and a
   signed structurally valid staged CAT-03 successor over the active-hold
   mutation root. Reject an unchanged pre-hold projection, unresolved triaged
   correction work, stale, wrong-product, fixture, retired, pre-hold,
   missing-dependency, competing-hold, or self-authored receipts. A third person
   performs repair attestation; a fourth distinct person releases. Verify
   release advances the root and serving stays closed. CAT-03 owners must then
   review/release/activate a fresh post-release record/campaign, obtain signed
   readback, and only then see serving recover.
7. **Source/import review.** Review a catalog source/import item and record an
   immutable recommendation. Confirm the operator cannot call migration-owner
   CAT-02/CAT-03 promotion, rollback, activation, or release authority.
8. **Session and navigation.** Refresh, use browser back/forward, idle for 15
   minutes, cross the one-hour absolute client limit, expire the ten-minute
   server session, sign out, and relaunch. No operator session is restored from
   durable browser storage.
9. **Accessibility and recovery.** Complete the flow by keyboard and screen
   reader at supported desktop zoom/text settings. Verify focus order, status/
   error announcements, non-color-only state, destructive confirmation, offline
   recovery, and no reporter identity or unallowlisted report field in the
   accessibility tree. Purpose-limited correction detail is visible only after
   the live claim and must clear with that claim/session.

Required evidence includes screenshots/video, accessibility snapshot, browser
console/network logs, exact source/build/origin, redacted database/Edge
transcripts, two-session race results, serving probes, separately authorized
backend audit/erasure proof, and named reviewer signoff. This flow cannot be
marked complete with mocked UI,
source tests, or fixture-only screenshots.

## Open Questions

- What clinically reviewed interval should require a pregnancy/breastfeeding status reconfirmation, and what exact behavior should apply when that interval expires?
- When multi-device sync is funded, what transactional reconciliation contract should mirror the local V1 status without allowing a stale server row to clear a newer cautious state?
- What exact fixtures reset the app into a fresh onboarding, returning routine, empty shelf, populated shelf, empty progress, and populated progress state?
- Which flows are safe to run without live Supabase, RevenueCat, Apple, Google, Sentry, or PostHog credentials?
- Should the first durable native mobile E2E suite use Detox, Maestro, native XCTest/XCUIAutomation, Android UI Automator, or another harness?
- Which Expo web routes should graduate from human-simulated evidence plus `e2e:human:manifest` into a committed Playwright suite after dependency approval?
- Where should long-lived release evidence live: `test-results/human-e2e/`, phase-specific docs folders, or both?
