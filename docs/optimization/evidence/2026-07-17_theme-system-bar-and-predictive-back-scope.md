# OPT-201/202 Theme, System-Bar, And Predictive-Back Checkpoint

Date: 2026-07-17 (America/Toronto)

Parent SHA: `64cbe71a37b1fa9804ee995eed994a7ba762b188`

Status: OPT-201 `implemented`; OPT-202 `not-applicable` for the accepted
iOS-only release.

## Outcome

The launch UI now has one deterministic appearance contract:

- Expo `userInterfaceStyle` is `light`.
- The splash plugin has one light configuration and no dark variant.
- The root fallback and paper `Screen` surfaces use dark status icons.
- Night `Screen` surfaces use light status icons automatically.
- Direct full-night roots use the same typed contrast function.
- A night child hidden by a paper Pro gate does not mount its status override.
- Android predictive back remains explicitly disabled.

This resolves the previous contradiction where Expo could select automatic
appearance while almost all routes and the root status bar were hard-coded for
paper. It does not claim that a complete dark theme exists.

## Route Ownership Matrix

| Surface | Background owner | Status owner | Expected style |
| ------- | ---------------- | ------------ | -------------- |
| Ordinary paper routes and paper gates | shared `Screen` or root fallback | shared `Screen` / root | dark |
| PM Today | `Screen tone="night"` | shared `Screen` | light |
| Onboarding reveal | `Screen tone="night"` | shared `Screen` | light |
| Commerce transparency | `Screen tone="night"` | shared `Screen` | light |
| Cycle week | direct night safe-area root | route | light |
| Shelf scan | direct night safe-area root | route | light |
| Progress capture | direct night root after Pro/lock/data gates | route content | light |
| Progress review | direct night root after Pro/lock/data gates | route content | light |
| Progress photo detail | direct night root after Pro/lock/data gates | route content | light |
| Win-back ready state | direct night root after loading/recovery/redirect | route | light |
| Safety conflict | dynamic night backdrop/sheet | conflict frame | light |
| Standard or missing conflict | paper/dimmed-paper treatment | conflict frame/root | dark |
| Transparent night sheet | underlying route plus dim backdrop | underlying route | inherited |

The Pro, lock, entitlement-loading, and direct-paywall recovery surfaces remain
paper. Their dark night override is deliberately mounted only after the gate
renders the actual night content.

## Predictive-Back Scope

`docs/DEVICE_SUPPORT_POLICY.md` and the accepted launch contract exclude
Android from this release. There is no approved Android route/device matrix or
native E2E harness to support a safe predictive-back claim. OPT-202 is therefore
`not-applicable`, not silently completed:

- `android.predictiveBackGestureEnabled` stays `false`;
- no Android API/device proof is invented;
- the task reactivates before any Android release after platform scope is
  authoritative and every route, modal, sheet, unsaved edit, destructive
  confirmation, camera/photo flow, and back fallback is exercised on the
  supported API/device matrix.

## Verification

- Focused policy, shared-Screen, and paywall-layout contracts: 3 files / 35
  tests PASS.
- Full root tests: 328 files / 3,966 tests PASS.
- Root typecheck: 2 workspaces PASS.
- Root lint: 2 workspaces PASS with zero warnings.
- `npx expo config --type public --json`: PASS; resolved
  `userInterfaceStyle="light"`, no splash `dark` entry, and
  `predictiveBackGestureEnabled=false`.
- Production iOS Expo export: PASS; 2,835 modules bundled to Hermes bytecode.
- `git diff --check` on the scoped implementation: PASS.

## Honest Acceptance Boundary

The plan requires screenshots/device proof for OPT-201. Windows cannot run the
authoritative iOS Simulator, and Expo web does not render native status icons or
prove the native splash transition. OPT-201 therefore remains `implemented`,
not `verified`, until supported-iPhone evidence covers:

1. Light and Dark device appearance settings.
2. Cold launch through splash into a paper route.
3. Paper-to-night and night-to-paper transitions.
4. Gated Progress and cycle routes that show a paper paywall before night
   content.
5. Standard and safety conflict variants.
6. Back, modal dismissal, foreground, and relaunch without a stale icon style.

No full-dark launch claim, Android release claim, screenshot, device result, or
approval is inferred from the passing local contract.
