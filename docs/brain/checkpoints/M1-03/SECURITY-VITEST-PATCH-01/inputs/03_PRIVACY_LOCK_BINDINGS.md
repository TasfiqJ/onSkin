# Conditional privacy source mapping

A real lockfile SHA change may invalidate three source-only iOS mappings. Before updating, independently compare the original **four mapped npm entries** and all **ten installed source pins** against their preimage versions, integrity and bytes. If even one changes, STOP; do not edit the mapping.

Only if all are identical: replace exactly three `lockIntegrity.packageLockSha256` values in `docs/phase-9/ios-sdk-package-mapping.json` with the real final lock SHA256. Preserve `source_candidate`, `archiveRequired=true`, unknown Podfile/privacy manifests/real archive evidence and every other key. Regenerate only the two allowed derived audit files through `npm run phase9:ios-privacy-source-audit` with original producer, then strict check/test. Do not alter the source-only privacy validator. No actual native reviewer, device or archive GO.

Regenerate the two Phase4 source-worklist outputs ONLY through the original canonical producer from a clean measured source after the functional commit. Preserve the true producer stdout/errors; strict check must pass at delivery. Never manually patch generated output.
