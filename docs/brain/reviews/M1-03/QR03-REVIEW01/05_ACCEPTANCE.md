# Finite acceptance gate

| Gate | Required | Never substitute |
|---|---|---|
| G1 exact custody | External manifest anchor, 7 writable+16 protected current base SHA256/Git blob/size, no out-of-scope changes | Self-issued digest, stale stage |
| G2 historical test fixture | Correct QR02 and QR03 snapshots, unchanged `test_*` bodies and negatives, real tampered-byte refusal | Copy current markers or fabricated blobs |
| G3 governance | Original ordinary full discover passes with 2 genuine platform-only skips, 0 failures/errors, at least 6 new adverse tests; frozen diagnostic optional | Alternate brain.ROOT green / relabeled misses |
| G4 root source | Fresh npm ci and forced 6067 root tests/typecheck/lint with 0 cached tasks | Historical or partial cached pass |
| G5 retained safety | Original secret12 green; Security70 status accurately red or green as observed, no test/policy/fixture rewrite | Unit tests=protected GO |
| G6 strict delivery | Canonical Phase4 worklist and strict M1 report green on committed Git blobs; hash every execution/receipt; exact final CI and branch | Uncommitted local evidence, pending=>pass |
| G7 protected boundaries | No edits to Expo/RN/native/Privacy/DB/Security/clinical/sourcepack or workflows, accepted identities unchanged, 0 spend, PR9 unmerged | Main/M2/release/hosted permission |

Even all gates green admit only the finite **governance fixture repair**, not whole M1-03, Security, canonical database, M2, device, clinical or release.
