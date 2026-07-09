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
- Device/layout support policy: `docs/DEVICE_SUPPORT_POLICY.md`.
- Launch-blocking Expo web floor: 320 x 480. Smaller 320 x 430 / 390 / 370 /
  360 browser viewports are resilience stress audits unless a supported native
  device, keyboard/Dynamic Type state, or store-review requirement reproduces
  the same issue.
- Durable local evidence gate: `npm run e2e:human:manifest` verifies committed
  Expo web-compatible support-floor evidence, records smaller stress evidence
  when available, and writes `docs/e2e/generated/human-e2e-manifest.{json,md}`.
  Native simulator/device automation remains an Open Question.

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
   Current resume evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 and 390 x 568 re-opened `/today`, clicked Progress, Shelf, You, and Today from the floating bar, verified exactly one selected tab after each switch, 53.99 px tab targets, center hit-tests resolving to the intended tab, zero horizontal overflow, no non-tab controls in the bar zone, and only expected local placeholder warnings. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-resume-current/`.
   Current label-geometry evidence: 2026-07-08 headless Chrome Expo web at 320 x 568 and 390 x 568 opened Today, Progress, Shelf, and You by route to verify selected-state geometry, exactly one selected tab in each state, all tab centers hit the intended tab, labels stay inside their tab frame with 19 px line boxes, horizontal overflow is zero, and no unexpected browser warn/error logs were recorded. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-geometry-current/`.
   Current interactive evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 and 390 x 568 clicked Today, Progress, Shelf, and You through the floating bar, verified exactly one selected tab after each switch, 54 px tab targets, 19 px label boxes, center hit-tests resolving to each intended tab, zero horizontal overflow, and zero browser warn/error logs. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-interactive-current/`.
   Current compact-label harness evidence: 2026-07-09 headless Chrome Expo web re-ran the durable tab bar geometry gate at 320 x 568 and 390 x 568 after updating the harness for the intentionally compact visible `Prog.` label. The pass verifies exactly one selected tab on each routed tab state, 66 px pill bar height, 54 px tab targets, 19 px visible label boxes, center hit-tests resolving to every tab, zero horizontal overflow, zero unexpected browser warn/error logs, and the full `Progress tab` accessibility label. Evidence and bug report are in `test-results/human-e2e/2026-07-09/navigation-tabbar-geometry-current/` and `docs/e2e-bug-reports/2026-07-09-tabbar-geometry-compact-label-harness.md`.

### Branches

- Branch: smallest supported phone width
  - Priority: Critical
  - Automate later: Yes
  - Action: Render the tab bar at 320 px and 390 px wide phone viewports.
  - Expected result: Today, Progress, Shelf, and You labels render on one line inside the floating bar, with no clipped glyphs, no text overlap, and at least 44 pt tap targets.
  - Evidence: Phone-width screenshots and DOM/native geometry snapshot.
  - Current local evidence: 2026-07-07 Chrome CDP Expo web screenshots and geometry snapshots at 320 x 568 and 390 x 568 show Today, Progress, Shelf, and You labels inside their tab bounds, all tab targets at least 54 px tall, tab widths 75.5 px at 320 and 93 px at 390, and no horizontal overflow.
  - Current polish evidence: 2026-07-08 headless Chrome screenshots confirm the Wealthsimple-style white floating bar remains readable while PM Today now keeps the surrounding bottom clearance dark instead of showing a light slab.
  - Current resume evidence: 2026-07-08 in-app browser screenshots and geometry snapshots confirm Today, Progress, Shelf, and You labels remain visible at 320 x 568 and 390 x 568, with tab widths of about 75.6 px and 93.1 px respectively, 53.99 px heights, successful center hit-tests, and zero horizontal overflow.
  - Current label-geometry evidence: 2026-07-08 headless Chrome Expo web screenshots and snapshots confirm Today, Progress, Shelf, and You labels remain inside their tab frames in each selected route state at 320 x 568 and 390 x 568, with tab widths of about 75.5 px and 93 px, 54 px target heights, 19 px label boxes, successful center hit-tests, and zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-geometry-current/`.
  - Current interactive evidence: 2026-07-08 in-app browser screenshots and geometry snapshots confirm tab clicks keep Today, Progress, Shelf, and You selected states accurate at 320 x 568 and 390 x 568, with tab widths of about 75.6 px and 93.1 px, 54 px target heights, 19 px label boxes, successful center hit-tests, zero horizontal overflow, and zero browser warn/error logs. Evidence is in `test-results/human-e2e/2026-07-08/navigation-tabbar-interactive-current/`.
  - Current compact-label harness evidence: 2026-07-09 headless Chrome Expo web screenshots and JSON snapshots confirm Today, `Prog.`, Shelf, and You render as direct one-line visible labels at 320 x 568 and 390 x 568, while the Progress tab keeps the full `Progress tab` accessibility label. The rerun reports tab widths of 75.5 px at 320 and 93 px at 390, 54 px tab targets, 19 px label boxes, successful center hit-tests, exactly one selected tab per route state, zero horizontal overflow, and zero unexpected browser warn/error logs. Evidence is in `test-results/human-e2e/2026-07-09/navigation-tabbar-geometry-current/`.
- Branch: content clearance beneath floating tab bar
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Today at 320 px and 390 px phone viewports with the contextual SPF prompt or empty-routine CTA visible.
  - Expected result: No visible CTA, prompt control, or inactive locked-paywall compliance control sits partially underneath the floating tab bar; controls either sit fully above the bar or require a deliberate scroll into view, with enough visual separation to keep the floating bar feeling intentional.
  - Evidence: Phone-width screenshots, hit-test snapshot, and control geometry.
  - Current local evidence: 2026-07-07 Chrome CDP Expo web checked `/today`, `/progress`, `/shelf`, and `/you` at 320 x 568 and 390 x 568; the DOM geometry snapshot found no non-tab visible controls intersecting the floating tab-bar zone.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 first swept 41 routes in `test-results/human-e2e/2026-07-08/short-phone-480-route-audit-6/`, then tightened `/today` empty-routine compact spacing after the `Add products` CTA looked crowded near the floating bar. Post-fix `/today` shows `Add products` at 230 x 56 px, y=314-370, with 37 px clearance above the floating tab bar, correct center hit-test, and zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/today-empty-short-phone-480-clearance/`.
  - Current support-floor empty-state evidence: 2026-07-09 Codex in-app browser Expo web reverified `/today?routine=AM` at the 320 x 480 launch support floor after the tighter empty-routine card treatment. The short support-floor card keeps `Build a routine from your shelf.` and hides lower helper copy, renders `Add products` as a complete 238 x 56 px button at y=155-211 with 196 px clearance above the floating tab bar, reports zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, and zero unexpected current-origin logs, and tapping `Add products` routes to `/shelf/manual`. Evidence and report are in `test-results/human-e2e/2026-07-09/today-empty-support-floor-current/`.
  - Current shelf/paywall evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 found `/shelf` empty-state `Add by hand` hidden under the floating tab bar and direct `/paywall/upsell?feature=full_routine` `Maybe later` clipped below the viewport. Post-fix `/shelf` shows `Scan a barcode` at 256 x 56 px and `Add by hand` at 256 x 48 px with center hit-tests landing on the buttons, 31 px clearance above the tab bar, and `Add by hand` routing to `/shelf/manual`; the paywall shows `Maybe later` at 264 x 48 px inside the viewport and tapping it dismisses to `/today`. Evidence is in `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/`.
  - Current Progress evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 found `/progress` empty-state `Take my first photo` rendered at y=349-405 with only about 2 px of clearance before the floating tab bar. Post-fix it renders at 272 x 52 px, y=315-367, with 33.6 px clearance, the center hit-tests to `Take my first photo`, tapping routes to `/progress/capture`, and horizontal overflow stays zero. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/` and `docs/e2e-bug-reports/2026-07-08-progress-empty-short-phone-clearance.md`.
  - Current Progress paywall evidence: 2026-07-08 bundled Playwright Chrome Expo web at 320 x 480 reproduced the free `/progress` contextual photo paywall legal controls sitting under the floating tab bar in the pre-fix route sweep, then verified the shared compact-header ProGate fix. Post-fix `/progress` has Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first visible and hit-testable, with zero target issues, zero visible-control issues, zero horizontal overflow, zero JavaScript dialogs, and no unexpected browser logs. Evidence and report are in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/` and `docs/e2e-bug-reports/2026-07-08-progate-short-phone-compliance-clipping.md`.
  - Current 320 x 430 Progress paywall evidence: 2026-07-08 Codex in-app browser Expo web reproduced `/progress` free-user `Explore first` sitting in the floating tab-bar hit zone after the shelf 430 px fixes. Post-fix, ProGate uses a sub-460 px density band that preserves Terms, Privacy, Restore, Maybe later, annual price, store-unavailable reason, and Start free trial with zero geometry issues on `/progress`; lower-priority `Explore first` is allowed to drop out of the sub-460 px first viewport. The follow-up 49-route sweep no longer reports Progress failures. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/`, `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postprogress-sweep/`, and `docs/e2e-bug-reports/2026-07-08-progress-progate-short-phone-430-clearance.md`.
  - Current split-short phone evidence: 2026-07-08 Codex in-app browser Expo web stress-tested the current route set at 320 x 390 after the 430 px clearance pass. Post-fix, Ask, Shelf, contextual paywall, Recommendations, Skin Notes, and Settings notifications keep visible controls fully readable and hit-testable, with lower-priority controls deliberately below the first viewport until scroll. Focused evidence covers 11 routes with zero clipped or blocked controls and successful taps for Progress-photo nudge, scan Close, Shelf Add by hand, Maybe later, Ask conflict prompt, Skin Note open, Recommendation open, Drugstore budget chip, OCR manual continuation, and no-match Add it by hand. The follow-up 49-route 320 x 390 sweep reports zero failed routes. Latest 320 x 390 / 120% evidence also verifies the contextual upsell paywall keeps `Maybe later`, Terms, Privacy, Restore, and Start free trial complete and hit-testable in the split-short header/body layout. Evidence and report are in `test-results/human-e2e/2026-07-08/split-short-phone-390-clearance/`, `test-results/human-e2e/2026-07-08/current-main-split-short-phone-390-sweep-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/`, and `docs/e2e-bug-reports/2026-07-08-split-short-phone-390-clearance.md`.
  - Current full-route rerun evidence: 2026-07-08 bundled Playwright Chrome Expo web at 320 x 480 re-ran 49 current `main` direct-entry routes after the compact-route fixes. The sweep found zero failed routes, zero visible clipped controls, zero sub-44 user-facing controls, zero blocked hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-08/current-main-short-phone-480-rerun/`.
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
  - Current supported-phone 120% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route 120% text-pressure audit at 320 x 568, the 320 x 480 launch support floor, 390 x 844, and 430 x 932. The follow-up reproduced clearance issues in `/shelf/no-match`, `/settings/notifications`, `/settings/privacy`, `/shelf/manual`, `/community`, and `/recommendations/preferences`; post-fix, lower-priority recovery, policy, promotional, texture, and note-section controls either stay complete or start below the first viewport. All four final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`. Native simulator/device keyboard and Dynamic Type QA remain open.
  - Current supported-phone 170% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route 170% text-pressure audit at 320 x 568, the 320 x 480 launch support floor, 390 x 844, and 430 x 932. The current-source follow-up reproduced `/settings/privacy` direct-entry rows peeking into the floating-tab zone, `/today?routine=PM` putting the empty-routine `Add products` CTA under the floating tab bar, 430 x 932 policy/paywall compliance controls, `/recommendations/preferences` texture chips, and `/shelf/no-match` recovery controls peeking at the viewport bottom, plus 390 x 844 Explore-first paywall copy/target pressure. Post-fix, direct privacy entries omit unrelated reminder rows, destructive and policy privacy actions stay below the first viewport, Today short-phone empty states keep the primary CTA complete above the bar, Recommendation Preferences and Shelf no-match defer lower-priority tall-phone controls below the first viewport, and contextual ProGate paywalls use compact header compliance plus shorter visible Explore-first copy with the full copy retained in the accessibility label. Final sweeps at 320 x 568, 320 x 480, 390 x 844, and 430 x 932 report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-compact-568-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-390-postfix-6/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-170-supported-phone-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 390 x 640 support-band 170% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit after support-band density guards for contextual ProGate paywalls, Recommendation Preferences, Shelf scan/manual, and Skin Notes. The pass reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-current/`. Native iOS/Android Dynamic Type, safe-area, screen-reader, keyboard, camera, and store-sheet QA remain device gates.
  - Current accepted-floor 100% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route audit at the 320 x 480 launch support floor after adding the native support-floor config contract and direct-entry density guards. Post-fix, `/ask`, `/community/note/missing-note-e2e`, `/recommendations/stale-local-rec`, `/settings/privacy`, `/settings/subscription`, `/shelf/no-match`, and `/shelf/opened` keep visible controls complete, center-hit-testable, and 44 px+, with lower-priority actions either complete above chrome or deliberately below the first viewport until scroll. The final sweep reports zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-480-config-spacing-guard/`. Native iOS/Android safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 320 x 480 launch-floor 170% / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web re-ran the 49-route text-pressure audit at the accepted 320 x 480 floor after current-source fixes for Settings Privacy, Settings Subscription, Recommendation Preferences, Ask, Shelf no-match, Community missing-note recovery, and stale Recommendation detail. Post-fix, support-floor routes use shorter visible labels with full accessibility labels retained, suppress nonessential hints/subtitles, compact policy and restore rows, keep the destructive privacy action complete, show only the essential Shelf no-match recovery actions, and shorten the Recommendation Preferences heading. Final sweeps at 200% and 170% report zero failed routes, zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-support-floor-480-postfix-12/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-16/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-support-floor-480-clearance.md`. Native iOS/Android safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 140% route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route 320 x 568 compact phone sweep at 140% text pressure. The audit reproduced direct upsell CTA clipping, ProGate routine paywall compliance overlap/monthly-price overflow, and Recommendation Preferences chip groups peeking as partial targets. Post-fix, direct upsell and ProGate use a 320 px narrow-short density tier with icon dismiss, hidden nonessential body copy, hidden monthly-equivalent labels, and tighter price/CTA blocks; Recommendation Preferences keeps visible chips 48 px and moves lower chip groups below the first viewport. The final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-3/`, `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-7/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-140-compact-568-clearance.md`. Native simulator/device Dynamic Type remains open.
  - Current 150% split-short route-audit evidence: 2026-07-08 headless Chrome Expo web passed the 49-route 320 x 568 and 320 x 430 sweeps at 150% text pressure, then reproduced tighter 320 x 390 failures in Recommendation Preferences, Settings Notifications, Shelf manual add, Shelf scan, Shelf no-match, Ask, Community, and narrow tab labels. Post-fix, lower-priority value filters and notification controls move below the first viewport, manual-add Ingredients clears the fixed Continue footer, Shelf scan uses compact fallback rows, Shelf no-match and Ask use shorter compact visible copy with full accessibility labels preserved, Shelf skeleton filters match the loaded compact labels, Community pushes later narrow sections fully below the first viewport, the 320 px tab bar abbreviates only the visible Progress label, and rendered web chrome no longer emits the pointer-events warning. The final 320 x 390 / 150% sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-13/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-150-split-short-390-clearance.md`. Native simulator/device safe-area and Dynamic Type QA remain open.
  - Current 170% compact route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route 320 x 568 compact-phone sweep at 170% text pressure. The audit reproduced floating-tab `Progress` label overflow, Shelf filter clipping, Shelf no-match recovery peeking, and follow-up narrow-compact edge cases in Shelf scan/manual, Ask, Skin Notes, and missing-note recovery. Post-fix, compact visible labels preserve full accessibility labels, optional and lower-priority controls move fully below the first viewport, and Community recovery actions remain complete. The final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-170-compact-568-postfix-9/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-170-compact-568-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 200% compact route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route 320 x 568 compact-phone sweep at 200% text pressure. The audit reproduced partial controls in `/recommendations/preferences` and `/settings/notifications`, plus a `/settings/privacy` direct-entry row whose center was blocked by the floating tab bar. Post-fix, compact-short preference chips and notification nudges defer lower-priority controls below the first viewport, and privacy direct-entry scrolling clears the health-data consent row from the tab bar. The final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-200-compact-568-postfix/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-200-compact-568-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
  - Current 320 x 430 / 200% route-audit evidence: 2026-07-08 headless Chrome Expo web re-ran the 49-route short-phone sweep at 200% text pressure. The audit reproduced a visible but disabled `/progress` paywall CTA in the preview store-unavailable state, a partial `Fragrance-free` chip in `/recommendations/preferences`, a partial `Streak & adherence` switch in `/settings/notifications`, and a follow-up partial `Add by hand` recovery button in `/shelf/search`. Post-fix, ProGate keeps the primary CTA tappable while purchase work is not pending so the store-unavailable feedback path can run, Recommendation Preferences pushes the first value-chip group clear of the bottom edge, Notification Settings moves Gentle Nudges below the ultra-short first viewport, and Shelf catalog search reserves a flexed result area so the manual-add fallback remains complete. The final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-200-short-phone-430-postfix/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-200-short-phone-430-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
- Current 320 x 390 / 320 x 360 / 200% route-audit evidence: 2026-07-08 headless Chrome Expo web first passed the split-short 320 x 390 sweep, then reproduced harsher 320 x 360 failures in contextual paywalls, direct upsell, Settings Privacy, Settings Notifications, Shelf no-match, compact Shelf filters, and stale Recommendation detail. Post-fix, micro-short paywalls use fitted title/price/CTA treatments, direct upsell store-unavailable CTAs stay tappable for route-owned feedback, narrow privacy direct entries defer the destructive health-data action below the first viewport, lower-priority notification and Shelf recovery controls move fully below the first viewport, stale Recommendation headers fit one line, and compact Shelf filters keep the short visible `7d` label with the full accessibility label. The final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-200-split-short-390-audit-current/`, `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
- Current 390 x 844 / 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced 16 modern-phone text-pressure failures across contextual paywalls, floating tab labels, Recommendation Preferences chips, Settings Privacy, Shelf scan/no-match, and Skin Notes. Post-fix, ProGate removes nonessential monthly-equivalent price pressure, the visible Progress tab label abbreviates at 390 px while preserving its accessibility label, preference chips densify, direct privacy policy rows stay below the first viewport, Shelf recovery/header targets are complete, and Skin Notes moves the later Sunscreen section below the first short modern-phone viewport. The final 49-route sweep and current-source rerun report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-current-rerun/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-390-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
- Current 430 x 932 / 390 x 844 supported modern-phone 200% route-audit evidence: 2026-07-09 headless Chrome Expo web reproduced tall supported-phone 200% failures in contextual ProGate paywalls, Skin Notes, Settings Privacy, Recommendation Preferences, and Shelf no-match. Post-fix, tall text-pressure ProGate paywalls use compact compliance/action density, lower-priority Skin Notes and Recommendation Preferences controls move below the first viewport, Privacy policy rows clear the floating tab-bar zone, and Shelf no-match keeps manual fallback scroll-reachable instead of a partial bottom-edge target. Final 49-route sweeps at 430 x 932 and 390 x 844 report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-5/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-7/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-430-clearance.md`. Native simulator/device safe-area, screen-reader, and Dynamic Type QA remain open.
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
- Dev-only reset fixture: start Expo web with `EXPO_PUBLIC_E2E_LOCAL_RESET=1` and open `/?e2eReset=local` to clear local private state plus query cache, then return to `/`.

### Path A: Happy Path

1. Action: Launch the app, proceed through age, consent, goals, quiz/products, notifications, analyzing, reveal, and account/paywall steps using safe local choices.
   Expected result: Each step advances intentionally, copy stays within approved claims, and the final state is clear.
   Evidence: Screenshot or video of each major transition plus terminal/simulator logs.
   Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 uses the dev-only reset fixture, completes age, goals, health consent, quiz, three-product shelf intake, reveal, notification skip, account skip, and the no-card `Explore first. 7 days of Pro` paywall path. Evidence is in `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/`.

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
- Branch: goal selection on shortest phone
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/onboarding/goals` on a 320 x 480 phone viewport and inspect all goal cards plus the fixed Continue action.
  - Expected result: All six goal choices are visible, readable, and hit-testable above the footer, with no goal card clipped underneath Continue, no horizontal overflow, and no visible control below 44 px.
  - Evidence: Screenshot and small-phone control geometry snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced goal cards sitting under the fixed Continue footer, then verified the compact two-column goal grid. Post-fix geometry shows all six goal cards at 130.7 px wide and at least 74 px tall, Continue at 56 px tall, zero hit-blocked controls, zero sub-44 controls, and zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/`.
  - Current split-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 390 reproduced Sensitivity and Barrier repair visible under the fixed Continue footer with blocked tap centers. Post-fix split-short density keeps all six goal cards at about 130.7 x 60 px, above Continue, with zero clipped controls, zero sub-44 controls, zero blocked center hit-tests, and a successful Sensitivity selection followed by Continue advancing to health-data consent. Evidence and report are in `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/` and `docs/e2e-bug-reports/2026-07-08-onboarding-goals-390-footer-overlap.md`.
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
  - Current skip evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 opens `/onboarding/notifications`, verifies the soft-ask plus `Not now`, taps skip, reaches `/onboarding/account`, then opens `/settings/notifications` in the same session and verifies `Morning routine` and `Evening · tonight's step` switches both have `aria-checked=false`, 48 px switch targets, zero horizontal overflow, and no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/onboarding-notification-skip-current/`. Native iOS/Android OS prompt denial remains device QA.
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
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind` verifies `/onboarding/age`, `/s/sharecard01`, `/shelf/search`, `/settings/timing`, and free `/routine/widgets` before and after tapping `Explore first. 7 days of Pro`. The four public copy surfaces show `RoutineKind`, all six captured states show no visible `OnSkin`, the no-card Pro week reaches the widgets deferred surface (`Widgets are not in this beta` / `Back to Today`), visible controls are 48 px+, horizontal overflow is zero, and current-origin browser warn/error logs are empty. Evidence is in `test-results/human-e2e/2026-07-08/public-copy-smoke-current/`; final trademark clearance, store listings, native identifiers, final domain, and App/Universal Links remain external blockers.
- Branch: Phase 8 public-site identity smoke
  - Priority: Critical
  - Automate later: Yes
  - Action: Serve `docs/phase-8/public-site` locally, open `index.html`, `share.html`, `support.html`, and `waitlist.html` at phone width, and inspect titles plus visible copy.
  - Expected result: The static launch pages use `RoutineKind`, show no legacy `OnSkin`, preserve the no-score/not-medical-advice boundaries, and keep final app association IDs as placeholders until store-console identity is cleared.
  - Evidence: Phone-width screenshots, visible-text snapshots, static-server transcript, and brand audit output.
- Branch: Phase 8 public-site placeholder store links
  - Priority: Critical
  - Automate later: Yes
  - Action: Serve `docs/phase-8/public-site` locally before final store URLs are substituted, open `index.html` and `share.html` at phone width, then tap one App Store/Google Play waitlist fallback.
  - Expected result: Raw `__APP_STORE_URL__` and `__PLAY_STORE_URL__` tokens are never clickable `href` values. Placeholder store buttons visibly route to `/waitlist.html`; when final production store URLs are substituted, the runtime guard promotes only validated App Store and Play Store HTTPS URLs.
  - Evidence: Phone-width screenshots, visible-text/link snapshots, click-through URL snapshot, and source-level final-substitution check.
  - Current local evidence: 2026-07-08 Codex in-app browser at 390 x 700 serves `docs/phase-8/public-site` on localhost, verifies `index.html` and `share.html` render `App Store waitlist` / `Google Play waitlist` with `/waitlist.html` hrefs and `data-store-ready=false`, taps App Store and Google Play fallbacks into the waitlist, records zero horizontal overflow, and source-checks that final App Store / Play Store URL substitution leaves no placeholder tokens while keeping the production-host runtime guard. Evidence and report are in `test-results/human-e2e/2026-07-08/phase8-public-store-link-fallback/` and `docs/e2e-bug-reports/2026-07-08-phase8-public-store-placeholder-hrefs.md`.

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
  - Current support-floor evidence: 2026-07-09 Codex in-app browser Expo web at 320 x 480 opens `/today?routine=AM`, verifies the short empty-routine card keeps `Build a routine from your shelf.`, intentionally drops lower helper copy on the first viewport, renders `Add products` as a complete 238 x 56 px button with no clipped/sub-44/blocked-control issues and zero horizontal overflow, then taps `Add products` and reaches `/shelf/manual`. Evidence is in `test-results/human-e2e/2026-07-09/today-empty-support-floor-current/`.
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
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 seeds a local sensitive/barrier profile plus cleanser, retinol, glycolic, ceramide, and SPF shelf products, opens `/today?routine=PM`, and verifies the six-night skin-cycling strip renders split two-line Exfoliate/Retinoid/Recover labels with full accessibility labels, no visual ellipses, zero horizontal overflow, and 44 px+ visible controls. Evidence is in `test-results/human-e2e/2026-07-08/today-empty-and-cycle-current/`.
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
- Branch: product detail lifecycle and catalog-report recovery
  - Priority: Critical
  - Automate later: Yes
  - Action: Add or open a real Shelf product, open product detail, tap More options, close the remove/discard sheet, tap Report an issue, and choose a catalog issue while the catalog backend is unavailable.
  - Expected result: Lifecycle and catalog-report choices stay inside named route-owned sheets, use 48 px+ controls, open no native or JavaScript dialog, keep the product detail at zero horizontal overflow, and render raw-error-free inline report feedback after a failed catalog report.
  - Evidence: Product-detail screenshots, sheet dialog snapshot, inline alert snapshot, dialog-state check, control-geometry snapshot, and browser logs.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 adds `Route Owned Balm`, opens product detail, verifies `Remove from shelf?` and `Report catalog issue` are named `role="dialog"` sheets with modal semantics and 48 px+ controls, submits `Wrong product match` against the unavailable catalog backend, and sees inline `Report not sent` feedback with no JavaScript/native dialog and zero horizontal overflow. The first pass found unnamed dialog nodes; post-fix evidence is in `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/`.
  - Current glyph/dock recheck: 2026-07-08 Codex in-app browser Expo web at 320 x 568 adds `Glyph Gel`, opens product detail, verifies the product-detail `More options` glyph remains a 48 x 48 accessible `More options` button after replacing the literal ellipsis text, confirms the best-before row is fully reachable after scroll instead of sitting under the lifecycle dock, opens the named `Remove from shelf?` dialog, keeps lifecycle controls 48 px+, has zero horizontal overflow, and records no current-origin browser warn/error logs. Evidence and report are in `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/` and `docs/e2e-bug-reports/2026-07-08-shelf-detail-more-options-glyph-dock.md`.
- Branch: no search result
  - Priority: Critical
  - Automate later: Yes
  - Action: Search for a product that should not match.
  - Expected result: No-match state offers manual add or safe next steps.
  - Evidence: Screenshot.
  - Current local evidence: 2026-07-08 in-app browser Expo web at 320 x 568 uses `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match`, searches `definitely missing sunscreen`, verifies the no-match copy offers `Add by hand`, and confirms the fallback opens `/shelf/manual` with zero horizontal overflow and 50 px+ visible controls. Evidence is in `test-results/human-e2e/2026-07-08/shelf-add-recovery-current/`.
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
  - Current local evidence: 2026-07-07 in-app browser E2E at 320 x 568 opens `/shelf/manual`, enters `Barrier Balm` / `RoutineKind Test`, opens the category picker, scrolls the modal sheet to `Something else`, verifies the row is visible and center-tappable, selects it, confirms the collapsed field reads `Other`, and continues to `/shelf/opened` with zero horizontal overflow and no clipped or sub-44 px visible controls.
  - 2026-07-08 current safe-area follow-up: Source contracts now require the route-local sheet to own its viewport height, reserve a 48 px outside-dismiss space, add native bottom-inset padding only when present, expose a named web dialog, pad the internal category list, and keep the collapsed category accessibility label aligned with the visible compact label. Codex in-app browser Expo web at 320 x 480 opens `/shelf/manual`, fills product and brand, opens the named `Choose product category` dialog, verifies no open-state control issues or horizontal overflow, scrolls to fully visible `Something else`, selects it, confirms the collapsed field exposes `Category, Other`, continues to `/shelf/opened`, and records zero unexpected warn/error logs. Evidence is in `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-320x480-postfix/`; native iOS/Android safe-area, Dynamic Type, keyboard, and screen-reader traversal remain open QA.
  - 2026-07-08 320 x 430 / 320 x 440 follow-up: a shortest-height route sweep found `/shelf/manual` Ingredients hit-blocked by the sticky Continue footer, `/shelf/ocr` clipping `Continue with manual text`, and `/shelf/no-match` clipping and blocking `Add it by hand`. Post-fix Codex in-app browser evidence verifies `/shelf/manual`, `/shelf/ocr`, and `/shelf/no-match` have zero user-facing clipped controls, hit-blocked controls, tiny targets, horizontal overflow, or unexpected route logs. A later 320 x 440 pass added extra ultra-short category-sheet bottom padding so `Something else` scrolls fully into view before selection, verified OCR capture-failure/manual-text continuation into `/shelf/manual`, and added explicit no-match row accessibility labels. The 320 x 430 / 120% text-pressure pass then hid no-match subtitles below 460 px so all three recovery rows remain complete under enlarged text. The broader 49-route post-fix sweep confirms shelf routes are no longer in the failure list. Evidence and bug reports are in `test-results/human-e2e/2026-07-08/shelf-short-phone-430-clearance/`, `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/`, `test-results/human-e2e/2026-07-08/shelf-ultrashort-manual-ocr-current/`, `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/`, `docs/e2e-bug-reports/2026-07-08-shelf-short-phone-430-intake-clearance.md`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`; native iOS/Android safe-area, keyboard, Dynamic Type, barcode camera, and OCR capture remain open QA.
  - 2026-07-08 320 x 370 / 320 x 360 / 130% micro-short text-pressure follow-up: the initial route sweep found `/shelf/manual` exposing the optional Ingredients textarea under the sticky Continue footer. Post-fix, manual add reserves extra split-short spacing below 410 px before optional ingredients and the final 49-route sweeps report zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-current/`, `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-micro-short-370-clearance.md`; native iOS/Android safe-area, keyboard, Dynamic Type, barcode camera, and OCR capture remain open QA.
  - 2026-07-09 layout-constant follow-up: Codex in-app browser Expo web on `localhost:8255` reverified `/shelf/manual` after split-short manual spacing calibration. The 320 x 480 support floor keeps Cancel, Add by hand, Product name, Brand, Category, and Continue complete with zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. A 320 x 400 non-blocking resilience stress pass keeps the same first-viewport controls complete while Ingredients remains below the first viewport. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
  - 2026-07-09 supported-phone 120% text-pressure follow-up: the route audits found `/shelf/manual` optional Ingredients entering the sticky Continue footer zone and `/shelf/no-match` manual recovery clipping on supported compact heights. Post-fix, manual add defers optional Ingredients below the first viewport and no-match keeps the manual recovery row complete or scroll-reachable. The 320 x 568, 320 x 480, 390 x 844, and 430 x 932 final sweeps report zero failed routes with evidence in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/`, and `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/`.
- Branch: barcode no-match or offline lookup
  - Priority: Critical
  - Automate later: Yes
  - Action: Scan a barcode that returns no catalog match, an external candidate, or an offline/failed lookup.
  - Expected result: The scan sheet never dead-ends; it shows a matched candidate, no-match copy, or manual/search/OCR fallbacks, logs the owner-scoped `shelf_scans` outcome when Supabase is available, and tracks only privacy-safe scan-funnel metadata.
  - Evidence: Screenshot, console/network or Supabase/mock insert evidence, and analytics payload assertion.
  - Current local evidence: 2026-07-08 in-app browser Expo web at 320 x 568 uses `EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=offline`, verifies `/shelf/scan` shows offline catalog copy plus Scan ingredient label, Search catalog, and Add it by hand fallbacks, and verifies `/shelf/no-match` exposes search, label-scan, and manual routes without promising contribution-back or showing unsafe source claims. Evidence is in `test-results/human-e2e/2026-07-08/shelf-add-recovery-current/`; live Supabase `shelf_scans`, real OBF lookup, native barcode camera, and OCR device capture remain device/backend QA.
  - 2026-07-09 support-floor spacing follow-up: after the device support policy set 320 x 480 as the launch-blocking shortest phone floor, Codex in-app browser Expo web on `localhost:8255` verified `/shelf/no-match` at 320 x 480 and 390 x 844. On the support floor, Search catalog, Scan ingredients, and Add it by hand are all visible 264 x 48 px recovery controls with passing center hit-tests, zero horizontal overflow, no JavaScript dialog, and zero current-origin warn/error logs; clicking them routes to `/shelf/search`, `/shelf/ocr`, and `/shelf/manual`. The 390 x 844 pass keeps the full `Scan the ingredient list` label and all three 334 x 68 px recovery controls visible and hit-testable. Evidence and report are in `test-results/human-e2e/2026-07-09/shelf-no-match-supported-floor-spacing/`; native barcode camera and OCR capture remain device QA.
  - 2026-07-08 shortest-phone follow-up: a 320 x 480 audit found `/shelf/no-match` clipping the `Add it by hand` fallback below the viewport. Post-fix Codex in-app browser evidence at 320 x 481 verifies all three recovery rows are visible, the manual row is a 54 px hit target with no blocked hit-test, clipped controls, horizontal overflow, JavaScript dialog, or current-route warning/error logs, and tapping its visible center routes to `/shelf/manual`. Evidence and bug report are in `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/` and `docs/e2e-bug-reports/2026-07-08-shelf-no-match-short-phone-fallback.md`.
  - 2026-07-08 320 x 430 / 120% text-pressure follow-up: the route audit found `/shelf/scan` fallback content could block the top `Close` button and `torch` switch centers when the camera preview was unavailable. Post-fix, the scan route reserves the header strip, omits the unavailable preview on sub-460 px fallback screens, compacts fallback rows, and the final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`; native camera and torch behavior remain device QA.
  - 2026-07-08 320 x 370 / 130% micro-short text-pressure follow-up: `/shelf/no-match` now switches to a sub-380 px recovery layout that keeps Close in the top-right hit zone, removes the decorative question mark from the first viewport, and moves the manual fallback fully below the first viewport rather than letting it peek as a partial target. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`; native camera and torch behavior remain device QA.
  - 2026-07-08 320 x 360 / 200% text-pressure follow-up: the harsher sweep found the second Shelf no-match recovery row peeking as an 11 px partial target at the bottom edge. Post-fix, the secondary scan/manual recovery block is deferred below the first viewport on micro-short phones while Search catalog remains complete and the other recovery actions remain scroll-reachable. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`; native camera and torch behavior remain device QA.
  - 2026-07-09 390 x 844 / 200% text-pressure follow-up: the modern-phone sweep found the Shelf no-match Scan ingredients action peeking as a partial bottom target after the broader paywall/settings pass. Post-fix, the compact Scan row is lifted into a complete 48 px hit target while Add by hand remains scroll-reachable, and the final 49-route sweep plus current-source rerun report zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-current-rerun/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-390-clearance.md`; native camera and torch behavior remain device QA.
  - 2026-07-09 430 x 932 / 170% text-pressure follow-up: the supported tall-phone sweep found lower Shelf no-match recovery controls could still approach the viewport edge under heavy text pressure. Post-fix, the tall-phone no-match layout adds recovery spacing so lower-priority actions stay scroll-reachable instead of peeking as partial first-viewport targets, and the final 430 x 932 sweep reports zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-170-supported-phone-clearance.md`; native camera and OCR behavior remain device QA.
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
  - Current local evidence: 2026-07-08 in-app browser Expo web at 320 x 568 adds `Boundary Vitamin C Serum`, verifies `/shelf/opened` shows `Just opened it`, `Pick a date`, and `Not opened yet` before scrolling to PAO/save actions, sets `3 months ago` plus `3 mo` PAO, and confirms Shelf shows `0 days left`. The first pass found replenish copy manufactured scarcity (`running low` / `nearly finished`) for a PAO boundary; post-fix, `/shelf/replenish` explains the trigger as `PAO or printed date`, says it is `not an alarm`, shows no scarcity copy, and `Re-add the same one` creates a fresh active unit with `opened Jul`, `3 mo PAO`, `Oct 2026`, and one archived prior unit. Evidence and report are in `test-results/human-e2e/2026-07-08/shelf-opened-replenish-boundary-current/`; native bottom-sheet, screen-reader, Dynamic Type, and restart-persistence QA remain open.
  - Current ultra-short direct-entry evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the no-draft `/shelf/opened` backdrop `Dismiss` control being reported as a clipped visible control in the post-Recommendations route sweep. Post-fix, the no-draft opened-date recovery sheet hides the backdrop from accessibility, keeps the visible Close and `Add product by hand` controls complete, and tapping `Add product by hand` routes to `/shelf/manual` with no clipped controls, no sub-44 controls, and no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/` and the fresh 49-route zero-failure sweep `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
- Branch: replenish similar options unavailable after commerce consent
  - Priority: Important
  - Automate later: Yes
  - Action: Set a product to a PAO boundary, open `/shelf/replenish`, tap `See similar options`, grant where-to-buy consent, and tap `See similar options` again while the catalogue/partner rail is unavailable.
  - Expected result: No paid links or retailer telemetry are exposed before consent. After consent, the route stays in the replenish context and shows a visible, accessible inline unavailable-catalogue message instead of appearing inert or opening a native alert.
  - Evidence: Screenshot sequence, dialog check, alert geometry, browser logs, and source contract.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true` and `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app` adds `Similar Flow Serum`, sets `3 months ago` plus `3 mo` PAO, verifies Shelf shows `0 days left`, opens `/shelf/replenish`, grants `Allow where-to-buy links`, and retaps `See similar options`. Pre-fix evidence showed the consented tap left Expo web visually unchanged while the source path used `Alert.alert`. Post-fix, one route-owned `role="alert"` message appears at y=427-545, `tab.getJsDialog()` is null, `scrollWidth=320`, and warn/error logs are empty. Evidence is in `test-results/human-e2e/2026-07-08/shelf-replenish-similar-inline-recovery-current/`; native iOS/Android announcement, Dynamic Type, and live similar-product rail QA remain open.
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

- Branch: camera/photo permission denied
  - Priority: Critical
  - Automate later: Yes
  - Action: Deny camera or photo permission.
  - Expected result: User sees a clear recovery path and no broken UI, including a visible alert if the OS Settings handoff fails.
  - Evidence: Screenshot, alert text, and permission state.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION=denied_no_retry`, `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`, and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verifies `/progress/capture` starts on the local-only consent gate, consent reaches the denied/no-retry permission gate with one `Open settings` action, no `Capture photo` control, and no JavaScript dialog, failed Settings handoff renders inline `Camera settings unavailable` alert copy with no dialog or raw fixture text, visible alert/actions are 48 px+ with zero horizontal overflow, and `Not now` returns to `/progress`. Evidence is in `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/`.
- Branch: first-use photo consent save failure
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`, open Progress capture without prior `photo_capture` consent and tap the first-use photo consent CTA.
  - Expected result: The camera does not open, the app shows stable photo-choice-not-saved copy, the consent CTA is retryable, `Not now` remains visible and tappable on a 320 x 568 phone, no camera permission prompt appears before consent is saved, and the next CTA tap consumes the one-shot failure and opens the normal permission/capture path.
  - Evidence: Failure screenshot/text, `role="alert"` copy, no pre-consent camera copy, compact button-geometry snapshot, retry into the normal permission/capture path, and browser warn/error logs.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once` and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verifies direct `/progress/capture` starts on the local-only consent gate, a forced consent-save failure keeps the camera and permission path closed, renders route-owned `Photo choice not saved` feedback with `role="alert"`, opens no JavaScript dialog, keeps the retry CTA 52 px and `Not now` 48 px inside the viewport, has zero horizontal overflow, shows no raw fixture error, and retry reaches the normal web camera-permission path. The same slice removed the leftover native `Alert.alert` call from the consent persistence failure path while leaving camera-capture failure alerts unchanged. Evidence is in `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/`.
- Branch: first-use local-only backup tradeoff
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/progress/capture` without prior `photo_capture` consent and inspect the consent gate at a compact phone size.
  - Expected result: The consent gate says photos stay on-device, no faceprint or biometric template is stored, cloud backup is a separate choice, and backup-off/lost-phone tradeoff is visible before the first capture. Capture-frame labels, shutter copy, and camera preview chrome are not rendered until photo consent is saved. The Take photos and Not now controls remain readable and tappable on 320 x 568 and shortest 320 x 480 phone viewports.
  - Evidence: Phone screenshot, visible-text snapshot, and 320 px button-geometry snapshot.
  - Current local evidence: 2026-07-07 Codex in-app browser Expo web at 320 x 568 verifies direct `/progress/capture` renders the complete local-only consent gate with no pre-consent capture chrome, 52 px `Take photos. On device only`, 48 px `Not now`, zero horizontal overflow, and safe recovery to `/progress` after tapping `Not now`. The overlay source now adds top and bottom safe-area insets to its scroll padding; native notch/home-indicator verification remains device QA.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 verifies direct `/progress/capture` and legacy `/photos/capture` keep the local-only consent copy, hide only the prep reminder on shortest phones, show no camera chrome before consent, keep `Take photos. On device only` and `Not now` fully visible and hit-testable, and recover to `/progress` after `Not now`. Evidence is in `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/`.
- Branch: camera start or photo capture failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Open Progress capture on a device where the camera cannot start, or force the still photo capture call to reject.
  - Expected result: The app shows stable camera-unavailable or photo-not-captured copy, keeps the timeline unchanged, and does not leave a tappable shutter that appears inert.
  - Evidence: Alert text, visible fallback state, and route snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once` and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` forces `/progress/capture` still-photo rejection from the capture surface. The route opens no dialog, renders inline `Photo wasn't captured` copy with `role="alert"`, foregrounds 56 px `Try photo again` and 48 px `Not now` controls while the background shutter is disabled, hides the raw fixture error, and logs no current-origin browser errors. Tapping retry consumes the fixture and shows the normal web permission gate with readable wrapped heading copy; `Not now` returns to `/progress`. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/`; physical iOS/Android camera mount, permission-denied, real `takePictureAsync` rejection, and encrypted image persistence QA remain open.
- Branch: empty timeline
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress with no photos.
  - Expected result: Empty state gives a clear next action.
  - Evidence: Screenshot.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced the empty-state `Take my first photo` CTA sitting visually under the floating tab bar with only about 2 px of clearance. Post-fix, the CTA is 272 x 52 px at y=315-367, has 33.6 px clearance above the floating tab bar, center hit-tests to itself, has zero horizontal overflow, and tapping it opens the `/progress/capture` local-only photo consent gate. Evidence and report are in `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/` and `docs/e2e-bug-reports/2026-07-08-progress-empty-short-phone-clearance.md`.
- Branch: timeline time-lapse unavailable
  - Priority: Important
  - Automate later: Yes
  - Action: Open Progress with populated local photos, switch to Timeline, and tap `Play`.
  - Expected result: The Play affordance does not open a native or JavaScript dialog, does not appear inert, and renders stable timeline-local copy explaining that the gentle flip-through arrives with on-device capture while the dated timeline remains usable.
  - Evidence: Screenshot, route state, dialog check, and geometry snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, and app lock disabled opens `/progress`, switches to Timeline, verifies Play is 82 x 48 px, taps Play, renders route-owned time-lapse copy at 242 x 76 px, opens no JavaScript/native dialog, keeps horizontal overflow at zero, and keeps no-score copy visible. Evidence is in `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/`.
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
- Branch: biometric app-lock prompt unavailable or rejected
  - Priority: Critical
  - Automate later: Yes
  - Action: Enable app lock, open the app-wide lock overlay or the locked Progress timeline, and force the local-auth prompt to reject or become unavailable.
  - Expected result: The app stays locked, shows stable app-lock-unavailable copy only for native prompt failure, keeps user cancellation quiet, leaves the Unlock control available for retry, and uses device-neutral copy that reads correctly on iOS and Android.
  - Evidence: Inline alert text, route state, native auth log, and helper status assertion.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=true`, `EXPO_PUBLIC_E2E_APP_LOCK_AUTH=unavailable`, `EXPO_PUBLIC_E2E_APP_LOCK_READY=available`, populated Progress photos, and store Pro entitlement opens `/progress`, keeps the app-wide lock overlay visible, renders route-owned `App lock is not available on this device right now.` feedback, leaves the topmost Unlock button 106 x 48 px, opens no JavaScript/native dialog on initial prompt or retry, and keeps horizontal overflow at zero. A second run with app lock disabled and `EXPO_PUBLIC_E2E_APP_LOCK_READY=unavailable` verifies the You-tab App lock switch remains off, renders row-local `Choice not saved` / app-lock-unavailable copy, leaks no raw native/provider text, opens no dialog, and keeps the switch 52 x 48 px. Evidence is in `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/`.

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
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, and `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only` verifies a clean-origin returning Progress photo user shows `12 weeks · 3 photos · all on this phone` while the Trend insight stays hidden. The preserved no-score refusal surface exposes the optional, on-device, off-by-default opt-in link, `/trend/optin` starts with `Read my progress` off plus separate/revocable consent copy, one explicit toggle changes the switch to `aria-checked=true` without failure copy, and reopening Progress renders the on-device Trend card. The scoped Trend output has no score, grade, skin age, or percentage; visible controls remain 48 px+ and horizontal overflow is zero. Evidence is in `test-results/human-e2e/2026-07-08/installed-base-trend-reconsent-current/`. Source tests now make a configured ledger with legacy `photo_capture` but no `photo_trend_insights` fail closed, so old photo users are not silently enrolled.
- Branch: consent save or withdrawal failure
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only`, open `/trend/optin`, toggle the opt-in on, retry the grant, toggle it off, then retry the withdrawal.
  - Expected result: The switch is disabled while saving, keeps a usable 44 pt touch target, failed grant/revoke attempts show stable "choice not saved" copy with a persistent alert region, the compact failure state does not expose clipped secondary controls, the visible consent state refreshes after each attempt, no raw backend/provider error appears, and successful retries clear the failure state.
  - Evidence: Failure/success screenshots, `role="alert"` copy, switch geometry, visible route state after each retry, and browser warn/error logs.
  - Current local evidence: 2026-07-08 In-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only` verifies direct `/trend/optin` starts with the switch off, failed grant renders persistent `Choice not saved` copy in a route-owned alert region with no JavaScript/native dialog, retry turns the switch on and clears the alert, failed withdrawal leaves the switch visibly on with the same inline alert and no dialog, retry turns the switch off and clears the alert, the switch remains 52 x 48, compact secondary links are hidden only while failure copy is visible, horizontal overflow is zero, and no raw backend/provider error appears. Evidence is in `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/`.
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
- Branch: reminders, streaks, and widgets routes
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/routine/streak`, `/routine/welcome-back`, and `/routine/widgets` directly.
  - Expected result: Free users see the reminders/widgets contextual paywall, not the streak or widget surface.
  - Evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 verified fresh free direct `/routine/streak`, `/routine/welcome-back`, and `/routine/widgets` all render the `Reminders, streaks & home-screen widgets.` contextual paywall, expose no streak, welcome-back, or widget surface content before entitlement, keep visible controls 48 px+, keep horizontal overflow at zero, and open no JavaScript dialog. From the same paywall, `Explore first. 7 days of Pro` starts the local no-card reverse trial; direct `/routine/widgets` reaches the deferred widget surface with `Back to Today`, `/routine/streak` renders `Showing up beats being perfect.`, and `/routine/welcome-back` renders `Welcome back.` with the `Tonight's step` CTA. Evidence is in `test-results/human-e2e/2026-07-08/reminders-streak-welcome-current/`.
  - Current 320 x 480 contextual ProGate follow-up: 2026-07-08 bundled Playwright Chrome Expo web verifies direct `/routine/streak` and `/routine/widgets` keep Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first reachable in the compact header/body layout, with zero target issues, zero visible-control issues, zero horizontal overflow, zero dialogs, and no unexpected browser logs. Evidence is in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`.
- Branch: native-widget preview check-off
  - Priority: Important
  - Automate later: Yes
  - Action: With Pro entitlement and `EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED=true`, open `/routine/widgets`, tap the in-app one-tap check-off preview rows, and inspect the count and recovery copy.
  - Expected result: Preview rows that look tappable are real 44 pt controls, update the in-app widget preview count, expose checkbox state to assistive tech, and show honest inline feedback that home-screen check-off still requires the native widget build. No row should render a fake `TAP` label or inert checklist affordance.
  - Evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and `EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED=true` verifies `/routine/widgets` preview rows are 48 px `role="checkbox"` controls, expose checked state after tapping, advance the count from `2 of 4` to `4 of 4`, show inline native-widget-build feedback, open no JavaScript dialog, keep horizontal overflow at 320 px, record zero current-route unexpected browser logs, and have zero visible controls below 44 px. Evidence and report are in `test-results/human-e2e/2026-07-08/widgets-preview-checkoff-current/`; bug report is `docs/e2e-bug-reports/2026-07-08-widgets-preview-inert-checkoff.md`.
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
  - Expected result: Policy and billing links show clear unavailable feedback instead of silently doing nothing; Restore still reports success/failure through the purchase state and leaves visible status on the current surface.
  - Evidence: Alert text or row-local feedback, visible route snapshot, and control-geometry snapshot.
  - Current local evidence: 2026-07-08 System Chrome CDP Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all` verifies direct `/paywall/upsell?feature=full_routine` renders row-local `Link unavailable` after Terms/Privacy failure and `No active subscription was found for this account.` after Restore. The Start free trial control is 264 x 54, Terms/Privacy/Restore controls are 48 px+ tall, and horizontal overflow is zero. Follow-up Codex in-app browser evidence at 320 x 568 verifies the same direct paywall restore branch opens no JavaScript dialog, renders exactly one route-owned `role="alert"` restore message, exposes no raw RevenueCat/provider text, keeps all controls 48 px+ tall, and keeps horizontal overflow at zero. Latest evidence also verifies the web-preview store-unavailable state keeps purchase disabled with honest preview copy while compliance restore remains reachable. Evidence is in `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/`, `test-results/human-e2e/2026-07-08/paywall-restore-inline-recovery-current/`, and `test-results/human-e2e/2026-07-08/paywall-inline-recovery-current/`. Native RevenueCat purchase-sheet failure, native restore, and OS billing-management handoff remain Phase 5/6 device QA.
- Branch: Pro entitlement state
  - Priority: Critical
  - Automate later: Yes
  - Action: Open the same routes with an active Pro or reverse-trial entitlement.
  - Expected result: The intended Pro surface renders and remains usable.
  - Evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 verifies local reverse-trial entitlement unlocks `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, `/cycle/procedure`, `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, `/routine/adaptation`, `/routine/streak`, `/routine/welcome-back`, and `/routine/widgets`: scheduler routes render their intended nested surfaces instead of the scheduler paywall, full-routine routes render their intended Pro surfaces, streak shows the calm adherence surface, welcome-back shows the earn-back surface with `Tonight's step`, and widgets show the deferred native-widget surface with `Back to Today` instead of the paywall. Earlier 2026-07-07 evidence also verifies local reverse-trial entitlement unlocks `/routine/plan`.
- Branch: unreviewed cycle-cadence production gate
  - Priority: Critical
  - Automate later: Yes
  - Action: With an active Pro or reverse-trial entitlement in a non-dev build while routine cadence review is still closed, open `/cycle/week`, `/cycle/settings`, and `/cycle/why-tonight` directly.
  - Expected result: Cycle week, settings, and explainability surfaces show review-gate copy, keep the daily AM/PM routine available, hide cadence-specific controls or pause/recovery banners, and do not promise that adding an active will build a cycle until dermatologist and cosmetic-chemist review opens the gate.
  - Evidence: Route screenshots or UI snapshots plus the cadence-gate contract test output.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed` verifies direct `/cycle/week`, `/cycle/settings`, and `/cycle/why-tonight` stay on review-gate copy for an active Pro fixture while cadence review is closed. Week and settings keep the AM/daily-routine reassurance visible, hide Settings/variant/night controls, hide cycle night rows, hide pause/recovery banners, avoid `add an active/build your cycle` promises, keep visible controls 48 px+ (56 px on `Got it`), and have zero horizontal overflow. `Got it` on direct `/cycle/why-tonight` returns to `/today`. Evidence is in `test-results/human-e2e/2026-07-08/cycle-cadence-review-gate-current/`; native iOS/Android bottom-sheet, safe-area, screen-reader, and reviewer-signoff QA remain open.
- Branch: Pro direct-entry route exits
  - Priority: Important
  - Automate later: Yes
  - Action: With an active Pro or reverse-trial entitlement, open scheduler and routine routes such as `/cycle/week`, `/cycle/why-tonight`, `/routine/reorder`, `/routine/tolerance`, and `/routine/widgets` directly, then use the visible Back, Done, Got it, Skip, Dismiss, Not yet, or sheet backdrop Dismiss control.
  - Expected result: The user returns to the Today tab instead of being trapped on a direct-entry Pro surface or modal sheet with no navigation history. Deferred widget routes use a destination-specific `Back to Today` CTA instead of generic Back copy. Visible Pro route exits and the Widgets Live Activity opt-in switch meet the 44 pt phone touch target, empty Pro states still expose an exit, `/routine/welcome-back` keeps its primary action fully visible with a rendered bottom buffer on short phones, projected cycle-night rows open the selected night's explainability sheet instead of an inert haptic-only button, projected row labels and settings active-night labels use wrapped, user-facing cycle-night copy such as `Night 1`, `Night 2`, and `Nights 3-4` instead of terse or impossible row numbers such as `N0`, `N5`, or `N3-4`, repeated retinoid or repeated exfoliant-slot nights are separated by recovery instead of appearing back-to-back, cycle safety/fallback notes render as readable text instead of inert buttons, phased-introduction cycle notes are the only tappable note CTA and meet the 44 pt phone touch target, and modal Pro sheets remain scrollable on short phones.
  - Evidence: Screenshot sequence, visible route snapshot, cycle-night spacing snapshot, and small-phone button-geometry snapshot.
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
  - Current 320 x 480 contextual ProGate follow-up: Contextual ProGate paywalls now use a sub-520 px treatment that moves Terms, Privacy, and Restore into a compact header row, keeps `Maybe later` at 48 px in the same top band, hides duplicate bottom compliance, and trims only the paywall body spacing. 2026-07-08 bundled Playwright Chrome Expo web verifies `/progress`, `/routine/plan`, `/routine/ramp`, `/routine/tolerance`, `/routine/reorder`, `/routine/adaptation`, `/cycle/settings`, `/cycle/disruption`, `/cycle/procedure`, `/cycle/phased-intro`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/week`, `/routine/streak`, `/routine/widgets`, and `/paywall/upsell?feature=full_routine` at 320 x 480 with zero target issues, zero visible-control issues, zero horizontal overflow, zero dialogs, and no unexpected browser logs. A later 320 x 568 text-pressure audit found the Progress photo paywall needed the same header compliance even outside the sub-520 px band; ProGate now applies that treatment to compact `/progress*` photo paywalls too. The 320 x 390 / 120% sweep verifies direct `/paywall/upsell?feature=full_routine` keeps `Maybe later`, Terms, Privacy, Restore, and Start free trial complete and center-hit-testable with zero overflow. Evidence and reports are in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`, `test-results/human-e2e/2026-07-08/progress-progate-text-pressure-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/`, `docs/e2e-bug-reports/2026-07-08-progate-short-phone-compliance-clipping.md`, and `docs/e2e-bug-reports/2026-07-08-progress-progate-text-pressure-tabbar-overlap.md`; native iOS/Android safe-area and Dynamic Type behavior remain release QA.
  - Current 430 x 932 tall-phone contextual ProGate evidence: 2026-07-09 Codex in-app browser Expo web verifies `/progress` uses the compact compliance header on the tall supported-phone viewport. Terms, Privacy, Restore, and Maybe later render as 48 px top-band controls, `Start free trial` renders as a complete 382 x 54 px CTA above the floating tab bar, the Explore-first visible body compacts to `No card needed.` while retaining the full accessibility label, horizontal overflow is zero, no dialog opens, and tapping Maybe later returns to `/today`. Evidence and report are in `test-results/human-e2e/2026-07-09/progate-tall-phone-header-current/`; native iOS/Android Dynamic Type and store-sheet behavior remain release QA.
  - Current 320 x 430 / 130% contextual ProGate follow-up: 2026-07-08 headless Chrome Expo web reproduced compact-header overlap on routine and cycle locked routes. Post-fix, ultra-short contextual ProGate paywalls reserve a stacked 96 px header band for compliance plus dismiss and hide the monthly-equivalent label, and the 49-route 130% text-pressure sweep reports zero failures. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-postfix/` and `docs/e2e-bug-reports/2026-07-08-progate-text-pressure-130-header-overlap.md`; native iOS/Android safe-area and Dynamic Type behavior remain release QA.
  - Current 320 x 370 / 320 x 360 / 130% contextual upsell follow-up: 2026-07-08 headless Chrome Expo web verifies the sub-380 px contextual ProGate band and direct upsell sheet keep compact compliance, dismiss, annual price, store-unavailable reason, and Start free trial complete while dropping nonessential body copy and the monthly-equivalent price where needed. A 2026-07-09 follow-up gave the micro-short contextual CTA a raised one-line hit target after the loaded `/progress` paywall CTA center resolved to surrounding paywall content. The final 49-route sweeps report zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-5/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-6/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, and `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`; native iOS/Android safe-area and Dynamic Type behavior remain release QA.
  - Current 320 x 390 / 320 x 360 / 200% contextual upsell follow-up: 2026-07-08 headless Chrome Expo web passed the 320 x 390 sweep, then found the 320 x 360 direct upsell CTA and contextual Progress CTA could land as partial or blocked targets under 200% text pressure. Post-fix, direct upsell and contextual ProGate use micro-short fitted titles, one-line price/CTA treatments, compact compliance, and a tappable store-unavailable CTA path so the user receives route-owned feedback instead of a dead disabled control. The final 49-route 320 x 360 sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-micro-short-360-clearance.md`; native iOS/Android safe-area, Dynamic Type, and store-sheet behavior remain release QA.
  - Current 320 x 568 / 140% contextual upsell follow-up: 2026-07-08 headless Chrome Expo web reproduced direct upsell CTA clipping and routine/cycle ProGate header overlap at 140% text pressure. Post-fix, narrow 320 px short paywalls use an icon dismiss, omit nonessential body copy, hide the monthly-equivalent price, and keep annual price, store-unavailable reason, compliance links, dismiss, and Start free trial complete and hit-testable. The final 49-route sweep reports zero failed routes with evidence in `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-3/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-140-compact-568-clearance.md`; native iOS/Android Dynamic Type behavior remains release QA.
  - Current shortest-phone contextual upsell evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 opens direct `/paywall/upsell?feature=full_routine` and `/paywall/upsell?feature=reminders_widgets`, verifies RoutineKind Pro copy, preview-store fallback copy, `Start free trial`, Terms, Privacy, Restore, and `Maybe later` are visible without scrolling, visible user-facing controls are 48 px+, horizontal overflow is zero, no center hit-test is blocked, no JavaScript dialog appears, and `Maybe later` recovers to `/today`. The only sub-44 geometry node in the follow-up run was an `aria-hidden="true"` / `tabindex="-1"` sheet spacer, not a user-facing target. Evidence is in `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/`, `test-results/human-e2e/2026-07-08/commerce-attribution-and-short-phone-ui/`, and `docs/e2e-bug-reports/2026-07-08-shelf-paywall-short-phone-bottom-actions.md`.
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
- Current ultra-short evidence: `test-results/human-e2e/2026-07-08/recommendations-ultrashort-430-current/`
- Current local evidence: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/`

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
  - Current modern/support-floor follow-up: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/recommendations/preferences` after modern texture-group spacing calibration. The 390 x 844 modern-phone pass keeps visible value, budget, and texture chips complete with all texture chips visible and hit-testable; the 320 x 480 support-floor pass keeps visible value controls complete while lower sections remain scroll-reachable. Both passes report zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
- Branch: recommendation preference save failure
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/recommendations/preferences`, tap a value, budget, or texture chip while forcing local private preference persistence to reject.
  - Expected result: Chips are disabled while saving, the new state is applied only after persistence succeeds, failures show stable route-owned copy without a blocking native dialog, and the For You hub does not recompute from an unsaved preference.
  - Evidence: Alert-region text, absence of a JS/system dialog, disabled chip state, and local preference state.
  - Current local evidence: 2026-07-08 System Chrome Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once` and `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS=1200` verifies `Vegan` stays `aria-selected=false` and disabled while the failed save is pending, shows stable `Preference not saved` copy after rejection with no JS/system dialog, disables again during retry, becomes `aria-selected=true` only after the successful save, persists after reload, keeps zero horizontal overflow, and keeps visible controls 48 px tall. Evidence is in `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/`.

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
  - Current locking evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with commerce enabled and a final-domain flag reproduced a stack regression where `/commerce/stack/sensitive-skin-starter-set` exposed `Paid link`, `Paid links`, external glyphs, and paid-link accessibility labels before consent. Post-fix, the stack shows `Consent needed` locked rows, no paid-link text, no external glyph, zero horizontal overflow, no sub-44 visible controls, and locked item taps open `/commerce/consent`. The same run adds a cleanser through `/shelf/manual`, opens `/recommendations/gap:mineral_spf`, verifies the locked where-to-buy block has no paid-link text/glyph, 48 px `Allow where-to-buy`, 50 px shelf alternative, the Allow control opens the consent sheet, and the shelf alternative routes to `/shelf/manual`. Evidence and report are in `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/` and `docs/e2e-bug-reports/2026-07-08-commerce-stack-paid-links-before-consent.md`.
- Branch: retailer link handoff failure
  - Priority: Important
  - Automate later: Yes
  - Action: With commerce consent on and a real HTTPS retailer URL available, simulate the OS refusing to open the external URL.
  - Expected result: The app shows a calm Link unavailable message, does not appear inert, and the user remains in the recommendation context.
  - Evidence: Partial. The 2026-07-07 local run reaches the consent-allowed catalog-blocked empty state because source-cleared retailer links and affiliate partner rails are not approved yet. 2026-07-08 Codex in-app browser Expo web at 320 x 568 with commerce enabled verified the stack paid-link stub path stays on `/commerce/stack/sensitive-skin-starter-set`, opens no dialog, renders a visible route-owned `role="alert"` message at viewport y=242-408 before the paid-link rows, keeps the paid-link row touchable, and keeps zero horizontal overflow. Source contracts now reject native `Alert` calls in `WhereToBuy` and stack paid-link recovery. Real retailer URL OS-refusal remains open until approved HTTPS retailer links are available.

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
   Current shortest-phone evidence: 2026-07-08 Expo web at 320 x 480 reproduced the third Skin Note clipping below the viewport on `/community`. Post-fix, the same route uses the sub-520 px Skin Notes hub/card density so the visible note cards are fully readable, the 48 px Back control remains visible, the flag-dependent Ask control remains 48 px by source contract when exposed, horizontal overflow is zero, and the third visible card no longer clips below the viewport. Evidence and bug report are in `test-results/human-e2e/2026-07-08/community-short-phone-480-card-fit/` and `docs/e2e-bug-reports/2026-07-08-community-short-phone-card-clipping.md`.
   Current ultra-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the third Skin Note clipping by about 3 px in the post-Recommendations route sweep. Post-fix, `/community` adds a sub-460 px scroll-content density so the third note is fully visible and tappable; tapping `Is "natural" always gentler for sensitive skin?` opens the note detail with zero clipped controls, zero sub-44 controls, and zero blocked center hit-tests. Final 320 x 430 clearance evidence also verifies `/community` in the four-route focused pass, and the fresh 49-route 320 x 430 sweep reports zero failed routes. Evidence is in `test-results/human-e2e/2026-07-08/community-short-phone-430-card-fit/`, `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/`, and `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
   Current 390 x 844 / 200% text-pressure evidence: 2026-07-09 headless Chrome Expo web found the first Sunscreen note card entering the bottom edge as an 18 px partial target. Post-fix, the short modern-phone Skin Notes hub moves that later topic section below the first viewport, keeping all visible note cards complete and hit-testable. The final 49-route sweep and current-source rerun report zero failed routes with evidence in `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-current-rerun/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-200-modern-390-clearance.md`; native Dynamic Type remains device QA.
   Current 430 x 932 / 120% text-pressure evidence: 2026-07-09 headless Chrome Expo web reproduced the later Sunscreen section as a partial bottom-edge target on `/community`. Post-fix, the modern-phone Skin Notes spacing applies below 980 px height, and the 430 x 932 final sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/` and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`; native Dynamic Type remains device QA.
   Current support-floor evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` verified `/community` at 390 x 844 and 320 x 480 after current-source support-floor calibration. The route keeps visible Skin Notes cards complete and hit-testable, avoids partial lower-topic targets, reports zero clipped controls, zero blocked hit centers, zero sub-44 visible controls, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin browser logs. Evidence and bug report are in `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/support-floor-summary-final.json` and `docs/e2e-bug-reports/2026-07-09-community-support-floor-partial-card.md`; native iOS/Android rendering remains device QA.

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
- Branch: claim-safe anonymous ask
  - Priority: Critical
  - Automate later: Yes
  - Action: With community posting enabled and consent granted, type claim-heavy and calm questions into the anonymous ask composer.
  - Expected result: Claim-safety copy flags risky wording as a first pass, never as an automated moderation decision, and no question is posted publicly before human review is staffed.
  - Evidence: Screenshot sequence and local moderation state.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED=true` verified the enabled `/community/ask` consent gate requires the 16+ checkbox, local-first consent reaches the anonymous composer with Supabase unconfigured, claim-heavy text (`Can glycolic acid cure acne if I use it every night?`) shows the claim-safety flag, `Submit for review` opens no dialog, and the route-owned `Asking opens soon` `role="alert"` recovery scrolls fully into view at y=292-471 with zero horizontal overflow. Evidence is in `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/`.

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
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED=true`, `EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED=true`, `EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED=true`, `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`, `EXPO_PUBLIC_E2E_REVIEWED_CONFLICT_SHARING=true`, and `EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT=unavailable` adds real Retinol 0.3% and Glycolic 7% products through manual shelf intake, opens the reviewed conflict share route, verifies the share card is present with a 272 x 56 Share to Stories control and 272 x 48 Done control, taps Share to Stories, renders inline `Sharing unavailable` recovery, opens no JavaScript/native dialog, leaks no raw native/provider text, and keeps horizontal overflow at zero. Evidence is in `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/`.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 opened a seeded reviewed conflict share card, tapped `Share to Stories` with native sharing forced unavailable, verified no native/browser dialog, kept the branded card and controls visible, and rendered inline `Sharing unavailable` feedback above the export action. Evidence is in `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/`.

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
  - Current support-floor evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` verified `/settings/privacy` at 390 x 844 and at the 320 x 480 launch support-floor viewport after direct-entry scroll/spacer calibration. Both direct entries resolve to `/you?section=privacy`, keep visible privacy controls complete and 44 px+, leave lower-priority policy rows fully below the first viewport, and report zero clipped controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin browser logs. The same focused support-floor sweep verifies `/today`, `/recommendations/preferences`, `/shelf/scan`, `/shelf/no-match`, `/routine/plan`, and `/community` across supported-floor or modern-phone viewports. Evidence and report are in `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/support-floor-summary-final.json`, `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/report.md`, and `docs/e2e-bug-reports/2026-07-09-settings-privacy-support-floor-direct-entry.md`.
  - Current policy-spacing evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/settings/privacy` after policy support-row spacing calibration. The 320 x 480 support-floor and 390 x 844 modern-phone viewports resolve to `/you?section=privacy`, keep visible privacy controls complete and 44 px+, keep policy rows present but fully below the first viewport, and report zero clipped controls, zero blocked hit centers, zero sub-44 visible controls, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin browser logs. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-privacy-policy-support-spacing-current/`.
  - Current layout-constant evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/settings/privacy` at 320 x 480 and 390 x 844 after the narrow withdraw-row spacer calibration. Both viewports resolve to `/you?section=privacy`, keep visible privacy controls complete, keep policy/data rows below the first viewport, and report zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
  - Current support-floor withdraw evidence: 2026-07-09 Codex in-app browser Expo web reverified `/settings/privacy` at the 320 x 480 launch support floor after the support-floor withdraw spacer was tightened. The first viewport resolves to `/you?section=privacy`, keeps Marketing emails and Photos/no-AI controls complete, leaves `Withdraw health-data consent` fully below the first viewport instead of peeking under the floating tab bar, and reports zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, and zero unexpected current-origin logs. A user-like scroll reaches a complete 232 x 72 px `Withdraw health-data consent` button with no blocked center. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/` and `docs/e2e-bug-reports/2026-07-09-settings-privacy-support-floor-withdraw-peek.md`.
  - Current Terms policy-row evidence: 2026-07-09 Codex in-app browser Expo web reverified `/settings/privacy` at the 320 x 480 launch support floor after adding the direct-entry Terms policy-row spacer. A user-like scroll reaches a complete 232 x 55 px `Terms` row above the floating tab bar, its center hit-test resolves to the row, tapping it renders route-owned `Link unavailable` recovery with no dialog, and horizontal overflow stays zero. The same pass spot-checks 390 x 844 with complete privacy controls above the bar and zero current-origin warn/error logs. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-privacy-terms-support-floor-current/`.
  - Current 320 x 568 / 120% text-pressure evidence: 2026-07-08 headless Chrome Expo web reproduced compact privacy and policy row hints overflowing when the shared You-tab row forced one-line hints. Post-fix, compact hints wrap with a readable 16 px line height and the route audit reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/` and `docs/e2e-bug-reports/2026-07-08-settings-privacy-text-pressure-overflow.md`.
  - Current 320 x 430 / 120% text-pressure evidence: 2026-07-08 headless Chrome Expo web verifies `/settings/privacy` redirects into the You tab privacy section with ultra-short direct-entry density: secondary hints are hidden where needed, privacy rows stay complete above the floating tab bar, and the route reports zero clipped controls, blocked hit-tests, sub-44 visible controls, horizontal overflow, or disallowed browser logs in the final 49-route sweep. A 2026-07-09 320 x 360 / 130% rerun found the health-data withdrawal row could appear while its hit center resolved to the underlying You tab content; post-fix it remains in the active privacy card hit layer and the paired 360/370 px sweeps pass. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`, `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-micro-short-370-clearance.md`.
  - Current supported-phone 120% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/privacy` direct-entry policy/data rows peeking into the floating-tab zone at 320 x 480, 390 x 844, and 430 x 932. Post-fix, direct privacy entries keep policy and data rows below the first viewport until the user scrolls, and the 320 x 568, 320 x 480, 390 x 844, and 430 x 932 final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`.
  - Current supported-phone 170% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/privacy` direct-entry first viewports exposing the Reminders card at 320 x 568, the `Withdraw health-data consent` row under the floating tab bar at 320 x 480, and lower policy rows including `Consumer health privacy` as partial 430 x 932 bottom-edge targets. Post-fix, direct privacy entries suppress the unrelated Reminders card and push destructive health-data and lower-priority policy actions fully below the first supported/tall-phone viewport until scroll. The 320 x 568, 320 x 480, 390 x 844, and 430 x 932 final 170% sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-170-compact-568-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-4/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-390-postfix-6/`, `test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-170-supported-phone-clearance.md`.
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
  - Current local evidence: 2026-07-08 System Chrome CDP Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all` verifies `/settings/subscription` shows `RoutineKind Pro`, `Manage in App Store`, Restore, Terms, and Privacy. Manage failure renders `We could not open subscription management...`, Terms/Privacy failure renders `Link unavailable`, Restore renders `No active subscription was found for this account.`, controls are 52-53 px tall, and horizontal overflow is zero. Follow-up Codex in-app browser evidence on the same fixture verifies Manage, Terms, and Restore all render route-owned `role="alert"` feedback, open no JavaScript dialog, keep the route on `/settings/subscription`, keep current-run warn/error logs empty after expected local placeholder warnings, and keep horizontal overflow at zero. Evidence is in `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/` and `test-results/human-e2e/2026-07-08/paywall-inline-recovery-current/`. Native iOS/Android RevenueCat restore and store-management sheet evidence remain Phase 5/6 QA.
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
- Branch: privacy and security choice save failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Open `/settings/privacy` on a compact phone viewport, tap the Marketing emails switch while consent persistence is unavailable, then repeat with keyboard activation.
  - Expected result: The switch uses a real 44 pt or larger touch target, failed persistence does not silently flip visible state, no native or JavaScript dialog blocks the user, row-local `Choice not saved` recovery copy appears near the changed control, no raw backend/provider error leaks, and the layout keeps zero horizontal overflow.
  - Evidence: Screenshot sequence, dialog-state check, switch state, alert-region geometry, and horizontal-overflow snapshot.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with local Supabase placeholders unavailable verifies `/settings/privacy` redirects to `/you?section=privacy`, the Marketing emails switch is 52 x 48 px and unchecked before interaction, pointer tap and keyboard activation both render an inline `role="alert"` message (`Choice not saved` / retry copy), the switch remains unchecked, no JS dialog appears, the alert is 232 x 68 px between the marketing row and the next privacy row, raw backend text is hidden, and horizontal overflow is zero. Evidence is in `test-results/human-e2e/2026-07-08/settings-privacy-choice-inline-feedback/`. Native iOS/Android switch and consent-service evidence remain device QA.
- Branch: data export share unavailable
  - Priority: Critical
  - Automate later: Yes
  - Action: Tap Export my data while the OS share sheet is unavailable, cannot be detected, or rejects after the temporary JSON export is created.
  - Expected result: The app shows clear route-owned export-unavailable feedback with `role="alert"`, opens no native or JavaScript dialog, does not treat the export as completed for review prompting, and deletes the temporary plaintext export file.
  - Evidence: Inline alert text, dialog-state check, mutation state, and cache cleanup assertion.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 verifies `/settings/privacy` resolves to `/you?section=privacy`, `Export my data` is unique, the local backend-unavailable failure renders the visible privacy-request recovery copy, visible data-rights controls are 56 px tall, horizontal overflow is zero, and focused settings action tests cover unavailable share/cache cleanup plus destructive delete/withdraw fallback behavior. Live Supabase and native share-sheet evidence remain external QA.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with placeholder Supabase unavailable verifies `/settings/privacy` resolves to `/you?section=privacy`, tapping `Export my data` renders inline `Export failed` recovery with `role="alert"`, opens no JavaScript/native dialog, leaks no raw backend/provider text, keeps visible controls 56 px tall, and keeps horizontal overflow at zero. Evidence is in `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/`.
- Branch: destructive data-rights confirmation and failure
  - Priority: Critical
  - Automate later: Yes
  - Action: Tap Withdraw health-data consent and Delete account on a compact phone viewport, cancel the first confirmation, then confirm each action while the data-rights backend is unavailable.
  - Expected result: Each destructive action requires an inline second confirmation with visible Cancel and destructive confirm controls, opens no native or JavaScript dialog, keeps the route usable after backend failure, renders raw-error-free route-owned recovery near the initiating section, and keeps controls at least 44 px tall with zero horizontal overflow.
  - Evidence: Confirmation screenshots, post-failure screenshots, dialog-state check, control-geometry snapshot, and browser logs.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 verifies `Delete account` opens an inline confirmation, `Cancel` removes it, confirming with the backend unavailable renders inline `Deletion failed`, `Withdraw health-data consent` opens a section-local inline confirmation, confirming renders inline `Withdrawal failed`, no JavaScript/native dialog opens, raw backend/provider text is hidden, confirmation buttons are 200 x 56 and nudged above the floating tab bar, the route remains `/you?section=privacy`, and horizontal overflow is zero. Evidence is in `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/`.
- Branch: cloud-backup tradeoff notice
  - Priority: Important
  - Automate later: Yes
  - Action: In the You tab Security section, turn Encrypted cloud backup on after local persistence succeeds.
  - Expected result: The device-loss/cloud-backup tradeoff appears inline near the Security switch with `role="alert"`, does not open a native or JavaScript dialog, preserves the saved ON state, and keeps the switch and notice readable on compact phones.
  - Evidence: Inline notice screenshot, switch state, dialog-state check, control-geometry snapshot, and browser logs.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with placeholder Supabase unavailable verifies the `Encrypted cloud backup` switch is 52 x 48, fails closed with inline `Choice not saved` recovery, opens no JavaScript/native dialog, keeps the switch OFF, leaks no raw storage/backend text, and keeps horizontal overflow at zero. The success tradeoff branch is source-guarded to be inline but still needs live consent-ledger/native evidence because cloud backup intentionally fails closed without ledger persistence. Evidence is in `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/`.
- Branch: reminder timing and discretion
  - Priority: Important
  - Automate later: Yes
  - Action: Open notification settings, toggle reminder tiers, edit AM/PM timing and quiet hours, then return to settings.
  - Expected result: User-set times, contextual timing-control and picker-row labels for assistive tech, 44 pt reminder-tier switches, and discreet lock-screen copy remain clear and calm, with no notification-pressure copy. Time picker sheets expose a single named modal dialog, a named dismiss action, and no unlabeled inert sheet-body controls.
  - Evidence: Screenshot sequence, local preference snapshot, and small-phone accessibility/geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web at 320 x 568 verifies `/settings/notifications` tier rows and switches, `/settings/timing` time pills, the Morning reminder time-picker sheet, AM time update from 7:30 AM to 8:00 AM, return to the notifications hub with the updated time, quiet-hours copy, generic lock-screen preview, zero horizontal overflow, and 48 px visible controls. Focused notification tests cover quiet-hours scheduling, delivery caps, lock-screen discreet copy, preference persistence, and route/touch-target contracts; native OS permission/scheduling QA remains external.
  - Current safe-area evidence: 2026-07-07 Codex in-app browser Expo web verifies the hand-built `/settings/timing` Morning picker keeps 40 px zero-inset web bottom padding, zero horizontal overflow, 48 px visible picker rows, one named dialog, and a 44 px named dismiss target in the compact observed viewport after sheet-height capping; selecting `8:00 AM` closes the modal and updates the Morning pill. Evidence is in `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/`. Native iOS/Android home-indicator and screen-reader verification remains device QA.
  - Current ultra-short evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 430 reproduced the `Replenishment` switch clipping in the post-Recommendations route sweep. Post-fix, `/settings/notifications` uses sub-460 px row density that preserves 48 px switches and complete visible controls; tapping Replenishment toggles the switch with no JavaScript dialog, no clipped controls, no sub-44 controls, and zero blocked center hit-tests. Evidence is in `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/` and the fresh 49-route zero-failure sweep `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
  - Current 320 x 430 / 120% text-pressure evidence: 2026-07-08 headless Chrome Expo web verifies `/settings/notifications` keeps visible notification switches complete and 48 px+ under enlarged text, while the lower promotional row starts below the first viewport instead of peeking behind the floating tab bar. The final 49-route sweep reports zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`.
  - Current supported-phone 120% text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/notifications` still peeking the lower promotional switch section at the 320 x 480 and 320 x 568 supported heights. Post-fix, the promotional section starts fully below the first viewport while the visible reminder switches remain complete and 48 px+, and the 320 x 568 and 320 x 480 final sweeps report zero failed routes. Evidence and report are in `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`, `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`, and `docs/e2e-bug-reports/2026-07-09-text-pressure-120-supported-phone-clearance.md`.
  - Current 320 x 370 / 320 x 360 / 130% micro-short text-pressure evidence: 2026-07-08 headless Chrome Expo web reproduced `/settings/notifications` peeking the lower-priority `Progress-photo nudge` switch by a few pixels at the viewport bottom. Post-fix, notifications use a split-short band below 410 px that keeps visible switches complete and moves `Progress-photo nudge` fully below the first viewport, while `/settings/timing` compacts the header, time rows, quiet-hours card, and helper copy for the sub-380 px envelope. A 2026-07-09 rerun corrected the micro-short nudge spacer so `Streak & adherence` and `Replenishment` stay complete instead of one row peeking at 320 x 360. The final 49-route sweeps report zero failed routes. Evidence and bug report are in `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-current/`, `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`, `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-10/`, `test-results/human-e2e/2026-07-09/text-pressure-130-ultra-short-360-postfix-3/`, `test-results/human-e2e/2026-07-09/text-pressure-130-micro-short-370-postfix-2/`, and `docs/e2e-bug-reports/2026-07-08-text-pressure-micro-short-370-clearance.md`; native iOS/Android notification permission, scheduling, safe-area, and Dynamic Type QA remain external.
  - Current support-floor layout-constant evidence: 2026-07-09 Codex in-app browser Expo web on `localhost:8255` reverified `/settings/notifications` after promotional section spacer calibration. The 320 x 480 support-floor and 390 x 844 modern-phone viewports keep visible notification controls complete and hit-testable, with zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, zero JavaScript dialogs, and zero unexpected current-origin logs. Evidence and report are in `test-results/human-e2e/2026-07-09/support-floor-layout-constant-followup-current/`.
  - Current support-floor nudge evidence: 2026-07-09 Codex in-app browser Expo web found the non-micro split-short `/settings/notifications` spacer still let `Progress-photo nudge` peek by roughly 5 px at the 320 x 480 launch support floor. Post-fix, 320 x 480, 320 x 568, and 390 x 844 all report zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero current-run unexpected warn/error logs; tapping `Replenishment` changes `aria-checked`. Evidence and report are in `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/` and `docs/e2e-bug-reports/2026-07-09-settings-notifications-support-floor-nudge.md`.
  - Current 360 x 640 / 200% and 390 x 640 / 170% supported text-pressure evidence: 2026-07-09 headless Chrome Expo web found `/settings/notifications` let the lower-priority `Streak & adherence` switch peek into the first viewport by 5 px at 360 x 640 / 200% and by 30 px at 390 x 640 / 170%. Post-fix, the route pushes Gentle Nudges below the first viewport for 360/390-class supported text-pressure layouts while preserving complete utility reminder controls. The 49-route reruns at both sizes report zero failed routes, zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs. Evidence and reports are in `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-postfix/`, `docs/e2e-bug-reports/2026-07-09-settings-notifications-360-640-text-pressure.md`, and `docs/e2e-bug-reports/2026-07-09-settings-notifications-support-band-text-pressure.md`.

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
- Branch: cloud consent save or withdrawal failure
  - Priority: Critical
  - Automate later: Yes
  - Action: In a dev build started with `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only`, open `/ask/consent`, toggle `Enable Ask RoutineKind` on, retry the grant, toggle it off, then retry the withdrawal.
  - Expected result: Failed grant and withdrawal attempts do not open a native or JavaScript dialog, do not flip the visible consent state before persistence, render persistent route-owned `Choice not saved` feedback with `role="alert"`, keep retry possible on a 320 x 568 phone viewport, clear the alert after successful retry, and show no raw backend/provider error.
  - Evidence: Screenshot sequence, dialog count, compact control geometry, route text snapshot, and browser warn/error logs.
  - Current local evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only` verifies the switch starts off, failed grant keeps it off with route-owned `Choice not saved` alert and no JavaScript dialog, retry turns it on and clears the alert, failed withdrawal keeps it on with the same inline alert, retry turns it off and clears the alert, visible controls remain 48 px+, horizontal overflow is zero, no raw fixture/provider error appears, and current-run browser warn/error logs are empty. The first pass found the shared web `ToggleSwitch` was inert because web disabled `onPress`; `docs/e2e-bug-reports/2026-07-08-toggle-switch-web-inert.md` records the bug and fix. Evidence is in `test-results/human-e2e/2026-07-08/ask-consent-failure-current/`.
- Branch: empty shelf state
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/ask` with no shelf products stored.
  - Expected result: The advisor still renders with honest empty-state guidance and safe suggested prompts.
  - Evidence: Screenshot.
- Branch: first suggested prompt on a short phone
  - Priority: Important
  - Automate later: Yes
  - Action: Open `/ask` at 320 x 568 and 320 x 480 with an empty shelf, tap `Is there a conflict on my shelf?`, and inspect the first conversation state without manually scrolling.
  - Expected result: The user question, deterministic badge, empty-shelf answer, report control, fixed composer, and disclosure footer remain readable; the first user message is not auto-scrolled under the header, and no prompt or report control peeks partially underneath the fixed composer on compact or shortest phones.
  - Evidence: Screenshot, scroll-position snapshot, and small-phone control-geometry snapshot.
  - Current local evidence: 2026-07-07 Expo web 320 x 568 taps `Is there a conflict on my shelf?`, keeps the user question, deterministic `$0` badge, empty-shelf answer, report control, composer, and disclosure footer readable with zero horizontal overflow and no sub-44 px controls. The same pass typed `Should I use retinol every night?`; before the fix it misrouted to product-fit recommendation copy, and after the fix it escalates safely with no fit-engine, SPF, or vitamin-C recommendation text. Evidence is in `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/`, with additional Node REPL Playwright/system Chrome evidence in `test-results/human-e2e/2026-07-07/ask-active-frequency-escalation/`.
  - Current shortest-phone evidence: 2026-07-08 Codex in-app browser Expo web at 320 x 480 reproduced lower empty-state prompt buttons being intercepted by the fixed composer. Post-fix `/ask` hides decorative pills on the shortest phones, shows the top two prompt buttons above the composer, verifies both prompt centers hit their own buttons, taps `Is there a conflict on my shelf?`, and confirms the empty-shelf answer plus report control, input, Send, and disclosure have zero hit-blocked controls, zero sub-44 px controls, zero horizontal overflow, and no JavaScript dialog. Evidence is in `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/`.
  - Current 320 x 430 / 120% text-pressure evidence: 2026-07-08 headless Chrome Expo web verifies `/ask` uses the single safest empty prompt, hides nonessential intro copy, keeps the prompt center clear of the fixed composer, and reports zero clipped controls, blocked hit-tests, sub-44 visible controls, or horizontal overflow in the final 49-route sweep. Evidence and report are in `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/` and `docs/e2e-bug-reports/2026-07-08-text-pressure-short-phone-430-clearance.md`.
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
  - Current shortest-phone evidence: 2026-07-08 `/ask` at 320 x 480 verifies the visible prompt buttons, report control, input, and Send are 48 px or taller/wider where applicable, their center hit-tests resolve to the intended controls, and the disclosure footer remains visible without intercepting prompts. Evidence is in `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/`.

## Open Questions

- What exact fixtures reset the app into a fresh onboarding, returning routine, empty shelf, populated shelf, empty progress, and populated progress state?
- Which flows are safe to run without live Supabase, RevenueCat, Apple, Google, Sentry, or PostHog credentials?
- Should the first durable native mobile E2E suite use Detox, Maestro, native XCTest/XCUIAutomation, Android UI Automator, or another harness?
- Which Expo web routes should graduate from human-simulated evidence plus `e2e:human:manifest` into a committed Playwright suite after dependency approval?
- Where should long-lived release evidence live: `test-results/human-e2e/`, phase-specific docs folders, or both?
