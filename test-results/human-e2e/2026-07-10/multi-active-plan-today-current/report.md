# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-10
- Codex task: Canonical clear-mode multi-treatment Plan/Today projection
- App surface: Expo web in Codex in-app browser
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8160`
- Browser/device: Codex in-app browser at 360 x 640 and 390 x 844
- Overall verdict: Pass after three responsive fixes

## Fixture

The fixture was built through the real Shelf, consent, and 12-question profile UI. It uses an explicit `No` pregnancy/breastfeeding status and ten products: cleanser, moisturiser, SPF, two retinoids, AHA, BHA, benzoyl peroxide, hydroquinone, and copper peptide.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Plan | 360 x 640 | Pass | `plan-360x640-final*.png`, text, geometry | BP is Morning; all four canonical cycle products and recovery nights are visible after scroll; two undefined cadences are explicit. |
| Today AM | 360 x 640 | Pass | `today-am-360x640.*` | BP is a check-off, hydroquinone/copper are absent, timing notice says two, zero overflow/sub-44 controls. |
| Today PM | 360 x 640 | Pass after fix | `today-pm-360x640-postfix.*` | Exactly one canonical active, seven-night strip, zero overflow/sub-44 controls. |
| Plan | 390 x 844 | Pass | `plan-390x844-final*.png`, text, geometry | Canonical product/night summaries remain readable after scroll. |
| Today AM | 390 x 844 | Pass after fix | `today-am-390x844-postfix.*` | No secondary teaser intersects the floating tab bar; no visible-control geometry failures. |
| Today PM | 390 x 844 | Pass after fix | `today-pm-390x844-postfix.*` | Two-line week labels replace ellipses; exactly one cycled active. |
| Product detail | 390 x 844 | Pass | `retinol-a-detail-390x844-scrolled.*` | Retinol A shows canonical cycling nights 4, 10, and 14. |
| Completion persistence | 360 x 640 AM | Pass | `today-am-360x640-after-bp.txt`, `today-am-360x640-reloaded.txt` | BP changes to checked and remains checked after reload. |

## Bugs Found

| ID | Severity | Actual | Fix |
| -- | -------- | ------ | --- |
| E2E-MULTI-01 | High | Today compressed all 17 cycle slots into one 360 px strip. | Render the canonical seven-night `weekAhead` projection. |
| E2E-MULTI-02 | Medium | Seven one-line labels ellipsized at 390 px. | Use the established two-line compact labels below 430 px. |
| E2E-MULTI-03 | Medium | The new timing notice shifted the AM Tonight teaser into the floating-tab zone at 390 x 844. | Suppress that secondary teaser below 932 px when timing notices are present. |

## Verification

- Focused routine/scheduler/route tests passed, including the new cross-model contract.
- Mobile TypeScript and ESLint passed during the slice.
- Browser geometry reports zero horizontal overflow and zero sub-44 visible controls.
- Final 390 x 844 AM geometry reports zero tab intersections.
- Browser telemetry contains zero errors. Only expected local Supabase-placeholder and Expo web notification warnings were recorded.

## Remaining Risk

- Physical iOS/Android Dynamic Type, VoiceOver, and TalkBack are not represented by Expo web.
- The in-app browser could not apply a 200% text-only scale to this persisted complex fixture. Existing broad 200% route evidence remains supplementary; native device text-scale QA stays external.
- Named clinical/cosmetic review is still required before unsupported treatment cadences can be added rather than withheld.
