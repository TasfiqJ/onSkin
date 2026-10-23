# Remaining original gates

- Original protected Security admission remains CLOSED. Proposal expiry `2026-10-21T00:00:00Z`, inventory, SAST coverage, scanners, exceptions, owner pins and all workflows remain unchanged. Passing 70 technical tests does not grant Security GO.
- Fresh public npm audit exits 1 with 67 high propagated package findings. Both target mocker advisory IDs are absent after the patch; original braces/node-forge findings and expired review remain separate. Static OSV/Python toolchain advisories, source inventory drift and current-source secret provider failures require independent remediation. Exact fresh provider metadata/log summaries are preserved where observed; no new authenticated scanner coverage is claimed.
- Canonical database image is still `public.ecr.aws/supabase/postgres:15.8.1.085`. Historical `Data limit exceeded` remains an external registry blocker. No local image pull, substitution, credentials, money or hosted replay was attempted. PG15/17 rehearsals do not qualify the canonical gate.
- The frozen old GF01 profile refuses this successor (`Wrong GF01 branch`); it is unchanged. The new external-manifest-bound scope verifier validates this narrow issuance only.
- Source and final delivery Quality/Security/iOS runs are different observations. PENDING remains PENDING. Independent Brain review is required, and whole M1-03 remains unaccepted.
- protected_source_go=false; database/main promotion/hosted replay/M2/release/device/archive/native privacy signoff=false. Accepted tasks remain only M0-01/M0-02/M1-01/M1-02. Incremental spend $0.
