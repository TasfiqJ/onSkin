# Commands, raw exits and limits

The first table and its following measurements describe the earlier routed-candidate pass, with exact original counts and SHAs retained. The final existing-surface measurements are below.

All receipts contain exact argv, cwd, UTC, head/tree, actual exit, complete-log SHA-256 and working status; later receipts also hash each working source/test file. Installed Node 22.21.0, npm 11.20.0, Python 3.9.13 and Vitest 4.1.11 were reused. No dependency, lock, policy or native version changed.

| Receipt | Actual result | Exit |
| --- | --- | --- |
| independent-original-production | Final three additive test files on exact anchor production: 21 fail, one pass; corrected fixtures. | 1 expected |
| shelf-render-authority-green | Shelf hook/store, prior read recovery and opening routes: 72 pass. | 0 |
| photo-render-authority-green | Capture authority, offline diary, real store and detail UX: 69 pass. | 0 |
| reminder-entry-green | Complete reminder family after entry fix: 257 pass. | 0 |
| recovery-source-currentness-red | Early new-feature implementation: three fail, twelve pass. | 1 expected |
| recovery-foreground-green | Final new-feature mounted/source acceptance: 16 pass. | 0 |
| final-retained-and-recovery | All eight retained families + new Recovery and settings: 2,312 pass, 193 files. | 0 |
| measured-root-tests | `npm test -- --force`: 6,133 mobile + 24 console = 6,157; 476 + 7 files; two tasks, zero cached. | 0 |
| measured-root-typecheck | `npm run typecheck -- --force`: three tasks, zero cached. | 0 |
| measured-root-lint | `npm run lint -- --force`: three tasks, zero cached; mobile ESLint with max-warnings=0; console TypeScript; types workspace has no lint configured. | 0 |
| final-worklist-generation | Unchanged `node scripts/phase4/build-source-worklist.mjs --strict`; only two permitted outputs. | 0 |
| independent-worklist-contract | Original `--strict --check` at measured source, complete independent checkout; changed one Shelf input; both outputs refused; exact restoration. | 0 / 1 / 0 |
| web375-measured-final / web390-attempt1 | Actual fresh-profile Expo web onboarding, daily loop and changed recovery/settings flows; 390 also checks 430 and 360/text×2. | 0 / 0 |
| cross390-attempt2 | Actual synthetic A→B→A, delayed Recovery read and existing cleanup failure/retry. | 0 |

The combined retained command is `npm --workspace apps/mobile run test -- src/features/shelf src/features/today src/features/routine src/features/scheduler src/features/streak src/features/notifications src/features/photos src/features/onboarding src/features/retainedRecovery src/features/settings --maxWorkers=4`.

The measured forced root runs start/end clean at d76cbd2742920895522e3e9018d554319c777741. No skips are reported. The complete root log retains 637 renderer-deprecation lines and 33 “not wrapped in act” warning lines. These are raw line counts, not independent defects; they were not suppressed. Final lint has zero warnings. Earlier nonzero exits and raw logs remain beside the final passes.

The complete disposable worktree used installed-dependency junctions, no source hard links or install. After the 0/1/0 audit and exact restore, its known junctions were removed without recursion and its clean owned worktree was removed. Existing Brain worktrees, including their negative overlays, were preserved. Final current-state evidence is in pre-delivery-state.json; post-push readback is reported externally.

## Final measured existing-surface validation

| Command / final receipt | Raw exit | Result |
| --- | --- | --- |
| `npm test -- --force` / final-inline-root-tests | 0 | Mobile 6,134 + console 24 = 6,158; 483 files, 2 tasks, 0 cached, no skips reported |
| `npm run typecheck -- --force` / final-inline-root-typecheck | 0 | 3 tasks, 0 cached |
| `npm run lint -- --force` / final-inline-root-lint | 0 | 3 tasks, 0 cached, 0 lint warnings |
| All eight retained feature families + Recovery/settings / final-inline-retained | 0 | 2,313 tests, 193 files |
| Original execution-baseline validator | 1 / 0 | Routed candidate refused; existing-surface implementation accepted, inventory unchanged |
| Original source-worklist strict check with one disposable input tamper / inline-worklist-contract | 0 / 1 / 0 | Clean complete final checkout; both outputs refuse; exact restoration; unchanged producer/output hashes |

The final forced root run retains 638 renderer-deprecation lines and 33 act-warning lines. Earlier clean source measurement and independent complete-checkout producer proof are historical receipts, not substituted for these final measurements. No native/provider/release result follows from any local pass.
