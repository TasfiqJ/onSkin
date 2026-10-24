# Commands and raw outcomes

Every receipt records the actual command, raw streams, exit and stream hashes.
Later receipts also record source file hashes, tracked diff hash and unchanged
lockfile hash. Earlier successful checks ran the final production/test bytes
before their commits; final-retained and the 375/cross-owner browser receipts
bind directly to measured source `40f04d017079b201f8f1b2e93a0de1be722aeedc`.

| Receipt | Result | Meaning |
| --- | --- | --- |
| baseline-retained | exit 0, 1,768 pass | Clean authorized anchor, seven retained feature families |
| red-regressions | exit 1, 8 fail | Four quiz + four delayed initial Shelf cases before repair |
| green-regressions | exit 0, 8 pass | Same cases after repair |
| red-opening | exit 1, no tests | Setup error: missing expo-crypto platform mock; not a regression reproduction |
| red-opening-2 | exit 1, 2 fail | Escaped write failure and duplicate pending quick action |
| green-opening | exit 0, 2 pass | Same route after one-line reuse of guarded handler |
| green-all-regressions | exit 0, 12 pass | Includes ended-authority and failed-fresh-read recovery negatives |
| final-retained | exit 0, 1,780 pass / 145 files | Shelf/onboarding/Today/routine/scheduler/streak/photos |
| forced-root-tests | exit 0, 6,090 pass | `npm test -- --force -- --maxWorkers=2`; zero cached tasks |
| forced-root-typecheck | exit 0 | `npm run typecheck -- --force`; 3 successful, zero cached |
| forced-root-lint | exit 0 | `npm run lint -- --force`; 3 successful, zero cached; types package declares no lint |
| packet-recheck | exit 0, 10 checked | Same manifest; transport integrity only |
| ui-red-quick390 | exit 1, no browser | Wrapper syntax error; not a product failure |
| ui-red-quick390-2 | exit 1, no browser | Wrapper anchor was non-unique; not a product failure |
| ui-red-quick390-3 | exit 1 | Keyboard driver needed real focus/text events; did not reach quick-opening fault |
| ui-green390 | exit 1 | Forced initial-read reset correctly closed the save UI; not a product failure |
| ui-green390-2 | exit 0 | Full 390x844 synthetic journey with corrected driver |
| ui-green375 | exit 0 | Same journey at 375x667 |
| ui-cross-owner390 | exit 0 | Actual A-to-B cleanup/refusal/retry/isolation/reload journey |

The original `scripts/e2e` files were not modified. `journeys-web.mjs` extends
the maintained driver in memory and binds its original/executed SHA-256.
Fragments, UI snapshots, clicks/inputs, warnings and failures are retained.
The screenshot selection is bounded. The driver-requested filename list is
separate from each successful summary's actual PNG inventory; two summaries
were postprocessed only to correct that inventory after screenshot selection.

Authored source `git diff --check` passes. Full raw evidence whitespace may
refuse trailing whitespace in original tool/browser logs; its separate raw
receipt records that refusal without rewriting the original output.

NOT_RUN: native devices/simulator, production build, signing/TestFlight,
deployment, paid positive views, real provider/account, hosted DB replay,
clinical validation and professional review. No fixture was fabricated to
grant those authorities.


Staging note: this checkout has sparse rules. The first plain `git add` refused
new checkpoint files; scoped `git add --sparse` stages only this new folder
without changing those rules. The first raw-log-whitespace receipt checked an
empty index and is not whitespace evidence. The next staged check refused raw
logs plus authored-script CRLF; authored files were normalized to LF before
the final authored-only PASS and raw-only refusal. Original raw logs are intact.

The first authored-only check also refused four extra EOF blank lines. They
were removed from authored files. `authored-whitespace-final` is the final
PASS; the raw refusal is retained separately without calling it a full PASS.
