# Local Diagnostics All-Source Failure Drill

- Date: 2026-07-17
- Surface: Expo web development build
- Configured viewport: 375 x 667
- Route: `/settings/diagnostics`
- Fixture: `EXPO_PUBLIC_E2E_LOCAL_DIAGNOSTICS_FAILURES=all`

Result: PASS

- Every diagnostics dependency threw the same deliberate test error.
- The screen stayed mounted and rendered only fixed fallbacks: `unknown`, `unavailable`, `not run`, zero counts, `gateway unreachable`, and the fixed epoch.
- The deliberate error message was absent from the rendered accessibility snapshot.
- `Refresh diagnostics` remained unique and usable; the safe failure state rendered again without a crash.
- Effective DOM geometry was 376 x 668 with document/body width 376 and no horizontal overflow.
- Browser warnings were limited to existing missing-Supabase development placeholders and the known Expo notifications web-support warning. No raw diagnostics exception was logged by the screen.

Visual evidence: `settings-diagnostics-failure.png`
