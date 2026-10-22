# Latest exact-head CI (authenticated provider)

Main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, stage `8babdad11791496ad6e8c45154b3b173bdddd36e` (tree `cf2ff58cc140956d8c3cda4a11c703733ebe6544`), [draft PR #9](https://github.com/TasfiqJ/onSkin/pull/9).

- [Quality 39545262835](https://github.com/TasfiqJ/onSkin/actions/runs/39545262835): completed SUCCESS. Credential-free canonical database test job 119041893746 passed; repository checks, PG15/17 rehearsals, and source-only Expo ios/android exports passed. This is a single exact-run observation, not guaranteed ECR availability or DB06 permission.
- [Security 39545262842](https://github.com/TasfiqJ/onSkin/actions/runs/39545262842): completed FAILURE. Original secret job 119041893805: test fixture cleanup `OSError: [Errno 39] Directory not empty: '.git'` after 9 passes/1 error; scanner not run in this delivery; separate static collector refused frozen `SOURCE_INVENTORY_DRIFT`; code/SBOM/advisory and expired owner acceptance remain failed.
- [iOS contract 39545262853](https://github.com/TasfiqJ/onSkin/actions/runs/39545262853): SUCCESS source-only.

Codex must refresh actual provider jobs after its own push. The previous measured head `3c063dfe` experienced ECR `toomanyrequests` in its canonical job; delivery `8bab` passed. Neither permanent acquisition repair nor hosted replay is inferred.
