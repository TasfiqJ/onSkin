# Read the relevant source, not all history

First inspect current AGENTS/CLAUDE and installed authoritative docs; adopted executive decisions and current reviewed task override old planning instructions, including historical direct-main push text.

Reminder causal path: apps/mobile/src/features/notifications/startup.ts -> deliver.ts -> applyPreferences.ts -> useNotifications.ts -> NotificationPreferenceSaveNotice.tsx and app/settings notifications/timing. Also inspect NotificationPreferenceScheduleReconciler, nativeMutation, response host, purpose/cap store and lease guards. The two targeted probes expose missing integration, not a request for a new scheduler.

Daily path: scripts/e2e/retained-daily-loop.mjs and onboarding-first-session.mjs; app/(tabs)/today.tsx; features/today/useRoutineClock.ts, useToday.ts, completionsStore.ts, localCompletionAccess/routineProjection; query/localDateBoundary and completion outbox. Review actual route phase vs captured current-view validation. The relevant sources were unchanged at the reviewed head; do not assume a newly introduced production regression.

Keep demonstrated repairs in features/routine/orderStore.ts, routine/reorder.tsx, scheduler/useCycle.ts and photos/encryptedStorage.ts. The shared crypto/file-core tests can run without falsely opening a paid/native route.

Current prior submission: docs/brain/checkpoints/M1-02/README.md, ACCEPTANCE_CLOSEOUT.md, completion-report.json, diagnostic evidence. Original M1-02 task/manifest remain under inputs. Do not rerun copied historical commands as current authority or ingest all artifacts.

Protected failures: CORE05 source-contract assertion and current Security/database CI. Read-only diagnosis is allowed; changing protected fixtures/chain, scanners, pins, exceptions/date is not. M1-03 remains the later reconciliation task. No J05/next research pack needed.
