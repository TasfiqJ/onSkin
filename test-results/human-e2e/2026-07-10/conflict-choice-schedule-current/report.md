# Conflict Choice And Schedule Human E2E

- Local test date: 2026-07-10 (America/Toronto; capture continued after 00:00 UTC)
- Surface: Expo web development build in the Codex in-app browser
- Viewports: 360 x 640 support floor and 390 x 844 modern phone
- Fixtures: Pro entitlement, open cadence-review gate, and one-shot encrypted conflict-choice write failure
- Result: PASS for the local-first web contract

The run completed onboarding through the real UI, added Lactic Acid 5%,
Glycolic 7%, and Retinol 0.3%, and exercised two independent pairs governed by
the same retinoid/AHA rule. Exact-pair URLs named the right products. Keep and
Use together choices persisted after reload, suppressed only the resolved pair
across Shelf, Recommendations, and Ask, and changed product-detail and Why
Tonight explanations without placing two potent actives on one night. Plan,
Today, and Week retained the reviewed one-active schedule.

Rule-only and incomplete pair URLs failed closed when the rule was ambiguous.
The one-shot private-write fixture kept the exact conflict sheet open, rendered
`Choice not saved` as an alert, left the previous choice intact, and succeeded
on retry. The retried Use together decision then appeared on product detail.

At 360 x 640, both actions become fully visible after normal sheet scrolling,
measure 55.99 px and 48 px, and pass center hit-tests with zero horizontal or
text overflow. At 390 x 844, the post-fix actions are fully visible at initial
open, measure 55.99 px and 48 px, and pass center hit-tests. Initial focus lands
on the named dialog, Tab moves to Keep, Shift+Tab wraps to Use together, and
Escape returns to Shelf. A pre-fix 4 px partial secondary action and missing
web Escape/initial-focus traversal were found and corrected during this run.

Browser warning/error capture contains only the expected local placeholder
Supabase warnings, Expo web notification limitation, and one intentional Metro
disconnect caused by restarting the one-shot failure fixture. No route-owned
JavaScript error was recorded. The in-app browser does not expose a writable
native Dynamic Type setting, so exact populated-pair 200% text scaling remains
native device QA; the repository-wide supported-phone synthetic 200% route
sweeps remain separate baseline evidence.

## Evidence

- `geometry.json`: support-floor, modern-phone, save-failure, and keyboard measurements
- `conflict-choice-360x640-top.png`
- `conflict-choice-360x640-actions.png`
- `conflict-choice-390x844-top.png`
- `conflict-choice-390x844-save-failure.png`
- `product-detail-390x844-retried-choice.png`
- `conflict-choice-360x640-dom.txt`
- `conflict-choice-390x844-dom.txt`
- `conflict-choice-save-failure-dom.txt`
- `product-detail-retried-choice-dom.txt`
- `browser-warn-error-logs.json`

## Remaining External Proof

- Apply and rerun the migration against staging Postgres, including duplicate,
  reversed-pair, choice-retention, owner-RLS, and second-run checks.
- Verify the best-effort Supabase mirror, retry/reconciliation behavior, native
  encrypted storage, Dynamic Type, VoiceOver, TalkBack, and safe areas on the
  supported iOS and Android release-device matrix.
- Obtain named clinical and cosmetic-chemistry approval before any future rule
  may place a reviewed potent-active pair in the same session.
