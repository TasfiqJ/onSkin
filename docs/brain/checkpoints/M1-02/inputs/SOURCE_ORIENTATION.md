# Source orientation — read selectively

Paths were verified in the current repository. This is a navigation map, not a claim that each behavior has been audited for M1-02. Read exact current implementations and nearby tests before changing them.

## Routine / Today

Start with apps/mobile/src/app/(tabs)/today.tsx; features/today/{completionsStore,completionSync,localCompletionAccess,cycleCompletion,routineProjection,useToday,useRoutineClock}. Read features/routine/{usePlan,orderStore,generate,cycleAnchor,planProfileAdmission,reviewGate}; features/scheduler/{cycleStore,useCycle,cycleConfigAuthority,CyclePersistenceGate,CycleRouteReadiness}; lib/offline/{OfflineSync,completionQueue,shelfMirrorQueue}; lib/query/{queryDateBoundaryCore,localDateBoundaryStore}. The app/routine and app/cycle routes expose actual behavior.

Historical docs/03-routine-builder.md has a current CORE-05 note: encrypted completion-v3 atomic visible state plus replay event; no fabricated identities for legacy records; Shelf drains first; owner-fenced RPC lanes retain direct-write prohibitions. Preserve current source contracts; older commercial/clinical statements are not new evidence or implementation authority.

## Private local diary

features/photos/{store,usePhotos,encryptedStorage,photoStoreEnvelope,photoThumbnail,photoNoteSaveCoordinator,sensitiveImageCoordinatorCore,photoDeleteJournal,photoDeleteRemoteCleanup,photoDeleteRetrySingleFlight}; lib/storage/{privateKV,privateKVTransactionCore,plaintextStaging,plaintextStagingCore}. Read actual route/privacy/permission/payment guards before UI tests.

Historical docs/06-photo-progress.md's implementation notes distinguish manual Expo still capture and transient static framing/light checks from unimplemented or unvalidated realtime measurement. Existing original/thumbnail encryption, per-URI cancellation/drain and plaintext staging journal cleanup are retained, not new research admission. Do not reproduce its historical medical/retention claims as verified facts.

## Reminders and dormant native widgets

features/notifications/{store,permission,nativeMutation,applyPreferences,startup,deliver,policy,contract,NotificationPreferenceScheduleReconciler,NotificationResponseHost}; features/widgets/{actionRegistry,lifecycleCoordinator,lifecycleRuntime,nativeOutboxModel}. Native bridge files and release flags remain read-only unless a future explicit task authorizes them.

Historical docs/07-reminders-streaks-widgets.md records local encrypted preferences/attempt ledger, purposes default off and native/device gates still closed. It also records source-only widgets with public publication flags false. Preserve exact current policy/caps rather than adopting historical growth recommendations.

## Existing checks and safety scaffolding

Root package scripts include core03:routine-guidance-source-contract:test; core04:persistence-source-contract:test; core05:adherence-source-contract:test; photo01/02/03/04/07:source-contract:test; photo05:trend-admission-source-contract:test; pay07:entitlement-admission-source-contract:test. Select affected checks; these names do not authorize activation or edits to protected contracts.

Use the maintained scripts/e2e/onboarding-first-session.mjs for accepted sign-out and cross-owner regression. Read docs/HUMAN_SIMULATED_E2E_TESTING.md and docs/USER_FLOW_TREE.md for any changed surface. Keep portable local testing, synthetic data and truthful gate states.

## Authority

Installed canonical authority is docs/v2/source-inputs/source_pack. This packet includes applicable exact Markdown contracts. Its older “push to main” text is superseded by the founder stage protocol; no historical file can issue a new task. Do not ingest90_Provenance or99_Restricted_Personal_References.
