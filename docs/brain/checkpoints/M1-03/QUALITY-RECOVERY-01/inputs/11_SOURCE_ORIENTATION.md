# Source map for the allowed work

- `apps/mobile/package.json`: existing SDK57 app dependencies (Expo and expo-network). Keep native adapter, React Native and feature sources untouched.
- `package-lock.json`: exact reviewed monorepo dependency graph. Generate with canonical npm 11 rather than manually typing lockfile entries.
- `package.json`: root scripts/overrides. Available only if strict Expo patch resolution requires it; default is NO CHANGE.
- `scripts/brain/m103_profile.py`: active M1-03 issuance validator, with old SC01/SC03 historical interval and report binder. Preserve immutable prior authority, add new fixed interval and refusal tests; do not weaken older validators or let old source permissions leak into this grant.
- `scripts/brain/test_m103_quality_recovery01_profile.py`: new negative tests for exact authority, immutable files, false acceptance, wrong branch/ref, tampered preimage and unauthorized intermediate commit.
- `.gitattributes`: preservation of exact bytewise context/review inputs, including Windows newline behavior.
- `docs/phase-4/generated/source-worklist.json`, `.md`: generated outputs only; strict `npm run phase4:source-worklist:check` checks their truthfulness.
- New checkpoint/review paths are purely source/provenance/evidence. No main branch, workflow, Security policy or DB grants.
