# Exact OWASP custody: two approaches, one packet

Required SHA256: `5878942efc5da41d2124bbf32a627db594cc63c29c524737c36e54ba677270d1`.

Official `https://semgrep.dev/c/p/owasp-top-ten` returned HTTP 200, 1,499,313 bytes, SHA256 `02a492308558a81347c1a8d526f07d62d32176f367f1c9a03fc1c99a0b37108f` on 2026-10-23. This also differs from prior official response `c552bf8aa0b9dfcb854cd4ae14108fae63f30ac237bb902c0f2f25e98b32b57b`. Neither matches or replaces the pin. No rule substituted or activated.

The second approach hashes 61 named YAML / OWASP gzip historical candidates from authentic local Git objects. None matches. Oversize profile expansions hit the recorded inflation cap and are not treated as rule bytes. Extending this same local search to all YAML blobs did not repeat the network request. `evidence/owasp-custody-attempts.json` retains object IDs, sizes, hashes, bounds and actual command/cwd. Bounded failure does not prove no external custodian holds the capture.

**Single issuer/custodian action packet:** The Semgrep registry issuer or original G97 acquisition custodian must supply the unmodified historical p/owasp-top-ten bytes hashing to `5878942efc5da41d2124bbf32a627db594cc63c29c524737c36e54ba677270d1`, plus a trusted issuance/acquisition record: issuer, immutable version/capture identity, UTC, exact length, SHA256 and license/redistribution provenance. Deliver through a Brain-approved custody path for offline verification. Timing profiles, scan results, regenerated families and equivalence assertions cannot satisfy it. If unrecoverable, report that fact to Brain for a separately authorized decision; do not replace or renew the pin here.

Independent custody verification and a new finite Brain grant must precede qualified-owner all-four-rule compatibility and original current-source coverage. No credentials, paid route or founder version choice requested. All-four-rule false; original current SAST NOT_RUN; source/scan NO_GO.
