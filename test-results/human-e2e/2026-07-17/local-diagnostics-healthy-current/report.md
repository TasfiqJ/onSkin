# Local Diagnostics Healthy-State E2E

- Date: 2026-07-17
- Surface: Expo web development build
- Configured viewport: 390 x 844
- Route: `/settings/diagnostics`

Result: PASS

- The fixed-schema v1 screen settled after private-storage startup.
- Every expected build, privacy/storage, sync/cache, service, timing, and capture-time section was present in the accessibility snapshot.
- Storage free space safely rendered `unavailable` on web without the prior unsupported `expo-file-system` warning.
- Effective DOM geometry was 390 x 845 with document/body width 390 and no horizontal overflow.
- `Refresh diagnostics` was unique and updated the capture timestamp.
- `Back to You` navigated to `/you`.
- The development-only You-screen entry was present and navigated back to `/settings/diagnostics`.
- Browser warnings were limited to the existing missing-Supabase development placeholders and the known Expo notifications web-support warning. No diagnostics-source warning/error was emitted.

Visual evidence: `settings-diagnostics-post-fix-viewport.png`
