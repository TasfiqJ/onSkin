# Engineering19 readable evidence

**All38 requirements and all18 acceptance gates remain UNACCEPTED. Public/release NO_GO. This is evidence delivery only.**

Source checkpoint: `2f699f6157c1d6414b7e74661a4e11e89a77ed92` / tree `c3968521569a5ae0ce5cea0a96a1d6350684e4b5`. Parent evidence upload: `cda890d175198c0ba0c041a19999d0e7fe171d0d`. The original archive remains unchanged at that commit; its ZIP SHA256 is `f58bd6b996be5861520ee8aef51434f140035aa50217f98e44e7bfe44b1fdf79`.

Open this README using the immutable commit URL supplied with the handoff. Every index link below is repository-relative and therefore resolves within that exact evidence commit; links do not depend on the moving branch or tag. A literal self-commit hash cannot be embedded in its own Git commit. For raw reader URLs, replace `github.com/<owner>/<repo>/blob/<COMMIT>/` with `raw.githubusercontent.com/<owner>/<repo>/<COMMIT>/`.

## Start here

- [Complete final report](reports/FINAL_REPORT.md)
- [All38 requirements / all18 gates](reports/ALL38_ALL18_MATRIX.md) and [machine-readable assessment](reports/ALL38_ALL18_MATRIX.json)
- [Complete technical change inventory](inventories/TECHNICAL_CHANGE_INVENTORY.md)
- [Test/build/browser receipt index](tests/TEST_EVIDENCE_INDEX.md)
- [Exact offline ancestry witness](ancestry/COMMIT_ANCESTRY_WITNESS.json) and [standalone verifier](ancestry/verify_ancestry.py)
- [Original continuation](continuation/NEXT_SESSION_PROMPT.md), [delivery addendum](continuation/DELIVERY_ADDENDUM.md), [permanent protocol](DELIVERY_PROTOCOL.md)
- [Material review and sanitization disclosure](review/PUBLICATION_REVIEW.md)
- [Publication manifest](MANIFEST.json)

## Patch parts, exact order

### CUMULATIVE_PR48_TO_ENGINEERING19.patch

Original and reconstructed bytes: **2969696**. SHA256 `456cc6f166fd11a44345bb1f7978dc2555011daaeedf77ffa9ba029b21c10f60`. Byte-exact; no redactions.

1. [patches/cumulative/part-001.txt](patches/cumulative/part-001.txt) — 245724 bytes; SHA256 `34d761aed705e5b40e33ecf9c76cca73ad3d0a5923f31f936150670e991cf872`
2. [patches/cumulative/part-002.txt](patches/cumulative/part-002.txt) — 245705 bytes; SHA256 `8f3838401827c17e34d5a75816fb05771b042aa7dca14f2b8bf42b987702ffcf`
3. [patches/cumulative/part-003.txt](patches/cumulative/part-003.txt) — 245749 bytes; SHA256 `3d5afd020c287c23221ee0e464facc4e7e9caf59f43cb4b82dd17080f40f9512`
4. [patches/cumulative/part-004.txt](patches/cumulative/part-004.txt) — 245719 bytes; SHA256 `2c3287bf02f46e6e4bdfd40ca2f02a935c62d249f1a0b833fdb067a3fba8a808`
5. [patches/cumulative/part-005.txt](patches/cumulative/part-005.txt) — 245742 bytes; SHA256 `e2838a5b248a0c6c716bfdfe287153b7db86c209d670b4cfc53dd0562bbe171a`
6. [patches/cumulative/part-006.txt](patches/cumulative/part-006.txt) — 245666 bytes; SHA256 `f7e0618ae292718ee424722481c136b354e422faaec6071d9f76878a8d7d5d49`
7. [patches/cumulative/part-007.txt](patches/cumulative/part-007.txt) — 245745 bytes; SHA256 `0768dc9ec1339dd2c9a1ee9aee0a40fde5215d15bd42fb58d92eab686cc239ed`
8. [patches/cumulative/part-008.txt](patches/cumulative/part-008.txt) — 245735 bytes; SHA256 `3756564b7208a368c7c6e9c757547cfbbe9a910e71949040c9a3c26714d8d2fe`
9. [patches/cumulative/part-009.txt](patches/cumulative/part-009.txt) — 245020 bytes; SHA256 `a5eea88e63aac099e59a54dd70a031901286e1eafc93ab8f7f5d4ef841e47eb6`
10. [patches/cumulative/part-010.txt](patches/cumulative/part-010.txt) — 245499 bytes; SHA256 `a5d3896bcc4bef27f25d57fc70e3ee3e2e177b38bd6faabec63a48c94e4d957a`
11. [patches/cumulative/part-011.txt](patches/cumulative/part-011.txt) — 245681 bytes; SHA256 `30b414abaf7152df0ea9cc55eb2b0ad946a7598e2b48f7d8e04b8c61b0d887d8`
12. [patches/cumulative/part-012.txt](patches/cumulative/part-012.txt) — 245704 bytes; SHA256 `33700848dbc1a1d605bfc34470f158018643b90d9e375c074aab2c11a265d138`
13. [patches/cumulative/part-013.txt](patches/cumulative/part-013.txt) — 22007 bytes; SHA256 `0faa07a069959af89ed5c2aa098feba518dbb469d7a230b09a4d46071972c17e`
### SESSION_ENGINEERING18_TO_ENGINEERING19.patch

Original and reconstructed bytes: **117642**. SHA256 `71cd5259dd2b4598ade02e848aab5408c2fb9898177c7578eb9ea845f5498d1c`. Byte-exact; no redactions.

1. [patches/session/part-001.txt](patches/session/part-001.txt) — 117642 bytes; SHA256 `71cd5259dd2b4598ade02e848aab5408c2fb9898177c7578eb9ea845f5498d1c`

## Verification and reconstruction

1. Read `MANIFEST.json`, then all `fileManifestShards` in listed order. Each original text file records original size/hash, published size/hash, explicit sanitization counts and ordered part paths/sizes/hashes.
2. Read every part as UTF-8. Join its exact bytes with no added separators, newline conversion, BOM insertion or whitespace edits. Part boundaries prefer complete lines. Split JSON may require reassembly before parsing; each part is still independently readable UTF-8 text.
3. `python verify_publication.py .` verifies every published payload hash, all text reassemblies, all38/all18 unaccepted state and the offline ancestry witness. It requires no Git credentials or network.
4. `python reconstruct_patches.py --root . --out <empty-output-directory>` recreates both byte-exact patch files and verifies their original hashes. `receipts/PATCH_VERIFICATION.json` records actual original forward/reverse exact-tree checks using temporary indexes; the script does not apply anything to an application checkout.
5. `python ancestry/verify_ancestry.py ancestry/COMMIT_ANCESTRY_WITNESS.json` independently verifies all133 raw commit objects and132 parent edges using Python standard library only.

The manifest binds all published files except itself; Git's immutable commit/tree binds the manifest. No self-referential file checksum is claimed. The existing `original/EVIDENCE_SHA256.json` and historical log receipts describe original ZIP bytes, not sanitized publication bytes. Use `MANIFEST.json` for the latter.

## Completeness and disclosure

All336 existing UTF-8 files are published in full, including intermediate failures, reproduction scripts and browser captures. All206 PNGs were reviewed but are not recommitted as binaries; all542 archive entries and their original hashes are listed in `inventories/ORIGINAL_FILES-*.json`. Captured browser DOM, geometry, network and summary JSON remain readable. The complete source inventory and large logs are split rather than truncated.

Ordinary text copies replace the local Windows home prefix with `[LOCAL_USER_HOME]` and remove terminal escape sequences. Source patches and raw ancestry bytes are unchanged. Required raw author metadata was checked against the already-public published source; the privacy finding was reported before publication. No sensitive customer/clinical/device/credential material was identified. This review does not confer security-gate acceptance. See the review report for exact limits.

No further engineering, application source change, PR48 change, main update, workflow dispatch, paid operation, native runner, LFS, Codespace, deployment, merge or release is part of this handoff. The publication uses one evidence-only `[skip ci]` commit and a tree with no workflows; current workflow-trigger checks are included in `review/WORKFLOW_PREFLIGHT.json`. Remote readability/hash/Actions verification is performed after publication and reported in the final handoff.

## Complete published file index

The table lists every payload/part/shard already in this tree. `MANIFEST.json` additionally records the index's own byte count and hash. All files are UTF-8; every file is at most245,760bytes.

| File | Bytes | SHA-256 |
|---|---:|---|
| [ancestry/ANCESTRY_VERIFICATION.json](ancestry/ANCESTRY_VERIFICATION.json) | 238 | `f49c5cba0a2a9d869932f6f6b023fc5824a4d82c33f5e2b0bafc61bccb4d2668` |
| [ancestry/COMMIT_ANCESTRY_WITNESS.json](ancestry/COMMIT_ANCESTRY_WITNESS.json) | 94940 | `2be9c89a5f76489dbd4b9186122465cf8acfe9562c63273d1bb24e33b73ab2ac` |
| [ancestry/verify_ancestry.py](ancestry/verify_ancestry.py) | 1516 | `51f9d57a7e348b014417de61e8a745a969786fc186781a8be34126bd183191a9` |
| [browser/consumer-375/01-welcome.json](browser/consumer-375/01-welcome.json) | 926 | `1ff071420091095d23daad344ad71d5a21c1bc5775d2491387aeea3c73f4c5c7` |
| [browser/consumer-375/01a-direct-protected-age-gate.json](browser/consumer-375/01a-direct-protected-age-gate.json) | 1427 | `1c811e76776fc8a0c50ea512584655b657f4116500ff2e30d6c5c171f7d6c83d` |
| [browser/consumer-375/02-age-empty.json](browser/consumer-375/02-age-empty.json) | 1427 | `1c811e76776fc8a0c50ea512584655b657f4116500ff2e30d6c5c171f7d6c83d` |
| [browser/consumer-375/03-age-filled.json](browser/consumer-375/03-age-filled.json) | 1428 | `0523e7b79942324574610492b44873c48afdc6f15a85b65e472f60f015f3ea19` |
| [browser/consumer-375/03a-after-age-submit.json](browser/consumer-375/03a-after-age-submit.json) | 1593 | `1dfffcada37febe538624840f7732dcb581f8b469da8fc98364241355b755fef` |
| [browser/consumer-375/04-consent.json](browser/consumer-375/04-consent.json) | 1593 | `1dfffcada37febe538624840f7732dcb581f8b469da8fc98364241355b755fef` |
| [browser/consumer-375/05-goals.json](browser/consumer-375/05-goals.json) | 2121 | `c7a37b8026731952885945bc49ffef110c96a5780329fe81f96d660524423a49` |
| [browser/consumer-375/06-goals-selected.json](browser/consumer-375/06-goals-selected.json) | 2131 | `21ceadfe25ce8f4474c0bfc87faa94b904d99f863ba75b2f725059aa0957b10d` |
| [browser/consumer-375/07-quiz-01.json](browser/consumer-375/07-quiz-01.json) | 1416 | `e309f0781af84f67c0e24e98ac175bfe297c8897febad6d9b4fdcc8002a84670` |
| [browser/consumer-375/08-quiz-after-04.json](browser/consumer-375/08-quiz-after-04.json) | 1392 | `c0c3d48805e20f11dfcddf818941adf0f649769bd72b0fb7b9d00419f72208d6` |
| [browser/consumer-375/08-quiz-after-09.json](browser/consumer-375/08-quiz-after-09.json) | 2085 | `dcf300420c93768d63fa4513c4c95729b20014813729c560f1b22ae4a3690c0b` |
| [browser/consumer-375/08-quiz-after-11.json](browser/consumer-375/08-quiz-after-11.json) | 1665 | `3b591240eb85bd7c9798b90941ea446b1df89c8290dccd5a38b0bc8acd0ad5a6` |
| [browser/consumer-375/09-products-empty.json](browser/consumer-375/09-products-empty.json) | 936 | `e90b0253d6a254214741867004a79b1ddd86ba986469b82f16f7cdff44492238` |
| [browser/consumer-375/10-products-after-1.json](browser/consumer-375/10-products-after-1.json) | 1456 | `c5c50de549bf209828c983b56f8029866260bb1e9237341dc1a2826a10c164b0` |
| [browser/consumer-375/11-products-after-2.json](browser/consumer-375/11-products-after-2.json) | 1699 | `7e723c24611c69933f899d492891e78949a08bc0e652a2c32ef71f8b57aad9de` |
| [browser/consumer-375/12-products-after-3.json](browser/consumer-375/12-products-after-3.json) | 1711 | `ab158daae4b29dc6a9dbe4c89489506118149d9db4d8da0ea413d731abc2e075` |
| [browser/consumer-375/13-post-products-continue-current.json](browser/consumer-375/13-post-products-continue-current.json) | 373 | `91da634571f9a4f9df5b4faf765871ebd6c72d9692df56e5cb81f36eec724ffa` |
| [browser/consumer-375/14-reveal-checks.json](browser/consumer-375/14-reveal-checks.json) | 691 | `67e150810a22ad6db9584b2b3e46ec2f5a7f69d838275c20b5ee3feb0897e708` |
| [browser/consumer-375/15-notifications.json](browser/consumer-375/15-notifications.json) | 947 | `7de936dedf1e7e505bacc395aea45e46268a6aaab0bd89f97795bc60486759f4` |
| [browser/consumer-375/15a-reminder-persistence35.json](browser/consumer-375/15a-reminder-persistence35.json) | 279 | `f897948700183e1b5e692417e52f80b0a5c33547e967fc53435baf8fe6bef1d4` |
| [browser/consumer-375/15a-reminders-off-saved.json](browser/consumer-375/15a-reminders-off-saved.json) | 997 | `bfb4f68caf373c79f776eac62e85097e761e8d1e5dacb89039bddf5aadb362c8` |
| [browser/consumer-375/15b-reminder-continuation35.json](browser/consumer-375/15b-reminder-continuation35.json) | 35 | `e75a92b253d32972326cf154509b02d3ef2e37c574865718f1f6a977c237a897` |
| [browser/consumer-375/16-account.json](browser/consumer-375/16-account.json) | 714 | `0d6387eea532be5faf2636c18882c949b2cda6d2307c708c3e4ea73a95323f50` |
| [browser/consumer-375/17-paywall-current.json](browser/consumer-375/17-paywall-current.json) | 2844 | `4554cea8d9739e7cb178ebbd3a9b6d943b2ee1814d333eb9ac00dcb39f543232` |
| [browser/consumer-375/17-paywall.json](browser/consumer-375/17-paywall.json) | 2844 | `4554cea8d9739e7cb178ebbd3a9b6d943b2ee1814d333eb9ac00dcb39f543232` |
| [browser/consumer-375/18-paywall-free-path-visible.json](browser/consumer-375/18-paywall-free-path-visible.json) | 2231 | `6143544b2fbafc71db5993c63a72f5b037811a50518006bc0170d7b10a234924` |
| [browser/consumer-375/19-today-free-current.json](browser/consumer-375/19-today-free-current.json) | 2401 | `68b367f70c714582435b6efac813462cce471d05fdb7a5f0a4739b043f9004fe` |
| [browser/consumer-375/20-free-first-session35.json](browser/consumer-375/20-free-first-session35.json) | 713 | `cedfae9f65089484b0a63194bb7e61c9a3176d4cc10421ce98e2d48bdf020387` |
| [browser/consumer-375/20-shelf-after-onboarding.json](browser/consumer-375/20-shelf-after-onboarding.json) | 6320 | `f1063cfbffe7f8b56ff9b1e7f2a169f4faf318a9bc0cff5a3844bf7b24896af0` |
| [browser/consumer-375/actual-applied-reload.json](browser/consumer-375/actual-applied-reload.json) | 2149 | `d785d0193a0e575f114ecde66b9aecc45467e3c656357fa708d3af704d0019fe` |
| [browser/consumer-375/actual-brief-review.json](browser/consumer-375/actual-brief-review.json) | 13611 | `de5e3fb8c83542e0074852f5df18ee17b228b25e52975615a4525fb18a8b010f` |
| [browser/consumer-375/actual-routine-summary.json](browser/consumer-375/actual-routine-summary.json) | 641 | `96b86ce1ab23dd1c215430265bb0764b9ed1e091a1875b455e9bc553ee1989db` |
| [browser/consumer-375/actual-use-retraction.json](browser/consumer-375/actual-use-retraction.json) | 2269 | `d85ab30bfc2a4eb70bd29107f15eb0f769defcc1e25923d81bf96e52cf6a8b73` |
| [browser/consumer-375/bottle-C37-product-before-touch.json](browser/consumer-375/bottle-C37-product-before-touch.json) | 12648 | `0fe922a4010c51c79f460c6e473d05fd385a124ffce22208706d8dcea39462bf` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-001.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-001.txt) | 245430 | `e2018c0d9d0ab58d60de3eb89c3c5f032c55d85b181e8824b86cd12b2f6fd53e` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-002.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-002.txt) | 177218 | `98d257c30eedc9645a6b2e588390508cc0775005b6cc5e9703e70645f71f7c80` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-003.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-003.txt) | 245758 | `2be8fb5c7acd80e63bb291f3209409b67c92431cf4b49aec1828629a5fc4cb34` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-004.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-004.txt) | 243017 | `f9d3870f628f9e030b44d00dc7484fce1fac1d5d5cefe8100a776917a57c815e` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-005.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-005.txt) | 179666 | `b9d0d6a9ff8c73d2c0ffaecc4449717dbad8ae19c83588ee8b689103534fc7b3` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-006.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-006.txt) | 245742 | `35ee1ca032a6b7947737bea7ae1f724756508c16068ad36681ea3d245bf89ac0` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-007.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-007.txt) | 242090 | `e827f3c33a8d9f4885b87419abc31b9c6b0a63ab521f387883d70b78b32c154b` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-008.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-008.txt) | 245743 | `86ef3bd8b47f89118444ee29d47d3c0acd8fbeca8dea47ebc43df463ff30efe5` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-009.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-009.txt) | 243508 | `6e592dd38b7bd071039edaeb609a69a7c9c146fd920f181b21214fe1f203c1bf` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-010.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-010.txt) | 245712 | `4e85fb0155328f5c368823b8b9577f348a58ab0f261cf028bf88a7f2b5ea8b6c` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-011.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-011.txt) | 243079 | `111c71d5d8358cafff5ad82f66448f161c35a3ef16a5fe9b193b764697fe6b71` |
| [browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-012.txt](browser/consumer-375/bottle-C37-Shelf-hit-chain.json/part-012.txt) | 86677 | `679469f602cf1ea19679373b18eba8142c10f1d60c9afb8eabccddb75be3b9a9` |
| [browser/consumer-375/bottle-recorded-use.json](browser/consumer-375/bottle-recorded-use.json) | 3641 | `44339c7139b71c0f4e7705765ea6ce8a0be74a86be0d1bef5ce3fd49f8876a2e` |
| [browser/consumer-375/bundle-crypto-provenance.json](browser/consumer-375/bundle-crypto-provenance.json) | 713 | `e90d08bd0e30d955f675fdd0dbd690537cf68ae5b04cda378a5a41647e25bcb3` |
| [browser/consumer-375/C37-run-environment.json](browser/consumer-375/C37-run-environment.json) | 734 | `cf75ad393b5b46502140e3cf0f1380e41ffe7a2c9afb228693fed9c9834315c0` |
| [browser/consumer-375/C41-01-explicit-draft.json](browser/consumer-375/C41-01-explicit-draft.json) | 3762 | `3de87a7776390e91b16730d79213692e24bfeac8956433037be837b8187fe5b7` |
| [browser/consumer-375/C41-02-first-save.json](browser/consumer-375/C41-02-first-save.json) | 3157 | `25a1167fb7d8af3cb3beced4f592ceb6f9f2c148ff5a1aea10ff72c662561543` |
| [browser/consumer-375/C41-03-correction-and-retraction-lineage.json](browser/consumer-375/C41-03-correction-and-retraction-lineage.json) | 3852 | `8b2406af07dcfd4da351880609e6271c3123ef1ae9982fd25ca7eb35f2b5210e` |
| [browser/consumer-375/C41-04-truthful-storage-refusal.json](browser/consumer-375/C41-04-truthful-storage-refusal.json) | 3952 | `f94f6f27442803321f8748d1bf4c509e9faeca82fc923127613e63a271dc59d7` |
| [browser/consumer-375/C41-05-reloaded-private-lineage.json](browser/consumer-375/C41-05-reloaded-private-lineage.json) | 4247 | `8a55181263ccadfb8312a22b08f82cc71f412004a635ca6b0b6c98c747c6beaa` |
| [browser/consumer-375/C41-06-closed-consent-epoch-masked.json](browser/consumer-375/C41-06-closed-consent-epoch-masked.json) | 1601 | `e6156d60986d19acd3260271bf4371251b464527849cf0dcc52f8b90375e2db8` |
| [browser/consumer-375/C41-07-forged-owner-refused.json](browser/consumer-375/C41-07-forged-owner-refused.json) | 1337 | `65fcaae2545fae05ffb930f3294fd008427c0f1407f4dcbc7478d7fe509de03a` |
| [browser/consumer-375/C41-control-hit-receipts.json](browser/consumer-375/C41-control-hit-receipts.json) | 28597 | `c808a65760155eacd7db93fcc0f2e56e364bf3955c163f559a477fcb30508050` |
| [browser/consumer-375/C41-development-phase-entry.json](browser/consumer-375/C41-development-phase-entry.json) | 401 | `c4c8e506c410630fdf0d7dcf79bc3742cb2b4d33b737955387d0a8a6d3910081` |
| [browser/consumer-375/C41-duplicate-touch-ownership.json](browser/consumer-375/C41-duplicate-touch-ownership.json) | 774 | `d3f21bac265fbccc6953ae86f3e6c8b7a5fe2364db4bd89a1f418c85b14ad335` |
| [browser/consumer-375/C41-hostile-authority-negatives.json](browser/consumer-375/C41-hostile-authority-negatives.json) | 306 | `a25544b6658539809e4db66b67031b1c745269560980615f6ccd829b46bed6d6` |
| [browser/consumer-375/C41-local-readback-receipts.json](browser/consumer-375/C41-local-readback-receipts.json) | 16307 | `280d2640aa7c922af67e37cf04be53b043818363b1858c2d0d8440bd3f8ce54f` |
| [browser/consumer-375/C41-navigation-authority-readbacks.json](browser/consumer-375/C41-navigation-authority-readbacks.json) | 4253 | `4791fa37109ced4d1bb089f032fb8d6b582c5ba002fabc21a513d90624c334da` |
| [browser/consumer-375/C41-network-metadata.json](browser/consumer-375/C41-network-metadata.json) | 3289 | `509031597363f8c9ed2fec0ea9db391cf29413fdd410e539a48d2f0663009d52` |
| [browser/consumer-375/C41-source-hashes.json](browser/consumer-375/C41-source-hashes.json) | 1764 | `a429eec51eb2ab73e9bdc475c16c7d79094badc5f288ce996c604dd13287f7d9` |
| [browser/consumer-375/C41-summary.json](browser/consumer-375/C41-summary.json) | 1265 | `de2cedeb87bb3abf5a33646efd7936d57c686996025733f72b0436e289b5d437` |
| [browser/consumer-375/C41-visible-status-alerts.json](browser/consumer-375/C41-visible-status-alerts.json) | 1251 | `da9e123b65d02c2d57a9d82ffa891c2b316493b479b7ce8a79fdb83bd39cffef` |
| [browser/consumer-375/changed-sequence-review.json](browser/consumer-375/changed-sequence-review.json) | 2054 | `d0239f02fcab5264874e87805ee740a73ec6942a52bf7032517fa8fcd47ebf42` |
| [browser/consumer-375/confirmed-bottle-before-use.json](browser/consumer-375/confirmed-bottle-before-use.json) | 2405 | `cb8450e6d494d09d38daa75f56526a1ad6e26b1235f20a4a6919a891e7021d53` |
| [browser/consumer-375/continuation06-canceled-records-question-review.json](browser/consumer-375/continuation06-canceled-records-question-review.json) | 13236 | `e402ddeb6ab15f294545eea4ed027e9f7e808f2024849b80d762adfb2f708b99` |
| [browser/consumer-375/continuation06-fresh-record-load.json](browser/consumer-375/continuation06-fresh-record-load.json) | 14712 | `e7a0ee9784d2b952a39c691354bc6bfe479d9cbd12d56e8580cf1fd6cd9c8aea` |
| [browser/consumer-375/E17-clear-reload-history.json](browser/consumer-375/E17-clear-reload-history.json) | 3401 | `8e813af621897574dbdadb4c8ebfc6b4ba06d5ae0b0619dfca883d20447f61e5` |
| [browser/consumer-375/E17-clear-review-cancelled-callback-refused.json](browser/consumer-375/E17-clear-review-cancelled-callback-refused.json) | 2367 | `ead135b3c2c9775d8e4193bd4d856ae09dfdf4bfd26cbc4da30aa15b58239cfd` |
| [browser/consumer-375/E17-clear-selected-brief.json](browser/consumer-375/E17-clear-selected-brief.json) | 11957 | `0fa7bf045743dd6351f4091d49a57d18e83ee8dd511de41375d138fbd9ad0803` |
| [browser/consumer-375/E17-cleared-today-optional-access.json](browser/consumer-375/E17-cleared-today-optional-access.json) | 1855 | `bf7404e3de993f743f0089fb92569ab7dece0ab7913b572146285a5c2b979a9d` |
| [browser/consumer-375/E17-restart-preserves-clear-and-use-history.json](browser/consumer-375/E17-restart-preserves-clear-and-use-history.json) | 3890 | `38a5c134b44f4fc6eea393cc2605d6cfc5d1162becfa6ff8bfe3e7a839f04b46` |
| [browser/consumer-375/E17-restart-today.json](browser/consumer-375/E17-restart-today.json) | 2690 | `3bb40784e4ef17d93f7e8ca215a9feec83adb323a3ab25a1e81e17282081dccc` |
| [browser/consumer-375/E17-review-start-initial.json](browser/consumer-375/E17-review-start-initial.json) | 489 | `952319406fbc8439c81caf7a9256cb86db50bc484e5cc517aa12093bf987e5e0` |
| [browser/consumer-375/E17-review-start-reopened.json](browser/consumer-375/E17-review-start-reopened.json) | 489 | `952319406fbc8439c81caf7a9256cb86db50bc484e5cc517aa12093bf987e5e0` |
| [browser/consumer-375/E17-timing-keyboard-saved.json](browser/consumer-375/E17-timing-keyboard-saved.json) | 1875 | `7c8ac305e1ddc90c21d03666b853a50b2a32be341214c610615eb8394dc467bf` |
| [browser/consumer-375/E17-timing-reload.json](browser/consumer-375/E17-timing-reload.json) | 1791 | `91c1b522c2faa7742de8a610ad80d8554b05ef7d0fce70ba5d705078a9f17b6b` |
| [browser/consumer-375/E18-corrected-recorded-use-reload.json](browser/consumer-375/E18-corrected-recorded-use-reload.json) | 1314 | `30eb6f63da214cfd9a891ccb36e50531af3369b424f2e0893fc7c6c26cf57bd6` |
| [browser/consumer-375/E18-current-recorded-use.json](browser/consumer-375/E18-current-recorded-use.json) | 1268 | `e5ed5c642c05bd60784429a5e40e3a61f79362686297723985c8c6b9043992fa` |
| [browser/consumer-375/E18-welcome-no-inferred-lapse.json](browser/consumer-375/E18-welcome-no-inferred-lapse.json) | 825 | `cde2964f4861d87160721ec0d95c6845c33c0a979ce3988c603332c6c831092e` |
| [browser/consumer-375/engineering15-privacy-summary.json](browser/consumer-375/engineering15-privacy-summary.json) | 399 | `b2b368816e4f0f15ceb119ef0ef239adb2517b6c7850be1fe4754d723bfd42f5` |
| [browser/consumer-375/engineering17-summary.json](browser/consumer-375/engineering17-summary.json) | 510 | `07226bdbc4307b9ea78aae7f915f43b8a102d5985a5b0fea1cf4e8c89114a966` |
| [browser/consumer-375/engineering18-activity.json](browser/consumer-375/engineering18-activity.json) | 238 | `5eb93bcad7b6d291e3e6bc6141f750136c7ec6671b21c8e591a680aa626f62ed` |
| [browser/consumer-375/expo-web.log](browser/consumer-375/expo-web.log) | 32401 | `57a9a1e00e9fcc447853dc66c13290f23ca91cfec8c5dc915440f76004dfccb0` |
| [browser/consumer-375/first-apply-comparison.json](browser/consumer-375/first-apply-comparison.json) | 1833 | `2e9f4ac3c93c1173af137b2f94a5348a1baa8eb500a241e339ed4b60ac4ef326` |
| [browser/consumer-375/formula-bottle-touch-before-scroll.json/part-001.txt](browser/consumer-375/formula-bottle-touch-before-scroll.json/part-001.txt) | 245692 | `35858a2766f4fc30ca8a32172c7ffdc33b29a445f9a1a38e819118b88e6e9986` |
| [browser/consumer-375/formula-bottle-touch-before-scroll.json/part-002.txt](browser/consumer-375/formula-bottle-touch-before-scroll.json/part-002.txt) | 190753 | `926f67bd9c0c65e847f6278f0fca00b4145e3f7dfd9a871b87f977a7d9a01cad` |
| [browser/consumer-375/formula-bottle-touch-before-scroll.json/part-003.txt](browser/consumer-375/formula-bottle-touch-before-scroll.json/part-003.txt) | 75121 | `04fa6f6a579dd2c7cc12ea77114770619077a392112bdb79cf8e6ca38e6cb066` |
| [browser/consumer-375/formula-bottle-touch-detail-arrived.json](browser/consumer-375/formula-bottle-touch-detail-arrived.json) | 60 | `81d0006a971d41d3d9e949994467ed5fd7b7e53352a210c9ed4e06224aea0585` |
| [browser/consumer-375/formula-bottle-touch-dispatch-touchEnd.json](browser/consumer-375/formula-bottle-touch-dispatch-touchEnd.json) | 82 | `bdd586d68ca4c95c405cb65dc08c6e269112a447a9bc1d28e1c08ab63175ea4a` |
| [browser/consumer-375/formula-bottle-touch-dispatch-touchStart.json](browser/consumer-375/formula-bottle-touch-dispatch-touchStart.json) | 205 | `f81db2a3ccdaee136dd56d0b425244c9902d02550f9fe27b939fa828db583dc0` |
| [browser/consumer-375/formula-bottle-touch-pre-touch.json/part-001.txt](browser/consumer-375/formula-bottle-touch-pre-touch.json/part-001.txt) | 175703 | `84a74cf641863830cfbd79259a7ff5c2c98f5bb1d5fea264140237d4e251c0cd` |
| [browser/consumer-375/formula-bottle-touch-pre-touch.json/part-002.txt](browser/consumer-375/formula-bottle-touch-pre-touch.json/part-002.txt) | 244071 | `87ec2721ed39649c8dce39f5739544d616c21b0142941ee54c1c50e8880ecb0d` |
| [browser/consumer-375/formula-bottle-touch-pre-touch.json/part-003.txt](browser/consumer-375/formula-bottle-touch-pre-touch.json/part-003.txt) | 245573 | `d61f39e36f60f9a3042ea87c69016cc63e45e859d3e4f4125bbb4480ea1a2f82` |
| [browser/consumer-375/formula-bottle-touch-pre-touch.json/part-004.txt](browser/consumer-375/formula-bottle-touch-pre-touch.json/part-004.txt) | 88413 | `93a1449507c1e93780538fc3226996b8bc62f069f379a3ac0dc492f749529a73` |
| [browser/consumer-375/formula-bottle-touch-scrolled.json/part-001.txt](browser/consumer-375/formula-bottle-touch-scrolled.json/part-001.txt) | 175376 | `80b89ff8d19968f9339e3fed6f53ddd944e7386d60dde59e1c4c3943c47c5b10` |
| [browser/consumer-375/formula-bottle-touch-scrolled.json/part-002.txt](browser/consumer-375/formula-bottle-touch-scrolled.json/part-002.txt) | 244071 | `87ec2721ed39649c8dce39f5739544d616c21b0142941ee54c1c50e8880ecb0d` |
| [browser/consumer-375/formula-bottle-touch-scrolled.json/part-003.txt](browser/consumer-375/formula-bottle-touch-scrolled.json/part-003.txt) | 245573 | `d61f39e36f60f9a3042ea87c69016cc63e45e859d3e4f4125bbb4480ea1a2f82` |
| [browser/consumer-375/formula-bottle-touch-scrolled.json/part-004.txt](browser/consumer-375/formula-bottle-touch-scrolled.json/part-004.txt) | 88412 | `6c8a8b58167165d63662458519d8e15c0a30e2f628c35a94bd744316f930a3f4` |
| [browser/consumer-375/network-outcomes35.json](browser/consumer-375/network-outcomes35.json) | 50510 | `5c7f7527d9285489d37b369fa64fc2ac792deb3f113a6a4355e337a1abd16fd2` |
| [browser/consumer-375/order-save-new-actual-version.json](browser/consumer-375/order-save-new-actual-version.json) | 2142 | `1325d9841f780bb451710360f179ef4b4e82f21a685d9c0b3c0b90181308e1cc` |
| [browser/consumer-375/privacy-explicit-cleanup-retry.json](browser/consumer-375/privacy-explicit-cleanup-retry.json) | 2748 | `e8be031bc6c3363b5b36306568d834b3e470507c7afb36682abfdfebd760b803` |
| [browser/consumer-375/privacy-export-unavailable-cleanup-pending.json](browser/consumer-375/privacy-export-unavailable-cleanup-pending.json) | 2641 | `c3eaaa1e682fbfcd66059bfafa6ef7e5637bc21f418452004e386bd77eba10d5` |
| [browser/consumer-375/privacy-paused-keyboard-delete-cancel.json](browser/consumer-375/privacy-paused-keyboard-delete-cancel.json) | 2734 | `0cc381ccaa5d1b2bfe20de63ba9be65bc98ca816466fc006c518f8fec15b2a77` |
| [browser/consumer-375/privacy-paused-recovery.json](browser/consumer-375/privacy-paused-recovery.json) | 1177 | `c5f051c6defb550c44d5cd66821244e731f4bc9bfb6400ba2a842d6c6b24200b` |
| [browser/consumer-375/privacy-retired-delete-refused.json](browser/consumer-375/privacy-retired-delete-refused.json) | 4309 | `fedfed3ff7d24e47eba5f538dd83f8f0ba029217a36f0d5f570e17d87c86ff78` |
| [browser/consumer-375/privacy-retired-withdrawal-refused.json](browser/consumer-375/privacy-retired-withdrawal-refused.json) | 5275 | `3a030e6e841478f46733ec8318d110c90f22f79bf4708affc48b10ef2e858053` |
| [browser/consumer-375/retired-apply-refused.json](browser/consumer-375/retired-apply-refused.json) | 1833 | `2e9f4ac3c93c1173af137b2f94a5348a1baa8eb500a241e339ed4b60ac4ef326` |
| [browser/consumer-375/retired-bottle-confirmations-refused.json](browser/consumer-375/retired-bottle-confirmations-refused.json) | 3109 | `5a9eb7c49505a8e2da186bfd477d57bb7f0b1f9c0313b788b7f1da8445ddec2c` |
| [browser/consumer-375/retired-retraction-refused.json](browser/consumer-375/retired-retraction-refused.json) | 2690 | `f1cb409bf4d247c97a8bd3e68fba2022a2b6c57b39f15bc937b0660f20a64e0f` |
| [browser/consumer-375/same-sequence-review.json](browser/consumer-375/same-sequence-review.json) | 2056 | `b48ad9e324d652c306da13f2b058414644c2670b1e3b7ea33fd87c6cf41a4263` |
| [browser/consumer-430/01-welcome.json](browser/consumer-430/01-welcome.json) | 1350 | `b8a40d75ec4e74050997e82d912096a5feb33ee9fe2d283a64f922427583c199` |
| [browser/consumer-430/01a-direct-protected-age-gate.json](browser/consumer-430/01a-direct-protected-age-gate.json) | 1456 | `b38fe6dc2d90bb39cb9737230ebdc50805881fb83cfb370a493c2d8556f19aa0` |
| [browser/consumer-430/02-age-empty.json](browser/consumer-430/02-age-empty.json) | 1456 | `b38fe6dc2d90bb39cb9737230ebdc50805881fb83cfb370a493c2d8556f19aa0` |
| [browser/consumer-430/03-age-filled.json](browser/consumer-430/03-age-filled.json) | 1457 | `02640facde3c2545398af90633273eb9615c43d284666e38a6066de5d9e11c19` |
| [browser/consumer-430/03a-after-age-submit.json](browser/consumer-430/03a-after-age-submit.json) | 1593 | `9450b3d9a39b27088b3a8986fec36fa96797ef13be5f896e1e3f8e146c66d8b7` |
| [browser/consumer-430/04-consent.json](browser/consumer-430/04-consent.json) | 1593 | `9450b3d9a39b27088b3a8986fec36fa96797ef13be5f896e1e3f8e146c66d8b7` |
| [browser/consumer-430/05-goals.json](browser/consumer-430/05-goals.json) | 2121 | `46c1a16b3cc32ef4e9d766d114f6153475118946ccd376229785325a03f360fb` |
| [browser/consumer-430/06-goals-selected.json](browser/consumer-430/06-goals-selected.json) | 2132 | `186b49b3dec87c9f092394cbaae1725550d8bb386846003cd91422ca4e62060e` |
| [browser/consumer-430/07-quiz-01.json](browser/consumer-430/07-quiz-01.json) | 1416 | `5bfdc0391ebacab4f3a2d709bca4016f8c33536601bb573ec5b950e7c6df3a57` |
| [browser/consumer-430/08-quiz-after-04.json](browser/consumer-430/08-quiz-after-04.json) | 1392 | `b0814fb8ef8e8912c0ab2d4656ff73b11a02b4a2785605673fb425f2bf2005ce` |
| [browser/consumer-430/08-quiz-after-09.json](browser/consumer-430/08-quiz-after-09.json) | 2086 | `23dbdaf1ea74073567cd0b74c3de2d33a0f1af8fa17a2788c66f53bfbf942239` |
| [browser/consumer-430/08-quiz-after-11.json](browser/consumer-430/08-quiz-after-11.json) | 1669 | `26666614c765ae047ea1a674aff66b5197819a5bc9e35bc06f7a02a5c54d18c2` |
| [browser/consumer-430/09-products-empty.json](browser/consumer-430/09-products-empty.json) | 2699 | `c46c0152ebaa06f675b13c4e2e2b006dfa9969d99a3a60a7f0c7886a04f79753` |
| [browser/consumer-430/10-products-after-1.json](browser/consumer-430/10-products-after-1.json) | 3219 | `a57b93877ec591bd945c32091d1a89f133f9bffc4c2a66da9109ee25ace58a48` |
| [browser/consumer-430/11-products-after-2.json](browser/consumer-430/11-products-after-2.json) | 3462 | `b752914a71b71e11d355a0aa86f56ffdbc1cd1f72e5f642e5cb7210f8129a71c` |
| [browser/consumer-430/12-products-after-3.json](browser/consumer-430/12-products-after-3.json) | 3474 | `2a99285c983cf28584d139a8fd884c58208102ab1d4c8dece30ab21e2158a696` |
| [browser/consumer-430/13-post-products-continue-current.json](browser/consumer-430/13-post-products-continue-current.json) | 373 | `45bc81262201aded015953fa7e57afee4aa3c2282e81b89eb9984b313620da7a` |
| [browser/consumer-430/14-reveal-checks.json](browser/consumer-430/14-reveal-checks.json) | 691 | `e0983573f8f30de8ad0abc3ed64a44e3a264272fa9005f97f3b461352efddda7` |
| [browser/consumer-430/15-notifications.json](browser/consumer-430/15-notifications.json) | 947 | `66f1f37b1b658f342b21ca13605c4079a1924f702d3b3cc9f5681759100c5877` |
| [browser/consumer-430/15a-reminder-persistence35.json](browser/consumer-430/15a-reminder-persistence35.json) | 279 | `f897948700183e1b5e692417e52f80b0a5c33547e967fc53435baf8fe6bef1d4` |
| [browser/consumer-430/15a-reminders-off-saved.json](browser/consumer-430/15a-reminders-off-saved.json) | 997 | `0d39fc964b9febb01fe292776c0f30664b7893495c5bc820647d9735892c038d` |
| [browser/consumer-430/15b-reminder-continuation35.json](browser/consumer-430/15b-reminder-continuation35.json) | 35 | `e75a92b253d32972326cf154509b02d3ef2e37c574865718f1f6a977c237a897` |
| [browser/consumer-430/16-account.json](browser/consumer-430/16-account.json) | 714 | `daa04d3ccba356a7cab50fd0f09625b3e8c3e304d4087df40718f91fade769db` |
| [browser/consumer-430/17-paywall-current.json](browser/consumer-430/17-paywall-current.json) | 2838 | `5da7edbe7519406aeef3c0b27c03325223a8047b242a1b19a75fa71447613300` |
| [browser/consumer-430/17-paywall.json](browser/consumer-430/17-paywall.json) | 2838 | `5da7edbe7519406aeef3c0b27c03325223a8047b242a1b19a75fa71447613300` |
| [browser/consumer-430/18-paywall-free-path-visible.json](browser/consumer-430/18-paywall-free-path-visible.json) | 2838 | `5da7edbe7519406aeef3c0b27c03325223a8047b242a1b19a75fa71447613300` |
| [browser/consumer-430/19-today-free-current.json](browser/consumer-430/19-today-free-current.json) | 2655 | `91f63e61f36b6baa646c90315944365e066f8e0a20597aa369d832ce844ae62b` |
| [browser/consumer-430/20-free-first-session35.json](browser/consumer-430/20-free-first-session35.json) | 713 | `36a32e80a0be28eac253611741daf40aed6f36b6e769482932d68cebb734ff6f` |
| [browser/consumer-430/20-shelf-after-onboarding.json](browser/consumer-430/20-shelf-after-onboarding.json) | 7096 | `fde0c45c864c8955804f8805b4018b79ff9e18be44074dd21c83b14ed2d6b677` |
| [browser/consumer-430/actual-applied-reload.json](browser/consumer-430/actual-applied-reload.json) | 2149 | `f255a5e6dcaab7b87294cd2616db73a9cf6af2522f1b3a4c54826d48d92483aa` |
| [browser/consumer-430/actual-brief-review.json](browser/consumer-430/actual-brief-review.json) | 15525 | `d6388ee9f4f4d774d8b792a9af55eeec0b03eba5c650c02b11e06259651224de` |
| [browser/consumer-430/actual-routine-summary.json](browser/consumer-430/actual-routine-summary.json) | 641 | `f7b9672bfe58198e21bf1a7696e410e6f2662980532f4f92ebdf4e9653f3c327` |
| [browser/consumer-430/actual-use-retraction.json](browser/consumer-430/actual-use-retraction.json) | 2501 | `1f39436c6ef7ce30a86333c8a5b18aaf258778dff2bd1492fc2774349f510eb8` |
| [browser/consumer-430/bottle-C37-product-before-touch.json](browser/consumer-430/bottle-C37-product-before-touch.json) | 14571 | `b44d60bc36984028d63d68cebbd8f5e415cb3c4f977ea596669de2e9c04ccd66` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-001.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-001.txt) | 242638 | `6a090b78240461e1eeff554e8b079e30e31562114bce143847a64835b90c6241` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-002.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-002.txt) | 181295 | `4b923b011bda69f87e63d96d4f6bb2e6fbf68adfc542c4ff15a65771f552c350` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-003.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-003.txt) | 242419 | `e19109dc42c215b4a129a4706b76c1522106746430ee567d7f1d09c6db273a6a` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-004.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-004.txt) | 221599 | `a0724a6d604f97689eb21b748534011b133a450069d1ce44de2f27137ee81bc3` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-005.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-005.txt) | 173967 | `82fdb07c17556c99d173662355a9dc676480ac5cc1ac7940201718b4e2a3cf24` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-006.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-006.txt) | 245710 | `8fd4b49265d462b3066cc10cf8b8d828d9206786a069bcfbf87d878d4156df00` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-007.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-007.txt) | 242307 | `e8145065b719ecc513c2a075269450e9dab2dc7716de433312267a6bcbb8e647` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-008.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-008.txt) | 175637 | `5638380e2121335ba22868a7e1b532a362e6a7c76ca26f382a2de2b5fb65557f` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-009.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-009.txt) | 245415 | `1d7d788b290e23c300494835da41d2d06388a28dcc75010bc0b8e7cce3ccbd25` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-010.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-010.txt) | 244446 | `640ac53fbbc491ea5d7d31722d39989ec64a6c6917fec611f2ebc013fd9bb11c` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-011.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-011.txt) | 173463 | `f136e9ebdad3d7ce78b58b06367ee36b253d8864ca122cfe30bc8842744cf53b` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-012.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-012.txt) | 245634 | `f2f1552d6756170d9cc100e296d95cc80fd54edc4594fdf2c84c2a3f9e864030` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-013.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-013.txt) | 242963 | `7c0d79bab3919a9f887e3e1ea04c95fb648d8a4b24568d3056469aa06b629f82` |
| [browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-014.txt](browser/consumer-430/bottle-C37-Shelf-hit-chain.json/part-014.txt) | 82610 | `33ef71305ba525ac82284ac5b0f61c8649f254f756b4e936a795aae602cba7d7` |
| [browser/consumer-430/bottle-recorded-use.json](browser/consumer-430/bottle-recorded-use.json) | 3643 | `dd003ca3c9673421073020162f447bb1176a9c1815bb04b7616af8aa27e85214` |
| [browser/consumer-430/bundle-crypto-provenance.json](browser/consumer-430/bundle-crypto-provenance.json) | 713 | `e90d08bd0e30d955f675fdd0dbd690537cf68ae5b04cda378a5a41647e25bcb3` |
| [browser/consumer-430/C37-run-environment.json](browser/consumer-430/C37-run-environment.json) | 734 | `519bc59aa6657d8e7a184a79eeeba3293cf1eba5ee1df506c828df274f74d56c` |
| [browser/consumer-430/C41-01-explicit-draft.json](browser/consumer-430/C41-01-explicit-draft.json) | 4226 | `ec39522b94b043aa2adddf7b1868936946f220cdb3a6052a1fcfdc50039096f8` |
| [browser/consumer-430/C41-02-first-save.json](browser/consumer-430/C41-02-first-save.json) | 3839 | `4ff6f1d3e579eb8b4e108f20ee3934d932fb038feed778007c143634bf7171e2` |
| [browser/consumer-430/C41-03-correction-and-retraction-lineage.json](browser/consumer-430/C41-03-correction-and-retraction-lineage.json) | 4541 | `a29f078ce324c5528976e87531cb626ecd47f24efa08bea79469327faba99bb7` |
| [browser/consumer-430/C41-04-truthful-storage-refusal.json](browser/consumer-430/C41-04-truthful-storage-refusal.json) | 4206 | `df08d78b5b579078eacad5220bae4bb18f0e0eccbfa9b11b197a6c9bb1aa19b4` |
| [browser/consumer-430/C41-05-reloaded-private-lineage.json](browser/consumer-430/C41-05-reloaded-private-lineage.json) | 4491 | `77a31dda8ffc528ad8712f91365b60babd7299d176a2be3883dc48b71de52358` |
| [browser/consumer-430/C41-06-closed-consent-epoch-masked.json](browser/consumer-430/C41-06-closed-consent-epoch-masked.json) | 1588 | `065ad722729f2fac6de60c8c58fdc7268c18eff2ed02632bb6ef0b514f1ba6b8` |
| [browser/consumer-430/C41-07-forged-owner-refused.json](browser/consumer-430/C41-07-forged-owner-refused.json) | 1322 | `c56faeb6230fb585efe76d52662e6e4249caa2500564cab96254470396d6a4cd` |
| [browser/consumer-430/C41-control-hit-receipts.json](browser/consumer-430/C41-control-hit-receipts.json) | 28505 | `76662f0e4a2c031ce4590d1c3dc02edf21614471e2e288fdf8de43bf5e4670cc` |
| [browser/consumer-430/C41-development-phase-entry.json](browser/consumer-430/C41-development-phase-entry.json) | 401 | `c4c8e506c410630fdf0d7dcf79bc3742cb2b4d33b737955387d0a8a6d3910081` |
| [browser/consumer-430/C41-duplicate-touch-ownership.json](browser/consumer-430/C41-duplicate-touch-ownership.json) | 772 | `c9c0df1fc6869a4723ab64746b5d43e78df5b12667663e36c488981978d6b558` |
| [browser/consumer-430/C41-hostile-authority-negatives.json](browser/consumer-430/C41-hostile-authority-negatives.json) | 306 | `a25544b6658539809e4db66b67031b1c745269560980615f6ccd829b46bed6d6` |
| [browser/consumer-430/C41-local-readback-receipts.json](browser/consumer-430/C41-local-readback-receipts.json) | 16307 | `7391e58de0fa179947ac2acae2987abaf53a593df4526da375e9af8c18606a41` |
| [browser/consumer-430/C41-navigation-authority-readbacks.json](browser/consumer-430/C41-navigation-authority-readbacks.json) | 4253 | `4791fa37109ced4d1bb089f032fb8d6b582c5ba002fabc21a513d90624c334da` |
| [browser/consumer-430/C41-network-metadata.json](browser/consumer-430/C41-network-metadata.json) | 3289 | `509031597363f8c9ed2fec0ea9db391cf29413fdd410e539a48d2f0663009d52` |
| [browser/consumer-430/C41-source-hashes.json](browser/consumer-430/C41-source-hashes.json) | 1764 | `a429eec51eb2ab73e9bdc475c16c7d79094badc5f288ce996c604dd13287f7d9` |
| [browser/consumer-430/C41-summary.json](browser/consumer-430/C41-summary.json) | 1265 | `fb8c3740b1bbb686014c1bf7f7604cfa1c9520c227c7cb3c5f89944aca9ab139` |
| [browser/consumer-430/C41-visible-status-alerts.json](browser/consumer-430/C41-visible-status-alerts.json) | 1251 | `0dd43865f68bc4932aa665f6961638539195be6f7b9df34ee5c76efbb862e08d` |
| [browser/consumer-430/changed-sequence-review.json](browser/consumer-430/changed-sequence-review.json) | 2054 | `1e304b7f3ccc6fbe58745e69f78d6a16e6e4c6356ac8e1b1848b43e04cf5123e` |
| [browser/consumer-430/confirmed-bottle-before-use.json](browser/consumer-430/confirmed-bottle-before-use.json) | 2837 | `4c6e098cab1598ec272fb77e1fd4481b75f0b40f7bd65cf5b759be06d341a4bb` |
| [browser/consumer-430/continuation06-canceled-records-question-review.json](browser/consumer-430/continuation06-canceled-records-question-review.json) | 15367 | `e72c42a33599b561f9b0f62c40ba5d729861f77814649641eddf1e7053898c73` |
| [browser/consumer-430/continuation06-fresh-record-load.json](browser/consumer-430/continuation06-fresh-record-load.json) | 16859 | `16a8f649174920fa71ea0e0df2c537df90e872904522eff6e72a506386f3f98d` |
| [browser/consumer-430/E17-clear-reload-history.json](browser/consumer-430/E17-clear-reload-history.json) | 3401 | `7d69818034fb6f8e914f58d78f0c23406a0337131d905d5a85c28b8d1392e801` |
| [browser/consumer-430/E17-clear-review-cancelled-callback-refused.json](browser/consumer-430/E17-clear-review-cancelled-callback-refused.json) | 2828 | `380c44fdf2c1c2ed4ed75ec6f5d20f72ed9a7482fa6c607bfd21e21d9458b006` |
| [browser/consumer-430/E17-clear-selected-brief.json](browser/consumer-430/E17-clear-selected-brief.json) | 13293 | `6dd1f28c50e68d33c7b2f162b0cc0843ba103b9b274de1c19ab9b147f4d90a61` |
| [browser/consumer-430/E17-cleared-today-optional-access.json](browser/consumer-430/E17-cleared-today-optional-access.json) | 1838 | `7f2e255890998ee525f2088c94b6d026e9e81b99b69b2c8c6a1ff7fcdcf5cd2c` |
| [browser/consumer-430/E17-restart-preserves-clear-and-use-history.json](browser/consumer-430/E17-restart-preserves-clear-and-use-history.json) | 3891 | `c5efd5913fd7dfab0212dcd37383c20bde5cc54558140e934061868e83cdd1ba` |
| [browser/consumer-430/E17-restart-today.json](browser/consumer-430/E17-restart-today.json) | 2944 | `cb355b9ac5b3e78eee60251848ca2dd711d1784f635ed76c34bd4c367e0e1ee7` |
| [browser/consumer-430/E17-review-start-initial.json](browser/consumer-430/E17-review-start-initial.json) | 489 | `1b700b114ff29dd8de9708e1cbcec417384caa313c87db1570829dbe808b407b` |
| [browser/consumer-430/E17-review-start-reopened.json](browser/consumer-430/E17-review-start-reopened.json) | 489 | `1b700b114ff29dd8de9708e1cbcec417384caa313c87db1570829dbe808b407b` |
| [browser/consumer-430/E17-timing-keyboard-saved.json](browser/consumer-430/E17-timing-keyboard-saved.json) | 1879 | `7314befba31ed29f50b9271c7e399370cb7c820c93cd34ffbe32785aa9ef3140` |
| [browser/consumer-430/E17-timing-reload.json](browser/consumer-430/E17-timing-reload.json) | 1795 | `c92440098fa0af5ce70781b04cbb72a32c0869bf74ad5a6bdd833f2aad511a3b` |
| [browser/consumer-430/E18-corrected-recorded-use-reload.json](browser/consumer-430/E18-corrected-recorded-use-reload.json) | 1314 | `083bcc9b216a8d8a6b323d639cc2966778beac07e322670534be31c725efdeec` |
| [browser/consumer-430/E18-current-recorded-use.json](browser/consumer-430/E18-current-recorded-use.json) | 1268 | `fa5bda56f19a261e29010f605aebee1817bede40424089912995738de09cfdfa` |
| [browser/consumer-430/E18-welcome-no-inferred-lapse.json](browser/consumer-430/E18-welcome-no-inferred-lapse.json) | 825 | `14d18480fb70fe3026f6a2b8ab618ba46f16afcb5dcb204500349a0578e0e2f5` |
| [browser/consumer-430/engineering15-privacy-summary.json](browser/consumer-430/engineering15-privacy-summary.json) | 399 | `d6a27398658b4ba822dd345061a0d57455a002189c6aaa037d72928f7a9376fd` |
| [browser/consumer-430/engineering17-summary.json](browser/consumer-430/engineering17-summary.json) | 510 | `e1513c0be19b72a6616eaa7302df9652206ea3b67755ce865b2c66541f174d2f` |
| [browser/consumer-430/engineering18-activity.json](browser/consumer-430/engineering18-activity.json) | 238 | `5a5698e9621388f1a9ae6367c7566a8fa6f8806f9429cd6846014b5e16e390bb` |
| [browser/consumer-430/expo-web.log](browser/consumer-430/expo-web.log) | 32410 | `450981e23ea9499317036d66033278a77c5bb723618bcef05b09b21b671e253c` |
| [browser/consumer-430/first-apply-comparison.json](browser/consumer-430/first-apply-comparison.json) | 2284 | `1290398d49617869bbc07cc663d4824f767157216af155e0b8242ad4edb559e6` |
| [browser/consumer-430/formula-bottle-touch-before-scroll.json/part-001.txt](browser/consumer-430/formula-bottle-touch-before-scroll.json/part-001.txt) | 245744 | `8f7d88fd7d4547ef70ccda4a8fed95848e074e68e52b3c83e89edacef6c52422` |
| [browser/consumer-430/formula-bottle-touch-before-scroll.json/part-002.txt](browser/consumer-430/formula-bottle-touch-before-scroll.json/part-002.txt) | 245750 | `c71d550cbf66fddab5dcd6894efac1828e44f3484f17465c34a05fe45ef56bdc` |
| [browser/consumer-430/formula-bottle-touch-before-scroll.json/part-003.txt](browser/consumer-430/formula-bottle-touch-before-scroll.json/part-003.txt) | 241065 | `9322a342892249f07f62e03ff297138621b52658e2fa5ccf5e590d65bae1f843` |
| [browser/consumer-430/formula-bottle-touch-detail-arrived.json](browser/consumer-430/formula-bottle-touch-detail-arrived.json) | 60 | `c97883d784871a7761cccaf1d8a05e93e608e4dc063c50228955c2e901b078c8` |
| [browser/consumer-430/formula-bottle-touch-dispatch-touchEnd.json](browser/consumer-430/formula-bottle-touch-dispatch-touchEnd.json) | 82 | `b78b31c4e595781ee64e93b7c9ce69125331fa10a9d64291ef569bff18ef6d99` |
| [browser/consumer-430/formula-bottle-touch-dispatch-touchStart.json](browser/consumer-430/formula-bottle-touch-dispatch-touchStart.json) | 203 | `ff164d4e8368cd6ad7597e1a325533cfc2e70ca98c83772298bd6f7459361dd2` |
| [browser/consumer-430/formula-bottle-touch-pre-touch.json/part-001.txt](browser/consumer-430/formula-bottle-touch-pre-touch.json/part-001.txt) | 175018 | `423629b7c9ebfa6e3692d76a08005d7fe9f7fa021af075372ab0ef9cfcbf282f` |
| [browser/consumer-430/formula-bottle-touch-pre-touch.json/part-002.txt](browser/consumer-430/formula-bottle-touch-pre-touch.json/part-002.txt) | 245675 | `b13110e9e3e88fae9598420baf450747930689deee28a3b45d4cbf61259c6373` |
| [browser/consumer-430/formula-bottle-touch-pre-touch.json/part-003.txt](browser/consumer-430/formula-bottle-touch-pre-touch.json/part-003.txt) | 245132 | `ff4153bd288570084b22a10059a2eca8cdb851c5f9d061b96fe40c6a18594cd5` |
| [browser/consumer-430/formula-bottle-touch-pre-touch.json/part-004.txt](browser/consumer-430/formula-bottle-touch-pre-touch.json/part-004.txt) | 92630 | `762457cea30935410daa22f607221baf85dbc64a419b86454e1becb339754a01` |
| [browser/consumer-430/formula-bottle-touch-scrolled.json/part-001.txt](browser/consumer-430/formula-bottle-touch-scrolled.json/part-001.txt) | 174690 | `337a56b45f4ba97c26367ac431ab154325a971ba3679571ed53ec17f0b418758` |
| [browser/consumer-430/formula-bottle-touch-scrolled.json/part-002.txt](browser/consumer-430/formula-bottle-touch-scrolled.json/part-002.txt) | 245675 | `b13110e9e3e88fae9598420baf450747930689deee28a3b45d4cbf61259c6373` |
| [browser/consumer-430/formula-bottle-touch-scrolled.json/part-003.txt](browser/consumer-430/formula-bottle-touch-scrolled.json/part-003.txt) | 245132 | `ff4153bd288570084b22a10059a2eca8cdb851c5f9d061b96fe40c6a18594cd5` |
| [browser/consumer-430/formula-bottle-touch-scrolled.json/part-004.txt](browser/consumer-430/formula-bottle-touch-scrolled.json/part-004.txt) | 92629 | `0838e72603a8f0a0da42ba7ac2f1526ba5cf143425f300cbb7c4089e5f984b4e` |
| [browser/consumer-430/network-outcomes35.json](browser/consumer-430/network-outcomes35.json) | 50510 | `4a9ae14c3bdaad23502ff34009c280ebf71061fb231d1af44d96f543bbfb20f1` |
| [browser/consumer-430/order-save-new-actual-version.json](browser/consumer-430/order-save-new-actual-version.json) | 2142 | `9b78dfa2c2787d328949d1eb6dd1f6f2dca16d7623eba3465cf288752e4a4daa` |
| [browser/consumer-430/privacy-explicit-cleanup-retry.json](browser/consumer-430/privacy-explicit-cleanup-retry.json) | 2952 | `96ec6b71a6f6cb951ad4fe6f54ea97e3ad9bc91d4f1ee142b20d60b2f1812446` |
| [browser/consumer-430/privacy-export-unavailable-cleanup-pending.json](browser/consumer-430/privacy-export-unavailable-cleanup-pending.json) | 3077 | `9ef2e686929525ca32083cce417135bc8b09303ba8c453f8d130b05dda5594cb` |
| [browser/consumer-430/privacy-paused-keyboard-delete-cancel.json](browser/consumer-430/privacy-paused-keyboard-delete-cancel.json) | 2951 | `2dbb00d6a99bd0a53cd9fe041296bbb47e5a47750f188b446633c13189617404` |
| [browser/consumer-430/privacy-paused-recovery.json](browser/consumer-430/privacy-paused-recovery.json) | 2234 | `b7472833c681b4a0bc55f673b6fd2c87b4723241e46df9e04ec97f04ef459ded` |
| [browser/consumer-430/privacy-retired-delete-refused.json](browser/consumer-430/privacy-retired-delete-refused.json) | 5101 | `490d82dccf6dcadd1a00b527829257ad85bb67b4889a90a2700a49482571bbec` |
| [browser/consumer-430/privacy-retired-withdrawal-refused.json](browser/consumer-430/privacy-retired-withdrawal-refused.json) | 5650 | `43e3adcd51306a801c78217fe8f7c157945ea6db34a4f30edad3971aa0a0d50f` |
| [browser/consumer-430/retired-apply-refused.json](browser/consumer-430/retired-apply-refused.json) | 2284 | `1290398d49617869bbc07cc663d4824f767157216af155e0b8242ad4edb559e6` |
| [browser/consumer-430/retired-bottle-confirmations-refused.json](browser/consumer-430/retired-bottle-confirmations-refused.json) | 3323 | `6b4861b51b0cf019a6a4f11a741ae379d0d9f9e71b3a360cf658e51a2042e738` |
| [browser/consumer-430/retired-retraction-refused.json](browser/consumer-430/retired-retraction-refused.json) | 3149 | `ffbae71978292f831340be259a9dd2c3e478916f44d359d8dc74d708483078ac` |
| [browser/consumer-430/same-sequence-review.json](browser/consumer-430/same-sequence-review.json) | 2056 | `c496d7ef250eb5aef45d98605406d44c8d99f6fdc19b5f52ee13dd548aa90cb5` |
| [browser/professional-browser/professional-375/onskin-received-plans.txt](browser/professional-browser/professional-375/onskin-received-plans.txt) | 399 | `b7c7b69e29cd817ff1b7d96d1efe5690fff2b7c4d19719c0c127f321ca396898` |
| [browser/professional-browser/professional-375/server.log](browser/professional-browser/professional-375/server.log) | 72 | `bae7242a422ed2eaf5d8e148e0b9506c86cd41741880c7303897b74fcff6be80` |
| [browser/professional-browser/professional-375/summary.json](browser/professional-browser/professional-375/summary.json) | 5329 | `5be92586dc2d4eab09f271e87d18d18dcb365b865069ebb693b5bf096851d6ca` |
| [browser/professional-browser/professional-430/onskin-received-plans.txt](browser/professional-browser/professional-430/onskin-received-plans.txt) | 399 | `b7c7b69e29cd817ff1b7d96d1efe5690fff2b7c4d19719c0c127f321ca396898` |
| [browser/professional-browser/professional-430/server.log](browser/professional-browser/professional-430/server.log) | 72 | `dfe4be600b3b9e455124bc1d8839f8d2ed03c99d1c38bb26cebcf03edaf14ae4` |
| [browser/professional-browser/professional-430/summary.json](browser/professional-browser/professional-430/summary.json) | 5056 | `6fd110ae552933cd9d91c6041cce55516103d01586f2e23a6ea0e680516e4e0e` |
| [browser/professional-browser/queue-375/domain/authority.mjs](browser/professional-browser/queue-375/domain/authority.mjs) | 9043 | `42fd980507b6fd86a4ab0b7895ce56967e65332d04e9ef6a830969c799e8480f` |
| [browser/professional-browser/queue-375/domain/grants.mjs](browser/professional-browser/queue-375/domain/grants.mjs) | 6014 | `74c7c83c0dd4b6b8c3976683bf3b30b0666e893970e552f9ad04cfe3709e3eab` |
| [browser/professional-browser/queue-375/domain/intendedPlans.mjs](browser/professional-browser/queue-375/domain/intendedPlans.mjs) | 13893 | `20493a1b669acfa6de4a536a8ccb46ea8ad00351e2c078c21964c8d0badf2717` |
| [browser/professional-browser/queue-375/domain/reconciliation.mjs](browser/professional-browser/queue-375/domain/reconciliation.mjs) | 15898 | `8d3fe3762f37c0069a2462cabb1b949a18c62e3467af073134641f12f74854b3` |
| [browser/professional-browser/queue-375/server.log](browser/professional-browser/queue-375/server.log) | 72 | `d01f6af82f52cd34d29ee8577e7b88b65221779676ad056df26362a3cf2530f5` |
| [browser/professional-browser/queue-375/summary.json](browser/professional-browser/queue-375/summary.json) | 5264 | `5b136125faa8073fb52040ea1cffb37a9a3b8ac662cb654830ab8049d117283d` |
| [browser/professional-browser/queue-430/domain/authority.mjs](browser/professional-browser/queue-430/domain/authority.mjs) | 9043 | `42fd980507b6fd86a4ab0b7895ce56967e65332d04e9ef6a830969c799e8480f` |
| [browser/professional-browser/queue-430/domain/grants.mjs](browser/professional-browser/queue-430/domain/grants.mjs) | 6014 | `74c7c83c0dd4b6b8c3976683bf3b30b0666e893970e552f9ad04cfe3709e3eab` |
| [browser/professional-browser/queue-430/domain/intendedPlans.mjs](browser/professional-browser/queue-430/domain/intendedPlans.mjs) | 13893 | `20493a1b669acfa6de4a536a8ccb46ea8ad00351e2c078c21964c8d0badf2717` |
| [browser/professional-browser/queue-430/domain/reconciliation.mjs](browser/professional-browser/queue-430/domain/reconciliation.mjs) | 15898 | `8d3fe3762f37c0069a2462cabb1b949a18c62e3467af073134641f12f74854b3` |
| [browser/professional-browser/queue-430/server.log](browser/professional-browser/queue-430/server.log) | 72 | `9deccc5511f1e1b74123886f33246c214b476f4048074284879691c2857fe539` |
| [browser/professional-browser/queue-430/summary.json](browser/professional-browser/queue-430/summary.json) | 5012 | `a4136d0f2fe6fe4a4af6aad2d53bae854b64f11eea593e431d19c6c3c43590ad` |
| [browser/recovery-browser/375x667-exit-progress.json](browser/recovery-browser/375x667-exit-progress.json) | 518 | `f6947d0206b455fa25556115f81ba4da6c9caff52fcdbcf7849e0dad167c9274` |
| [browser/recovery-browser/375x667-refusal.json](browser/recovery-browser/375x667-refusal.json) | 515 | `f65767a6e7ee760ff61b535aa3b96d449eb0ef0f4385cf6690e66cbe6773ea67` |
| [browser/recovery-browser/375x667-reload-refusal.json](browser/recovery-browser/375x667-reload-refusal.json) | 515 | `f65767a6e7ee760ff61b535aa3b96d449eb0ef0f4385cf6690e66cbe6773ea67` |
| [browser/recovery-browser/375x667-retry-0.json](browser/recovery-browser/375x667-retry-0.json) | 82 | `ba093dc91c33111fe170debb4cb2782d4f4616e65bfa7a8840b21843efa35e1e` |
| [browser/recovery-browser/375x667-retry-1.json](browser/recovery-browser/375x667-retry-1.json) | 82 | `acbe0041f3f63c5edb76afedea3b0f0d833d222a259dcf0f0201d946eb9254ae` |
| [browser/recovery-browser/375x667-retry-controls.json](browser/recovery-browser/375x667-retry-controls.json) | 585 | `7d84f0b0119447f0aa095f8fb8e962fb995aae9d21e06edfc385b456a91672fc` |
| [browser/recovery-browser/430x932-exit-progress.json](browser/recovery-browser/430x932-exit-progress.json) | 518 | `c3d5aba748d1ae92311c0513492d877909621925c111da729f913797b99f16ad` |
| [browser/recovery-browser/430x932-refusal.json](browser/recovery-browser/430x932-refusal.json) | 515 | `95451dd52ad27d30fd9a6dbae4db490303f6fe978a231a20c8245b06c820e80f` |
| [browser/recovery-browser/430x932-reload-refusal.json](browser/recovery-browser/430x932-reload-refusal.json) | 515 | `95451dd52ad27d30fd9a6dbae4db490303f6fe978a231a20c8245b06c820e80f` |
| [browser/recovery-browser/430x932-retry-0.json](browser/recovery-browser/430x932-retry-0.json) | 80 | `318cdab25a5fb4e57ae529cfac77713bf53ccc233b39a082ba720f6d82f49072` |
| [browser/recovery-browser/430x932-retry-1.json](browser/recovery-browser/430x932-retry-1.json) | 80 | `f79a829ccef3f9132a1e403d61b932ea99a9f3323a67628160f5ccad012846a0` |
| [browser/recovery-browser/430x932-retry-controls.json](browser/recovery-browser/430x932-retry-controls.json) | 585 | `619a5da94318c655db09c3428505d13a79d56cd2b32193079972aa03b1a5d2f2` |
| [browser/recovery-browser/bootstrap-e19-provenance-375x667-failure.json](browser/recovery-browser/bootstrap-e19-provenance-375x667-failure.json) | 2436 | `13a783675c94bf3c5cfd2829c0f2ca5ba0fb0af7ac8f2acde189aaa867748e96` |
| [browser/recovery-browser/bootstrap-e19-provenance-375x667-result.json](browser/recovery-browser/bootstrap-e19-provenance-375x667-result.json) | 567 | `d505ce7e6f845f80f335011e78e02e24f81988cc5015a4ee7f61798783fe2b33` |
| [browser/recovery-browser/bootstrap-e19-provenance-430x932-failure.json](browser/recovery-browser/bootstrap-e19-provenance-430x932-failure.json) | 2510 | `61fae6418ef394f0907156649898b9192ba18e53067fadf0ea1c8bf20f8cf99b` |
| [browser/recovery-browser/bootstrap-e19-provenance-430x932-result.json](browser/recovery-browser/bootstrap-e19-provenance-430x932-result.json) | 567 | `2081169ac56b36a0c1bd789706458f3e5437f80bc4fea8a30074f8ca32c268a3` |
| [browser/recovery-browser/expo-e19-provenance.log](browser/recovery-browser/expo-e19-provenance.log) | 54186 | `86bc84571f87d7a0883e1839d8749cb8e988ed4ac781b5b29c32d58565b54889` |
| [browser/recovery-browser/network.json](browser/recovery-browser/network.json) | 34308 | `95bac117c644bbd4810e51ff7092de8df6d87b69fb86430d5b2b1aeb316bed1a` |
| [browser/recovery-browser/summary.json](browser/recovery-browser/summary.json) | 708 | `665eb6c9ab0a6aac31658a1dc29559e6757c791579757e779e6dac42af160319` |
| [browser/recovery-browser-v2/375x667-exit-progress.json](browser/recovery-browser-v2/375x667-exit-progress.json) | 518 | `f6947d0206b455fa25556115f81ba4da6c9caff52fcdbcf7849e0dad167c9274` |
| [browser/recovery-browser-v2/375x667-explicit-consent-goals.json](browser/recovery-browser-v2/375x667-explicit-consent-goals.json) | 452 | `dcd45f279d92018a46d90a2088f5360cb713bf790fde724cff3ca8c1079ba8af` |
| [browser/recovery-browser-v2/375x667-refusal.json](browser/recovery-browser-v2/375x667-refusal.json) | 515 | `f65767a6e7ee760ff61b535aa3b96d449eb0ef0f4385cf6690e66cbe6773ea67` |
| [browser/recovery-browser-v2/375x667-reload-refusal.json](browser/recovery-browser-v2/375x667-reload-refusal.json) | 515 | `f65767a6e7ee760ff61b535aa3b96d449eb0ef0f4385cf6690e66cbe6773ea67` |
| [browser/recovery-browser-v2/375x667-retry-0.json](browser/recovery-browser-v2/375x667-retry-0.json) | 82 | `ba093dc91c33111fe170debb4cb2782d4f4616e65bfa7a8840b21843efa35e1e` |
| [browser/recovery-browser-v2/375x667-retry-1.json](browser/recovery-browser-v2/375x667-retry-1.json) | 82 | `acbe0041f3f63c5edb76afedea3b0f0d833d222a259dcf0f0201d946eb9254ae` |
| [browser/recovery-browser-v2/375x667-retry-controls.json](browser/recovery-browser-v2/375x667-retry-controls.json) | 585 | `7d84f0b0119447f0aa095f8fb8e962fb995aae9d21e06edfc385b456a91672fc` |
| [browser/recovery-browser-v2/430x932-exit-progress.json](browser/recovery-browser-v2/430x932-exit-progress.json) | 518 | `c3d5aba748d1ae92311c0513492d877909621925c111da729f913797b99f16ad` |
| [browser/recovery-browser-v2/430x932-explicit-consent-goals.json](browser/recovery-browser-v2/430x932-explicit-consent-goals.json) | 452 | `c8c9235e41af10a5b70cd575b812e60bff405033bfff5eadfda75d86ca2bd457` |
| [browser/recovery-browser-v2/430x932-refusal.json](browser/recovery-browser-v2/430x932-refusal.json) | 515 | `95451dd52ad27d30fd9a6dbae4db490303f6fe978a231a20c8245b06c820e80f` |
| [browser/recovery-browser-v2/430x932-reload-refusal.json](browser/recovery-browser-v2/430x932-reload-refusal.json) | 515 | `95451dd52ad27d30fd9a6dbae4db490303f6fe978a231a20c8245b06c820e80f` |
| [browser/recovery-browser-v2/430x932-retry-0.json](browser/recovery-browser-v2/430x932-retry-0.json) | 80 | `318cdab25a5fb4e57ae529cfac77713bf53ccc233b39a082ba720f6d82f49072` |
| [browser/recovery-browser-v2/430x932-retry-1.json](browser/recovery-browser-v2/430x932-retry-1.json) | 80 | `f79a829ccef3f9132a1e403d61b932ea99a9f3323a67628160f5ccad012846a0` |
| [browser/recovery-browser-v2/430x932-retry-controls.json](browser/recovery-browser-v2/430x932-retry-controls.json) | 585 | `619a5da94318c655db09c3428505d13a79d56cd2b32193079972aa03b1a5d2f2` |
| [browser/recovery-browser-v2/expo-e19-provenance.log](browser/recovery-browser-v2/expo-e19-provenance.log) | 12470 | `f15dc694079ead682b4a62eb234836a21b71f4e33104691891cfdaa431f4a658` |
| [browser/recovery-browser-v2/network.json](browser/recovery-browser-v2/network.json) | 5881 | `d2dd32f8dcb42d9acb4c624925872301a46505334052622722cd01a7aa1de557` |
| [browser/recovery-browser-v2/summary.json](browser/recovery-browser-v2/summary.json) | 708 | `2d4d009cc4f85b62d9370722448624449da8f386d07e4e1b58ced62b5c358a36` |
| [continuation/DELIVERY_ADDENDUM.md](continuation/DELIVERY_ADDENDUM.md) | 863 | `a539b5ec6f5610935230a4f97176a9da0a167f26efaac391e1ff60df3cd76538` |
| [continuation/NEXT_SESSION_PROMPT.md](continuation/NEXT_SESSION_PROMPT.md) | 11516 | `c447b748cf8e462a19830147da16e93740b6ac410fe4f4035b6507ef6f9aff37` |
| [DELIVERY_PROTOCOL.md](DELIVERY_PROTOCOL.md) | 2205 | `57117018ceb8a21e148865118904b1c6b54c7aca613cff15dd476b62f14e04a9` |
| [inventories/ORIGINAL_FILES-001.json](inventories/ORIGINAL_FILES-001.json) | 45251 | `7bcd200dddc8d85f4a10401a7a8507bc6ff74caadbe9a17ecbe4bb46bc0a718a` |
| [inventories/ORIGINAL_FILES-002.json](inventories/ORIGINAL_FILES-002.json) | 45527 | `69b6a67be55537589a4e69cf8409ce0a12b8f3229c2d7791371293d7b34d71c0` |
| [inventories/ORIGINAL_FILES-003.json](inventories/ORIGINAL_FILES-003.json) | 45342 | `229096a327f2271ec2eb72de9d41c79956f7601a3958bbb353736e0473dcf2f7` |
| [inventories/ORIGINAL_FILES-004.json](inventories/ORIGINAL_FILES-004.json) | 27316 | `d08ff69eb0d4d02ef32254af53170b206649eb20d350808882065424ebebd1ca` |
| [inventories/SOURCE_MANIFEST.json.parts/part-001.txt](inventories/SOURCE_MANIFEST.json.parts/part-001.txt) | 245712 | `0b6b094ebff7115bf50d686b88e21ce0f5456803d76e1e13af521fb33bdb2ac6` |
| [inventories/SOURCE_MANIFEST.json.parts/part-002.txt](inventories/SOURCE_MANIFEST.json.parts/part-002.txt) | 85186 | `512990fef5b4734eae3c0c70b3fe55497856a686808132c2767305c7a0249c92` |
| [inventories/TECHNICAL_CHANGE_INVENTORY.json](inventories/TECHNICAL_CHANGE_INVENTORY.json) | 95938 | `58068e0dac46de0bad6322debcff88e2274c6e29c159f8f94454102d1b8d81c2` |
| [inventories/TECHNICAL_CHANGE_INVENTORY.md](inventories/TECHNICAL_CHANGE_INVENTORY.md) | 49733 | `6f7e594e1d05d0be910982e8b564df891a012f54d41e3a8f25d2492ce3956a62` |
| [manifests/files-001.json](manifests/files-001.json) | 35503 | `e0a861f9b06183d7c2def47120669e774ee7766f68301e2125ddafb4922c281d` |
| [manifests/files-002.json](manifests/files-002.json) | 35065 | `28e4c92c716366010e9a17a47a7322ba296b71d18e8f33f399fd41993e54874e` |
| [manifests/files-003.json](manifests/files-003.json) | 33900 | `18b9165a34714ff2a76360b61cd0b0bc9284c197c57a12b99b65d725f2b7c19b` |
| [manifests/files-004.json](manifests/files-004.json) | 36901 | `6fb64574ad32f5580d627ce1321b8366cf675e7f4a542dbdfe9747bad654ed2a` |
| [manifests/files-005.json](manifests/files-005.json) | 37587 | `da9ac0337f221ffa16ed44f91c644af9d8b4ba5d3c03489bc715165dc32cc7eb` |
| [manifests/files-006.json](manifests/files-006.json) | 32831 | `a6336959195603d2b1b9c7527f45c9c0d0844ea1cc4b7586c01b9af4da204219` |
| [manifests/files-007.json](manifests/files-007.json) | 33196 | `17969fe6002d41c41602e0ed01e9012b4e19058f2bfd1a039f7157089ea37c4d` |
| [manifests/files-008.json](manifests/files-008.json) | 18324 | `8d09118c959e2d02c58a8bf6f4613f8221a6ce578ab3afab8452316d4e25bf53` |
| [original/EVIDENCE_SHA256.json](original/EVIDENCE_SHA256.json) | 62220 | `797f8cd69621582e77e8453fc7a6b2d70895066ed6d1da7b2fad2ab598186a87` |
| [patches/cumulative/part-001.txt](patches/cumulative/part-001.txt) | 245724 | `34d761aed705e5b40e33ecf9c76cca73ad3d0a5923f31f936150670e991cf872` |
| [patches/cumulative/part-002.txt](patches/cumulative/part-002.txt) | 245705 | `8f3838401827c17e34d5a75816fb05771b042aa7dca14f2b8bf42b987702ffcf` |
| [patches/cumulative/part-003.txt](patches/cumulative/part-003.txt) | 245749 | `3d5afd020c287c23221ee0e464facc4e7e9caf59f43cb4b82dd17080f40f9512` |
| [patches/cumulative/part-004.txt](patches/cumulative/part-004.txt) | 245719 | `2c3287bf02f46e6e4bdfd40ca2f02a935c62d249f1a0b833fdb067a3fba8a808` |
| [patches/cumulative/part-005.txt](patches/cumulative/part-005.txt) | 245742 | `e2838a5b248a0c6c716bfdfe287153b7db86c209d670b4cfc53dd0562bbe171a` |
| [patches/cumulative/part-006.txt](patches/cumulative/part-006.txt) | 245666 | `f7e0618ae292718ee424722481c136b354e422faaec6071d9f76878a8d7d5d49` |
| [patches/cumulative/part-007.txt](patches/cumulative/part-007.txt) | 245745 | `0768dc9ec1339dd2c9a1ee9aee0a40fde5215d15bd42fb58d92eab686cc239ed` |
| [patches/cumulative/part-008.txt](patches/cumulative/part-008.txt) | 245735 | `3756564b7208a368c7c6e9c757547cfbbe9a910e71949040c9a3c26714d8d2fe` |
| [patches/cumulative/part-009.txt](patches/cumulative/part-009.txt) | 245020 | `a5eea88e63aac099e59a54dd70a031901286e1eafc93ab8f7f5d4ef841e47eb6` |
| [patches/cumulative/part-010.txt](patches/cumulative/part-010.txt) | 245499 | `a5d3896bcc4bef27f25d57fc70e3ee3e2e177b38bd6faabec63a48c94e4d957a` |
| [patches/cumulative/part-011.txt](patches/cumulative/part-011.txt) | 245681 | `30b414abaf7152df0ea9cc55eb2b0ad946a7598e2b48f7d8e04b8c61b0d887d8` |
| [patches/cumulative/part-012.txt](patches/cumulative/part-012.txt) | 245704 | `33700848dbc1a1d605bfc34470f158018643b90d9e375c074aab2c11a265d138` |
| [patches/cumulative/part-013.txt](patches/cumulative/part-013.txt) | 22007 | `0faa07a069959af89ed5c2aa098feba518dbb469d7a230b09a4d46071972c17e` |
| [patches/session/part-001.txt](patches/session/part-001.txt) | 117642 | `71cd5259dd2b4598ade02e848aab5408c2fb9898177c7578eb9ea845f5498d1c` |
| [receipts/DELIVERY.json](receipts/DELIVERY.json) | 2413 | `6716ddf8a3abd932c67ca961837bf92e2abaa623b624f2e4801faa166f7e70cd` |
| [receipts/DELIVERY.md](receipts/DELIVERY.md) | 576 | `d6b8c0a1f52b02c5b1b384643a0575ada68fc981252361a85e867d8ffbf65edf` |
| [receipts/PATCH_VERIFICATION.json](receipts/PATCH_VERIFICATION.json) | 1533 | `027b2b6eee7cd3d5d11330efaee90d422a7197b9017582b71ee99a5f5faf2d60` |
| [receipts/PRECONDITIONS.json](receipts/PRECONDITIONS.json) | 1046 | `fe1f82bfd7728f8ec66c8a3a69c02dca6bae766d15fcc5f4a5657b5434ca265a` |
| [reconstruct_patches.py](reconstruct_patches.py) | 1282 | `452c0273e6adc31339f14c76f269e80eb866b1b8e3aee4a339a06a05f9e405dc` |
| [reports/ALL38_ALL18_MATRIX.json](reports/ALL38_ALL18_MATRIX.json) | 38916 | `9daf54b903a885547da5aa4637e426e38d211f4047e753c1c6c8214e3c74f651` |
| [reports/ALL38_ALL18_MATRIX.md](reports/ALL38_ALL18_MATRIX.md) | 28183 | `f9dfa08c743e822237b8a51007871160ead6e3a00cafca878f750eb967640e36` |
| [reports/FINAL_REPORT.md](reports/FINAL_REPORT.md) | 14634 | `fc6a8bb68c3ba7d7bfc00b8841da77b49891877523fc24ae58eb2d9e75a185b8` |
| [reproduction/browser_checks.py](reproduction/browser_checks.py) | 1504 | `0bccb42e158885124d86ba3304def9aa986d7b791ea8129d990a43735a50c456` |
| [reproduction/builds.py](reproduction/builds.py) | 789 | `74b41b403f8a2742084553a10ceb30ec9298b04a412dd6234edc16422957adee` |
| [reproduction/consumer-flow.mjs](reproduction/consumer-flow.mjs) | 146262 | `3bac37582bb44ebf82df5c01bed862a2fede26d00a1985d605d0b2439bcf6ba3` |
| [reproduction/continuity17.mjs](reproduction/continuity17.mjs) | 7780 | `938fe4bd57b22577523335cc31c9fe02bb008d215144b6219444b0a47c47cc44` |
| [reproduction/package_checkpoint.py](reproduction/package_checkpoint.py) | 6850 | `1b8d24e2f0c226afb5e8bf3df2b0fc97e4b43c484ee814a79ad2d7aa0474daee` |
| [reproduction/recovery-browser.mjs](reproduction/recovery-browser.mjs) | 5646 | `14a20a27b0852e6361dd88f3187ec04db45150d580ef3a739d2fe92a29d5cbb7` |
| [reproduction/run_check.py](reproduction/run_check.py) | 1128 | `98e323f0daef2fc792a7bd07a1b743a56a4afedff830b164729c7c2a904688e8` |
| [review/COMPLETE_MATERIAL_SCAN.json](review/COMPLETE_MATERIAL_SCAN.json) | 121375 | `f3a3c57496bb0f171e593d8afd4c0c4f4e17bdde5a49107ea1dedc50bc967cda` |
| [review/PUBLICATION_REVIEW.md](review/PUBLICATION_REVIEW.md) | 3245 | `f5815717a3eaceeb13582c0c6c956f460685364b2e667bc1a1eb8fc4821042c4` |
| [review/REMOTE_PREFLIGHT.json](review/REMOTE_PREFLIGHT.json) | 1092 | `03b818ffc5044a2210aa17ef641838277265ff398306844b61d89d0d8d11f02d` |
| [review/SCREENSHOT_PUBLICATION_REVIEW.json](review/SCREENSHOT_PUBLICATION_REVIEW.json) | 59025 | `af0bffa9f4a6ff01b3700b561122f9253083872002f88cf558530dc1adb3914c` |
| [review/WORKFLOW_PREFLIGHT.json](review/WORKFLOW_PREFLIGHT.json) | 2291 | `cd8dcfd9d52df918731c96d2d6ede83dbb58be07500ab037c5eefa1ea9ea3169` |
| [tests/authentic-replacement.json](tests/authentic-replacement.json) | 702 | `94517bb0dd9d26ee0bb078542523dfaa9ace0488058642c4d237b0d1f2ad40d2` |
| [tests/authentic-replacement.log](tests/authentic-replacement.log) | 361 | `d9ea1afc979af1fa7ba0adce66d290712bb5cea0109df14ff24f507bc0121373` |
| [tests/consumer-375.json](tests/consumer-375.json) | 532 | `ac6d12ec078f6e585aa51f2a58433f07436ea1516364b617cca1ebd33d4553d1` |
| [tests/consumer-375.log](tests/consumer-375.log) | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [tests/consumer-430.json](tests/consumer-430.json) | 532 | `f2b355890017b4276342b377f5d3e42edc32064c2e093b4442974599cd1ea819` |
| [tests/consumer-430.log](tests/consumer-430.log) | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [tests/final-lint.json](tests/final-lint.json) | 537 | `8df9ae6e5091e81d441c65cf84354b65d3228b55d2707ec6a523476b80913410` |
| [tests/final-lint.log](tests/final-lint.log) | 1553 | `d4482887c13033784d191dd1bfbd60f0aec3500beefb510993f32e55372464bb` |
| [tests/final-mobile-build.json](tests/final-mobile-build.json) | 564 | `b92bf2b1aeea17c41d4092b7d2e3f220678877a210f722edb10d0f952a874ce0` |
| [tests/final-mobile-build.log](tests/final-mobile-build.log) | 5946 | `79dcc55d100822c26a42aa0d34443849585f795c7ebb3deb7de91d1d0466b7f0` |
| [tests/final-professional-build.json](tests/final-professional-build.json) | 576 | `d573bcec255e9fa9cb3e0830813736d14ceeea690e949956cbf1b2fdff463cf6` |
| [tests/final-professional-build.log](tests/final-professional-build.log) | 443 | `e12fdf90344ea4b5937f15bc6f942d28355560e02ab880b2c9a90ae050a7754c` |
| [tests/final-root.json](tests/final-root.json) | 539 | `eea53cc0dff0ba9d377084e9f7cb6a90797bb687756f9133fed35c5e8e541365` |
| [tests/final-root.log/part-001.txt](tests/final-root.log/part-001.txt) | 245636 | `a4fc20a400113ce623a5d8f693a81b019dd66f3abec918c888eaae69ff1205bf` |
| [tests/final-root.log/part-002.txt](tests/final-root.log/part-002.txt) | 245592 | `48bd464662b187a1bb176f85e470e104bfb97d74fa82b1c1e8bc4f98a72c97cc` |
| [tests/final-root.log/part-003.txt](tests/final-root.log/part-003.txt) | 116251 | `7db7ae3a3cdbed9ccb523361ce32acf29ce3e2edd06801f336d9e58a43233e0c` |
| [tests/final-typecheck.json](tests/final-typecheck.json) | 549 | `e2542de417222e7887282e59ef7cacdb4f22bd38e872a85a6a4cd3d39af54edc` |
| [tests/final-typecheck.log](tests/final-typecheck.log) | 1569 | `fa8067f79ed6efddf31c4b39580014c772f5408adc53a05aa32f56080498a282` |
| [tests/p0-authenticated-final.json](tests/p0-authenticated-final.json) | 1344 | `12865b274e81305c17a0748810cc4332e393ca0820f579f0d9b0662e78fa7b37` |
| [tests/p0-authenticated-final.log](tests/p0-authenticated-final.log) | 2737 | `b5c87406f136981f236464359648b48abe97ff4f0244355bdd2bebe39122c993` |
| [tests/p0-authenticated-v2.json](tests/p0-authenticated-v2.json) | 1341 | `e04d1a3f35f2b45f7733274d83ddda0fe770e294b0714a2a8ba8d75c24395422` |
| [tests/p0-authenticated-v2.log](tests/p0-authenticated-v2.log) | 579 | `96a61128994b8b002b447b9daf613ca6b9dbc3b3be24e19be75d81779541a62a` |
| [tests/p0-authenticated.json](tests/p0-authenticated.json) | 1338 | `406b0910fb173dc20c2d7a0b2a09b9c0cfd93b9f55db91f1985d47be1415a45e` |
| [tests/p0-authenticated.log](tests/p0-authenticated.log) | 2445 | `4d5c5844513e34bdb222c9d85a6db29ea37dbdf04186c8e9dbead25047dac4a5` |
| [tests/p0-expanded.json](tests/p0-expanded.json) | 1057 | `ca387812de7183a3c8dda9c2aabf71e3dc8cfdb56213da4d6da6fa5b3c63dace` |
| [tests/p0-expanded.log](tests/p0-expanded.log) | 442 | `8a65561c7306d2820750e8cc001ed1799671c4203d33c60473a3a3aa999ae153` |
| [tests/p0-focused-initial.json](tests/p0-focused-initial.json) | 944 | `25cc013f711ffa78cb126adeaae6a4b2f0fe1485c2866802eb9fd8b3e3f03de5` |
| [tests/p0-focused-initial.log](tests/p0-focused-initial.log) | 15281 | `cb8c9f1a09cb75341b38dbc429f2b7e70e47f34b570f47ba5e77b97bf8a75830` |
| [tests/p0-focused-v2.json](tests/p0-focused-v2.json) | 1059 | `40b806e95f6e696f8b3be77b7af3e72b1b5952ec5f577baf373100e058fd4c13` |
| [tests/p0-focused-v2.log](tests/p0-focused-v2.log) | 4811 | `eb50af2c06301f262d3d97bc495f1ba81bb606911ae35d9deb30a49688db3b06` |
| [tests/p0-focused-v3.json](tests/p0-focused-v3.json) | 1059 | `e504be1123958a8a45faaf8fb97ada8936a0e991c1d0911c8e192dffe8bb0733` |
| [tests/p0-focused-v3.log](tests/p0-focused-v3.log) | 2665 | `f2ee8f68ca7b476fb8394018faf4279d1bfc44c7cef807f3a4aa7ee8ba2b69ff` |
| [tests/p0-focused-v4.json](tests/p0-focused-v4.json) | 1059 | `4795a0150da3cb1520be855ca91171d46ffd84068a380bef56b0923617c49710` |
| [tests/p0-focused-v4.log](tests/p0-focused-v4.log) | 442 | `c41c6a9f128e723920b7fd216daec4c1c4360cbf7138339f055b54742d9c2bc2` |
| [tests/p0-green-initial.json](tests/p0-green-initial.json) | 861 | `3998b0183a3c6397648bf44a5a01a63a732128807316f93a7d9bd919f96a3f9d` |
| [tests/p0-green-initial.log](tests/p0-green-initial.log) | 369 | `538a7c1137f61ef9bc57c094653aef2b94d6bf23ad2dabe630c2561f65406e1f` |
| [tests/p0-lint.json](tests/p0-lint.json) | 1001 | `a89def8a20fefa4b70047884157f06fcc5e006d5b6e39a1ba97c6cab745368d0` |
| [tests/p0-lint.log](tests/p0-lint.log) | 760 | `364ce19590c32cfa40d707f5883cd2f5c4d1961075986b5277d540d2415dcd9e` |
| [tests/p0-red.json](tests/p0-red.json) | 692 | `48129791c44f0c165615180221298674829542b301aeeb35623c753a1776912a` |
| [tests/p0-red.log](tests/p0-red.log) | 3243 | `3e6e410891e2acd609fc6a54684b8de82d7aa2b0218f201be4bab154d9003bfc` |
| [tests/p0-root-initial.json](tests/p0-root-initial.json) | 881 | `56cc403a7984f43301396644d032e7311d0204f038a2c7a7abf4666a2b04fb0b` |
| [tests/p0-root-initial.log/part-001.txt](tests/p0-root-initial.log/part-001.txt) | 245755 | `1cd8933e00ee74765165a0b290409c5b02751dc57f41176922c431e8f51ffb5c` |
| [tests/p0-root-initial.log/part-002.txt](tests/p0-root-initial.log/part-002.txt) | 245723 | `b6b42ea00edbd030074a31bc0e784d3665234ae5c6c2135801e8e5dc0c487009` |
| [tests/p0-root-initial.log/part-003.txt](tests/p0-root-initial.log/part-003.txt) | 135590 | `47b84d69572d2024505874faa4417390d97c7f3a2b664c21721d8b15f6db2f0f` |
| [tests/p0-storage-final.json](tests/p0-storage-final.json) | 1238 | `c4177f21b1ec9de42e51fff91c546a50b419d21d88ec2db19bbf6dbd8905485b` |
| [tests/p0-storage-final.log](tests/p0-storage-final.log) | 496 | `0a5e3439000ae208105b6e99e89f8381aad4c759de75e4fa18ee99ca0b748a0b` |
| [tests/p0-types-initial.json](tests/p0-types-initial.json) | 899 | `b0b1b9d6f1c67f689d325c03fa3e22af0a4e2006ed1809720d17d78d68f1cf35` |
| [tests/p0-types-initial.log](tests/p0-types-initial.log) | 53 | `b54d549108f4472a08b801ce1f5455705f22a9c1f23d9f647d1f884131bd5290` |
| [tests/p0-types-v2.json](tests/p0-types-v2.json) | 1010 | `42d7717410c39802a4ca410b4294eb0c010005037d59ffb8cc0ef03bb13844b4` |
| [tests/p0-types-v2.log](tests/p0-types-v2.log) | 53 | `b54d549108f4472a08b801ce1f5455705f22a9c1f23d9f647d1f884131bd5290` |
| [tests/professional-owner-375.json](tests/professional-owner-375.json) | 563 | `20acd5f2bfa27b6f6702655d4c394e6e70122c76161f43dd3eef977f3126a940` |
| [tests/professional-owner-375.log](tests/professional-owner-375.log) | 32 | `4a0a1c63f3487b9de2856ad4bc5c247b7fef7c41d4c10a7469016bb107c5ab0d` |
| [tests/professional-owner-430.json](tests/professional-owner-430.json) | 563 | `6a9f5d4e11bf507df4f67f721afd49a8b2de7f19bf4c134938a752cc8d425ea6` |
| [tests/professional-owner-430.log](tests/professional-owner-430.log) | 32 | `9585eb04e882ba930f1ba022ff192bd4faec8f86f58b89686289dbe2b9f287fd` |
| [tests/professional-queue-375-v2.json](tests/professional-queue-375-v2.json) | 574 | `5899ef17281c3431842177507cc236c2c1dde79e0828f7d8a3b40c5f3e023e92` |
| [tests/professional-queue-375-v2.log](tests/professional-queue-375-v2.log) | 19 | `e3922f815681e895665ab07d19ea43c2dd0a6ec43a59e52eb84d5df48f8e4f2c` |
| [tests/professional-queue-375.json](tests/professional-queue-375.json) | 571 | `292e7a5c4170e9d7ee1773279ae9e9afb75d3af1f69945bce4dd715cec0349a2` |
| [tests/professional-queue-375.log](tests/professional-queue-375.log) | 971 | `e684561cdacb65c24d83ca27ffd617c66bdb0d81e713c4c88dd9dd41e71fc519` |
| [tests/professional-queue-430.json](tests/professional-queue-430.json) | 571 | `095c14891394e4ee01586fcac4340bf64a12860e98ea56d0158e0798693b2285` |
| [tests/professional-queue-430.log](tests/professional-queue-430.log) | 19 | `5e20567d10c3467e60d65dd72b7a61aa151e6ef78176dc0088aea4670528d8e0` |
| [tests/recovery-browser-v2.json](tests/recovery-browser-v2.json) | 541 | `d9490452a0a7e7c00927dd5ae541ff6aaba3a2ff2ae98e5609cd94ef1e712a03` |
| [tests/recovery-browser-v2.log](tests/recovery-browser-v2.log) | 42 | `fd8786ba9ed9349f69f165c30fdbb9887c9448c9910a01a8ca90064e779414ef` |
| [tests/recovery-ui.json](tests/recovery-ui.json) | 1070 | `68c500c75578fadacb8cc496216c471822a9acf10c09c474c9b3d91527a76b56` |
| [tests/recovery-ui.log](tests/recovery-ui.log) | 455 | `120b0f2794da67598f785b8eb32a0f704296a4a9e19d01832838cc6dc0e71223` |
| [tests/REPRODUCTION.md](tests/REPRODUCTION.md) | 1971 | `937a4664044894f77b7fc7da57f7189e2d11928c84e68df5da82e373fdcde36a` |
| [tests/TEST_EVIDENCE_INDEX.md](tests/TEST_EVIDENCE_INDEX.md) | 7895 | `634c8b6ff4b0b62cda1629ce9f413729f506371b0cdf029d1e6cebceb7af9b35` |
| [tests/TEST_MANIFEST.json](tests/TEST_MANIFEST.json) | 31306 | `72be6b6d2471c1f8cef48801be57a49755a038e5ad4e71a49f4df58f4157d102` |
| [tests/unsigned-journal-red.json](tests/unsigned-journal-red.json) | 1009 | `f897ac09a778bcdcae490f81c55bb1b1a0e3cebde6c5a2f52fa21576c2997049` |
| [tests/unsigned-journal-red.log](tests/unsigned-journal-red.log) | 4010 | `e664a02ab0d5c2a04aa3eb8769cf9a1af6786f2fdafdc5257cfd7cfa41cc8bb2` |
| [tests/verified-lint.json](tests/verified-lint.json) | 542 | `f0179214fd82131186ea982f75982badd8449bead1b2d7b36297b82316a05b13` |
| [tests/verified-lint.log](tests/verified-lint.log) | 1553 | `7a119c8dc7dc9f3639867606075f42ba019720ef56fa813513e4abac64a648a9` |
| [tests/verified-root.json](tests/verified-root.json) | 542 | `a04e92efdc2837e3ad3ca62c0449834e48b8f933fd39d40ff5314f5b1e714582` |
| [tests/verified-root.log/part-001.txt](tests/verified-root.log/part-001.txt) | 245751 | `c0444d355aca291c4aa927f67113e2aee21d20e4916b030982ab3d18dbcb7438` |
| [tests/verified-root.log/part-002.txt](tests/verified-root.log/part-002.txt) | 245741 | `a1dda8839691e378dd2d498f3a9adee915dbdc28b1c1833c2f83bd418d6b4b57` |
| [tests/verified-root.log/part-003.txt](tests/verified-root.log/part-003.txt) | 117881 | `de1fd603ab58d6b0e0afb3fe46a0b83b04e3b2056dcb7132484d65109801376b` |
| [tests/verified-typecheck.json](tests/verified-typecheck.json) | 552 | `74a71edc26d5678ece37cb2f6f8974c9860817f9ad7836cf7500c169b6ae6531` |
| [tests/verified-typecheck.log](tests/verified-typecheck.log) | 1569 | `b5ac1b19e32f37757b6342a8bf983a28971b6d30e3a4decbbdab6e1496cb59d7` |
| [verify_publication.py](verify_publication.py) | 1517 | `b93ce7649f97deef6c3136bcd4721c02e444f397c9be149e329f30594efb4dc6` |
| [MANIFEST.json](MANIFEST.json) | Git-tree bound | Lists all payload hashes; no circular self-hash |
| [README.md](README.md) | In manifest | In manifest |
