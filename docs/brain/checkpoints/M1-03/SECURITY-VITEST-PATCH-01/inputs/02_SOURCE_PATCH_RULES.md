# Exact dependency remediation

1. Edit ONLY `apps/mobile/package.json` and `apps/catalog-operator-console/package.json`, ONLY `devDependencies.vitest` from `^4.1.11` to `^4.1.12`. Preserve all other keys, versions, ordering and formatting. Do not upgrade unrelated production/runtime dependencies.
2. Independently fetch npm `vitest@4.1.12`, `@vitest/mocker@4.1.12`, exact tarballs and registry SRI. Verify the two public advisories are addressed by this patched line. Do not jump to major Vitest 5.
3. Use reviewed npm 11.20.0 to regenerate true `package-lock.json` from these manifest changes. Do not manually edit resolved/integrity/SRI or add npm overrides. Compute an exact package inventory delta and inspect full resolved URLs/versions/integrities. The preview saw eleven entries including `chai` 6.2.2 -> 6.3.0; a different genuine result must be justified or STOP if the delta is unrelated/untrusted.
4. After installing clean exact source run both workspaces' tests plus forced root tests, typecheck and lint. No cached green. Restore full original tests if the resolver exposes a problem; never bypass a failing test.

This is real vulnerability remediation; NOT an exception/waiver. Keep all Security policies, proposal, source inventory, toolchain, CI workflows, existing test_contract.py and original exceptions unchanged. If the safe upgrade requires any non-allowlisted edit, STOP with evidence and a narrow proposal.
