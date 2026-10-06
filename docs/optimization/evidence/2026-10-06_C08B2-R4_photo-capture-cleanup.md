# C-08B2-R4: photo-purpose cleanup and generated RPC truth

Review candidate on baseline `00c75c07daa08692f88f9f2b4fa416bacd02ad12`. This narrowly extends the R3 lifecycle contract; it does not claim independent approval, native-device or hosted-backend acceptance.

## Cleanup policy

Ordinary explicit sign-out still erases Progress photos and the health-purpose `layerwell.photos.deleteJournal.v1` journal while preserving the minimal, independently encrypted per-owner `layerwell.photoDeleteCleanup.v1.<ownerBinding>` namespace. Replay still requires that exact owner's fresh authenticated/current-health authority. A different owner must not read or execute the retained obligation. These R3 rules are unchanged.

Authoritative `photo_capture` purpose closure has a different meaning. The existing purpose withdrawal operation supersedes per-photo remote deletion: `runGranularPhotoCaptureCleanup()` enumerates the owner's photo records, removes verified remote storage, deletes the photo records and re-attests storage absence. The leased dependent worker remains the authority for completing that server work. The mobile client must not substitute a per-photo replay for purpose-level completion or claim server completion merely because local state was erased.

`hasPhotoCaptureConsent()` already supplies `deleteLocalOnAuthoritativeClose: clearPhotos` to the real dependent-consent lifecycle. R4 extends only that existing cleanup implementation. Inside its serialized photo queue and account-generation guard, `clearPhotos()` resolves the canonical validated local owner binding, rechecks the guard and awaits that exact namespace's existing raw eraser alongside metadata/media removal. It does not decrypt the namespace, require a new health lease, scan foreign owners, or widen the persistent key registries. Unclaimed/ownerless local data has no owner namespace to erase; malformed or unavailable ownership proof fails closed rather than guessing a binding.

Vault erasure failure participates in the existing `PHOTO_CLEAR_FAILED` result. The actual dependent-consent cleanup translates a failed cleanup to `HEALTH_DEPENDENT_CONSENT_LOCAL_CLEANUP_FAILED`. An explicit withdrawal retains its durable pending purpose tombstone until local and remote work have both succeeded; a cross-device authoritative-close check rejects on cleanup failure and retries through the same leaf. A configured status outage is not authoritative withdrawal and does not erase the accepted sign-out-surviving obligation.

The existing queue also orders accepted photo writes before purpose erasure. A late acknowledgement for a replay already dispatched before cleanup cannot recreate a removed journal/vault; subsequent fresh reads and re-grants cannot obtain erased pre-withdrawal IDs. R3's file-absence protocol, note/reference state machines, decoded-memory route-removal boundary and account/health admission are unchanged.

Full/base-health withdrawal and terminal account deletion retain their existing exact-owner erasure integrations. Neither the dynamic vault prefix nor its contents are added to ordinary account-private or health-purpose batch registries; ordinary sign-out survival is intentional.

## Generated RPC contract

`packages/types/src/database.types.ts` already contains `apply_photo_delete_outbox_batch`, with `Args: { p_operations: Json }` and `Returns: Json`. The prior client comment saying the generated snapshot predates the RPC was wrong.

The client overlay now explicitly derives the RPC from that generated member and narrows only its broad JSON argument to `PhotoDeleteRpcOperation[]`. Its remaining generated properties, including return type, are retained. Compile-time contracts require the RPC to exist in the generated schema, require the expected broad generated JSON shape, prove the client payload is a narrowing, and prevent unrestricted generated JSON from being accepted as the mobile payload. The generated snapshot and SQL are not edited.

## Regression evidence

`photoDeleteCaptureWithdrawal.c08b2.test.ts` runs the actual dependent-consent receipt/tombstone lifecycle, canonical owner proof, photo store/cleanup, encryption, independent vault and explicit-sign-out isolation over controlled native I/O and remote consent responses. It covers explicit and cross-device close, same-owner re-grant, missing-key erasure, erasure failure/retry, ordinary sign-out and B isolation, a queued accepted deletion, late replay settlement, unchanged full-health cleanup and uninterrupted offline/reconnect replay. The existing terminal-account suite remains part of validation.

The unmodified granular-withdrawal and dependent-worker Deno suites verify server-owned photo storage/metadata cleanup and completion ordering. A compiler-only negative test removes the generated RPC from an in-memory source view and proves the client contract fails without altering the real generated file.

The complete replacement packet contains red-before/green-after logs, the full R3 validation matrix rerun against R4, exact source preservation and inventory hashes, current short-phone browser evidence, guarded-installer tests and a deterministic rebuild script. Historical R3/R2 evidence is preserved separately, not presented as new runtime acceptance.
