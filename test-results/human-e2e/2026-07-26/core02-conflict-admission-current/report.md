# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-26
- Codex task: CORE-02 zero-admission clinical-conflict boundary
- App surface: Codex in-app browser against Expo web
- Build/start command:
  `EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=development EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH=anonymous_owner EXPO_PUBLIC_E2E_LOCAL_RESET=1 EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed npm --workspace apps/mobile run web -- --port 19222 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser on Windows, 390 x 844
- Source commit:
  `c78208ef1da9dd4b3c5f385d421541f8741dba3c`
- Feature tested: conflict guidance, Ask, stale conflict detail, public share,
  and paywall behavior while the admitted corpus is empty
- Overall verdict: Pass with issues

## Tool Inventory

- Expo CLI: available and used
- iOS Simulator: unavailable on this Windows host
- Android emulator: not used; Android is outside the current release contract
- Expo web: available and used
- Playwright: browser-plugin DOM and interaction surface used
- Codex in-app browser: used
- External services: none; Supabase remained intentionally unconfigured

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf | Empty admitted conflict corpus with two active products | Pass | `13-committed-shelf-zero-admission-390x844.jpg` | Shows unavailable guidance and no compatibility result. |
| Ask entry | Suggested prompts with zero admission | Pass | `14-committed-ask-conflict-hidden-390x844.jpg` | Conflict prompt is absent; local routine/fit prompts remain. |
| Ask typed pair | Exact glycolic-toner and retinol-serum question | Pass | `15-committed-ask-exact-pair-refusal-390x844.jpg` | Refuses to call the pair compatible pending completed independent review. |
| Ask fit | Deterministic category recommendation | Pass after fix | `16-committed-ask-fit-neutral-source-status-390x844.jpg` | Bare evidence grade was removed; no source claim is invented. |
| Conflict detail | Direct stale rule URL | Pass with evidence limitation | `17-committed-stale-conflict-dialog-390x844.jpg` | Generic stale-note dialog names no rule. The tester observed `Back to Shelf` return to `/shelf`; no post-click screenshot or trace is retained. |
| Public share | Invalid opaque share route | Pass | `18-committed-invalid-public-share-generic-390x844.jpg` | Public page exposes no product, profile, photo, or health context. |
| Paywall | Zero-admission product claims | Pass | `19-committed-paywall-zero-admission-390x844.jpg` | Does not sell conflict or clinical guidance; store checkout stays disabled in preview. |
| Paywall disclosure | Bottom disclosure after user scroll | Pass | `20-committed-paywall-professional-review-disclosure-390x844.jpg` | States that health-related guidance requires independent professional review before availability. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| CORE02-E2E-001 | Medium | Open `/ask`, select the product-fit prompt | No evidence grade without an exact source/review contract | Displayed `Evidence: established` | `docs/e2e-bug-reports/2026-07-26-core02-ask-fit-evidence-label.md` |

The bug was fixed in the committed source and the same surface branch passed
after reload.

## Tests Added or Updated

- `apps/mobile/src/features/ask/answer.test.ts`: proves fit answers do not expose
  an unbound citation and fail closed for non-compatible coverage.
- `apps/mobile/src/features/ask/routeContract.test.ts`: proves the zero-admission
  conflict prompt is hidden.
- `apps/mobile/src/features/intelligence/conflictRoutes.test.ts`: proves stale
  and public conflict routes remain generic.
- `scripts/core02/clinical-rule-source-contract.test.mjs`: enforces the
  production zero-admission and corpus-admission boundary.

## Commands Run

```bash
npm run typecheck
npm run lint
npm test
npm run core02:clinical-rule-source-contract:test
npm run launch:contract:verify
npm run phase7:check-core-loop
npm run phase8:check-growth-store
npm run phase10:beta-analytics-audit
```

The run reported all commands exiting zero. It reported the mobile suite passing
320 files / 3,863 tests, the catalog operator console passing 7 files / 24
tests, and the CORE-02 source contract passing 16/16. A raw terminal transcript
is not retained in this packet.

The repository-wide `npm run e2e:human:manifest` gate was also invoked. It
stopped on a pre-existing missing
`test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/` prerequisite.
No CORE-02 packet contract is registered in that manifest, so clearing CAT07
would not itself admit this folder. The governed CAT07 runner cannot recreate
the dated packet truthfully on 2026-07-26 because it writes live timestamps
while the manifest requires `2026-07-22T...`; the CAT07 runner contract itself
passes 38/38 tests. No CAT07 evidence was fabricated or backdated.

## Browser Diagnostics

- `browser-console-committed.json` contains 96 repeated development warnings and
  zero errors through `2026-07-26T13:11:31.816Z`.
- The warnings are limited to intentionally missing local Supabase URL/key,
  unsupported web push-token observation, and React Native Web's deprecated
  `pointerEvents` compatibility warning.
- The console snapshot predates the final screenshots, which begin after
  13:12Z. No post-flow console export is retained, so this packet does not
  establish a run-wide zero-error result.
- A development overlay button is visible in one Ask screenshot; it is not a
  submitted-build surface.

## Remaining Risk

- This pass is Expo-web implementation evidence, not a signed iOS archive,
  iOS Simulator, physical-iPhone, VoiceOver, Dynamic Type, or App Review result.
- This tracked folder remains directly inspectable evidence, but no CORE-02
  manifest contract currently admits it. The repository-wide manifest also
  stops first on the unrelated missing 2026-07-22 CAT07 packet described above.
- No network-failure branch was exercised because these paths are deliberately
  local and the hosted backend is not configured.
- The corpus remains `draft_blocked` with zero admitted rules. Independent
  dermatologist, chemistry/pharmacy, and regulatory-counsel review; trusted
  native signature verification; counsel-approved claims/policies; exact
  archive inspection; and Apple review remain open.
- Passing this evidence does not establish legal compliance, clinical
  validity, App Store acceptance, product-market fit, or revenue.
