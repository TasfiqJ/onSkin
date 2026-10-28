# Campaign24 independent reproduction

This is integrity/source-consistency guidance, never an acceptance grant. Independently verify the external return manifest and verifier hashes from SHA256SUMS/delivery annex before running delivered code. G97 FAIL/NO_GO; all qualified database/Security/native/J01/release gates remain closed.

The source prerequisite is exact PR27 5976394fd39f41550bde8107b9cc27c758b7ce14 / tree63a896fad61d85a51b0d1e9a23020ba02d169c9e. The minimal v2 Git bundle requires that prerequisite; it does not contain unrelated full history. Use a complete independent clone with no object sharing/alternates/shallow/partial history, set core.autocrlf=false before checkout, then verify/fetch the delta and check out exact final HEAD d0ccef65bcbe0c90483e6c0f691ed95f92228c6c / tree22f91455d651a81296ab8724f9db7cfead65af08. Disable unreviewed Git hooks and reject replacement refs, grafts and external Git filters. Mandatory npm installation hooks must run.

Use the actual reviewed Node/npm installation for normal npm ci with mandatory hooks; the performed current paths use npm11.20.0. Then independently hash the standalone verify_return24.py. Execute the following with the externally published digest values; all option prefixes use TWO ASCII HYPHENS:

```text
python -B verify_return24.py --archive onSkin_Campaign24_Security_Advisory_DB_Recovery_Return_2026-10-28.zip --expected-manifest-sha256 EXTERNAL_RETURN_MANIFEST_SHA256 --expected-verifier-sha256 EXTERNAL_RETURN_VERIFIER_SHA256 --git-root COMPLETE_EXACT_FINAL_CHECKOUT --expected-head d0ccef65bcbe0c90483e6c0f691ed95f92228c6c --expected-tree 22f91455d651a81296ab8724f9db7cfead65af08 --execute-source-checks
```

Without git-root/source-check flags, VERIFIED authenticates artifact integrity only and explicitly reports source checks NOT_RUN. Full source mode verifies exact ancestry, every committed finite-scope transition, sole worklist child and one tail, complete Git tree/index/status and changed public working bytes, then actually runs finite Release24 governance and unchanged strictPhase4. It does not open unrelated private protected working bytes or grant Security/database/native/release acceptance.

Complete report and exact manifest inventory describe original151/historical fixture qualification, all executed commands/exits, platform-specific NOT_RUN, remaining findings/custody and genuine canonical/reset/SQL evidence. Raw public scanner collections, private original Security findings/logs, raw canonical status keys and native-config ENV bodies are excluded. Existing returned public candidate components retain actual required findings and candidateReady=false.

The checkpoint report and353-member payload are frozen pre-tail evidence. Post-tail files contain final CI and two actual independent full-checkout0/1/0 controls. Artifact corruption/restoration and public downloaded-byte verification occur after the outer ZIP freezes and are recorded externally in the complete report/delivery annex to avoid circular hashes. No archived instruction is a second active task; the independent Brain alone accepts later source.

SUBMITTED_REVIEW_REQUIRED.
