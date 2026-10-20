# Independent execution and custody observations

This is a curated machine-readable record in Markdown. Original safe logs remain at the named remote temporary locations; hashes identify their observed bytes. They are not embedded or claimed as sandbox copies. The record itself is included in the state manifest.

```json
{
  "record_type": "BRAIN_CURATED_INDEPENDENT_REVIEW",
  "source_commit": "31307694ebb9895ed8cfb77fa6ac532b789d2810",
  "source_tree": "c52f49d6f3dfa8cdee98d4a26c707ad8747576d0",
  "reviewed_at_utc": "2026-10-20T19:45:14+00:00",
  "environment": {
    "os": "Windows",
    "node": "22.21.0",
    "npm": "11.20.0",
    "python": "3.9.13",
    "working_directory": "C:/Users/jasim/Desktop/onSkin/.claude/worktrees/m1-retained-safety"
  },
  "raw_summary": {
    "path": "C:/Users/jasim/AppData/Local/Temp/onskin-brain-cont03-review-vg5nxavc/review-summary.json",
    "sha256": "61cbfb670c11d5ee0f7159c6c38d6c7086c27e3e8613843af335aed40384a9e8",
    "bytes": 16522,
    "custody": "Remote file produced by independent Brain commands; this record is a curated summary, not a byte-for-byte copy."
  },
  "source_checks": [
    {
      "command": "npm run test -- --force",
      "exit_code": 0,
      "result": "6018 passed (5994 mobile +24 console); 0 failed/skipped; 0 cached tasks",
      "raw_log": "check-0.log",
      "sha256": "827a050f5040aac500b9689a320976e51e7d041f22fca1e2ad61aeff06b944bf",
      "started_at_utc": "2026-10-20T19:29:30.743336+00:00"
    },
    {
      "command": "npm run typecheck -- --force",
      "exit_code": 0,
      "result": "3 successful tasks; 0 cached",
      "raw_log": "check-1.log",
      "sha256": "ba7f481718120529d560122e784906383b181fbca072327244158ea89325defb",
      "started_at_utc": "2026-10-20T19:30:07.611025+00:00"
    },
    {
      "command": "npm run lint -- --force",
      "exit_code": 0,
      "result": "3 successful tasks; mobile ESLint, console TypeScript, types no configured lint; 0 cached",
      "raw_log": "check-2.log",
      "sha256": "56d71e463e484b959d9108d28d2e646c1f8432ba20140efbd18f6cdac4c3970f",
      "started_at_utc": "2026-10-20T19:30:25.932022+00:00"
    },
    {
      "command": "python -B -m unittest discover -s scripts/brain -p test_*.py -v",
      "exit_code": 0,
      "result": "48 cases: 46 passed, 2 genuine Windows symlink-privilege skips, 0 failed",
      "raw_log": "check-3.log",
      "sha256": "17aa5bb4370d9ce268edebad0e54d8eb14bb524eaa9942aa9ed8d650f0fb1e06",
      "started_at_utc": "2026-10-20T19:31:10.595616+00:00"
    },
    {
      "command": "python -B scripts/brain/brain.py --profile M1-01 report docs/brain/checkpoints/M1-01/CONT-03/completion-report.json",
      "exit_code": 0,
      "result": "Report consistency PASS; not independent acceptance",
      "raw_log": "check-4.log",
      "sha256": "541c8017bb7fd21a866d855fe5fda85fc611681400b90b57d960d104b9d21bff",
      "started_at_utc": "2026-10-20T19:35:36.805206+00:00"
    },
    {
      "command": "node --test scripts/core01/metro-linked-dependencies.test.cjs scripts/core01/native-age-assurance-source-contract.test.mjs scripts/e2e/retained-safety-assertions.test.mjs",
      "exit_code": 0,
      "result": "15 passed; 0 failed/skipped; not native execution",
      "raw_log": "check-5.log",
      "sha256": "e9907c2724a63a0c93bed72aa58b4b8b9ab69081812d7db7dd889cd76071f8cc",
      "started_at_utc": "2026-10-20T19:35:41.550793+00:00"
    },
    {
      "command": "node scripts/phase4/build-source-worklist.mjs --strict --check",
      "exit_code": 0,
      "result": "Current; passed",
      "raw_log": "check-6.log",
      "sha256": "ab248369bb441b4d4cfbb989f3aab2eac1de3a44622ca3e7bbc03e99efa122fd",
      "started_at_utc": "2026-10-20T19:35:41.974955+00:00"
    }
  ],
  "browser_checks": [
    {
      "case": "cross390",
      "command": "node scripts/e2e/onboarding-first-session.mjs --cross-owner",
      "width": 390,
      "height": 844,
      "app_port": 8411,
      "debug_port": 9511,
      "exit_code": 0,
      "output_sha256": "fbecce79891de43e7ae8aff297060d6dbbd0fea2b094ed50023def3bcd042bb5",
      "evidence_directory": "C:/Users/jasim/AppData/Local/Temp/onskin-brain-cont03-web-z90trx4h/cross390"
    },
    {
      "case": "cross375",
      "command": "node scripts/e2e/onboarding-first-session.mjs --cross-owner",
      "width": 375,
      "height": 667,
      "app_port": 8412,
      "debug_port": 9512,
      "exit_code": 0,
      "output_sha256": "359173ae9abcf58bdc2b74b2313e59979bd2b09113a95a75820619b646814278",
      "evidence_directory": "C:/Users/jasim/AppData/Local/Temp/onskin-brain-cont03-web-z90trx4h/cross375"
    },
    {
      "case": "cross430",
      "command": "node scripts/e2e/onboarding-first-session.mjs --cross-owner",
      "width": 430,
      "height": 932,
      "app_port": 8413,
      "debug_port": 9513,
      "exit_code": 0,
      "output_sha256": "2e9a751e10eeaa62d3afdd721d3238d603592a0404c715267cc2b6431544ee9e",
      "evidence_directory": "C:/Users/jasim/AppData/Local/Temp/onskin-brain-cont03-web-z90trx4h/cross430"
    },
    {
      "case": "signout390",
      "command": "node scripts/e2e/onboarding-first-session.mjs --account-isolation",
      "width": 390,
      "height": 844,
      "app_port": 8414,
      "debug_port": 9514,
      "exit_code": 0,
      "output_sha256": "1f2b9e24810b2b8318c0bd8e17183724dbe44c00f2da9649627c9fe5e3cc7e72",
      "evidence_directory": "C:/Users/jasim/AppData/Local/Temp/onskin-brain-cont03-web-z90trx4h/signout390"
    },
    {
      "case": "retained390",
      "command": "node scripts/e2e/onboarding-first-session.mjs --retained-safety",
      "width": 390,
      "height": 844,
      "app_port": 8415,
      "debug_port": 9515,
      "exit_code": 0,
      "output_sha256": "dc04781e0bcb34c7a58f44cdf49f891b6a69ca7cda58f5e962afeefbbf3e0a5e",
      "evidence_directory": "C:/Users/jasim/AppData/Local/Temp/onskin-brain-cont03-web-z90trx4h/retained390"
    }
  ],
  "harness_sha256": "fdb72850109cc1309a9919efb2625e3eaf881c69dc3c76aaac57d30675079453",
  "custody": {
    "new_commits": [
      "9508e3fe2626d0cc48f3c479204843920be2bc38",
      "696fa0e5860638e7fc286a24824010d166bf8c37",
      "8a8c0d88394986894f1e81085dceba9c927c9076",
      "b76b8f7df68eb9e48fdb1d2d4a3900ae1ab1dfde",
      "536a2e41496003265ac68acc4f85214204327fe4",
      "6e86e61bc5a11dcf5feaed0af3f9980cdd4d2f89",
      "6c088d81444cda933549d0bb64227a3611e98f70",
      "a21705a93c64a8e1c0f6f7061d5247c40d1a1f65",
      "4da339b0aa5d11143668dd03adba55c334748d7d",
      "38d75c12f13ef105cfa913c8702fd13b6009d97b",
      "8a485b2e462b041aa9b0a54570595cbcf04bad5e",
      "7cb800fbc14046284bb610e2c4e2e46303d7a423",
      "e5005a4f7bdab781782252eb6f07bae97ebb9d7b",
      "d2916d79c2c04988649a5a8ed631baf67ed2851c",
      "b1f05a2601927ddbe582de2b15dfa600c9bb3e99",
      "c15f5860fd9969dcfcb25447da64e149f3d4cae6",
      "31307694ebb9895ed8cfb77fa6ac532b789d2810"
    ],
    "new_changed_paths": 1121,
    "cumulative_main_changed_paths": 5021,
    "ordinary_diff_files_reviewed": 12,
    "report_artifacts_verified": 1083,
    "mismatches": [],
    "issued_manifest_sha256": "42ed0cb652fe921640d525578d0ac59b7832f3d0567e6a5515f3687347c5d2b5",
    "issued_files_verified": 29,
    "old_records_unchanged": true,
    "protected_paths_unchanged_per_commit_and_net": true,
    "worklist_items": 14,
    "worklist_references": 414,
    "worklist_meanings_unchanged": true,
    "worklist_fingerprint_mismatches": [],
    "worklist_generator_sha256": "b3882f954498008cd80fe57d50f75c358504bca99f5f97b7481239977af26d1e",
    "measured_to_delivery_tail_paths": 585,
    "tail_only_checkpoint_and_handoff": true,
    "worktree_clean_before_after": true
  },
  "cross390_observation": {
    "exactB": true,
    "healthOwnerB": true,
    "noAInCache": true,
    "noAInShelfOrQueue": true,
    "hasB": true,
    "bEditPersisted": true,
    "ciphertextOnly": true,
    "noWidgetCapabilities": true,
    "rendered_samples": 5764,
    "observed_leaks": 0,
    "late_operation_errors": [
      "PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY",
      "HEALTH_DATA_WRITE_ADMISSION_CLOSED",
      "ACCOUNT_GENERATION_CHANGED"
    ],
    "visual_review": [
      "CO-03-cleanup-refused.png",
      "CO-09-b-usable-shelf.png",
      "CO-11-b-identity.png"
    ]
  },
  "limits": [
    "No native device or live provider execution",
    "No Linux governance rerun in this review",
    "Sampled DOM/frame observations do not prove absence of every possible rendering race",
    "Synthetic identity/preflight transport is not genuine provider authentication",
    "Full 233 focused tests reported by Codex were not separately rerun; applicable application tests are included in the independently rerun root suite",
    "Security advisory impact not independently adjudicated; no protected acceptance"
  ]
}
```
