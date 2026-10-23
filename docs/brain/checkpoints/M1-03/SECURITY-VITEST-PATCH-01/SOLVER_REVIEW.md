# Exact reviewed-npm solver delta

The authentic npm 11.20.0 command changed **12 existing lock entries** and added/removed **zero package paths**. Lock: `6557c859298af02363aeb9c1efb37240de0bddfd3f4f4bffa93d34a85b9e8242` (572,798 bytes). No lock hand edit, npm override, Vitest 5 jump, or unrelated runtime upgrade occurred. All ten changed package tarballs were independently fetched and SHA512-verified against official npm metadata; the two target SRIs also match the external issuance.

| Lock entry | Explanation |
| --- | --- |
| `apps/catalog-operator-console` | Only devDependencies.vitest ^4.1.11 -> ^4.1.12; all other workspace lock data identical. |
| `apps/mobile` | Only devDependencies.vitest ^4.1.11 -> ^4.1.12; all other workspace lock data identical. |
| `node_modules/@vitest/expect` | 4.1.11 -> 4.1.12; official Vitest family package and internal exact edges match the published metadata, dev-only. |
| `node_modules/@vitest/mocker` | 4.1.11 -> 4.1.12; official Vitest family package and internal exact edges match the published metadata, dev-only. |
| `node_modules/@vitest/pretty-format` | 4.1.11 -> 4.1.12; official Vitest family package and internal exact edges match the published metadata, dev-only. |
| `node_modules/@vitest/runner` | 4.1.11 -> 4.1.12; official Vitest family package and internal exact edges match the published metadata, dev-only. |
| `node_modules/@vitest/snapshot` | 4.1.11 -> 4.1.12; official Vitest family package and internal exact edges match the published metadata, dev-only. |
| `node_modules/@vitest/spy` | 4.1.11 -> 4.1.12; official Vitest family package and internal exact edges match the published metadata, dev-only. |
| `node_modules/@vitest/utils` | 4.1.11 -> 4.1.12; official Vitest family package and internal exact edges match the published metadata, dev-only. |
| `node_modules/chai` | 6.2.2 -> 6.3.0 satisfies the unchanged @vitest/expect ^6.2.2 range; dev-only assertion dependency, same official registry, no added dependencies. |
| `node_modules/tinyrainbow` | 3.1.1 -> 3.2.0 satisfies ^3.1.0. All four parents are dev-only Vitest packages. Official source adds RGB/hex terminal colours; no dependencies/install lifecycle. Official tarball verified and no finding in fresh public audit. This is the justified reviewed-npm delta beyond the 11-entry preview. |
| `node_modules/vitest` | 4.1.11 -> 4.1.12; exact family dependencies/optional peers follow the authentic published metadata. Optional browser-webdriverio peer becomes ^4.1.11; it is not installed. No runtime package is upgraded. |

The initial 11-entry preview guard correctly paused on tinyrainbow. Independent parent, metadata, tarball, source-diff and fresh public audit review justified it as a related Vitest-only development dependency. The raw exact solver delta and all URL/version/integrity identities are in `evidence/solver-delta.json`; provenance and parent evidence are in `evidence/solver-independent-review.json`; the actual upstream source diff is retained. npm audit still exits 1 with 67 high propagated findings; a target remediation does not clear that gate.
