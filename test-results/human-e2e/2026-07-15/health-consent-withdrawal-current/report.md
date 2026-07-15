# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-15
- App surface: Expo web in the Codex in-app browser
- Viewports: 390 x 844 and 360 x 640
- Build/start command (PowerShell): `$env:EXPO_PUBLIC_E2E_LOCAL_RESET='1'; $env:EXPO_NO_TELEMETRY='1'; npm.cmd --workspace apps/mobile run web -- --port 8291`
- Source state: Uncommitted health-consent checkpoint based on `90ed58d6dc8038bf5f2aa2a841b211683f3205c0`
- Feature tested: Consent-before-goals onboarding, decline/direct-route denial, non-destructive health-consent withdrawal, paused shell, and terminal fresh reconsent
- Overall verdict: **Pass for the scoped local Expo-web flow; launch-blocked on the external gates below**

This run used placeholder Supabase environment values and a local development
owner. It did not call a hosted withdrawal worker, delete hosted rows or Storage
objects, or perform any other destructive external action.

## Flows Executed

| Flow | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Fresh local reset -> Welcome -> age -> consent | Pass | Browser action/URL trace; `21-consent-360x640-postfix.png` | Goals did not precede the current consent disclosure. |
| Decline | Pass | Browser DOM/URL trace | The consent screen displayed `No consent recorded` and did not enter goals. |
| Direct `/onboarding/goals` without a grant | Pass | Browser DOM/URL trace | The request recovered to consent without mounting goals content. Direct quiz and native lifecycle variants remain separate open cases. |
| Fresh grant | Pass | `23-fresh-grant-goals-final-390x844.png`, `24-fresh-grant-goals-reload-final-390x844.png` | The URL was `/onboarding/goals` at every 100 ms sample through 1.9 seconds and again at 6.5 seconds; reload remained on goals. |
| Open active Privacy and review withdrawal | Pass | `15-privacy-active-postfix-390x844.png`, `16-withdrawal-confirm-postfix-390x844.png` | Cancel preserved the active state; confirm entered the local paused lifecycle. |
| Confirm withdrawal and relaunch | Pass | `17-withdrawn-paused-postfix-390x844.png`, `18-withdrawn-reload-postfix-390x844.png` | The shell displayed `Status: withdrawn. Local cleanup complete.` and stayed paused after reload. |
| Review fresh consent and choose `Not now` | Pass | `19-fresh-consent-postfix-390x844.png`, browser action/DOM trace | Fresh disclosure was reviewable; refusal returned to the paused shell. |
| Terminal fresh reconsent | Pass | `20-reconsent-goals-stable-postfix-390x844.png`, `22-reconsent-goals-reload-postfix-390x844.png` | The URL was `/onboarding/goals` at every 100 ms sample through 1.9 seconds and again at 6.5 seconds; reload remained on goals. |
| Compact consent layout | Pass | `21-consent-360x640-postfix.png` | Agree, decline, and policy actions were visible and reachable at 360 x 640. |

Screenshots `10` and `12` are retained only as pre-fix diagnostics: later route
sampling proved those captures were transient. Screenshot number `14`, if
present in another local copy, is not acceptance evidence. The valid final
screenshots for this run are `13`, `15` through `24`, with `20`, `22`, `23`,
and `24` carrying the final route-stability replays.

## Bugs Found And Fixed

| Bug record | Result |
| --- | --- |
| `docs/e2e-bug-reports/2026-07-15-expo-router-app-root-test-bundle.md` | App-root test bundling defect fixed and regression-covered. |
| `docs/e2e-bug-reports/2026-07-15-health-consent-e2e-reset-control-journal.md` | Development reset did not clear the complete consent control journal; fixed and replayed. |
| `docs/e2e-bug-reports/2026-07-15-health-consent-grant-navigation-race.md` | Duplicate route ownership and a conditional activation-wrapper remount were fixed; fresh grant and reconsent stayed on goals through timed sampling and reload. |

## Automated Verification At This Checkpoint

- Mobile typecheck: pass
- Mobile lint: pass
- Mobile tests: 266 files / 3,026 tests passed
- Local database verification: pass across two resets and all 53 migrations;
  261 pgTAP assertions passed (46 schema + 215 health-consent lifecycle)
- Phase 9 health-consent withdrawal: 104 Deno tests + 7 evidence tests passed

## Environment Notes

- The server ran on port 8291 with `EXPO_PUBLIC_E2E_LOCAL_RESET=1`.
- `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` used placeholder/unconfigured behavior.
- The Expo Notifications web warning about push-token-change listeners was
  expected for this surface and was not treated as a product-flow failure.
- No hosted Supabase request or destructive provider action is claimed by this
  evidence.

## Open Gates

- No reviewed hosted Supabase environment, live health-consent worker, Cron/Vault
  invocation, owned Storage-object deletion, or version-2 hosted zero-residue
  artifact was exercised.
- No physical iPhone, TestFlight, process-death/background, Keychain/file-system,
  StoreKit, VoiceOver, or Dynamic Type evidence was collected.
- All 15 installed legal-copy tuples remain `draft_blocked`; no counsel approval,
  production processor/backup approval, Apple acceptance, or legal-compliance
  determination is claimed.
- `DB-08` remains open because repository database types are still hand-maintained.
