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
- Branch: consent declined
  - Priority: Critical
  - Automate later: Yes
  - Action: Decline health-data collection consent before the quiz.
  - Expected result: Consent remains unbundled and voluntary; the app does not enter the health-data quiz, records the decline best-effort, and explains that the personalized quiz stays locked unless the user agrees.
  - Evidence: Screenshot and state notes.
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
- Branch: sensitivities multi-select exclusivity
  - Priority: Important
  - Automate later: Yes
  - Action: On the sensitivities/allergies quiz step, select `None that I know of`, then select a concrete sensitivity such as `Fragrance`; repeat in the opposite order.
  - Expected result: `None that I know of` behaves as an exclusive option and cannot remain selected with concrete sensitivities.
  - Evidence: Screenshot and UI state snapshot.
- Branch: product intake category metadata
  - Priority: Important
  - Automate later: Yes
  - Action: Add a first-run shelf product with a category such as Moisturiser or Oil / balm, then continue to the shelf/reveal path.
  - Expected result: The product is added once, the selected category uses a canonical shelf ID, and PAO/default metadata is preserved rather than degrading to unknown because of a mismatched onboarding-only category.
  - Evidence: Screenshot and local shelf state or product metadata snapshot.
- Branch: back/relaunch during onboarding
  - Priority: Important
  - Automate later: Yes
  - Action: Navigate back, background/relaunch, refresh on Expo web, or directly open `/onboarding/reveal` or `/onboarding/analyzing` without completed quiz answers.
  - Expected result: Progress is preserved or reset intentionally with no broken state; reveal/analyzing must not fabricate a default skin profile and must recover to the quiz path.
  - Evidence: Video or before/after screenshots.

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

### Path A: Happy Path

1. Action: Open Today, review routine steps, complete a step, and verify the completed state.
   Expected result: Completion is responsive, visually clear, and persists after navigation away and back.
   Evidence: Screenshot before completion, after completion, and after navigation.

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

### Path A: Happy Path

1. Action: Open Shelf, search for a known fixture product, select it, and confirm the detail/shelf state.
   Expected result: Search results are understandable and the shelf state updates without unsafe recommendation claims.
   Evidence: Screenshots of search, selection, and final shelf state.

### Branches

- Branch: no search result
  - Priority: Critical
  - Automate later: Yes
  - Action: Search for a product that should not match.
  - Expected result: No-match state offers manual add or safe next steps.
  - Evidence: Screenshot.
- Branch: camera permission denied
  - Priority: Important
  - Automate later: Yes
  - Action: Attempt scan/OCR with camera permission denied.
  - Expected result: The app shows a clear recovery path.
  - Evidence: Screenshot and simulator permission state.
- Branch: opened date or replenish edge case
  - Priority: Important
  - Automate later: Yes
  - Action: Set an opened date or replenish state at a boundary date.
  - Expected result: The app explains expiration/replenish status clearly.
  - Evidence: Screenshot.
- Branch: direct-entry back or close navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Open Shelf add, search, OCR, archive, product detail, and replenish routes directly, then use the visible Back, Close, Cancel, or Not now control.
  - Expected result: The user returns to the Shelf tab instead of getting stuck on a direct-entry screen with no navigation history.
  - Evidence: Screenshot sequence and visible route snapshot.

## Flow: Photo Progress

- Goal: A user can capture or review progress without accidental cloud exposure or misleading claims.
- Persona: User tracking skin progress.
- Entry state: User has completed onboarding and has photo consent state defined.
- Start screen/URL/window: Progress tab.
- Success state: Photo capture/review works locally and privacy expectations are explicit.
- Priority: Critical
- Automate later: Yes, after native harness is selected.
- Surface: iOS and Android.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/progress/`

### Path A: Happy Path

1. Action: Open Progress, add or view a progress photo using safe local fixture behavior.
   Expected result: The photo flow is clear, private by default, and does not imply diagnosis or guaranteed improvement.
   Evidence: Screenshots or simulator video.

### Branches

- Branch: camera/photo permission denied
  - Priority: Critical
  - Automate later: Yes
  - Action: Deny camera or photo permission.
  - Expected result: User sees a clear recovery path and no broken UI.
  - Evidence: Screenshot and permission state.
- Branch: empty timeline
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress with no photos.
  - Expected result: Empty state gives a clear next action.
  - Evidence: Screenshot.
- Branch: relaunch after adding photo
  - Priority: Important
  - Automate later: Yes
  - Action: Add a photo, relaunch, and return to Progress.
  - Expected result: Local state is preserved as designed.
  - Evidence: Video or screenshot sequence.
- Branch: direct-entry back, close, and permission escape
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress capture, review, no-score explainer, and missing photo detail routes directly, then use the visible Close, Back, or Not now control.
  - Expected result: The user returns to the Progress tab instead of being trapped on a camera, review, permission, consent, or missing-photo screen with no navigation history.
  - Evidence: Screenshot sequence and visible route snapshot.

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

### Path A: Direct-Link Lock

1. Action: Open each Pro-only route directly as a fresh free user.
   Expected result: The app renders the matching contextual paywall or safe fallback, not the premium screen.
   Evidence: Screenshot of each locked route and notes identifying the route.

### Branches

- Branch: nested scheduler routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, and `/cycle/procedure` directly.
  - Expected result: Free users remain gated for the full scheduler route group.
  - Evidence: Screenshots or UI snapshots.
- Branch: full routine intelligence routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/plan`, `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, and `/routine/adaptation` directly.
  - Expected result: Free users see the full-routine contextual paywall, not the routine builder, sequencing, ramp, tolerance, or adaptation screen.
  - Evidence: Screenshots or UI snapshots.
- Branch: reminders, streaks, and widgets routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/streak`, `/routine/welcome-back`, and `/routine/widgets` directly.
  - Expected result: Free users see the reminders/widgets contextual paywall, not the streak or widget surface.
  - Evidence: Screenshots or UI snapshots.
- Branch: conflict check quota and direct routes
  - Priority: Critical
  - Automate later: Yes
  - Action: As a fresh free user, open one conflict detail, then open a different `/conflict/[ruleId]` route directly. Repeat the route as a Pro or reverse-trial user.
  - Expected result: The first free conflict check renders the conflict detail. A second distinct conflict check shows the conflict-checks contextual paywall with no conflict-detail flash. Pro users can open the full conflict detail.
  - Evidence: Screenshots or UI snapshots.
- Branch: loading or slow entitlement state
  - Priority: Critical
  - Automate later: Yes
  - Action: Load a gated route while entitlement is still resolving.
  - Expected result: No premium content flashes before the entitlement decision.
  - Evidence: Screenshot or trace.
- Branch: store pricing loading or unavailable
  - Priority: Important
  - Automate later: Yes
  - Action: Open onboarding and contextual paywalls before RevenueCat pricing is available, or with the local development fallback.
  - Expected result: The price area uses approved fallback labels while loading and a clear unavailable state when pricing truly fails; it must never render `Unavailable` as if it were the billed amount.
  - Evidence: Screenshot and visible-text snapshot.
- Branch: Pro entitlement state
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the same routes with an active Pro or reverse-trial entitlement.
  - Expected result: The intended Pro surface renders and remains usable.
  - Evidence: Screenshot of at least one unlocked route per feature group.
- Branch: Pro direct-entry route exits
  - Priority: Important
  - Automate later: Yes
  - Action: With an active Pro or reverse-trial entitlement, open scheduler and routine routes such as `/cycle/week`, `/cycle/why-tonight`, `/routine/reorder`, `/routine/tolerance`, and `/routine/widgets` directly, then use the visible Back, Done, Got it, Skip, Dismiss, or Not yet control.
  - Expected result: The user returns to the Today tab instead of being trapped on a direct-entry Pro surface with no navigation history.
  - Evidence: Screenshot sequence and visible route snapshot.
- Branch: back, refresh, relaunch, or navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Refresh the browser, navigate away and back on a locked direct route, or directly open `/paywall/upsell?feature=full_routine` and `/paywall/winback`.
  - Expected result: Gating stays stable and dismissing a direct-entry paywall returns to a safe app surface, not a blank or dead-end history state.
  - Evidence: Screenshot sequence.
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

### Path A: For You Hub

1. Action: Open `/recommendations`, inspect grouped suggestions or the "you're set" state, then open Preferences and return.
   Expected result: The hub is advisory, not storefront-like, and preferences return to the For You hub.
   Evidence: Screenshot sequence and visible route snapshot.

### Branches

- Branch: direct-entry recommendation exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations`, `/recommendations/preferences`, and a stale `/recommendations/[id]` route directly, then use the visible Back or Back to For you control.
  - Expected result: The direct For You hub returns to the You tab; nested recommendation routes return to `/recommendations` instead of remaining on a no-history screen.
  - Evidence: Screenshot sequence and visible route snapshot.
- Branch: stale recommendation detail
  - Priority: Important
  - Automate later: Yes
  - Action: Open a recommendation detail ID that is no longer present after shelf/profile changes.
  - Expected result: The app explains the suggestion is no longer current and provides a working Back to For you path.
  - Evidence: Screenshot and route snapshot.
- Branch: recommendation accept and dismiss
  - Priority: Critical
  - Automate later: Yes
  - Action: Open a real recommendation detail, dismiss it, then open another and accept it into manual add or conflict detail.
  - Expected result: Dismissal persists, acceptance goes to the correct next step, and copy remains independent and claim-safe.
  - Evidence: Screenshot sequence and local recommendation state.

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

### Path A: Transparency And Consent

1. Action: Open the You tab commerce rows, open "How we stay honest", then return. Open a recommendation where-to-buy consent gate and choose Allow or Not now.
   Expected result: The transparency page explains church-and-state commerce clearly; the consent gate is separate, calm, and dismisses back to the originating surface when there is navigation history.
   Evidence: Screenshot sequence, route snapshot, and commerce-consent state.

### Path B: Shoppable Routines

1. Action: Open `/commerce/stacks`, open an available stack in development, tap "How this works", and return through the visible Back controls.
   Expected result: The stack remains ordered by routine sequence, paid-link disclosure stays visible, transparency remains reachable, and Back returns through the stack hierarchy.
   Evidence: Screenshot sequence and visible route snapshot.

### Branches

- Branch: direct-entry commerce exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/commerce/stacks`, `/commerce/transparency`, `/commerce/consent`, and `/commerce/stack/[slug]` directly, then use the visible Back, Dismiss, Allow, Not now, or scrim control.
  - Expected result: Top-level commerce direct entries return to the You tab; stack details return to `/commerce/stacks`; deferred commerce routes also return to the You tab instead of a no-history dead end.
  - Evidence: Screenshot sequence and visible route snapshot.
- Branch: unavailable stack
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/commerce/stack/[slug]` for a slug that is not currently shippable.
  - Expected result: The app shows a calm unavailable state and a working Back path to `/commerce/stacks`.
  - Evidence: Screenshot and route snapshot.
- Branch: no commerce consent
  - Priority: Critical
  - Automate later: Yes
  - Action: With commerce consent off, inspect a where-to-buy block and a stack item.
  - Expected result: No paid links or retailer telemetry are exposed; the user sees the consent gate or locked state and can choose the shelf alternative.
  - Evidence: Screenshot and local consent state.

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

### Path A: Conflict Detail

1. Action: Open a real `/conflict/[ruleId]` route from a shelf conflict, review evidence/severity copy, choose Keep alternate nights or Use together anyway, and return to Shelf.
   Expected result: The conflict copy is calm and claim-safe, the user choice persists, and the app does not re-nag immediately.
   Evidence: Screenshot sequence and local choice state.

### Branches

- Branch: direct-entry conflict and share exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/conflict/[ruleId]` and `/share/conflict/[ruleId]` directly, then use the visible Close, Done, Keep, or Use together control.
  - Expected result: The user returns to the Shelf tab instead of remaining on a direct-entry conflict or share-card screen with no navigation history.
  - Evidence: Screenshot sequence and visible route snapshot.
- Branch: missing or unshareable conflict
  - Priority: Important
  - Automate later: Yes
  - Action: Open conflict and share-card routes for a rule that is not present in the current shelf.
  - Expected result: The app shows a calm unavailable state and a working escape path.
  - Evidence: Screenshot and route snapshot.
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

### Path A: Subscription Settings

1. Action: Open `/settings/subscription`, review plan, Restore, Terms, Privacy, and Manage subscription controls.
   Expected result: The account state is understandable, cancellation/restore paths are honest, and no unsupported billing action is implied.
   Evidence: Screenshot and visible-text snapshot.

### Branches

- Branch: direct-entry settings exits
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/settings/subscription`, `/settings/notifications`, and `/settings/timing` directly, then use the visible Back control.
  - Expected result: The user returns to the You tab instead of remaining on a direct-entry settings screen with no navigation history.
  - Evidence: Screenshot sequence and visible route snapshot.
- Branch: reminder timing and discretion
  - Priority: Important
  - Automate later: Yes
  - Action: Open notification settings, toggle reminder tiers, edit AM/PM timing and quiet hours, then return to settings.
  - Expected result: User-set times and discreet lock-screen copy remain clear and calm, with no notification-pressure copy.
  - Evidence: Screenshot sequence and local preference snapshot.

## Flow: Ask OnSkin Deterministic Advisor

- Goal: A user can open the free deterministic Ask advisor without cloud consent, while unavailable cloud Ask controls stay honestly deferred.
- Persona: Free user exploring shelf/routine guidance.
- Entry state: Fresh local app state or seeded shelf state; `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=false`.
- Start screen/URL/window: Direct route `/ask`, or Today Ask teaser when available.
- Success state: `/ask` renders the Ask OnSkin advisor surface; `/ask/consent` renders the cloud Ask deferred screen while the cloud flag is off.
- Priority: Critical
- Automate later: Yes
- Surface: Expo web for route parity; iOS and Android for native app confirmation.
- Evidence folder: `test-results/human-e2e/YYYY-MM-DD/ask-deterministic/`

### Path A: Deterministic Ask Opens

1. Action: Open `/ask` directly with cloud Ask disabled.
   Expected result: The Ask OnSkin advisor renders with deterministic/free copy and suggested prompts. It must not show the cloud Ask deferred beta screen.
   Evidence: Screenshot and visible-text snapshot.

### Branches

- Branch: cloud consent direct route while cloud Ask is disabled
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/ask/consent` directly with cloud Ask disabled.
  - Expected result: The route shows the cloud Ask deferred screen and does not offer a usable consent toggle for an unavailable cloud feature.
  - Evidence: Screenshot and visible-text snapshot.
- Branch: empty shelf state
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/ask` with no shelf products stored.
  - Expected result: The advisor still renders with honest empty-state guidance and safe suggested prompts.
  - Evidence: Screenshot.
- Branch: back, refresh, relaunch, or navigation
  - Priority: Important
  - Automate later: Yes
  - Action: Refresh `/ask`, directly open `/ask` and use the Back control, then directly open `/ask/consent` and use the deferred Back CTA.
  - Expected result: Deterministic Ask remains reachable, only the cloud consent route is deferred while the flag is off, and direct-entry Back controls return to a safe app surface instead of no-oping.
  - Evidence: Screenshot sequence.
- Branch: accessibility and keyboard
  - Priority: Important
  - Automate later: Yes
  - Action: Tab through prompt chips, text input, and send controls.
  - Expected result: Interactive controls have usable roles/labels and keyboard focus without trapping the user.
  - Evidence: UI snapshot or accessibility notes.

## Open Questions

- What exact fixtures reset the app into a fresh onboarding, returning routine, empty shelf, populated shelf, empty progress, and populated progress state?
- Which flows are safe to run without live Supabase, RevenueCat, Apple, Google, Sentry, or PostHog credentials?
- Should the first durable mobile E2E suite use Detox, Maestro, native XCTest/XCUIAutomation, or another harness?
- Which Expo web routes are faithful enough for Playwright coverage?
- Where should long-lived release evidence live: `test-results/human-e2e/`, phase-specific docs folders, or both?
