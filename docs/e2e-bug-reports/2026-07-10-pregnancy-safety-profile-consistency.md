# E2E Bug Report: Pregnancy Safety Could Disagree Across Plan And Today

Severity: Critical
Surface: Mixed
Environment: Expo web plus deterministic TypeScript fixtures
Feature: Skin profile, routine generation, scheduler, recommendations, and Today
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Save a local profile with a pregnancy-caution status and add a retinoid plus BHA without confirmed-low concentration.
2. Generate the routine plan, then open Today PM.
3. Compare profile authority, generated steps, cycle/cadence output, and visible caution copy.

## Expected Result

One profile status controls every consumer. Pregnancy-caution products are removed before sequencing and scheduling, and Plan and Today cannot disagree or infer an affirmative health status.

## Actual Result

Shelf conflict loading used a server-only profile with a `false` fallback while routine generation used the encrypted local profile. Generation could retain caution products in sequence/cadence output, and an early production-cadence path could bypass cycle suppression so a retinoid appeared as a daily Today step. Prefer-not, missing, and unavailable status were also collapsed to non-pregnant, and the conflict sheet could claim the user had disclosed pregnancy.

Successive independent reviews then found further unsafe edges: unreviewed exclusions bypassed the production clinical gate; a local status edit could later fail open to stale server `none`; unrelated or cross-ingredient percentages could falsely classify BHA as low; expiring excluded products could still receive `Repurchase`; excluded products could still count as recommendation ownership, conflict context, or goal coverage; profile rebuild and consent decline could leave stale caches; prefer-not/unknown still created a literal Pregnancy pseudo-product; and the new sensitive write accepted obsolete or missing health consent.

## Evidence

- Screenshot: Post-fix supported-phone captures in `test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/`.
- Logs: `telemetry-browser-logs.json`, `telemetry-page-errors.json`, and network telemetry in the same folder.
- UI snapshot: `results.json` and `summary.json` in the same folder.
- Terminal transcript: focused pregnancy-safety, profile, generator, scheduler, recommendation, Plan, and Today test run.

## Frequency

- Always for the affected fixture and code paths before the fix.

## Scope

- Affected route/screen: `/settings/skin-profile`, `/routine/plan`, `/today?routine=PM`, and `/conflict/[ruleId]`.
- Affected account or fixture: Any local profile whose status required caution, especially with retinoid, hydroquinone, or BHA lacking confirmed-low concentration.
- External service involved: No. A configured Supabase fallback could contribute to the split authority.
- Destructive action involved: No.

## Suspected Cause

Profile reads and boolean fallbacks were duplicated across features, while product suppression happened after parts of routine scheduling instead of at one shared pre-sequencing boundary.

## Minimal Fix Recommendation

Introduce one consent-bound local-first `ProfileBits` reader. Preserve malformed/unreadable records and never fall through to a server mirror; treat server-only status as unknown. Derive exclusions from the launch-gated rule records, preserve catalog ingredient boundaries, require exact tag-associated concentration evidence before calling BHA low, filter before all sequencing/scheduling and recommendation ownership/conflict/goal/replacement work, and withhold treatment/exfoliant placement when cadence review is closed. Require current version/hash consent in UI and write services, reset every dependent cache immediately on decline, invalidate caches after grant/rebuild/status edits, retain a final Today defense, and expose neutral non-destructive recovery.

## Verification Flow After Fix

1. Drive `none -> pregnant/trying -> breastfeeding -> prefer_not -> none`, fail/retry one profile write, and reload encrypted prefer-not.
2. Compare Plan and Today after every transition; regrant legacy consent through one failed consent write; verify a missing profile stays cautious.
3. At 360 x 640 and 390 x 844, apply 200% text pressure, audit control geometry, and assert no vendor traffic, dialogs, page errors, or disallowed browser logs.

## Post-Fix Evidence

- Screenshot: Eighteen supported-phone and recovery captures in `test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/`.
- Logs: Zero vendor requests, dialogs, page errors, or disallowed browser logs in the evidence summary.
- UI snapshot: `summary.json` reports four passing scenarios, all status choices, both write-failure retries, legacy-consent regrant, missing-profile recovery, encrypted reload, Plan/Today consistency, explicit-clear restoration, and zero sub-44 visible controls.
- Terminal transcript: Focused unit/source-contract matrix includes real QueryClient cache reset plus excluded-product recommendation coverage; full launch verification is recorded with the closing commit.

## Remaining Risk

- Untested branches: Physical iOS/Android persistence, secure-storage fault injection, Dynamic Type, VoiceOver, and TalkBack.
- Missing fixtures: The browser UI fixture uses retinoid and BHA; hydroquinone, reviewed/unreviewed rule states, server-only stale `none`, and confirmed-low/high/ambiguous BHA are covered by focused tests.
- Follow-up needed: Named clinical, cosmetic-chemistry, and legal/privacy review; a reviewed status-refresh interval; and future multi-device reconciliation. The separate clear-mode multi-treatment Plan/Today slice is now covered by `2026-07-10-multi-active-plan-today-responsive.md`.
