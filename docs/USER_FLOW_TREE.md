# User Flow Tree

This file maps human-simulated E2E branches for OnSkin. Update it before testing a UI feature. Cover Critical branches first, then Important, then Nice.

## Surface Inventory

- Primary surface: Expo React Native mobile app in `apps/mobile`.
- Primary commands:
  - `npm --workspace apps/mobile run ios`
  - `npm --workspace apps/mobile run android`
  - `npm --workspace apps/mobile run start`
- Secondary web command: `npm --workspace apps/mobile run web`
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/`
- Durable E2E harness: Open Question.

## Known App Areas From Route Inspection

- Onboarding: age, account, consent, goals, notifications, products, quiz, analyzing, reveal, paywall.
- Tabs: Today, Shelf, Progress, You.
- Shelf flows: search, scan, OCR, no match, manual add, opened date, replenish, archive, product detail.
- Progress flows: photo capture/review, timeline, progress detail.
- Settings/account flows: subscription, timing, privacy/local data, account actions.
- Growth and sharing flows: share cards and conflict screens.
- Trend, community, commerce, and Ask surfaces.

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

### Branches

- Branch: smallest supported phone width
  - Priority: Critical
  - Automate later: Yes
  - Action: Render the tab bar at 320 px and 390 px wide phone viewports.
  - Expected result: Today, Progress, Shelf, and You labels render on one line inside the floating bar, with no clipped glyphs, no text overlap, and at least 44 pt tap targets.
  - Evidence: Phone-width screenshots and DOM/native geometry snapshot.
  - Current local evidence: 2026-07-07 Chrome CDP Expo web screenshots and geometry snapshots at 320 x 568 and 390 x 568 show Today, Progress, Shelf, and You labels inside their tab bounds, all tab targets at least 54 px tall, tab widths 75.5 px at 320 and 93 px at 390, and no horizontal overflow.
  - Current polish evidence: 2026-07-08 headless Chrome screenshots confirm the Wealthsimple-style white floating bar remains readable while PM Today now keeps the surrounding bottom clearance dark instead of showing a light slab.
- Branch: content clearance beneath floating tab bar
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Today at 320 px and 390 px phone viewports with the contextual SPF prompt visible.
  - Expected result: No visible CTA, prompt control, or inactive locked-paywall compliance control sits partially underneath the floating tab bar; controls either sit fully above the bar or require a deliberate scroll into view.
  - Evidence: Phone-width screenshots, hit-test snapshot, and control geometry.
  - Current local evidence: 2026-07-07 Chrome CDP Expo web checked `/today`, `/progress`, `/shelf`, and `/you` at 320 x 568 and 390 x 568; the DOM geometry snapshot found no non-tab visible controls intersecting the floating tab-bar zone.
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
  - Current local status: Not locally verified in desktop Chrome because it does not emit native React Native `Keyboard` show/hide events for the floating tab bar. Source contracts still cover `Keyboard.addListener` and `tabBarHideOnKeyboard`; native simulator/device keyboard and text-scale QA remain open.

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

### Path A: Happy Path

1. Action: Launch the app, proceed through age, consent, goals, quiz/products, notifications, analyzing, reveal, and account/paywall steps using safe local choices.
   Expected result: Each step advances intentionally, copy stays within approved claims, and the final state is clear.
   Evidence: Screenshot or video of each major transition plus terminal/simulator logs.

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
- Branch: consent declined
  - Priority: Critical
  - Automate later: Yes
  - Action: Decline health-data collection consent before the quiz.
  - Expected result: Consent remains unbundled and voluntary; the app does not enter the health-data quiz, records the decline best-effort, and explains that the personalized quiz stays locked unless the user agrees.
  - Evidence: Screenshot and state notes.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 opens `/onboarding/consent`, taps `I don't agree`, shows `No consent recorded` plus the personalized-quiz-locked explanation, keeps the route on consent, and direct `/onboarding/quiz` after the decline recovers to consent without rendering quiz questions.
- Branch: direct quiz entry without health-data consent
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/onboarding/quiz` directly with no local health-data collection grant, then refresh the route.
  - Expected result: The quiz questions do not render; the app recovers to `/onboarding/consent` so health-data collection remains unbundled and explicit before quiz access.
  - Evidence: Screenshot, route snapshot, and browser console logs.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 direct `/onboarding/quiz` with a clean local context redirects to `/onboarding/consent`, does not render the first quiz question before consent, stays on consent after refresh, then opens `/onboarding/quiz` with the first question only after `I agree. Continue`; all checked states have zero horizontal overflow and no visible sub-44 px controls.
- Branch: notification permission denied
  - Priority: Important
  - Automate later: Yes
  - Action: Deny notification permission or skip notification setup.
  - Expected result: User can continue without pressure, and routine reminder preferences remain off instead of later appearing enabled.
  - Evidence: Screenshot or simulator permission state.
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
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web confirms `/onboarding/products` at 320 px renders the compact collapsed category selector with zero horizontal overflow, a 54 px product-name input, a 50 px `Choose product category` control, and a 56 px footer action in `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-safe-area/`. Source contracts now verify the picker sheet uses native bottom-inset padding when present, caps height at viewport minus a 44 px dismiss reserve, exposes modal-dialog semantics on web, and keeps category chips inside a shrinkable scroll view. Browser modal-open and screenshot evidence could not be captured because the in-app browser timed out; native iOS/Android safe-area and screen-reader QA remain open.
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
- Branch: real profile label
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan` with a saved profile whose sensitivity is neutral or resistant.
  - Expected result: The label reflects that profile state rather than hardcoding `dry, sensitive skin`.
  - Evidence: Screenshot and local profile fixture snapshot.
- Branch: direct-entry back recovery
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/routine/plan` directly and use the visible Back control.
  - Expected result: The user returns to the You tab instead of staying trapped on the plan route.
  - Evidence: Screenshot sequence and route snapshot.
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
- Branch: sparse shelf without night actives
  - Priority: Critical
  - Automate later: Yes
  - Action: Add only a daytime product such as `Mineral SPF 50`, open `/routine/plan`, inspect the evening card, tap `Start today`, and inspect Today if the local clock lands on PM.
  - Expected result: The plan remains labeled as built from the user's shelf, the morning card includes the daytime product, and the plan/Today PM evening states do not claim `skin cycling`, `Recover`, or `ceramide only` until a real night active or barrier product exists.
  - Evidence: Phone screenshot, visible-text snapshot, local shelf state, and Today route snapshot when tested in PM.
  - Current local evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 removes the night actives from the same onboarding shelf so only `Mineral SPF 50` remains, then verifies `/routine/plan` stays labeled `BUILT FROM YOUR SHELF`, shows Morning `Mineral SPF 50`, renders `EVENING` with `No night steps yet.`, and contains no skin-cycling, `Recover`, retinol, or glycolic copy. `Start today` lands on the PM Today empty evening state without stale cycle or night-active copy and with zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-07/routine-front-label-products-current/`.

## Flow: Runtime Brand Identity Smoke

- Goal: A user sees one coherent public app identity across high-visibility runtime surfaces.
- Persona: New or returning user using a build configured with the working rebrand candidate.
- Entry state: Local Expo web build with `EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind` and `EXPO_PUBLIC_APP_SCHEME=routinekind`.
- Start screen/URL/window: Direct routes `/ask`, `/paywall/upsell?feature=full_routine`, and `/settings/subscription`.
- Success state: High-visibility Ask, Pro, subscription, and public-card copy use `RoutineKind` through runtime configuration; old public `OnSkin` copy is absent from the checked surfaces.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web smoke; iOS and Android after final native identifiers are cleared.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/runtime-brand-identity/`
- Current local evidence: `test-results/human-e2e/2026-07-07/runtime-brand-identity/`

### Path A: Configured Runtime Copy

1. Action: Start Expo web with the working public display name, open `/ask`, `/paywall/upsell?feature=full_routine`, and `/settings/subscription`, then inspect visible page copy.
   Expected result: `/ask` renders `Ask RoutineKind`; the paywall/subscription surfaces render `RoutineKind Pro`; no checked surface displays old public `OnSkin` labels.
   Evidence: Screenshots, visible-text snapshots, and browser console logs. Current local evidence: 2026-07-07 Expo web at 320 x 568 renders `Ask RoutineKind`, `Part of RoutineKind Pro.`, and `RoutineKind Pro` in subscription settings, with zero visible `OnSkin` labels and no browser console errors. This does not close final brand/legal clearance or native identifier QA.

### Branches

- Branch: share-card placeholder identity
  - Priority: Important
  - Automate later: Yes
  - Action: Inspect the runtime share-card constants without a final brand domain.
  - Expected result: The card watermark uses `RoutineKind`, the URL fallback uses a reserved `.example` domain, and the deep link uses the configured public scheme.
  - Evidence: Unit test output and source snapshot.
- Branch: public-copy sweep smoke
  - Priority: Critical
  - Automate later: Yes
  - Action: Start Expo web with the working public display name, open `/onboarding/age`, `/s/[shareId]`, `/shelf/search`, `/settings/timing`, and the local reverse-trial path before `/routine/widgets`.
  - Expected result: Visible public copy on age gate, share landing, catalog search, and timing lock-screen preview uses `RoutineKind` and does not show legacy `OnSkin`; widgets route remains the existing native-widget deferred surface until device QA enables it.
  - Evidence: Phone-width screenshots, visible-text snapshots, local reverse-trial route snapshot, and browser console logs.
- Branch: Phase 8 public-site identity smoke
  - Priority: Critical
  - Automate later: Yes
  - Action: Serve `docs/phase-8/public-site` locally, open `index.html`, `share.html`, `support.html`, and `waitlist.html` at phone width, and inspect titles plus visible copy.
  - Expected result: The static launch pages use `RoutineKind`, show no legacy `OnSkin`, preserve the no-score/not-medical-advice boundaries, and keep final app association IDs as placeholders until store-console identity is cleared.
  - Evidence: Phone-width screenshots, visible-text snapshots, static-server transcript, and brand audit output.

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

### Path A: Happy Path

1. Action: Open Today, review routine steps, complete a step, undo it, complete it again, and verify the completed state.
   Expected result: Completion is responsive, visually clear, and persists after navigation away and back. The first check-off activation event can fire only once, including after undo/recheck or legacy completion logs. Routine product names remain readable without visual ellipses for normal shelf names, and routine instruction lines remain complete or use concise display copy on compact phones. When a streak is visible, the Today streak/adherence pill shows singular/plural copy correctly, remains a buffered 48 px phone target, and opens the adherence surface, or its contextual Pro gate for free users.
   Evidence: Screenshot before completion, after completion, after undo, after re-completion, and after navigation or reload.

### Branches

- Branch: empty routine
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Today with no routine fixture.
  - Expected result: Empty state gives a clear next action and does not look broken.
  - Evidence: Screenshot.
- Branch: offline or sync pending
  - Priority: Important
  - Automate later: Yes
  - Action: Complete a step with network disabled or sync unavailable if supported locally.
  - Expected result: Local completion is preserved and sync state is honest.
  - Evidence: Screenshot and logs.
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
- Branch: local date and clock display
  - Priority: Important
  - Automate later: Yes
  - Action: Open Today in the evening routine state.
  - Expected result: The header uses the current local date and clock time, never a static design-placeholder time.
  - Evidence: Screenshot and visible-text snapshot.

## Flow: Shelf Product Add

- Goal: A user can add or find a skincare product and understand any match/conflict result.
- Persona: User building their shelf.
- Entry state: User has completed onboarding or has a seeded account/local state.
- Start screen/URL/window: Shelf tab.
- Success state: Product is added, or the user receives a clear no-match/manual-add path.
- Priority: Critical
- Automate later: Yes
- Surface: iOS and Android first because camera/OCR may be native-only.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/shelf/`
- Current local evidence: `test-results/human-e2e/2026-07-07/shelf-product-detail-routine-role-current/`
- Current local evidence: `test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/`
- Current local evidence: `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/`

### Path A: Happy Path

1. Action: Open Shelf, search for a known fixture product, select it, and confirm the detail/shelf state.
   Expected result: Search results are understandable, the catalog search input and Search action stay inside narrow phone viewports, the shelf state updates without unsafe recommendation claims, and a real-product shelf exposes a clear Build my routine handoff into `/routine/plan`.
   Evidence: Screenshots of search, selection, and final shelf state.

### Branches

- Branch: product detail routine role
  - Priority: Critical
  - Automate later: Yes
  - Action: Open a real product detail from Shelf, inspect the routine role card, and tap its routine action.
  - Expected result: The detail hub explains whether the product is already used in the generated routine or is not placed yet, and the routine action routes to `/routine/plan` without leaving the user at an inventory dead end.
  - Evidence: Product detail screenshot, visible-text snapshot, and routine-plan destination snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 opens `Mineral SPF 50` from Shelf, shows `ROUTINE ROLE` with `Used in your Morning routine`, exposes the `Review routine placement` action, and routes to `/routine/plan` with zero horizontal overflow.
- Branch: no search result
  - Priority: Critical
  - Automate later: Yes
  - Action: Search for a product that should not match.
  - Expected result: No-match state offers manual add or safe next steps.
  - Evidence: Screenshot.
- Branch: empty Shelf compact phone overflow
  - Priority: Important
  - Automate later: Yes
  - Action: Open the empty Shelf tab at a 320 px phone width.
  - Expected result: The empty-state bottle illustration, headline, helper copy, Scan a barcode action, Add by hand
    action, and floating tab bar stay within the viewport with no horizontal page overflow or side-scroll.
  - Evidence: 320 px screenshot and overflow geometry snapshot.
- Branch: manual category picker on short phones
  - Priority: Important
  - Automate later: Yes
  - Action: Open Shelf manual add in a 320 px phone viewport, enter product and brand, open the category picker, scroll through all category options, and select the lower "Something else" option.
  - Expected result: The category picker opens as a named bottom sheet instead of an inline list, category rows remain at least 48 px targets, lower options are reachable by scroll, visible option taps are not intercepted by the fixed Continue footer, and the collapsed category field stays polished on compact phones.
  - Evidence: Screenshot sequence and hit-test geometry.
  - Current local evidence: 2026-07-07 in-app browser E2E at 320 x 568 opens `/shelf/manual`, enters `Barrier Balm` / `RoutineKind Test`, opens the category picker, scrolls the modal sheet to `Something else`, verifies the row is visible and center-tappable, selects it, confirms the collapsed field reads `Other`, and continues to `/shelf/opened` with zero horizontal overflow and no clipped or sub-44 px visible controls.
  - 2026-07-08 safe-area follow-up: Source contracts now require the route-local sheet to own its viewport height, reserve 44 px outside-dismiss space, add native bottom-inset padding only when present, and expose web dialog semantics. Codex in-app browser confirmed the compact collapsed route at 320 px with zero horizontal overflow and 50+ px visible controls, but browser input dispatch failed before modal-open recapture; native iOS/Android safe-area and accessibility traversal remain open QA.
- Branch: barcode no-match or offline lookup
  - Priority: Critical
  - Automate later: Yes
  - Action: Scan a barcode that returns no catalog match, an external candidate, or an offline/failed lookup.
  - Expected result: The scan sheet never dead-ends; it shows a matched candidate, no-match copy, or manual/search/OCR fallbacks, logs the owner-scoped `shelf_scans` outcome when Supabase is available, and tracks only privacy-safe scan-funnel metadata.
  - Evidence: Screenshot, console/network or Supabase/mock insert evidence, and analytics payload assertion.
- Branch: camera permission denied
  - Priority: Important
  - Automate later: Yes
  - Action: Attempt scan/OCR with camera permission denied.
  - Expected result: The app shows a clear recovery path, including Open settings when the OS will not prompt again; if Settings cannot open, the app shows a stable unavailable alert instead of appearing inert.
  - Evidence: Screenshot, alert text, and simulator permission state.
- Branch: camera start or label capture failure
  - Priority: Important
  - Automate later: Yes
  - Action: Open Shelf OCR on a device where the camera cannot start, or force the label photo capture call to reject.
  - Expected result: The user sees stable camera-unavailable or label-not-captured copy and can continue with manual ingredient text instead of being returned to an unexplained camera state. On short phones, the manual review text area and final Continue action do not overlap.
  - Evidence: Alert text, visible fallback state, and route snapshot.
- Branch: opened date or replenish edge case
  - Priority: Important
  - Automate later: Yes
  - Action: Set an opened date or replenish state at a boundary date.
  - Expected result: The app explains expiration/replenish status clearly, and the opened-date sheet shows all three core opened-state choices without clipping on short phones before the user scrolls to PAO or save actions.
  - Evidence: Screenshot.
- Branch: active shelf empty with archive history
  - Priority: Critical
  - Automate later: Yes
  - Action: Add one product, mark it finished or discarded, then return to the Shelf tab with no active products.
  - Expected result: The empty Shelf still exposes a `View archive` action with the archived count, the action meets the 44 pt phone touch target, and tapping it opens the archive with the finished/discarded product visible.
  - Evidence: Screenshot sequence, visible route snapshot, and touch target measurement.
- Branch: direct-entry back or close navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/shelf/add` (compatibility alias to `/shelf/manual`), `/shelf/search`, `/shelf/ocr`, `/shelf/no-match`, `/shelf/opened`, `/shelf/archive`, `/shelf/[id]`, and `/shelf/replenish` directly, including stale `/shelf/replenish?id=[missing]`, then use the visible Back, Close, Cancel, Not now, Back to Shelf, Add a product, or backdrop Dismiss control.
  - Expected result: The user returns to the Shelf tab instead of getting stuck on a direct-entry screen or modal sheet with no navigation history. `/shelf/add` must open the manual-add intake instead of being captured by the dynamic product-detail route. Stale `/shelf/[id]` entries must explain that the product is unavailable and provide `Back to Shelf` plus `Add a product` recovery actions. Stale `/shelf/replenish` entries must explain that the replacement prompt is no longer active, avoid reusing freshness or shopping prompts, and provide `Back to Shelf` plus `Add a product`. Direct `/shelf/opened` without an intake draft must recover to manual add instead of saving a generic product. Visible route exits meet the 44 pt phone touch target, `/shelf/search` keeps its manual fallback buffered above the phone bottom edge, add/replenish sheets keep their actions reachable by scrolling on short phones, and sheets that can fill the viewport expose a visible Close control and dialog semantics instead of relying on a tiny backdrop.
  - Evidence: Screenshot sequence, visible route snapshot, and small-phone touch target measurements.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 and 390 x 568 covers direct `/shelf/add`, `/shelf/manual`, `/shelf/search`, `/shelf/ocr`, `/shelf/scan`, `/shelf/no-match`, `/shelf/opened`, `/shelf/archive`, stale `/shelf/[id]`, and stale `/shelf/replenish`. `/shelf/search` keeps the 56 px `Add by hand` fallback 32 px above the bottom edge, recovery clicks route to `/shelf/manual` or `/shelf`, every checked route has zero horizontal overflow, and focused `shelfRoutes.test.ts` route contracts pass.
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

### Path A: Happy Path

1. Action: Open Progress, add or view a progress photo using safe local fixture behavior.
   Expected result: The photo flow is clear, private by default, and does not imply diagnosis or guaranteed improvement. When the comparison surface is populated, the Photo CTA, Compare/Timeline tabs, No scores link, Side-by-side toggle, and date-change chips meet the 44 pt phone touch target without clipping on small phones.
   Evidence: Screenshots or simulator video.
   Current local evidence: 2026-07-07 Expo web 320 x 568 covers the first-photo entry and non-destructive capture-consent branch: `/progress` shows a 56 px `Take my first photo` CTA with zero horizontal overflow, `/progress/capture` shows complete local-only consent copy plus 52 px `Take photos. On device only` and 48 px `Not now` controls, and `Not now` returns to `/progress`.
   Current populated evidence: 2026-07-07 Codex in-app browser Expo web with `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated` verifies the populated Compare view after the local Pro preview, including `12 weeks · 3 photos · all on this phone`, Compare/Timeline/No scores controls, zero horizontal overflow, no sub-44 controls, one named `Choose the first photo` dialog, a named dismiss target, three contextual photo-tile labels, dismiss recovery, and a successful first-photo update to `May 12`.

### Branches

- Branch: camera/photo permission denied
  - Priority: Critical
  - Automate later: Yes
  - Action: Deny camera or photo permission.
  - Expected result: User sees a clear recovery path and no broken UI, including a visible alert if the OS Settings handoff fails.
  - Evidence: Screenshot, alert text, and permission state.
- Branch: first-use photo consent save failure
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`, open Progress capture without prior `photo_capture` consent and tap the first-use photo consent CTA.
  - Expected result: The camera does not open, the app shows stable photo-choice-not-saved copy, the consent CTA is retryable, `Not now` remains visible and tappable on a 320 x 568 phone, no camera permission prompt appears before consent is saved, and the next CTA tap consumes the one-shot failure and opens the normal permission/capture path.
  - Evidence: Failure screenshot/text, `role="alert"` copy, no pre-consent camera copy, compact button-geometry snapshot, retry into the normal permission/capture path, and browser warn/error logs.
- Branch: first-use local-only backup tradeoff
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/progress/capture` without prior `photo_capture` consent and inspect the consent gate at a compact phone size.
  - Expected result: The consent gate says photos stay on-device, no faceprint or biometric template is stored, cloud backup is a separate choice, and backup-off/lost-phone tradeoff is visible before the first capture. Capture-frame labels, shutter copy, and camera preview chrome are not rendered until photo consent is saved. The Take photos and Not now controls remain readable and tappable on a 320 x 568 phone viewport.
  - Evidence: Phone screenshot, visible-text snapshot, and 320 px button-geometry snapshot.
  - Current local evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 verifies direct `/progress/capture` renders the complete local-only consent gate with no pre-consent capture chrome, 52 px `Take photos. On device only`, 48 px `Not now`, zero horizontal overflow, and safe recovery to `/progress` after tapping `Not now`. The overlay source now adds top and bottom safe-area insets to its scroll padding; native notch/home-indicator verification remains device QA.
- Branch: camera start or photo capture failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Progress capture on a device where the camera cannot start, or force the still photo capture call to reject.
  - Expected result: The app shows stable camera-unavailable or photo-not-captured copy, keeps the timeline unchanged, and does not leave a tappable shutter that appears inert.
  - Evidence: Alert text, visible fallback state, and route snapshot.
- Branch: empty timeline
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress with no photos.
  - Expected result: Empty state gives a clear next action.
  - Evidence: Screenshot.
- Branch: contextual photo-timeline paywall on short phones
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress as a free user in a 320 px wide phone viewport.
  - Expected result: The contextual photo-timeline paywall keeps the annual price, Start free trial CTA, no-card `Explore first` CTA, Terms, Privacy, Restore, Maybe later, and floating tab bar readable and tappable with no overlaps or clipped text, including when store pricing is unavailable and the disabled-pricing reason is visible.
  - Evidence: Screenshot and 320 px geometry snapshot.
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
- Branch: biometric app-lock prompt unavailable or rejected
  - Priority: Critical
  - Automate later: Yes
  - Action: Enable app lock, open the app-wide lock overlay or the locked Progress timeline, and force the local-auth prompt to reject or become unavailable.
  - Expected result: The app stays locked, shows stable app-lock-unavailable copy only for native prompt failure, keeps user cancellation quiet, leaves the Unlock control available for retry, and uses device-neutral copy that reads correctly on iOS and Android.
  - Evidence: Alert text, route state, native auth log, and helper status assertion.

## Flow: Photo Trend Insights

- Goal: A user can review or opt into on-device "changes in your own photos" without score-like claims, silent enrollment, or direct-entry dead ends.
- Persona: Progress user deciding whether to enable optional photo trend narration.
- Entry state: User has completed onboarding; photo trend feature flag may be enabled or deferred.
- Start screen/URL/window: Progress tab, You privacy row, direct `/trend/optin`, direct `/trend/fairness`, or deferred Trend routes.
- Success state: Trend remains off by default, copy stays claim-safe and fairness-aware, and direct-entry exits recover to the photo-progress parent flow.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route recovery; iOS and Android for native photo/toggle confirmation.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/trend-routes/`
- Current local evidence: `test-results/human-e2e/2026-07-07/trend-routes-current/`

### Path A: Optional Opt-In

1. Action: Open `/trend/optin`, read the consent framing, toggle the setting on and off, open the fairness explainer, then return.
   Expected result: Consent is separate and revocable, the feature is off by default, no photo is uploaded, the opt-in switch remains a 44 pt phone target, and fairness copy avoids score or diagnostic language.
   Evidence: Screenshot sequence and local trend-consent state. Current local evidence: 2026-07-07 Expo web at 320 x 568 with `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true` and `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only` shows the opt-in switch starts off, toggles on, toggles off, exposes a reachable 48 px fairness-link row after scroll, opens `/trend/fairness`, and returns to `/trend/optin` with zero horizontal overflow and no browser errors.

### Branches

- Branch: direct-entry Trend exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/trend/optin` and `/trend/fairness` directly, then use the visible Back control. Repeat while the Trend feature flag is deferred.
  - Expected result: Direct opt-in and deferred Trend routes return to the Progress tab; the nested fairness explainer returns to `/trend/optin` instead of a no-history dead end. Visible Back controls meet the 44 pt phone touch target.
  - Evidence: Screenshot sequence and visible route snapshot.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 verifies default-gated `/trend/optin` and `/trend/fairness` render the deferred Trend surface with `Back to Progress`, and both return to `/progress`. With Trend enabled, direct `/trend/fairness` returns to `/trend/optin`, direct `/trend/optin` returns to `/progress`, and Back controls are 48 px.
- Branch: installed-base reconsent
  - Priority: Critical
  - Automate later: Yes
  - Action: Simulate a returning user with photo history but no `photo_trend_insights` consent.
  - Expected result: Trend insight stays hidden until the user explicitly opts in; no previous photo user is silently enrolled.
  - Evidence: Screenshot and local consent state.
- Branch: consent save or withdrawal failure
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only`, open `/trend/optin`, toggle the opt-in on, retry the grant, toggle it off, then retry the withdrawal.
  - Expected result: The switch is disabled while saving, keeps a usable 44 pt touch target, failed grant/revoke attempts show stable "choice not saved" copy with a persistent alert region, the compact failure state does not expose clipped secondary controls, the visible consent state refreshes after each attempt, no raw backend/provider error appears, and successful retries clear the failure state.
  - Evidence: Failure/success screenshots, `role="alert"` copy, switch geometry, visible route state after each retry, and browser warn/error logs.
- Branch: fairness floor copy
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the fairness explainer across light, unknown, and darker Monk tone fixtures.
  - Expected result: The threshold framing is equal-or-higher for darker tones, redness is not treated as the metric, and no "works for everyone" claim appears.
  - Evidence: Screenshot or visible-text snapshot.

## Flow: Pro Feature Gating

- Goal: A free user cannot reach Pro-only surfaces by direct navigation, while a Pro or reverse-trial user can.
- Persona: Free user evaluating the app, and reverse-trial/Pro user with local entitlement.
- Entry state: Fresh free app state for locked checks; Pro entitlement state for unlocked checks.
- Start screen/URL/window: Direct routes for Pro surfaces such as `/cycle/week`, nested `/cycle/*`, `/routine/widgets`, and `/progress/*`.
- Success state: Free users see a contextual paywall or safe fallback with no premium content flash; Pro users reach the intended feature surface.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route-gating parity; iOS and Android for native camera/widget behavior.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/pro-gating/`
- Current local evidence: `test-results/human-e2e/2026-07-07/pro-gating-current/`

### Path A: Direct-Link Lock

1. Action: Open each Pro-only route directly as a fresh free user.
   Expected result: The app renders the matching contextual paywall or safe fallback, not the premium screen.
   Evidence: 2026-07-07 fresh Chrome context at 320 x 568 verified direct `/routine/widgets`, `/cycle/settings`, and `/routine/plan` render the correct contextual paywalls in free state, with no premium content, zero horizontal overflow, no browser errors, and visible 48 px+ controls.

### Branches

- Branch: nested scheduler routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, and `/cycle/procedure` directly.
  - Expected result: Free users remain gated for the full scheduler route group. Reverse-trial or Pro users reach the intended scheduler surfaces; cycle settings rows read as scheduled outputs, not deferred drag-and-drop controls.
  - Evidence: 2026-07-07 fresh Chrome context at 320 x 568 verified free `/cycle/settings` shows `Unlock your full skin-cycling scheduler.` and local reverse trial then renders `/cycle/settings` scheduler settings instead of the paywall. Other nested scheduler routes remain covered by route contracts, not fresh UI screenshots.
- Branch: full routine intelligence routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan`, `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, and `/routine/adaptation` directly.
  - Expected result: Free users see the full-routine contextual paywall, not the routine builder, sequencing, ramp, tolerance, or adaptation screen. First-time free users can choose the no-card `Explore first` path from that paywall; lapsed entitlement users remain on the paid re-offer path.
  - Evidence: 2026-07-07 fresh Chrome context at 320 x 568 verified free `/routine/plan` shows `Unlock your full routine.`, `Explore first. 7 days of Pro`, and no routine-plan content; tapping Explore first starts the local reverse trial and renders the routine plan. Other routine intelligence routes remain covered by route contracts, not fresh UI screenshots.
- Branch: reminders, streaks, and widgets routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/streak`, `/routine/welcome-back`, and `/routine/widgets` directly.
  - Expected result: Free users see the reminders/widgets contextual paywall, not the streak or widget surface.
  - Evidence: 2026-07-07 fresh Chrome context at 320 x 568 verified free `/routine/widgets` shows `Reminders, streaks & home-screen widgets.` contextual paywall; after local reverse trial, `/routine/widgets` reaches the widget deferred surface with `Back to Today` instead of the paywall. Streak/welcome-back remain covered by route contracts, not fresh UI screenshots.
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
- Branch: store pricing loading or unavailable
  - Priority: Important
  - Automate later: Yes
  - Action: Open onboarding, contextual, and lifecycle paywalls before RevenueCat pricing is available, or with the local development fallback.
  - Expected result: The price area uses approved fallback labels while loading and a clear unavailable state when pricing truly fails; lifecycle purchase actions such as paid-expiry renewal explain why the action is disabled; it must never render `Unavailable` as if it were the billed amount, and visible fallback copy must not expose infrastructure names, package setup detail, or production-build diagnostics.
  - Evidence: Screenshot and visible-text snapshot.
  - Current local evidence: 2026-07-07 in-app browser E2E at 320 x 568 verifies Progress, `/routine/plan`, `/onboarding/paywall`, and `/paywall/upsell?feature=full_routine` keep the monthly equivalent on a one-line `$4.16/mo` label instead of a cramped `$4.16 /mo` split, preserve the annual amount as the most conspicuous price, keep zero horizontal overflow, and expose no sub-44 px visible controls. Evidence is in `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/`.
- Branch: purchase success compact-phone confirmation
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/paywall/success` after a trial start or paid purchase on a 320 px wide phone viewport.
  - Expected result: The success badge renders a clean checkmark, the title and renewal terms are readable, the renewal metadata does not orphan `yr` onto its own line, and the Today CTA remains visible with a clear bottom buffer.
  - Evidence: 2026-07-07 fresh Chrome context at 320 x 568 after local reverse trial verified `/paywall/success` renders a clean checkmark, readable title/body, contained renewal metadata, and a visible 56 px `See tonight's routine` CTA with zero horizontal overflow.
- Branch: policy and billing link handoff failure
  - Priority: Important
  - Automate later: Yes
  - Action: Tap Terms, Privacy, Restore, and Manage subscription while the OS/browser cannot open external URLs.
  - Expected result: Policy and billing links show a clear unavailable alert instead of silently doing nothing; Restore still reports success/failure through the purchase state.
  - Evidence: Alert text and visible route snapshot.
- Branch: Pro entitlement state
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the same routes with an active Pro or reverse-trial entitlement.
  - Expected result: The intended Pro surface renders and remains usable.
  - Evidence: 2026-07-07 fresh Chrome context at 320 x 568 verified local reverse-trial entitlement unlocks `/routine/plan`, unlocks `/cycle/settings`, and routes `/routine/widgets` to the widget deferred surface rather than the reminders/widgets paywall.
- Branch: unreviewed cycle-cadence production gate
  - Priority: Critical
  - Automate later: Yes
  - Action: With an active Pro or reverse-trial entitlement in a non-dev build while routine cadence review is still closed, open `/cycle/week`, `/cycle/settings`, and `/cycle/why-tonight` directly.
  - Expected result: Cycle week, settings, and explainability surfaces show review-gate copy, keep the daily AM/PM routine available, hide cadence-specific controls or pause/recovery banners, and do not promise that adding an active will build a cycle until dermatologist and cosmetic-chemist review opens the gate.
  - Evidence: Route screenshots or UI snapshots plus the cadence-gate contract test output.
- Branch: Pro direct-entry route exits
  - Priority: Important
  - Automate later: Yes
  - Action: With an active Pro or reverse-trial entitlement, open scheduler and routine routes such as `/cycle/week`, `/cycle/why-tonight`, `/routine/reorder`, `/routine/tolerance`, and `/routine/widgets` directly, then use the visible Back, Done, Got it, Skip, Dismiss, Not yet, or sheet backdrop Dismiss control.
  - Expected result: The user returns to the Today tab instead of being trapped on a direct-entry Pro surface or modal sheet with no navigation history. Deferred widget routes use a destination-specific `Back to Today` CTA instead of generic Back copy. Visible Pro route exits and the Widgets Live Activity opt-in switch meet the 44 pt phone touch target, empty Pro states still expose an exit, `/routine/welcome-back` keeps its primary action fully visible with a rendered bottom buffer on short phones, projected cycle-night rows open the selected night's explainability sheet instead of an inert haptic-only button, projected row labels and settings active-night labels use wrapped, user-facing cycle-night copy such as `Night 1`, `Night 2`, and `Nights 3-4` instead of terse or impossible row numbers such as `N0`, `N5`, or `N3-4`, repeated retinoid or repeated exfoliant-slot nights are separated by recovery instead of appearing back-to-back, cycle safety/fallback notes render as readable text instead of inert buttons, phased-introduction cycle notes are the only tappable note CTA and meet the 44 pt phone touch target, and modal Pro sheets remain scrollable on short phones.
  - Evidence: Screenshot sequence, visible route snapshot, cycle-night spacing snapshot, and small-phone button-geometry snapshot.
  - Current cycle-label evidence (2026-07-07): In-app browser E2E at 320 x 568 with local reverse trial and two shelf actives reproduced terse `/cycle/week` and `/cycle/settings` labels (`N1`, `N2`, etc.), then verified the fix. Post-fix `/cycle/week` and `/cycle/settings` render `Night 1`, `Night 2`, etc., contain no `N#` visible labels, keep zero horizontal overflow, and expose no clipped or sub-44 px visible controls. Evidence is in `test-results/human-e2e/2026-07-07/cycle-night-labels-current/`.
  - Current shared-sheet evidence (2026-07-07): Codex in-app browser Expo web at 320 x 568 verifies direct `/cycle/disruption` renders one compact modal dialog with all four disruption choices, zero horizontal overflow, no sub-44 exposed controls, a non-focusable hidden backdrop, and the intended compact 24 px web bottom padding after the shared `Sheet` safe-area hardening.
- Branch: back, refresh, relaunch, or navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Refresh the browser, navigate away and back on a locked direct route, or directly open `/paywall/upsell?feature=full_routine` and `/paywall/winback`.
  - Expected result: Gating stays stable and dismissing a direct-entry paywall returns to a safe app surface, not a blank or dead-end history state. On short phones, paywall bodies scroll above fixed actions, Terms/Privacy/Restore and decline controls meet the 44 pt touch target with a rendered buffer, the win-back fallback reason stays readable above its current-plan CTA when a native offer is unavailable, and the contextual upsell exposes a real visible dismiss action instead of relying on a tiny scrim-only target.
  - Evidence: Screenshot sequence plus 320 px button-geometry snapshot.
  - Current evidence (2026-07-07): `/paywall/upsell?feature=reminders_widgets` at 320 x 568 in `test-results/human-e2e/2026-07-07/paywall-upsell-reminders-compact/` verifies zero horizontal overflow, no clipped elements, 48 px+ visible controls, readable fallback store copy, and `Maybe later` recovery to `/today`.
  - Current monthly-price evidence (2026-07-07): `/paywall/upsell?feature=full_routine` at 320 x 568 in `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/` verifies the upsell sheet renders `$4.16/mo` on one readable line, with zero horizontal overflow and no sub-44 px visible controls.
  - Current lifecycle evidence (2026-07-07): `/paywall/reoffer` and `/paywall/downgrade` at 320 x 568 and 390 x 568 in `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/` verify Terms/Privacy/Restore can scroll above fixed footer actions with 48 px controls, the decline actions keep a 32 px bottom buffer, unavailable-store copy stays readable, no visible controls clip or fall below 44 px, and `Continue on free` / `Keep using free` recover to `/today`.
- Branch: accessibility and keyboard
  - Priority: Important
  - Automate later: Yes
  - Action: Inspect focusable controls and use keyboard activation on the paywall actions.
  - Expected result: Controls have roles, labels, and visible feedback without trapping focus.
  - Evidence: UI snapshot or accessibility notes.

## Flow: Personalized Recommendations

- Goal: A user can review independent For You recommendations, tune recommendation preferences, and escape stale/direct recommendation links without getting trapped.
- Persona: Returning user deciding what to add, replace, or skip.
- Entry state: User has completed onboarding or has seeded profile/shelf/routine state.
- Start screen/URL/window: You tab, Today recommendation teaser, or direct recommendation routes.
- Success state: Recommendations remain calm and explainable, and direct-entry recommendation screens recover to the correct parent surface.
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

### Path A: For You Hub

1. Action: Open `/recommendations`, inspect grouped suggestions or the "you're set" state, then open Preferences and return.
   Expected result: The hub is advisory, not storefront-like, and preferences return to the For You hub.
   Evidence: Screenshot sequence and visible route snapshot.

### Branches

- Branch: Today recommendation teaser and SPF gap prompt
  - Priority: Important
  - Automate later: Yes
  - Action: Open Today with a shelf/profile state that produces an SPF gap, inspect the inline prompt, then tap See why or dismiss it.
  - Expected result: The prompt stays advisory and dismissible, the visible close, See why, and Not now controls meet the 44 pt phone touch target, and no text or action overflows on a 320 px phone.
  - Evidence: Small-phone screenshot, button-geometry snapshot, and local dismissed recommendation state when dismissing.
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
- Branch: stale recommendation detail
  - Priority: Important
  - Automate later: Yes
  - Action: Open a recommendation detail ID that is no longer present after shelf/profile changes.
  - Expected result: The app explains the suggestion is no longer current and provides a working Back to For you path.
  - Evidence: Screenshot and route snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 direct `/recommendations/stale-local-rec` shows the stale suggestion copy, exposes a 48 px `Back to For you` action, returns to `/recommendations`, and has zero horizontal overflow.
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
- Branch: compact recommendation budget and texture preferences
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations/preferences` on 320 x 568 and 390 x 568 phone viewports and inspect the Drugstore, Mid-range, Premium, Gel, Cream, Fluid, Balm, and Oil chips.
  - Expected result: Budget chips remain on one row, texture chips do not peek or clip at the viewport edge, labels are fully visible without clipping or overflow, and each chip remains at least 44 pt in both dimensions.
  - Evidence: Phone-width screenshots, chip geometry snapshots, and visible-text snapshots.
  - Current local evidence: 2026-07-07 Expo web in `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/` shows `Drugstore`, `Mid-range`, and `Premium` on one row at 320 x 568 with a 34 px bottom buffer, shows all five texture chips fully visible in one row at 390 x 568 with a 32 px bottom buffer, keeps all checked chips 48 px or taller/wider, and has zero horizontal overflow.
- Branch: recommendation preference save failure
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations/preferences`, tap a value, budget, or texture chip while forcing local private preference persistence to reject.
  - Expected result: Chips are disabled while saving, the new state is applied only after persistence succeeds, failures show stable copy, and the For You hub does not recompute from an unsaved preference.
  - Evidence: Alert text, disabled chip state, and local preference state.

## Flow: Commerce Trust And Shoppable Routines

- Goal: A user can inspect where-to-buy transparency, manage commerce consent, and browse shoppable routines without getting trapped on trust-critical direct-entry surfaces.
- Persona: Returning user reviewing commerce independence before tapping a paid link or browsing a curated routine.
- Entry state: User has completed onboarding; commerce feature flag may be enabled or deferred.
- Start screen/URL/window: You tab, For You recommendation detail, stack list, stack detail, transparency page, consent sheet, or direct commerce routes.
- Success state: Commerce remains secondary to recommendations, disclosures are visible, consent stays separate and revocable, and direct-entry commerce exits recover to the correct parent surface.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route recovery; iOS and Android for native outbound-link and modal behavior.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/commerce-routes/`
- Current local evidence: `test-results/human-e2e/2026-07-07/commerce-routes-current/`

### Path A: Transparency And Consent

1. Action: Open the You tab commerce rows, open "How we stay honest", then return. Open a recommendation where-to-buy consent gate and choose Allow or Not now.
   Expected result: The transparency page explains church-and-state commerce clearly; the consent gate is separate, calm, and dismisses back to the originating surface when there is navigation history.
   Evidence: 2026-07-07 Expo web at 320 x 568 verified direct `/commerce/transparency` recovery, recommendation where-to-buy locked state with consent off, separate `/commerce/consent` sheet entry, `Not now`, `Dismiss`, `Allow where-to-buy links`, return to the originating recommendation after Allow, and catalog-blocked empty state while live links remain unavailable.

### Path B: Shoppable Routines

1. Action: Open `/commerce/stacks`, open an available stack in development, tap "How this works", and return through the visible Back controls.
   Expected result: The stack remains ordered by routine sequence, paid-link disclosure stays visible, transparency remains reachable through a 44 pt phone target, and Back returns through the stack hierarchy.
   Evidence: 2026-07-07 Expo web at 320 x 568 verified `/commerce/stacks` to `/commerce/stack/sensitive-skin-starter-set`, visible paid-link disclosure, 48 px `How stack paid links work`, `/commerce/transparency`, Back to stack detail, and Back to `/commerce/stacks` with zero horizontal overflow.

### Branches

- Branch: direct-entry commerce exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/commerce/stacks`, `/commerce/transparency`, `/commerce/consent`, and `/commerce/stack/[slug]` directly, then use the visible Back, Dismiss, Allow, Not now, or scrim control.
  - Expected result: Top-level commerce direct entries return to the You tab; stack details return to `/commerce/stacks`; deferred commerce routes also return to the You tab instead of a no-history dead end. Visible Back and Dismiss controls meet the 44 pt phone touch target, and the consent sheet keeps Dismiss reachable while its content scrolls on short phones.
  - Evidence: 2026-07-07 Expo web at 320 x 568 verified default deferred `/commerce/stacks`, `/commerce/transparency`, `/commerce/consent`, and `/commerce/stack/sensitive-skin-starter-set` return to `/you`; commerce-enabled direct `/commerce/transparency`, `/commerce/stacks`, `/commerce/consent`, and `/commerce/stack/sensitive-skin-starter-set` recover to `/you` or `/commerce/stacks` as appropriate, with 44+ px visible controls and no browser errors.
  - 2026-07-08 safe-area follow-up: With `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`, Codex in-app browser verified `/commerce/consent` at 320 px renders one named `Before we show where to buy` dialog with `aria-modal=true`, a 44 px top reserve, zero horizontal overflow, 48 x 48 Dismiss, 264 x 54 Allow, 264 x 48 Not now, and no mojibake. Source contracts now require native bottom-inset padding when present and hide the scrim from accessibility traversal; native iOS/Android safe-area and screen-reader QA remain open.
- Branch: unavailable stack
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/commerce/stack/[slug]` for a slug that is not currently shippable.
  - Expected result: The app shows a calm unavailable state, explains the stack may have been updated while disclosures or product availability are reviewed, provides a visible `Back to stacks` path to `/commerce/stacks`, and keeps `How paid links work` available without exposing retailer links.
  - Evidence: 2026-07-07 Expo web at 320 x 568 verified `/commerce/stack/missing-stack-e2e` unavailable copy, no retailer links, 56 px `Back to stacks`, 56 px `How paid links work`, recovery to `/commerce/stacks`, and transparency recovery.
- Branch: no commerce consent
  - Priority: Critical
  - Automate later: Yes
  - Action: With commerce consent off, inspect a where-to-buy block and a stack item.
  - Expected result: No paid links or retailer telemetry are exposed; the user sees the consent gate or locked state, and the Allow where-to-buy plus shelf alternative controls meet the 44 pt phone touch target.
  - Evidence: 2026-07-07 Expo web at 320 x 568 verified the recommendation where-to-buy block shows locked copy with no retailer rows, no paid-link disclosure, 48 px `Allow where-to-buy`, 50 px shelf alternative to `/shelf/manual`, and stack item taps open the separate consent sheet instead of retailer links.
- Branch: retailer link handoff failure
  - Priority: Important
  - Automate later: Yes
  - Action: With commerce consent on and a real HTTPS retailer URL available, simulate the OS refusing to open the external URL.
  - Expected result: The app shows a calm Link unavailable message, does not appear inert, and the user remains in the recommendation context.
  - Evidence: Open. The 2026-07-07 local run reaches the consent-allowed catalog-blocked empty state because source-cleared retailer links and affiliate partner rails are not approved yet.

## Flow: Skin Notes Community Trust Layer

- Goal: A user can inspect expert Skin Notes, note details, and deferred community posting routes without getting trapped or seeing social-proof patterns that overpromise.
- Persona: Returning user looking for calm, evidence-backed explanations before asking an anonymous community question.
- Entry state: User has completed onboarding; community posting may be enabled, consent-gated, or deferred.
- Start screen/URL/window: You tab Skin Notes row, direct `/community`, direct `/community/note/[id]`, direct `/community/ask`, or direct `/community/people-like-you`.
- Success state: The library stays expert-led, posting remains clearly gated or deferred, and direct-entry exits return to the right parent surface.
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

### Path B: Posting Gate

1. Action: Open `/community/ask` with posting deferred, then repeat with posting enabled but no age or consent state.
   Expected result: Deferred posting returns to the Skin Notes hub; enabled posting shows separate 16+ and consent controls, and Not now exits to the hub.
   Evidence: Screenshot sequence and local gate state.
   Current local evidence: 2026-07-07 Expo web 320 x 568 covers the default posting-deferred state for `/community/ask` and `/community/people-like-you`: both routes explain peer posting is not in beta, expose `Back to Skin Notes`, return to `/community`, and have zero horizontal overflow.

### Branches

- Branch: direct-entry Community exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/community`, `/community/note/[id]`, `/community/ask`, and `/community/people-like-you` directly, then use Back or Not now.
  - Expected result: Direct `/community` returns to the You tab; nested note, ask, people-like-you, and deferred posting surfaces return to `/community`. Deferred posting routes use a destination-specific `Back to Skin Notes` CTA instead of generic Back copy. Visible hub Back/Ask controls, nested-route Back controls, the 16+ consent checkbox, and Not now meet the 44 pt phone touch target.
  - Evidence: Screenshot sequence, visible route snapshot, and small-phone button-geometry snapshot.
  - Current local evidence: 2026-07-07 focused `communityRoutes.test.ts` route contracts pass, and Expo web 320 x 568 verifies direct `/community/ask` plus `/community/people-like-you` fallback CTAs are 100 px tall, use `Back to Skin Notes`, and route to `/community` with zero horizontal overflow.
- Branch: missing note detail
  - Priority: Important
  - Automate later: Yes
  - Action: Open a stale `/community/note/[id]` route that is no longer present.
  - Expected result: The app explains the Skin Note is unavailable, says the note may have been updated or removed during expert review, and provides a visible `Back to Skin Notes` action that returns to `/community` without relying on navigation history.
  - Evidence: Screenshot and route snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 opens a stale note route, shows `NOTE UNAVAILABLE`, explains the note may have been updated or removed during expert review, exposes a 56 px `Back to Skin Notes` CTA, and returns to `/community` with zero horizontal overflow.
- Branch: expert note share failure and outbound context
  - Priority: Important
  - Automate later: Yes
  - Action: Open a Skin Note, tap Share note, and simulate the native share sheet being unavailable or rejected.
  - Expected result: The outbound note text keeps the claim-safe disclaimer plus source/reviewer context, and a failed share sheet shows a clear Sharing unavailable alert without leaving the note.
  - Evidence: Alert text and share payload snapshot.
- Branch: claim-safe anonymous ask
  - Priority: Critical
  - Automate later: Yes
  - Action: With community posting enabled and consent granted, type claim-heavy and calm questions into the anonymous ask composer.
  - Expected result: Claim-safety copy flags risky wording as a first pass, never as an automated moderation decision, and no question is posted publicly before human review is staffed.
  - Evidence: Screenshot sequence and local moderation state.

## Flow: Shelf Conflict Checks And Share Cards

- Goal: A user can inspect conflict guidance and share reviewed conflict cards without getting stuck on direct-entry surfaces.
- Persona: User checking whether two shelf products can be used together, or sharing a reviewed shelf check.
- Entry state: User has completed onboarding or has seeded local shelf state.
- Start screen/URL/window: Shelf tab or direct conflict/share routes.
- Success state: Conflict guidance remains claim-safe, choices are saved when available, and direct-entry exits recover to the Shelf tab.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route recovery; iOS and Android for native share sheet behavior.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/conflict-routes/`
- Current local evidence: `test-results/human-e2e/2026-07-07/conflict-share-routes-current/`

### Path A: Conflict Detail

1. Action: Open a real `/conflict/[ruleId]` route from a shelf conflict, review evidence/severity copy, choose Keep alternate nights or Use together anyway, and return to Shelf.
   Expected result: The conflict copy is calm and claim-safe, shelf-only copy gives timing advice without claiming the products were already placed by a cycle, the user choice persists, and the app does not re-nag immediately.
   Evidence: 2026-07-07 fresh Chrome context at 320 x 568 seeded a real retinol/glycolic Shelf conflict, opened the detail via the Shelf `Review conflict` banner, verified calm evidence/severity/resolution copy, scrolled to the action area, tapped `Use together anyway`, returned to Shelf, and verified the conflict banner was suppressed while the products remained visible. The run decrypted local override storage and confirmed `00000000-0000-4000-8000-000000000001:e2e-glycolic+e2e-retinol` persisted. Evidence is in `test-results/human-e2e/2026-07-07/conflict-detail-choice-current/`.

### Branches

- Branch: direct-entry conflict and share exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/conflict/[ruleId]` and `/share/conflict/[ruleId]` directly, then use the visible Close, Done, Keep, or Use together control.
  - Expected result: The user returns to the Shelf tab instead of remaining on a direct-entry conflict or share-card screen with no navigation history.
  - Evidence: 2026-07-07 Expo web at 320 x 568 verified `/conflict/missing-rule-e2e` `Back to Shelf`, default `/share/conflict/missing-rule-e2e` deferred `Back to Shelf`, and share-card-enabled unshareable `Done` all return to `/shelf`, with zero horizontal overflow and no browser console errors.
- Branch: missing or unshareable conflict
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/conflict/[ruleId]` and `/share/conflict/[ruleId]` for a rule that is not present in the current shelf; use Back to Shelf from the missing detail state and the add-product escape hatch.
  - Expected result: The missing conflict detail explains that the timing note is no longer active, never reuses stale routine advice, Back to Shelf returns to `/shelf`, Add a product opens `/shelf/manual`, and the share-card fallback still returns to Shelf without exposing private shelf details.
  - Evidence: 2026-07-07 Expo web at 320 x 568 verified the missing state copy, stale-routine warning, `/shelf` recovery, `/shelf/manual` escape hatch, default share-card fallback, and enabled unshareable share-card state without private product names.
  - Current local evidence: 2026-07-08 in-app browser at 320 x 568 rechecked direct `/conflict/missing-rule-e2e` after a compact-sheet fallback fix. Pre-fix evidence captured `maxHeight: 0px` with the actions below the viewport; post-fix evidence confirms a 524 px dialog, `aria-modal`, `Timing note unavailable` accessibility label, zero horizontal overflow, no mojibake, and visible 56 px / 48 px actions. Evidence is in `test-results/human-e2e/2026-07-08/conflict-detail-safe-area/`.
- Branch: native share unavailable
  - Priority: Important
  - Automate later: Yes
  - Action: Attempt to export a reviewed share card on a surface without native sharing support.
  - Expected result: The app explains sharing is unavailable without losing the user or exposing sensitive shelf details.
  - Evidence: Screenshot or platform log.

## Flow: Settings Account Controls

- Goal: A user can manage subscription and reminder settings without getting trapped when settings routes are opened directly.
- Persona: Returning user reviewing account or reminder preferences.
- Entry state: User has completed onboarding or has seeded local account/reminder state.
- Start screen/URL/window: You tab or direct settings routes.
- Success state: Settings changes and exits are clear, and direct-entry settings screens recover to the You tab.
- Priority: Important
- Automate later: Yes
- Surface: Expo web for route recovery; iOS and Android for native subscription and notification settings behavior.
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
  - Action: Open `/settings/subscription`, `/settings/notifications`, `/settings/timing`, and `/settings/privacy` directly, then use the visible Back control where the route has its own screen.
  - Expected result: The user returns to the You tab instead of remaining on a direct-entry settings screen with no navigation history. `/settings/privacy` lands inside the You tab privacy-control surface instead of showing an unmatched-route page. Visible Back controls, You tab navigation rows and privacy/security switches, reminder timing pills/list rows, notification edit rows, and secondary subscription exits meet the 44 pt phone touch target. On compact phones, the You tab first viewport ends on complete rows with a clear buffer above the floating tab bar, and covered lower rows do not receive accidental hits until the user scrolls them into view.
  - Evidence: Screenshot sequence, visible route snapshot, and small-phone button-geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web verifies `/settings/privacy` redirects to `/you?section=privacy` at 320 x 568 and 390 x 568. The direct entry lands on complete privacy controls, leaves the `POLICIES` rows below the first viewport, has zero horizontal overflow, and has no non-tab controls in the floating tab-bar zone. Native iOS/Android rendering remains a device QA follow-up.
- Branch: active reverse-trial subscription options
  - Priority: Critical
  - Automate later: Yes
  - Action: Seed an active app-granted reverse-trial entitlement, open `/settings/subscription`, then tap the Pro options row.
  - Expected result: The screen shows the reverse-trial/free-until state, a no-card status label, and a keep-Pro options row that opens the Pro keep-options paywall. It must not open App Store or Google Play subscription management, must not imply there is a card on file, and must not show expired-trial copy while the reverse trial is still active. On compact phones, the annual price and store-unavailable reason must appear before the keep-Pro CTA, and Terms, Privacy, and Restore must remain reachable without clipped controls.
  - Evidence: Screenshot sequence, visible route snapshot, and local entitlement fixture snapshot.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 reproduced the compact keep-options bug where the CTA appeared before the annual price/store-unavailable reason, then verified the fix through `/settings/subscription` -> `Keep Pro after your week` -> `/paywall/reoffer` at 320 x 568 and 390 x 568. Post-fix state has active no-card copy, no expired-trial copy, annual price and preview-checkout reason before the CTA, zero horizontal overflow, no sub-44 px visible controls, no clipped controls, and scroll-reachable 48 px Terms/Privacy/Restore above the fixed footer. Evidence is in `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/`.
- Branch: policy link handoff failure
  - Priority: Important
  - Automate later: Yes
  - Action: Tap Privacy, Consumer Health Privacy, Terms, Support, account deletion help, or data export help while the browser cannot open the URL.
  - Expected result: The app shows a clear unavailable alert or row-local recovery message instead of swallowing the failed handoff, keeps the user on Settings, and keeps policy/help rows at least 44 px tall on compact phones.
  - Evidence: Alert text or row-local feedback, visible route snapshot, and control-geometry snapshot.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser` opens `/settings/privacy`, taps Privacy policy, Consumer health privacy, Terms, Support, Account deletion, and Data export, and verifies each failed handoff renders row-local `Link unavailable` recovery copy. All six rows are 70-94 px tall, each recovery message is 48 px tall, horizontal overflow is zero, and the route remains `/you?section=privacy`. Browser logs include expected Supabase placeholder network failures because live backend remains blocked.
- Branch: data export share unavailable
  - Priority: Critical
  - Automate later: Yes
  - Action: Tap Export my data while the OS share sheet is unavailable, cannot be detected, or rejects after the temporary JSON export is created.
  - Expected result: The app shows a clear export-unavailable alert, does not treat the export as completed for review prompting, and deletes the temporary plaintext export file.
  - Evidence: Alert text, mutation state, and cache cleanup assertion.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 verifies `/settings/privacy` resolves to `/you?section=privacy`, `Export my data` is unique, the local backend-unavailable failure renders the visible privacy-request recovery copy, visible data-rights controls are 56 px tall, horizontal overflow is zero, and focused settings action tests cover unavailable share/cache cleanup plus destructive delete/withdraw fallback behavior. Live Supabase and native share-sheet evidence remain external QA.
- Branch: reminder timing and discretion
  - Priority: Important
  - Automate later: Yes
  - Action: Open notification settings, toggle reminder tiers, edit AM/PM timing and quiet hours, then return to settings.
  - Expected result: User-set times, contextual timing-control and picker-row labels for assistive tech, 44 pt reminder-tier switches, and discreet lock-screen copy remain clear and calm, with no notification-pressure copy. Time picker sheets expose a single named modal dialog, a named dismiss action, and no unlabeled inert sheet-body controls.
  - Evidence: Screenshot sequence, local preference snapshot, and small-phone accessibility/geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 verifies `/settings/notifications` tier rows and switches, `/settings/timing` time pills, the Morning reminder time-picker sheet, AM time update from 7:30 AM to 8:00 AM, return to the notifications hub with the updated time, quiet-hours copy, generic lock-screen preview, zero horizontal overflow, and 48 px visible controls. Focused notification tests cover quiet-hours scheduling, delivery caps, lock-screen discreet copy, preference persistence, and route/touch-target contracts; native OS permission/scheduling QA remains external.
  - Current safe-area evidence: 2026-07-07 Codex in-app browser Expo web verifies the hand-built `/settings/timing` Morning picker keeps 40 px zero-inset web bottom padding, zero horizontal overflow, 48 px visible picker rows, one named dialog, and a 44 px named dismiss target in the compact observed viewport after sheet-height capping; selecting `8:00 AM` closes the modal and updates the Morning pill. Evidence is in `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/`. Native iOS/Android home-indicator and screen-reader verification remains device QA.

## Flow: Ask RoutineKind Deterministic Advisor

- Goal: A user can open the free deterministic Ask advisor without cloud consent, while unavailable cloud Ask controls stay honestly deferred.
- Persona: Free user exploring shelf/routine guidance.
- Entry state: Fresh local app state or seeded shelf state; `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=false`.
- Start screen/URL/window: Direct route `/ask`, or Today Ask teaser when available.
- Success state: `/ask` renders the Ask RoutineKind advisor surface; `/ask/consent` renders the cloud Ask deferred screen while the cloud flag is off.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route parity; iOS and Android for native app confirmation.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/ask-deterministic/`
- Current local evidence: `test-results/human-e2e/2026-07-07/ask-current-compact-advisor/`

### Path A: Deterministic Ask Opens

1. Action: Open `/ask` directly with cloud Ask disabled.
   Expected result: The Ask RoutineKind advisor renders with deterministic/free copy and suggested prompts. It must not show the cloud Ask deferred beta screen.
   The composer disclosure footer stays fully visible and legible above the bottom edge on a 320 x 568 phone.
   Evidence: Screenshot and visible-text snapshot.
   Current local evidence: 2026-07-07 Expo web 320 x 568 renders `Ask RoutineKind`, the deterministic shelf answer, a visible 48 px composer input plus 48 px Send control, the disclosure footer, and zero horizontal overflow.

### Branches

- Branch: cloud consent direct route while cloud Ask is disabled
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/ask/consent` directly with cloud Ask disabled.
  - Expected result: The route shows the cloud Ask deferred screen and does not offer a usable consent toggle for an unavailable cloud feature. Its `Back to Ask` deferred CTA returns to `/ask` on direct entry.
  - Evidence: Screenshot and visible-text snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 shows `Ask RoutineKind is not in this beta`, privacy/model/support/observability readiness copy, a 56 px `Back to Ask` CTA, and the CTA returns to `/ask` with zero horizontal overflow.
  - Current navigation evidence: 2026-07-08 system Chrome Expo web at 320 x 568 directly opens `/ask/consent`, verifies the cloud Ask deferred beta surface with a 272 x 56 `Back to Ask` CTA, then taps it and recovers to `/ask` with zero horizontal overflow and no browser errors. Evidence is in `test-results/human-e2e/2026-07-08/ask-navigation-direct-entry/`.
- Branch: empty shelf state
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/ask` with no shelf products stored.
  - Expected result: The advisor still renders with honest empty-state guidance and safe suggested prompts.
  - Evidence: Screenshot.
- Branch: first suggested prompt on a short phone
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/ask` at 320 x 568 with an empty shelf, tap `Is there a conflict on my shelf?`, and inspect the first conversation state without manually scrolling.
  - Expected result: The user question, deterministic badge, empty-shelf answer, report control, fixed composer, and disclosure footer remain readable; the first user message is not auto-scrolled under the header, and no follow-up prompt peeks partially underneath the fixed composer on compact phones.
  - Evidence: Screenshot, scroll-position snapshot, and small-phone control-geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 taps `Is there a conflict on my shelf?`, keeps the user question, deterministic `$0` badge, empty-shelf answer, report control, composer, and disclosure footer readable with zero horizontal overflow and no sub-44 px controls. The same pass typed `Should I use retinol every night?`; before the fix it misrouted to product-fit recommendation copy, and after the fix it escalates safely with no fit-engine, SPF, or vitamin-C recommendation text. Evidence is in `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/`, with additional Node REPL Playwright/system Chrome evidence in `test-results/human-e2e/2026-07-07/ask-active-frequency-escalation/`.
- Branch: back, refresh, relaunch, or navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Refresh `/ask`, directly open `/ask` and use the Back control, then directly open `/ask/consent` and use the deferred Back CTA.
  - Expected result: Deterministic Ask remains reachable, only the cloud consent route is deferred while the flag is off, and direct-entry Back controls return to a safe app surface instead of no-oping. Visible Ask Back, report-answer, CTA, and send controls meet the 44 pt phone touch target.
  - Evidence: Screenshot sequence and small-phone button-geometry snapshot.
  - Current local evidence: 2026-07-08 system Chrome Expo web at 320 x 568 verifies direct `/ask` renders Ask RoutineKind, reload preserves the deterministic advisor, the 48 px Back control routes to `/today`, direct `/ask/consent` shows the deferred cloud surface, and its 272 x 56 `Back to Ask` CTA routes to `/ask`. Ask Back, composer, and Send controls are 48 px tall, horizontal overflow is zero in all five states, and no browser errors were recorded. Evidence is in `test-results/human-e2e/2026-07-08/ask-navigation-direct-entry/`.
- Branch: accessibility and keyboard
  - Priority: Important
  - Automate later: Yes
  - Action: Tab through prompt chips, text input, and send controls.
  - Expected result: Interactive controls have usable roles/labels, 44 pt visible touch geometry where applicable, suggested prompts and the disclosure footer do not sit underneath or clip against the fixed composer on short phones, and keyboard focus does not trap the user.
  - Evidence: UI snapshot or accessibility notes.

## Open Questions

- What exact fixtures reset the app into a fresh onboarding, returning routine, empty shelf, populated shelf, empty progress, and populated progress state?
- Which flows are safe to run without live Supabase, RevenueCat, Apple, Google, Sentry, or PostHog credentials?
- Should the first durable mobile E2E suite use Detox, Maestro, native XCTest/XCUIAutomation, or another harness?
- Which Expo web routes are faithful enough for Playwright coverage?
- Where should long-lived release evidence live: `test-results/human-e2e/`, phase-specific docs folders, or both?
