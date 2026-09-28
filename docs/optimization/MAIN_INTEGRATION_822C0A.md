# Optimization checkpoint integration

Integration date: 2026-08-13

Source checkpoint: `822c0a3167a67ca486a7f8ec1fa6742dfdd3572b`

Target: current Layerwell `main`

This merge integrates the completed optimization checkpoint into the newer Layerwell codebase with current `main` as the product and launch-contract authority.

## Resolution policy

- Preserve every route, feature, animation, and branded asset already present on current `main`.
- Adopt an optimization when its API and behavior are compatible with the current feature implementation.
- Port narrow improvements manually when the original optimization targeted an older version of a current file.
- Exclude obsolete optimization modules and tests that depend on superseded APIs or would weaken current privacy, account-isolation, storage, commerce, or navigation contracts.
- Treat historical optimization evidence as evidence for its recorded checkpoint only, not as proof for this merged release.

## Integrated improvements

- Reduced-motion handling was added to compatible animated routes while retaining the underlying animations for users who have not enabled Reduce Motion.
- Request coordination, diagnostics, query, storage, photo, subscription, accessibility, and observability helpers that satisfy current contracts were retained with their tests.
- iOS complete-file data protection and release transport-security configuration plugins were integrated with fail-closed contract tests.
- Expo SDK 57 patch dependencies were aligned, duplicate native modules were deduplicated, and the reviewed `expo-widgets` patch was advanced to 57.0.9 after confirming the upstream update changed no iOS source.
- Current Layerwell PNG artwork was recompressed losslessly. The optimizer verifies identical decoded scanlines and metadata and is deterministic and idempotent.
- The current capture-consent flow retains the optimized single permission-request behavior without changing the newer route contract.

## Deliberate exclusions

- Older replacements for current routes or services were not accepted when they removed current behavior or failed current type, unit, navigation, privacy, or storage contracts.
- The older commerce modal layout was not adopted because current direct commerce URLs require the transparent `Slot` layout.
- A legacy Progress review modal was not recreated because the current Progress flow no longer has that route structure.
- Browser, simulator, physical-device, hosted-service, legal, and App Store evidence was not fabricated or carried forward as proof for the merged release.

The merge is accepted only after the current repository typecheck, lint, test, brand, native-configuration, and relevant optimization contract checks pass. Any broader launch-readiness gate remains governed by the current launch documentation and its external evidence requirements.
