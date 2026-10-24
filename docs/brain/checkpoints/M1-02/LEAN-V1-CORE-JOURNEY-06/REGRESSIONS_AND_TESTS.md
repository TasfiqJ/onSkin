# Original behavior and validation

The strongest old-source run is `independent-original-nested-runtime` in the raw log archive and receipt map. Its mobile production/config/types inputs were exported from exact accepted Git `f78e3d4`, with all 1,071 original production files authenticated before and after the run. Two final new integration tests were overlaid byte-for-byte. Existing dependency locations were reused without installation; platform/network/presentation boundaries alone were mocked, while encrypted KV, owner-write admission, stores, React Query, hooks and rendered route components remained real. This is a source-complete mobile subset for regression reproduction, **not** a full independent repository checkout or worklist proof. The binding inventory is compressed with reproduction receipts.

The exact final tests select 13 old-behavior vectors: **9 fail + 4 pass**; six new-feature/prototype-only vectors are deliberately deselected. Five failures concern progress: replacement owner and same-owner cache reuse, withdrawal without parent remount, stale totals during current read, and grant expiry without navigation. Four concern archive unreadability, duplicate/refused onboarding removal, and replacement owner/same-owner Shelf identities. These represent four defect families, not nine independent bugs. Three unhandled old removal rejections are preserved. Passing safeguards are not credited as repaired defects. The corrected final source passes every overlaid case in the full current suites.

Two earlier overlay attempts lacked the mobile nested @noble dependency location and failed with `randomBytes is not a function`. Both are **SETUP_FAILURE**, excluded from regression claims. The custom negative receipt's `started_at` field was inadvertently recorded after the process; it is a completion observation time. Its exact command, cwd, source binding, raw exit and log digest remain valid. The receipt is preserved rather than retroactively rewriting a timestamp.

Real source-bounded browser observations separately justified finder placement and chip reflow: `prototype375/J06-03-volume-match` placed a match below routine prompts; `single390/J06-09-text-pressure360` clipped the Expiring filter at x264 + width155 on a 360px viewport. These are pre-fix intermediate-source observations, not accepted-anchor regression counts. Final snapshots retain the match-first presentation and wrapped filters. The screenshot audit's zero geometric issues does not imply no glyph clipping: bottom dock enlarged labels remain a documented protected-layout limitation.

| Final clean measured-source command | Result |
| --- | --- |
| `npm test -- --force` | exit 0; 6,180/6,180: 6,156 mobile / 479 files + 24 console / 7 files; 2 tasks, 0 cached |
| `npm run typecheck -- --force` | exit 0; 3 tasks, 0 cached |
| `npm run lint -- --force` | exit 0; 3 tasks, 0 cached; no warnings; existing types workspace has its configured no-op lint |
| Ten retained feature-family suite, exact command in `committed-retained.json` receipt | exit 0; 2,335/2,335 in 196 files |
| `node scripts/phase4/build-source-worklist.mjs --strict --check` | exit 0, full clean primary checkout |

All commands, cwd, UTC start, measured head/tree, before/after clean status, raw exit, duration and raw-log digests are in `command-receipts.json`. The baseline retained run is 2,313/193. The +22 cases are in three new files: Quick Find 3, Shelf/core journey 12, progress authority 7. No root test task was cached. Existing renderer/act diagnostics remain in the unaltered logs.

Meaningful integration failures are preserved: the `reflow-root-tests` run failed one original literal row-class assertion (6,155 passed / 1 failed). Production was corrected to retain that class while applying wrap via style; the original assertion was unchanged. Earlier new-test type errors, a lint warning and a prototype stale-removal test failure are retained and corrected. They are not counted as accepted-anchor defects. Final full source was retested after the final fix, not inferred from focused green.

Every top-level command log is retained losslessly in `raw-command-logs.tar.gz`; repetitive browser diagnostics are hash-indexed in `ui-run-inventory.tar.gz`, with all final successful run snapshots/diagnostics retained in `ui-traces.tar.gz`. Archive members have exact SHA-256/byte inventories. No red log was rewritten to green.
