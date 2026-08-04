# Phase 3 Reviewer Worklist

Generated: 2026-08-04T21:52:43.998Z
Status: pass
Git SHA: 9416b48f35cf5e1d6c4957ec632c752775b1d1d2
Git status: clean

This generated worklist converts the legal, clinical, cosmetic chemistry,
privacy/security, and IP/FTO review logs into an operator handoff. It does
not mark anything approved; it records the exact source files and hashes
reviewers must inspect before launch gates can close.

## Summary

- Review items: 39
- Source files hashed: 444
- Missing source files: 0
- Current detached signoffs: 0
- Release dispositions missing signoff: 0
- Blockers: 0
- Warnings: 0

## Items

| Domain            | Area                                              | Status      | Reviewer | Date | Signoff        | Sources | Missing sources |
| ----------------- | ------------------------------------------------- | ----------- | -------- | ---- | -------------- | ------- | --------------- |
| legalRegulatory   | Regulatory launch classification                  | Not cleared | TBD      | TBD  | not-applicable | 4       | 0               |
| legalRegulatory   | Launch claims vocabulary                          | Not cleared | TBD      | TBD  | not-applicable | 3       | 0               |
| legalRegulatory   | Store metadata and review notes                   | Blocked     | TBD      | TBD  | not-applicable | 5       | 0               |
| legalRegulatory   | Subscription and cancellation                     | Not cleared | TBD      | TBD  | not-applicable | 38      | 0               |
| legalRegulatory   | Commerce and paid-link disclosure                 | Blocked     | TBD      | TBD  | not-applicable | 23      | 0               |
| legalRegulatory   | Ask and AI disclosures                            | Blocked     | TBD      | TBD  | not-applicable | 19      | 0               |
| clinical          | Ingredient interaction rules                      | Not cleared | TBD      | TBD  | not-applicable | 3       | 0               |
| clinical          | Routine application ordering                      | Not cleared | TBD      | TBD  | not-applicable | 4       | 0               |
| clinical          | Pregnancy safety and active cadence               | Not cleared | TBD      | TBD  | not-applicable | 5       | 0               |
| clinical          | PAO defaults                                      | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Recommendation types                              | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Shoppable stacks                                  | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Community notes and posts                         | Not cleared | TBD      | TBD  | not-applicable | 17      | 0               |
| clinical          | Ask OnSkin deterministic answers                  | Not cleared | TBD      | TBD  | not-applicable | 2       | 0               |
| clinical          | Trend analysis                                    | Not cleared | TBD      | TBD  | not-applicable | 16      | 0               |
| clinical          | Photo progress copy                               | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Onboarding quiz                                   | Blocked     | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Consent copy                                      | Blocked     | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Functional tags                                   | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Conflict and synergy rules                        | Not cleared | TBD      | TBD  | not-applicable | 2       | 0               |
| cosmeticChemistry | PAO defaults                                      | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Recommendation catalog                            | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Shoppable stack item labels                       | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Routine sequencing                                | Not cleared | TBD      | TBD  | not-applicable | 4       | 0               |
| cosmeticChemistry | Active concentration and pregnancy-caution matrix | Not cleared | TBD      | TBD  | not-applicable | 22      | 0               |
| cosmeticChemistry | Smart shelf labels                                | Not cleared | TBD      | TBD  | not-applicable | 31      | 0               |
| privacySecurity   | Health-data consent and withdrawal                | Blocked     | TBD      | TBD  | not-applicable | 63      | 0               |
| privacySecurity   | Photo privacy and local storage                   | Not cleared | TBD      | TBD  | not-applicable | 4       | 0               |
| privacySecurity   | Trend and cloud-backup consent                    | Blocked     | TBD      | TBD  | not-applicable | 17      | 0               |
| privacySecurity   | Ask, commerce, and community consent              | Blocked     | TBD      | TBD  | not-applicable | 4       | 0               |
| privacySecurity   | Account deletion and data export                  | Blocked     | TBD      | TBD  | not-applicable | 15      | 0               |
| privacySecurity   | Analytics and crash payloads                      | Not cleared | TBD      | TBD  | not-applicable | 19      | 0               |
| privacySecurity   | Auth and processor posture                        | Blocked     | TBD      | TBD  | not-applicable | 53      | 0               |
| ipFto             | Brand and trademark clearance                     | Blocked     | TBD      | TBD  | not-applicable | 11      | 0               |
| ipFto             | Native identifiers and callbacks                  | Blocked     | TBD      | TBD  | not-applicable | 3       | 0               |
| ipFto             | Onboarding quiz FTO                               | Blocked     | TBD      | TBD  | not-applicable | 4       | 0               |
| ipFto             | Public positioning differentiation                | Not cleared | TBD      | TBD  | not-applicable | 3       | 0               |
| ipFto             | Catalog source and image rights                   | Blocked     | TBD      | TBD  | not-applicable | 24      | 0               |
| ipFto             | Share-card marks and deep links                   | Blocked     | TBD      | TBD  | not-applicable | 16      | 0               |

## Item Details

### legalRegulatory - Regulatory launch classification

- Worklist ID: `legalRegulatory:regulatory-launch-classification`
- Status: Not cleared
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `3cbb82a8c65e9865fce862c40f56a34b28f21bdbfdad344c53f2bba077e2b1e1`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Counsel must classify every exact release function and intended-use/claim surface; a disclaimer is not a device-classification safe harbor.

Sources:

- `docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md` - 18597 bytes - sha256 `f365db66e5db9a4d0847de9c184558e946e21176587d587fc8bba6f8754c42d5`
- `docs/phase-3/regulatory-positioning-memo.md` - 8907 bytes - sha256 `d0e67dde9ea011dd2846934f38f30b636b4233fccd4faf4773195c6a7016ea5d`
- `docs/legal-readiness.md` - 16423 bytes - sha256 `0738dd5c741a5e666d0b3e0a0fdd0fd11cf3233ec69ede5a8b166c324cda1e7f`
- `apps/mobile/src/lib/legal/disclaimer.ts` - 926 bytes - sha256 `b9cc550cb5802a61fbc0c782585b4fcc388719d2475e5f7d476005da4f26e174`

### legalRegulatory - Launch claims vocabulary

- Worklist ID: `legalRegulatory:launch-claims-vocabulary`
- Status: Not cleared
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `ea6e4340c1ccbdf2a157b06135d134d8b082542e9d6842c41c1e302bc2c927f0`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review health/cosmetic/drug claims and jurisdictional handling in addition to store, ads, screenshots, pushes, paywalls, and review replies.

Sources:

- `docs/phase-3/launch-claims-vocabulary.md` - 3613 bytes - sha256 `18a587dde1f99b877e6489b44a6454488efa22ca020fe825b4e1246305912891`
- `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md` - 33920 bytes - sha256 `c09c16e8df76171b1e2f6e3522bc212ee785e8172e7822a65d2573002b4a4f9f`
- `apps/mobile/src/lib/legal/storeMetadata.ts` - 7852 bytes - sha256 `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`

### legalRegulatory - Store metadata and review notes

- Worklist ID: `legalRegulatory:store-metadata-and-review-notes`
- Status: Blocked
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `5db51fe3c2e854377612c444e19e653cb2337e7ceb4d9de57cadce81d3207369`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Requires final brand, support/policy URLs, privacy labels, medical-device declaration, IAP, reviewer access, and exact-build evidence.

Sources:

- `docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md` - 18597 bytes - sha256 `f365db66e5db9a4d0847de9c184558e946e21176587d587fc8bba6f8754c42d5`
- `docs/phase-3/store-metadata-review.md` - 2533 bytes - sha256 `eaaefbb8f09bf99b12888fa847a13b2c93bbc585c61c1f07d48759858d8dd8b1`
- `docs/phase-3/app-review-notes.md` - 5319 bytes - sha256 `c7e521b926db2c8d3cdc62c9962538ed92da5822c8b1146ba1a1952a59bb7453`
- `docs/phase-3/google-play-health-declaration-notes.md` - 1901 bytes - sha256 `12329457687f1d91a80099badea762832c3e123cfcf8dc82ce739c8ed1fb5658`
- `apps/mobile/src/lib/legal/storeMetadata.ts` - 7852 bytes - sha256 `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`

### legalRegulatory - Subscription and cancellation

- Worklist ID: `legalRegulatory:subscription-and-cancellation`
- Status: Not cleared
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `7aa9c53c9d8b4dadc6ee42d6b7276025eb5f5901578b05ed476d1cedd8e44473`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Auto-renew, restore, cancellation, trial, and win-back copy.

Sources:

- `apps/mobile/src/features/subscription/cancelIntent.test.ts` - 1780 bytes - sha256 `d950be6fe9113911fb318323d4a5b7a0fdcb2a1574ee2ce567dd56377d019660`
- `apps/mobile/src/features/subscription/cancelIntent.ts` - 542 bytes - sha256 `401681a7d3bed2d27b84599b1fc6321de1afb8d4cef1930bbe0d54597fc86dbe`
- `apps/mobile/src/features/subscription/claimsafety.test.ts` - 4504 bytes - sha256 `62d70ccc6d6342d86d72ad36c135f82eef591e7964e561951a02c0ffeaaf5f09`
- `apps/mobile/src/features/subscription/ComplianceRow.tsx` - 5025 bytes - sha256 `116fc975b950f6cf919471bd41c0530d1da8c08875d64d9f141bec10416cf514`
- `apps/mobile/src/features/subscription/conflictQuota.test.ts` - 4710 bytes - sha256 `240c045085f2c6a9b622d723607df62e6697edc3d50e5db877a4efb004503f5d`
- `apps/mobile/src/features/subscription/conflictQuota.ts` - 3595 bytes - sha256 `0e88478e0ca325c0650bde53a223a2b06a0252f8dba370688b4b7d3eb06dd538`
- `apps/mobile/src/features/subscription/copy.ts` - 8500 bytes - sha256 `4e72f3ac95733986cb8e9cd076a126e9ab43d9dd16e57f601cf39a3954f51beb`
- `apps/mobile/src/features/subscription/dismissPaywall.test.ts` - 2567 bytes - sha256 `0b6b18e59315bf79fc066ba0dd5bc544fcb93a896b9205e223d6af7d39668265`
- `apps/mobile/src/features/subscription/dismissPaywall.ts` - 886 bytes - sha256 `f0e2425be6b3742ba8da23db5c36b326f8810d1f3285fd1015f9308072d400d9`
- `apps/mobile/src/features/subscription/entitlement.test.ts` - 3970 bytes - sha256 `2ef807ac5ae4b4bdf0d83e47c3a37c7d1de4eb425c436fec17177991616a273a`
- `apps/mobile/src/features/subscription/entitlement.ts` - 5813 bytes - sha256 `735938df18d9a15c383c7017102c9626b538ab90f0f7e0ef9054d7b14de9e9ec`
- `apps/mobile/src/features/subscription/entitlementEvidence.test.ts` - 6620 bytes - sha256 `3b54db67533690960a45168349bbad40dafb7a036ad31dbd669216a78f5e7c75`
- `apps/mobile/src/features/subscription/entitlementEvidence.ts` - 18546 bytes - sha256 `b8d11b40a3ec16703e42442a49f7a6a4582ea7a2c190a7e2f271326fbf5b61f9`
- `apps/mobile/src/features/subscription/gatedRoutes.test.ts` - 1109 bytes - sha256 `9d50f012762bc49dadef8736536ab807af198b970189df5c901d4375a83f7a4f`
- `apps/mobile/src/features/subscription/gatedRoutes.ts` - 483 bytes - sha256 `aea4630a6d619bc5a10f6ee247d46af66f0a29887db6f7da869f7f12fdacd4af`
- `apps/mobile/src/features/subscription/lifecycle.test.ts` - 3609 bytes - sha256 `7a6fa4b798d5db895852bb635c1915f84dcede71457133ae2a2e767b9f4c7a68`
- `apps/mobile/src/features/subscription/lifecycle.ts` - 3380 bytes - sha256 `d474cb495f3ea7250f159d2236605bb19383051202127aad225faca82a356804`
- `apps/mobile/src/features/subscription/PaywallFeedback.tsx` - 2851 bytes - sha256 `b32214dc39986c6e3a92ecda688c761c965c2860448470c4839c4f229f399ece`
- `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts` - 38597 bytes - sha256 `7889b5f7ad4c9ada4dbd9f89dcfd9f78a3f032058a636b4ddf960ef423ace2af`
- `apps/mobile/src/features/subscription/plans.test.ts` - 1722 bytes - sha256 `23c775e3e8097b29f727b29157a62659e0a61ae726f7db1b019bd55c41749882`
- `apps/mobile/src/features/subscription/plans.ts` - 2677 bytes - sha256 `3e6f35b07b59b875d9ee7b337f341f227dd6f42f5178b501c4fdda2242225e22`
- `apps/mobile/src/features/subscription/priceDisplay.test.ts` - 3483 bytes - sha256 `420ec71fc37fed57e2ecc31fc5ccd19098289051b29bb18e9b79f13c2b7c180f`
- `apps/mobile/src/features/subscription/priceDisplay.ts` - 1789 bytes - sha256 `2fe6c0d3c47f9eecdef15e31b4720c47afa00c74c97b14c738583648043ea296`
- `apps/mobile/src/features/subscription/ProGate.tsx` - 21628 bytes - sha256 `f7528d81a3fb52ac29a32ffc7902e48dd20c10b677e1e4abafcd11cff378bb15`
- `apps/mobile/src/features/subscription/proGatedRoutes.test.ts` - 16111 bytes - sha256 `44d56f7f13bab8928002e0ef441c45de7748877e4becf54d74dd7d9279733997`
- `apps/mobile/src/features/subscription/ReverseTrialBanner.tsx` - 2326 bytes - sha256 `b3453ed2c4b8efa0529d97decf7c352c03cae0411bc6bfbfba231212a5ec335f`
- `apps/mobile/src/features/subscription/serverContracts.test.ts` - 7049 bytes - sha256 `daca502833a84b5c01167cbe3b1c0c72e2042bc6514cbda4e56329f284f3f5be`
- `apps/mobile/src/features/subscription/store.test.ts` - 32970 bytes - sha256 `9074c92b587abc09f8df3e1d05c3fb4c0e95a38fd9a6ef6f4e00361a678e385d`
- `apps/mobile/src/features/subscription/store.ts` - 60455 bytes - sha256 `2e5e3e65abd8fc2e36b8e6bd0b9e369291829249d92740c0011d1f87d61101d8`
- `apps/mobile/src/features/subscription/storefrontCopy.test.ts` - 2414 bytes - sha256 `bf337ddc1a4eb1656bb67eafc78133c36026b33f8797ebcef47e0deba889c561`
- `apps/mobile/src/features/subscription/storefrontCopy.ts` - 1929 bytes - sha256 `77cf3ff8188121e6ac2854595e0a79b2b9f71e794f8ddb4e773ae9a81bdaedcc`
- `apps/mobile/src/features/subscription/storeTransactionNoticeContracts.test.ts` - 6647 bytes - sha256 `fe93dd56547bbdf2c7307897b80d9f6af56a660b261ba72089bf7ea2a4a8fd12`
- `apps/mobile/src/features/subscription/StoreTransactionNoticeHost.test.ts` - 5863 bytes - sha256 `0a0bd7d45eebe2a3429029e1c2586dd75b62aef97d10cc178d5d98fa8fb3b909`
- `apps/mobile/src/features/subscription/StoreTransactionNoticeHost.tsx` - 12042 bytes - sha256 `2add0b2247d702901aba3545efc4898b8b2166d105b83859bdf13aa6049c1bd0`
- `apps/mobile/src/features/subscription/useEntitlement.ts` - 17046 bytes - sha256 `07ae96a482701392e841b70aff84a77e44ea0c35ea1e4659eb2fe2f58d8ab59c`
- `apps/mobile/src/features/subscription/useEntitlementEvidenceContracts.test.ts` - 1052 bytes - sha256 `54fe20269bdcc074b7ec48482838981c04b42a352db12a23984d356336b5cb64`
- `apps/mobile/src/features/subscription/useSubscriptionOffering.ts` - 761 bytes - sha256 `9f765eb64c59b0a27f5b815b16fa829465322e1ee5dab866230bb6afe5af1a8a`
- `apps/mobile/src/lib/iap/revenuecat.ts` - 37617 bytes - sha256 `6ae4921ebcdfd202dad381661dddcefd28add835b2502328946c8ae1a52b0358`

### legalRegulatory - Commerce and paid-link disclosure

- Worklist ID: `legalRegulatory:commerce-and-paid-link-disclosure`
- Status: Blocked
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `fb3c40e9ce02b2e5d97318a36d79fe7a991062db2b982e9719f13ad8891b442b`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: FTC disclosure, partner data sharing, source rights, order reports.

Sources:

- `docs/phase-4/odbl-compliance-memo.md` - 5338 bytes - sha256 `cf202bd20819b0a8f5b84cc81e7bb2f2470d45ae257a800d4e72f7e88e5bda7d`
- `apps/mobile/src/features/commerce/admission.ts` - 70 bytes - sha256 `32feaa31a53d5d322da4ca4eb3b38a5968458d04c28df95afdcfe8d4ad96a10d`
- `apps/mobile/src/features/commerce/attribution.test.ts` - 2317 bytes - sha256 `0bcba1e47b0c2d6c2be25520822988b738b8833b4aa04e3e26e0e6a358812683`
- `apps/mobile/src/features/commerce/attribution.ts` - 1544 bytes - sha256 `851b6e522d79437bbd905b0c03e105e9734702dbd5915c81144e6b553059a636`
- `apps/mobile/src/features/commerce/claimsafety.test.ts` - 4270 bytes - sha256 `605ed71990018b118eba4cf5b4a5e6745fd9bb231f74253610484619a54f50b0`
- `apps/mobile/src/features/commerce/commerce.test.ts` - 2844 bytes - sha256 `6db2503af9f9cd26612945dfa2e1184dbaa95f63bd1ef0393d6feaa38b9bb76a`
- `apps/mobile/src/features/commerce/CommerceDeferredSurface.tsx` - 449 bytes - sha256 `b57b799ec43cecce12b7d9c9155d81288a62fdd4af2a6f520ad99e1b57b668e5`
- `apps/mobile/src/features/commerce/CommerceLinkNotice.tsx` - 751 bytes - sha256 `911862ba2aa65e417f186c920738dc977ab3acb65fddc46ad9682b32b31ad2f7`
- `apps/mobile/src/features/commerce/commerceRoutes.test.ts` - 3417 bytes - sha256 `5944b9d3b150c49ed31e4b111ca50717630813ef4a58211bd6d6de412ea3ff72`
- `apps/mobile/src/features/commerce/consent.test.ts` - 2287 bytes - sha256 `29d6cee0db17a8ccf62b2f62c633a59b57e9f45029dbf1f8f5f5ce351f070226`
- `apps/mobile/src/features/commerce/consent.ts` - 1095 bytes - sha256 `80f0f30cacc7c0de3393568bb6fa4c23c703eccdba0c658788732cb1a66a73bd`
- `apps/mobile/src/features/commerce/consentLogic.ts` - 336 bytes - sha256 `613f344902c702ae413107b040b3c2c1b0069b58325771c44968dc38ffed6777`
- `apps/mobile/src/features/commerce/copy.ts` - 4647 bytes - sha256 `5196c28ede0ccc14c2f82e389c3b14544e839d3210c4b08203e95f4bc08f912d`
- `apps/mobile/src/features/commerce/disclosureOperation.test.ts` - 1066 bytes - sha256 `2afd4c867d9bbccc27834a4573d2a88bd90c9681122bcbe74135a9fe03a9f757`
- `apps/mobile/src/features/commerce/disclosureOperation.ts` - 495 bytes - sha256 `24008712afbcc370df59388af3a08f7e723cd7089aefb7e73c73a4a1073d936e`
- `apps/mobile/src/features/commerce/links.ts` - 1608 bytes - sha256 `447f7ace76a8af1a6598b84a17edb7a7d1e64dff9e14ff99d3100996c663845f`
- `apps/mobile/src/features/commerce/LockGlyph.tsx` - 1284 bytes - sha256 `a6a4bc8696bc94c4fd5acc0a39226a258607b3778dd21f90bb23bd22fe0c9ca8`
- `apps/mobile/src/features/commerce/stacks.ts` - 1127 bytes - sha256 `f631f46d439ea14dd5ed9deeed2be1eabfa941c802942a16c8f83178562e0820`
- `apps/mobile/src/features/commerce/store.test.ts` - 1800 bytes - sha256 `243b0eacb1b7068a39e160ec31bf2626c7dae8300a85b826df1c87ca21698b82`
- `apps/mobile/src/features/commerce/store.ts` - 970 bytes - sha256 `d45e9ebae23d64d13a9f390569a0ee8a1e6b34096d3b4395df69414ba2dc5ba0`
- `apps/mobile/src/features/commerce/useCommerce.ts` - 698 bytes - sha256 `09521e1e075a97111e59d0e32a55a9d0db9ad18987bfd3304a4726bbc719d92e`
- `apps/mobile/src/features/commerce/WhereToBuy.tsx` - 156 bytes - sha256 `a459ece2191dbbfb7aa787e784dd074b8b361369e904ee9d76baf8118848a0ae`
- `supabase/functions/order-report-poll/index.ts` - 1125 bytes - sha256 `5747e2e536851e325fcb25ca3c9f0cefa81fc0c0f94c6c34791b89b5651adc8c`

### legalRegulatory - Ask and AI disclosures

- Worklist ID: `legalRegulatory:ask-and-ai-disclosures`
- Status: Blocked
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `3280b1d915d90c036f0468c271d2fc7c7358042862c6087304061dad092ab071`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Vendor, AI disclosure, safety, privacy, and state-law review needed.

Sources:

- `docs/13-ask-onskin-assistant.md` - 116206 bytes - sha256 `b10347f01671cac49f4039e6f47bf9637377043cb6c489bb0e0d9e49a89f9ad9`
- `apps/mobile/src/features/ask/answer.test.ts` - 11922 bytes - sha256 `4d6a33acbd626f7a3a61b02e62af29c85d59ace6fc01f63a74bd27608ffb1dbf`
- `apps/mobile/src/features/ask/answer.ts` - 15567 bytes - sha256 `cc9a7a0bd0e44a3cca4709479aee9513f424059917fd07335e26bb36371ce786`
- `apps/mobile/src/features/ask/applyConsentChoice.test.ts` - 1932 bytes - sha256 `ad650b6161eac3e5f051ef8f9351b0312bef6ba2b05aaf5c67acb887e053705a`
- `apps/mobile/src/features/ask/applyConsentChoice.ts` - 599 bytes - sha256 `61a6d68a997af32f0caf5d68c5b347cb2ed3a085874172a48f0489875441c24f`
- `apps/mobile/src/features/ask/AskTeaser.tsx` - 1467 bytes - sha256 `a9dfaa2f4cfe8d805c26d5fa6aefff91c02327b8d7dca8f09376c788a0a8108d`
- `apps/mobile/src/features/ask/claimsafety.test.ts` - 7841 bytes - sha256 `05cd47f500866b175719b0c16e5a0106c84ed0581d49a372e5d6daaadb3e650c`
- `apps/mobile/src/features/ask/consent.test.ts` - 2193 bytes - sha256 `86c27236e060f6fabfca22049f195041475523bd2f147f1a1e5658a694ee0b71`
- `apps/mobile/src/features/ask/consent.ts` - 833 bytes - sha256 `ba732d8c83bd8951f2c33a11ef7555bd2d6ee23dd1b02d6bfb8de20cd219885b`
- `apps/mobile/src/features/ask/copy.ts` - 7508 bytes - sha256 `c0fa11f9fcb1c0175e13a3368e1000f7dd6f2b80e2d486124649b55878358f35`
- `apps/mobile/src/features/ask/gate.test.ts` - 1777 bytes - sha256 `cb2c0af6d08be18530a703dc12ff36bb727dbe33f54085e3b4fc9742f8f33c1a`
- `apps/mobile/src/features/ask/gate.ts` - 2131 bytes - sha256 `337f2bb2f6d0e7208102648233da198c9f4c4cc3f3f392a8b57082969e6fc3c4`
- `apps/mobile/src/features/ask/guard.ts` - 2015 bytes - sha256 `bd0e051294a02a78bab242b4fdfbad5f7e08258467232009f027536258a433ee`
- `apps/mobile/src/features/ask/intent.test.ts` - 2674 bytes - sha256 `8f1680dc85f47891fdb8b41e8756d69f3526a54d9bb659926e4955879686166a`
- `apps/mobile/src/features/ask/intent.ts` - 3815 bytes - sha256 `83c3468965521a3a37db6d513d9e12ffd679cd23d8a83ee1560a4fe4bd3de15b`
- `apps/mobile/src/features/ask/routeContract.test.ts` - 11474 bytes - sha256 `5875bbd277bfa3e3bc5b93fae753e4812d1b18caeb4abaff7899bd7df3d67f98`
- `apps/mobile/src/features/ask/store.test.ts` - 9357 bytes - sha256 `42a01c5d0a828912b92978a0b1921f1a7df8ca67effc0b0ebbc47e965e248de7`
- `apps/mobile/src/features/ask/store.ts` - 5622 bytes - sha256 `76af6872cc1376d2d515534bf463ad71a8e7a1c51d838000ca1ed3a421331cec`
- `apps/mobile/src/features/ask/useAsk.ts` - 5560 bytes - sha256 `9f03da10e33b546052d7c0bea39b8f72cba70c28465f17eeca5bed79930b6727`

### clinical - Ingredient interaction rules

- Worklist ID: `clinical:ingredient-interaction-rules`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `65a81aa77af1d98b329ac709fa750ace52455b39dafa879ad76f088168a3d100`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review all 13 candidate rules, exact runtime admission logic, and audit constraints. Clinical approval must be independent of chemistry and regulatory-counsel review.

Sources:

- `apps/mobile/src/features/intelligence/rules.ts` - 1389 bytes - sha256 `5c0d27f4b671a3fbe6dc57a8d715acfe3b817c2a171b14fb8e7e87624c39ad45`
- `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts` - 51808 bytes - sha256 `71263bcc56d86655d9057b5c3449b92c4056526439b3296c97e5680aae103dae`
- `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md` - 33920 bytes - sha256 `c09c16e8df76171b1e2f6e3522bc212ee785e8172e7822a65d2573002b4a4f9f`

### clinical - Routine application ordering

- Worklist ID: `clinical:routine-application-ordering`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `f9cf9ac37fbd6dc3d672c97a0ad2c45843ae5890d93174723106dc35e521531a`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review every role's phase, priority, exact full/compact display copy, rule version, and partial-review behavior. No manual add-to-AM/PM recovery exists.

Sources:

- `apps/mobile/src/features/routine/sequencing.ts` - 20044 bytes - sha256 `7f17500cbbabe123320f13df9e018f7bbf1cb146a3f70aaa845782b0cd6dcf6c`
- `apps/mobile/src/features/routine/generate.ts` - 8621 bytes - sha256 `d98871cff5edb3cb7bf119b735fa352254c14e2f56b68d0b4f897dff0eaf21b1`
- `apps/mobile/src/features/today/routineProjection.ts` - 7275 bytes - sha256 `6fd3051255557caeaa3e92bb4c3ca29713c3dc2c620aad7fc4beaf17b0d998c0`
- `apps/mobile/src/app/(tabs)/today.tsx` - 38886 bytes - sha256 `c07f10efec2a63a5c6eeb8cefc7e040276cae42fcfef1f18a1646dc3d93074d1`

### clinical - Pregnancy safety and active cadence

- Worklist ID: `clinical:pregnancy-safety-and-active-cadence`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `d664febbe35ebc7046647f11608258d7a4885a12aaf0ed2295f162e0ec97f749`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review statuses, retinoid/hydroquinone/BHA matrix and threshold, unknown-strength handling, cadence, replacement suppression, and every visible explanation together.

Sources:

- `apps/mobile/src/features/intelligence/pregnancySafety.ts` - 4775 bytes - sha256 `9dc3a263a0de3661ed164c685dbef6494107ae7d494bfe3c37b40d2ed7fd276c`
- `apps/mobile/src/features/intelligence/concentration.ts` - 7024 bytes - sha256 `a44ab1e6e6020e7e01a432d82c5aa8e8f941db4b4a870f8e0fa55e94bd8a6230`
- `apps/mobile/src/features/routine/generate.ts` - 8621 bytes - sha256 `d98871cff5edb3cb7bf119b735fa352254c14e2f56b68d0b4f897dff0eaf21b1`
- `apps/mobile/src/features/scheduler/orchestrate.ts` - 13381 bytes - sha256 `9232e7a8b8f8a92de9e871dcf806ada0776a96eb527289c5c1476ec2452286a8`
- `apps/mobile/src/features/recommendations/engine.ts` - 24385 bytes - sha256 `09d3eb6119b68909c9d34d23ddacf6c2ee9d79e0d35ecf277353c68d8b8224c3`

### clinical - PAO defaults

- Worklist ID: `clinical:pao-defaults`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `1dbd9bb982ece71d5d0074afccef5f81f64d8ea5cfdfd8d138474228b3f852ad`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Keep conservative until chemist/derm signoff.

Sources:

- `apps/mobile/src/features/intelligence/pao.ts` - 5160 bytes - sha256 `32209515587ba1136c72abcd9703f25ef46c0aa6a289bff5fac685a08a0eafde`

### clinical - Recommendation types

- Worklist ID: `clinical:recommendation-types`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `33313868dcb1e46ebf4af9bf62b5001208f19ebabe468a98863c492a7ccfc9a8`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Structural routine types may remain; medical-adjacent needs signoff.

Sources:

- `apps/mobile/src/features/recommendations/catalog.ts` - 9187 bytes - sha256 `c51facef1b8d53e2c916de28b08910147b6afe2d1de3ba36f587ad9cc1f64ffa`

### clinical - Shoppable stacks

- Worklist ID: `clinical:shoppable-stacks`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `2bca48349eab5a9520af45a871f5232eb72621b722a8b9f6aefb6101cc0510ac`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Paid link disclosure does not replace clinical review.

Sources:

- `apps/mobile/src/features/commerce/stacks.ts` - 1127 bytes - sha256 `f631f46d439ea14dd5ed9deeed2be1eabfa941c802942a16c8f83178562e0820`

### clinical - Community notes and posts

- Worklist ID: `clinical:community-notes-and-posts`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `f756561a73a68269d965eff7288227141c4ffd383d9ea40b2d994bd2f19fd64a`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Expert notes, posting, reporting, aggregates, and medical-claim moderation require review.

Sources:

- `apps/mobile/src/features/community/anonHandle.ts` - 1201 bytes - sha256 `1e5e04a4d6b96655903d8a72a9bd3af862359e0a10ebdbd7e070faa48f701510`
- `apps/mobile/src/features/community/claimsafety.test.ts` - 3718 bytes - sha256 `a99af5d89eaf44419c6dc9d523e08135372c810cefcfa92a6720952d38fc524d`
- `apps/mobile/src/features/community/claimSafetyScan.ts` - 1379 bytes - sha256 `2ddb8498bbfe958021bfe80a9a86d02e7a5b4b051b30ee7eb6d832f5094419b6`
- `apps/mobile/src/features/community/community.test.ts` - 3667 bytes - sha256 `b1e932bf6d60ced81a5607f0bc48e313edf78625e5fd8135a13e2b8677eed937`
- `apps/mobile/src/features/community/communityRoutes.test.ts` - 11841 bytes - sha256 `a3642aaab17ce1b326242674864aae4e2cf4e66ceedcc9f3a716a41f0f0f5760`
- `apps/mobile/src/features/community/consent.test.ts` - 1971 bytes - sha256 `7ba59e83436739852dbcefbd5a8ca2619d83cf7c5bb98144a8c2f168649d489c`
- `apps/mobile/src/features/community/consent.ts` - 1121 bytes - sha256 `9bacdd40ad62d380a482bb4de5f911c62b87a03002d95ac8b4f4fb7d6a2ae8c6`
- `apps/mobile/src/features/community/copy.ts` - 3437 bytes - sha256 `93bcc88884238ebbb31caa05c07bcb26f014629101aec6fc5099f797d47bdbf3`
- `apps/mobile/src/features/community/InContextNote.tsx` - 2655 bytes - sha256 `e4a13c898a38fb885b88efd568e310bf9d25a88f77edbb5e672990576d2357d8`
- `apps/mobile/src/features/community/notes.ts` - 9194 bytes - sha256 `bb478f3088b63cfc2b15f348a1aa72d0bd6397759ad7704ca9ecb4457a02a38c`
- `apps/mobile/src/features/community/reactionStore.test.ts` - 5030 bytes - sha256 `5eea7e0730669032bc93c5b812240ec480928f40801d6ffa152558f4c8817ad1`
- `apps/mobile/src/features/community/reactionStore.ts` - 2674 bytes - sha256 `6a2552c810d3f4a68b723e6345ca59073be66ef586cb5f2cb4282234da754e11`
- `apps/mobile/src/features/community/shareNote.test.ts` - 3237 bytes - sha256 `706e4e5dc436c57b5fb29006b2449c4dae9fc9c59023b65154a21c6bd84aee86`
- `apps/mobile/src/features/community/shareNote.ts` - 1029 bytes - sha256 `8008f3453916597181769bf78a8a199d92a83b3ec579c8b1b0592b61af578ef3`
- `apps/mobile/src/features/community/store.test.ts` - 2287 bytes - sha256 `81ed8b3dc3c4ab2a8f43be1e5b8523cfb910a7ac16d7fd8099fa9036accfba2a`
- `apps/mobile/src/features/community/store.ts` - 1198 bytes - sha256 `bdad8c54f82c2be262d3f7317596c2a3792ec6a5d0f0ee2be80233d43f7ab97f`
- `apps/mobile/src/features/community/useCommunity.ts` - 604 bytes - sha256 `9d19519c7a5642d2c2617c638ce0e89a42d906f23e20de85899d6311a0d325e4`

### clinical - Ask OnSkin deterministic answers

- Worklist ID: `clinical:ask-onskin-deterministic-answers`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `3fc55cc0d8518f5d8330207ff3ea4e39b9c6b4f6e16d27afd5b9f0455869020b`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Deterministic answers are still regulated user-facing copy.

Sources:

- `apps/mobile/src/features/ask/answer.ts` - 15567 bytes - sha256 `cc9a7a0bd0e44a3cca4709479aee9513f424059917fd07335e26bb36371ce786`
- `apps/mobile/src/features/ask/copy.ts` - 7508 bytes - sha256 `c0fa11f9fcb1c0175e13a3368e1000f7dd6f2b80e2d486124649b55878358f35`

### clinical - Trend analysis

- Worklist ID: `clinical:trend-analysis`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `31288c3e3f44cb7a3f987423224f5ebe3f5d833b181331b01bf152b605b658f8`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Requires a real exact-build engine/issuer, measurement/failure evidence, predeclared diverse-condition fairness, exact claim/copy review, privacy/legal review, and supported-iPhone proof before launch.

Sources:

- `apps/mobile/src/features/trend/applyConsentChoice.test.ts` - 1828 bytes - sha256 `45a12c3ef0f7cb17830606f98365e59b77111f7e9e45241f2c1aa1539c80c14e`
- `apps/mobile/src/features/trend/applyConsentChoice.ts` - 637 bytes - sha256 `3b960048debd59e0a0669167c408025159ad67cfd3f62076700fe78bcd429124`
- `apps/mobile/src/features/trend/claimsafety.test.ts` - 5935 bytes - sha256 `72b6e24abefe92212523ecfe62877adea6ab0111870c1cd6a8f252591ac2cf0e`
- `apps/mobile/src/features/trend/consent.test.ts` - 2518 bytes - sha256 `c8d5b14e464359308cc39cf16f880e77cff2184e0f0da36814256d9d937fb3ce`
- `apps/mobile/src/features/trend/consent.ts` - 1227 bytes - sha256 `a4e37054dfc470c935ec45249c8f2bb58d75d5c55407dc3b238b9f1d6e055106`
- `apps/mobile/src/features/trend/copy.ts` - 5381 bytes - sha256 `804c809a7f3acdebf3293fdb738d18524e6e3aa8095e78c0f00de0cf8cfc9318`
- `apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts` - 3420 bytes - sha256 `71eec188c7b7135d067ce1313be73dc4df8be5afc02fe3ec655fe44a81dac802`
- `apps/mobile/src/features/trend/store.test.ts` - 2466 bytes - sha256 `ba5aff392e2b0cec9abf07ecf89a8b14415ff5923795f484990e42bfe2c06ad3`
- `apps/mobile/src/features/trend/store.ts` - 2119 bytes - sha256 `7dff9753d4e1d2334a9e4b82be2eea727f8a16b5967051beeaefcffe69a7dc0e`
- `apps/mobile/src/features/trend/trend.test.ts` - 3224 bytes - sha256 `797f4e43ac5724fce8c6df388bdd6c84514ff8a10626f6c7866b8fb47bf3733b`
- `apps/mobile/src/features/trend/trend.ts` - 3598 bytes - sha256 `3a7c314b74b0ff8e166f1aa55f710745ad6d743793bc5f65441c1675d7aeb24d`
- `apps/mobile/src/features/trend/TrendInsight.tsx` - 462 bytes - sha256 `0cb5fe60f475a09c85e89b5aea4dd8a5f0092b90f87191605c958f8d760723c5`
- `apps/mobile/src/features/trend/trendRoutes.test.ts` - 2544 bytes - sha256 `a74a7c0516aa57fb610e0339d85a740505fe8f203f30d7f93f5e1713ddcf298a`
- `apps/mobile/src/features/trend/useTrend.test.ts` - 3959 bytes - sha256 `0900e378011668323b49eb2cd6a2054dfd7393ed62efa808badce8cf7fe72f72`
- `apps/mobile/src/features/trend/useTrend.ts` - 2605 bytes - sha256 `f66040eaa2090ad36f2b35244e6c70814f6709981448e5210b5577ec71d98f75`
- `docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md` - 21446 bytes - sha256 `1e1f85728bcea9e473bbe010f9f6bf0930b4c14f196a67378c6fc2ae6db359c3`

### clinical - Photo progress copy

- Worklist ID: `clinical:photo-progress-copy`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `d136c70e4b399f8f5e409a184a587ed1421026b485b8a6c53093df312581ff06`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Lower risk but privacy-sensitive.

Sources:

- `apps/mobile/src/features/photos/copy.ts` - 7661 bytes - sha256 `3921a01492072726177d549ec5353bf64768c20a400f0f4305b18d6b89dbaa13`

### clinical - Onboarding quiz

- Worklist ID: `clinical:onboarding-quiz`
- Status: Blocked
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `af4b34dffb747f97fcd9499462c5350c952263e90f7c6e86667ad04ea5760e9c`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Needs IP/legal plus clinical review.

Sources:

- `apps/mobile/src/features/onboarding/quiz.ts` - 9591 bytes - sha256 `88de1dd0f6329fc792aa5697e66b0fc4bbedfe654181dcc740fd36a35b3fc3dc`

### clinical - Consent copy

- Worklist ID: `clinical:consent-copy`
- Status: Blocked
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `3c6cadffe52f4f651e99aa1bd1bce14900197792494486d007da393ba0f763ab`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Legal-owned copy explicitly names pregnancy, trying to become pregnant, and breastfeeding status; review exact version/hash behavior.

Sources:

- `apps/mobile/src/features/onboarding/consentCopy.ts` - 5658 bytes - sha256 `6e0cc1d6de3cad0b84c5cdb7463ed8b171820a9e436d5075f3b54623e6a47034`

### cosmeticChemistry - Functional tags

- Worklist ID: `cosmeticChemistry:functional-tags`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `1f9baeadd23d8ae83e0bf0bdb75849180e6990208ead7233ea33401bf827a81e`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Verify naming and category boundaries.

Sources:

- `packages/types/src/index.ts` - 19110 bytes - sha256 `015b60293c9252c54e99830ec390e7b518f8244649b105920d830dc1f3e55f25`

### cosmeticChemistry - Conflict and synergy rules

- Worklist ID: `cosmeticChemistry:conflict-and-synergy-rules`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `cf40196866669e859b10aafa11de441a8a9fe539fd0fcfdfa5054429ab5d3dd4`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review molecule, derivative, concentration, pH, vehicle, delivery-system, packaging, fixed-formulation, stability, and layering limits.

Sources:

- `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts` - 51808 bytes - sha256 `71263bcc56d86655d9057b5c3449b92c4056526439b3296c97e5680aae103dae`
- `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md` - 33920 bytes - sha256 `c09c16e8df76171b1e2f6e3522bc212ee785e8172e7822a65d2573002b4a4f9f`

### cosmeticChemistry - PAO defaults

- Worklist ID: `cosmeticChemistry:pao-defaults`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `86db57c6b6339121b2627e3a7a5fdb3f28dc8ef7caca3d2156c329e967f5a4f3`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review by category and preservative risk assumptions.

Sources:

- `apps/mobile/src/features/intelligence/pao.ts` - 5160 bytes - sha256 `32209515587ba1136c72abcd9703f25ef46c0aa6a289bff5fac685a08a0eafde`

### cosmeticChemistry - Recommendation catalog

- Worklist ID: `cosmeticChemistry:recommendation-catalog`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `2bd55d28d1873aeeddf0ff02af01ddacb3875862c62862b80695e7feff8ac234`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm evidence notes and caveats.

Sources:

- `apps/mobile/src/features/recommendations/catalog.ts` - 9187 bytes - sha256 `c51facef1b8d53e2c916de28b08910147b6afe2d1de3ba36f587ad9cc1f64ffa`

### cosmeticChemistry - Shoppable stack item labels

- Worklist ID: `cosmeticChemistry:shoppable-stack-item-labels`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `7811ba5f22f25fd2fb7f46d640bf815fb50131a8f83f7e65202e85f6de962314`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Product examples illustrative only.

Sources:

- `apps/mobile/src/features/commerce/stacks.ts` - 1127 bytes - sha256 `f631f46d439ea14dd5ed9deeed2be1eabfa941c802942a16c8f83178562e0820`

### cosmeticChemistry - Routine sequencing

- Worklist ID: `cosmeticChemistry:routine-sequencing`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `9779e0e245658b201d2e8c5b4c96423844223e5ff55fe34618b66731de4863d5`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm every role's phase, priority, exact displayed instruction, and partial-review behavior. No manual add-to-AM/PM recovery exists.

Sources:

- `apps/mobile/src/features/routine/sequencing.ts` - 20044 bytes - sha256 `7f17500cbbabe123320f13df9e018f7bbf1cb146a3f70aaa845782b0cd6dcf6c`
- `apps/mobile/src/features/routine/generate.ts` - 8621 bytes - sha256 `d98871cff5edb3cb7bf119b735fa352254c14e2f56b68d0b4f897dff0eaf21b1`
- `apps/mobile/src/features/today/routineProjection.ts` - 7275 bytes - sha256 `6fd3051255557caeaa3e92bb4c3ca29713c3dc2c620aad7fc4beaf17b0d998c0`
- `apps/mobile/src/app/(tabs)/today.tsx` - 38886 bytes - sha256 `c07f10efec2a63a5c6eeb8cefc7e040276cae42fcfef1f18a1646dc3d93074d1`

### cosmeticChemistry - Active concentration and pregnancy-caution matrix

- Worklist ID: `cosmeticChemistry:active-concentration-and-pregnancy-caution-matrix`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `259344bc47052a68762108411af31f5b2ff83fab106f977f0f0595c837ac5614`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Validate aliases, thresholds, multi-active ambiguity, low/high/unknown BHA, hydroquinone, and replacement behavior.

Sources:

- `apps/mobile/src/features/intelligence/concentration.ts` - 7024 bytes - sha256 `a44ab1e6e6020e7e01a432d82c5aa8e8f941db4b4a870f8e0fa55e94bd8a6230`
- `apps/mobile/src/features/intelligence/pregnancySafety.ts` - 4775 bytes - sha256 `9dc3a263a0de3661ed164c685dbef6494107ae7d494bfe3c37b40d2ed7fd276c`
- `apps/mobile/src/features/scheduler/cadence.test.ts` - 5506 bytes - sha256 `1340e95900d2cf7ce9df0d8c9890c54bd12d661b20ad30b9308cff6719c62c5d`
- `apps/mobile/src/features/scheduler/cadence.ts` - 2891 bytes - sha256 `0c46957a5a49577fdb6808cea95802834a8b5c5f2df50600d4ce93c00a0f8f6d`
- `apps/mobile/src/features/scheduler/classes.ts` - 3586 bytes - sha256 `84f04b38aa881075b1a655f809ed83dd9f431d978a40b19942061c60027eb45c`
- `apps/mobile/src/features/scheduler/customCycle.test.ts` - 9291 bytes - sha256 `9cec61bc36016b5c2acc6afeaff48b37cae861271141203520574ea3399f8e14`
- `apps/mobile/src/features/scheduler/customCycle.ts` - 13146 bytes - sha256 `3e6fc08ddf8813933f5e07216fc04c411d7683a44f3761b33b82132f95ee9cda`
- `apps/mobile/src/features/scheduler/CycleMutationError.tsx` - 685 bytes - sha256 `e8b9e8ed76aa9397a387cdfa718edf9d78569522166a5b5aeb267afff69aee81`
- `apps/mobile/src/features/scheduler/cycleStore.test.ts` - 26038 bytes - sha256 `50683374e860600be6d785014002a1c3e75c4c163f6cbfb0f74da31063f23340`
- `apps/mobile/src/features/scheduler/cycleStore.ts` - 21910 bytes - sha256 `9a32efad1c33138c1cc31ba8f21aca5f9a748a1ce767ac317ce311ca6cf0e964`
- `apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts` - 21836 bytes - sha256 `19b56bbd139d44d5ea04ebc37d33c132b6f212156ce071e0d302ae0d39ee9ab0`
- `apps/mobile/src/features/scheduler/orchestrate.test.ts` - 19682 bytes - sha256 `613be5b855e6a975da9e39002c74e1069bae65ac906d7a2f351807e08ad3048a`
- `apps/mobile/src/features/scheduler/orchestrate.ts` - 13381 bytes - sha256 `9232e7a8b8f8a92de9e871dcf806ada0776a96eb527289c5c1476ec2452286a8`
- `apps/mobile/src/features/scheduler/profile.test.ts` - 10906 bytes - sha256 `ca69bfb059f6d8d608574c05c49b88097afa69895bc6963c4823e766a1549985`
- `apps/mobile/src/features/scheduler/profile.ts` - 6605 bytes - sha256 `a29854d4894bd7920c0b050bcfe61ea066563cdf9df188ea717d7efb9a70cad2`
- `apps/mobile/src/features/scheduler/profileMapping.ts` - 1581 bytes - sha256 `c1d8c721369827d11fa52f86373fc01f0c7df0a5ee71c58a05ba80d72bf0a5e5`
- `apps/mobile/src/features/scheduler/projection.test.ts` - 4592 bytes - sha256 `1a82f286a581851bee7f06df68d0eb629380b23037c45ed066a05c0c6be44cfe`
- `apps/mobile/src/features/scheduler/projection.ts` - 3918 bytes - sha256 `8d5e9983dd125f4f1438534f6aec7f855f2d9f8ccb0189b56ac6dd6e31443782`
- `apps/mobile/src/features/scheduler/useCycle.test.ts` - 5793 bytes - sha256 `4c8cf39be7570a795ac64b8abd256b5113acda5ead6e91bb802b87a914786541`
- `apps/mobile/src/features/scheduler/useCycle.ts` - 12284 bytes - sha256 `5206dc3e8cd31cea4b8933daa4d6ca1f5c2efa7808c2322c6d70705cd72c9fd9`
- `apps/mobile/src/features/scheduler/useCycleAnalytics.test.ts` - 805 bytes - sha256 `ac98d3eb19e85d67dfd368b06189c7e6b76ac23557de92918db68b4d40c56fed`
- `apps/mobile/src/features/recommendations/engine.ts` - 24385 bytes - sha256 `09d3eb6119b68909c9d34d23ddacf6c2ee9d79e0d35ecf277353c68d8b8224c3`

### cosmeticChemistry - Smart shelf labels

- Worklist ID: `cosmeticChemistry:smart-shelf-labels`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `b95ff4e0f8983b2e057f22bc01eb4af9e1826da46869cdad994d0a5fa03f3f49`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm terms are cosmetic, not medical.

Sources:

- `apps/mobile/src/features/shelf/analytics.test.ts` - 543 bytes - sha256 `fce0e7cd2128b9c01644369a7dde86d178f44aaa80b0c7f9a58079ab08d4cc17`
- `apps/mobile/src/features/shelf/analytics.ts` - 599 bytes - sha256 `1e514f5fc1a96111a8b792dc8841ad41a11130dd6de7031eb08a353f85ef1050`
- `apps/mobile/src/features/shelf/catalogLookupRecovery.test.ts` - 8320 bytes - sha256 `5991b1ce3ea47e81841235c5845ca632ed3c719777365f6af9865ff10fe8bd50`
- `apps/mobile/src/features/shelf/catalogLookupRecovery.ts` - 7625 bytes - sha256 `aafbea137610e42b8d6df23c18f1e93731d78840a8017e3c577c02acf9ee0247`
- `apps/mobile/src/features/shelf/catalogRecoveryAsync.test.ts` - 13379 bytes - sha256 `130d79a4beebd7dc7ada42b78a90a9233b1b5bcdbad7d2f24cab7667e64f350a`
- `apps/mobile/src/features/shelf/categories.test.ts` - 1325 bytes - sha256 `a6f69552408d01ddfd0f5d44d0c296101f77eda35f0affcbbde580d3dd950a42`
- `apps/mobile/src/features/shelf/categories.ts` - 2390 bytes - sha256 `922060ab9c10baa353a89dc69f9d107cc1ff0b91fed280dc47b0c5eb485f5911`
- `apps/mobile/src/features/shelf/expiry.test.ts` - 2602 bytes - sha256 `dca407f4572147d1368e0f2b108e4a59ed2bb0f63e541bdeb0f1264bbb73d952`
- `apps/mobile/src/features/shelf/expiry.ts` - 2778 bytes - sha256 `43e97ea2d296532af742bd23643e9ca48ed0193d756ba5c163f421703a15508d`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 8353 bytes - sha256 `a7ec4652c8a3cff995038511eec95f31e3d0045cf99d4597f78c58daee44364e`
- `apps/mobile/src/features/shelf/freshness.ts` - 7299 bytes - sha256 `be0997619e57b575d84169f1c47bbf00bbb61e811a393ce04eff586b5b14b77e`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 4858 bytes - sha256 `03808fae36a3a74134bcda3d5db0e729729dcde2653b0331a7d481a5a71f9689`
- `apps/mobile/src/features/shelf/IntakeContext.test.ts` - 2193 bytes - sha256 `9bc6f78dec650d85c5580cb691206733882b43f719f32faae937f140bbb2a859`
- `apps/mobile/src/features/shelf/IntakeContext.tsx` - 2707 bytes - sha256 `e0cd87f56b16cb77fcc474b06050235bc72c732108c82c0316d09bc72411b3a4`
- `apps/mobile/src/features/shelf/intakeSession.ts` - 2846 bytes - sha256 `1c6239702337c9a30cd10e0611ef0087014be56c6bc917c48a0245f553da0710`
- `apps/mobile/src/features/shelf/labels.test.ts` - 911 bytes - sha256 `2ba7c9f148da2c53095451e9a9dee151446950a4f60ec52ccc08a0f20d2a9c6f`
- `apps/mobile/src/features/shelf/labels.ts` - 978 bytes - sha256 `8106cbcfb4d79040f6547234f9afcc2627b9adaa0ce529789544085b5f6ed679`
- `apps/mobile/src/features/shelf/limits.ts` - 222 bytes - sha256 `8f469d2cafccc1f3ebb14b4ac4e09951d4e58ab63df7bea88c4906a3b8aa8449`
- `apps/mobile/src/features/shelf/LocalDateField.tsx` - 1878 bytes - sha256 `e5cf3e8c0700e99944dcf1d515e511d4d78464277643599a6ba704daec7b9503`
- `apps/mobile/src/features/shelf/metadata.ts` - 1606 bytes - sha256 `e7da08df3d733c91f2464b7de96fdabbfa45c283fbf47659d1e2996821f16546`
- `apps/mobile/src/features/shelf/mutations.ts` - 4655 bytes - sha256 `13dfde9b8a5490f67b5269271ae0bdf6bb3910ba5b55b4db60560690d7a56eac`
- `apps/mobile/src/features/shelf/pairedConflicts.ts` - 766 bytes - sha256 `eb4cc3b857828ae8d123890b0771a44fe57e73e29da3e6207604fd3ed640a918`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 508 bytes - sha256 `dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3`
- `apps/mobile/src/features/shelf/scanLog.test.ts` - 4009 bytes - sha256 `5fbd9506ee53dc6908b7839a4c4f2bcecfaeb6b2f7748ba49fc7a125b9e773c2`
- `apps/mobile/src/features/shelf/scanLog.ts` - 1527 bytes - sha256 `4f27c7914c0147f85d4bc7f6a800e6bf013b808a17f3a5eea4dd574baf212f20`
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts` - 69844 bytes - sha256 `4e25d81e10f9bba5eead0e597eaabec9f1e459600b73bc922fe8bb75528d3a71`
- `apps/mobile/src/features/shelf/store.test.ts` - 57329 bytes - sha256 `c000ac66f164e1a2118cd5fe153f32a8c6565388534319825bfb0728cec29e02`
- `apps/mobile/src/features/shelf/store.ts` - 58796 bytes - sha256 `218dd66ae24c4e301b476fe878ddcfc614e9acb435045a1571375ee399893d15`
- `apps/mobile/src/features/shelf/useShelf.test.ts` - 5075 bytes - sha256 `2aa0f2717f781bdf8836d451df432e577ab157fa5e0799f2ab674e87b163aea9`
- `apps/mobile/src/features/shelf/useShelf.ts` - 10545 bytes - sha256 `060113bd3a3af609cae6cf0d022bfcbe5292e71cd7cc91e4fac6c93d4608c9ec`

### privacySecurity - Health-data consent and withdrawal

- Worklist ID: `privacySecurity:health-data-consent-and-withdrawal`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `c64d441848d3d7f4ac8a385985453fb094b913175fb8a210a6a78d0a838d033d`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review age -> consent -> goals ordering; immediate local/server freeze; exact deletion/preservation scope; legacy users; terminal-only fresh reconsent; installed-client rollout; minimized receipt retention; Supabase backup/restore; processor versioning; and final consumer-health notice.

Sources:

- `docs/phase-3/consent-matrix.md` - 17993 bytes - sha256 `2ec41501d4fbd98e55f8edb4b7d83a9bd92ff8e5973f6eb37bd5117274d42342`
- `docs/store-privacy-inventory.md` - 41308 bytes - sha256 `27ad6d8ef6f9a1702dc42cb7464f05f5eb872d8cc57177cf521de95520632ad5`
- `docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md` - 37059 bytes - sha256 `c7fcaeb47bd9a53591c8f5b1a0dd78bbfb9045c54588cc382a27a27ed6120289`
- `docs/hugeToDo/health-processor-inventory-v1.json` - 3386 bytes - sha256 `491c5389e410aae42006b22705bb5c6426c813d048c47b10dec131c3b897801a`
- `docs/hugeToDo/credential-inventory.json` - 21138 bytes - sha256 `245be60b517158b1acea43635eab87f113d5cf70dd1009303dfee7dc1e1bda31`
- `apps/mobile/src/features/onboarding/consentCopy.ts` - 5658 bytes - sha256 `6e0cc1d6de3cad0b84c5cdb7463ed8b171820a9e436d5075f3b54623e6a47034`
- `apps/mobile/src/features/onboarding/healthConsentStore.ts` - 7274 bytes - sha256 `3a9356ffd904a36fc034b5650f98f932f0517a3dc2ed4532e774787e57ea92e3`
- `apps/mobile/src/features/scheduler/profile.ts` - 6605 bytes - sha256 `a29854d4894bd7920c0b050bcfe61ea066563cdf9df188ea717d7efb9a70cad2`
- `apps/mobile/src/features/healthConsent/activationInterlock.test.ts` - 7300 bytes - sha256 `56ae9f642fb7b71eed61d3fbbaa1c3345791688435c265a46c6dd5a22a072312`
- `apps/mobile/src/features/healthConsent/activationInterlock.ts` - 4493 bytes - sha256 `bc07baebb5133b36e5a6cdec09e76f9776442f4c6261090b0f82e219a0f5d0e1`
- `apps/mobile/src/features/healthConsent/dependentConsentCleanup.test.ts` - 5254 bytes - sha256 `27803a00d46eccaecec0703145dbf2b4a77fc0a700dd26a37b6ec9521c1970b6`
- `apps/mobile/src/features/healthConsent/HealthDataActivationMount.test.ts` - 6015 bytes - sha256 `959dc00e71eaf0053908c2ad3095177b9dab19d535ea21e3549f9d76ec1bd8b7`
- `apps/mobile/src/features/healthConsent/HealthDataActivationMount.tsx` - 3261 bytes - sha256 `aef498d084e3233bba3ed43315193e52a3b308e5a6d0f37108cb66ea3c114611`
- `apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts` - 6504 bytes - sha256 `f56e2bbb8c971ac55fa0f677c351f3a1bbd323a981f0ce15fbba4dc61b446f71`
- `apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx` - 31585 bytes - sha256 `9caaf70078a24d3aacec87691bbe56a73314726d3c2f89edad33f340079478a9`
- `apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts` - 12568 bytes - sha256 `164120b5e44c20a2b720fb5f2bcb85a579deda5623a401bb09b121f9e58896ab`
- `apps/mobile/src/features/healthConsent/lifecycle.test.ts` - 39974 bytes - sha256 `18c32b54a3a1aa8a59a070063fb17b853c2959e0a6e638bfb91212866f374131`
- `apps/mobile/src/features/healthConsent/lifecycle.ts` - 49646 bytes - sha256 `61600ff6922302e2c1e3cd3be52684c325e8801e8c032e3abad771dcbfa4fc44`
- `apps/mobile/src/features/healthConsent/lifecycleStore.test.ts` - 10605 bytes - sha256 `a52d02d42957b1a1369af986d7e7acd488ae4a39d889102df5f021660a3f2961`
- `apps/mobile/src/features/healthConsent/lifecycleStore.ts` - 14125 bytes - sha256 `65e44e82a8a2ffe9097dc3d8bfe851e364d2cf65d25b69a7647a21b02e53181c`
- `apps/mobile/src/features/healthConsent/pendingIntent.test.ts` - 4902 bytes - sha256 `08bda804575082a5ad01d867e4127778cb5a06aded020942d05f3cdf2f1eec03`
- `apps/mobile/src/features/healthConsent/pendingIntent.ts` - 12028 bytes - sha256 `35882885fc019269565cb862b158580534d506c09952cd926192309f14a63b7d`
- `apps/mobile/src/features/healthConsent/remote.test.ts` - 6342 bytes - sha256 `40eaaca9c431ae3ffa95d511b0b0b120eac2afeb2ea907a87f554f0b5a389b09`
- `apps/mobile/src/features/healthConsent/remote.ts` - 11387 bytes - sha256 `fa3f68c0e4a7f27a1f9c61047def0af034365c8b63f289d34527ab42b3aa7677`
- `apps/mobile/src/features/healthConsent/selectiveCleanup.test.ts` - 9432 bytes - sha256 `0f3f77f32bd7a72991dcfbb3d42981c6f086db09580fa652affafcf0902bab96`
- `apps/mobile/src/features/healthConsent/selectiveCleanup.ts` - 6449 bytes - sha256 `06c7c5d8c7129d01d28ff258339e09ff114d5f8077fe35462832cb52380aee71`
- `apps/mobile/src/lib/consent/consent.test.ts` - 10641 bytes - sha256 `13de0b484f39b7803eb586fddb2e1bb7af02087affe1a5d05b8aafe87be53f5a`
- `apps/mobile/src/lib/consent/consent.ts` - 10426 bytes - sha256 `83bef9b4cefbe4204a06170b789beb4c05c4ea097c4b8682759de1c86b894cad`
- `apps/mobile/src/lib/consent/dependentConsentContract.test.ts` - 2510 bytes - sha256 `a7faed8bd978c885bcaba4810d595341a08477233092572a02fbdd5a852bdcee`
- `apps/mobile/src/lib/consent/dependentConsentContract.ts` - 8999 bytes - sha256 `d6c24513171d35ad9c422a487d8331bed9013729b340348643962cbf46bb7c2d`
- `apps/mobile/src/lib/consent/dependentConsentLease.test.ts` - 4906 bytes - sha256 `0c1be5223c3ea5b5e37347e9267bc83c720b2f06b18540e1ea5c7b4742c3e8b2`
- `apps/mobile/src/lib/consent/dependentConsentLease.ts` - 11026 bytes - sha256 `e96ed2d6e79ae29b1ed9973a403dae323a368ce268c617c590823df09cf68f12`
- `apps/mobile/src/lib/consent/dependentConsentLifecycle.test.ts` - 17433 bytes - sha256 `10a4c82b11f68a11128bd2491d042e0745f777603278e3daaf5fa06209a4dac4`
- `apps/mobile/src/lib/consent/dependentConsentLifecycle.ts` - 25851 bytes - sha256 `ba0c425416000beb7aeebcacd90d792e7ae9bb7da1f93203d0fa6cdf06370baf`
- `apps/mobile/src/lib/consent/dependentConsentLocal.test.ts` - 6210 bytes - sha256 `d730f4466d46af2b5cc9e02482cd69b465db14433746e514ba7dc767cf0a8980`
- `apps/mobile/src/lib/consent/dependentConsentLocal.ts` - 10440 bytes - sha256 `29f59a4c2fc5a8b1550100e39f77b486b9201f260a7a7e692f3fff658f9e9123`
- `apps/mobile/src/lib/consent/dependentConsentRecoveryContract.ts` - 437 bytes - sha256 `887d9ef0185d8f716cf4b10ed6862cdbab852b7caf981a9c2007fb68df70a7e9`
- `apps/mobile/src/lib/consent/dependentConsentRecoveryStore.test.ts` - 4062 bytes - sha256 `e88568775306a98cce3d7ea60502d1e8be92f416f25f43e745a5c3f9412dba34`
- `apps/mobile/src/lib/consent/dependentConsentRecoveryStore.ts` - 5375 bytes - sha256 `480c05e2c5e13e2d8d54bcc94e7371320a17383f54b52eeab5b981d945dba91e`
- `apps/mobile/src/lib/consent/dependentConsentTransport.test.ts` - 4757 bytes - sha256 `3bd97c342b3950e38ad7aae57e3444911a1c826d4702a54073226b7a01a353ea`
- `apps/mobile/src/lib/consent/healthDataWriteAdmission.test.ts` - 6586 bytes - sha256 `94a92e7970e8caba3fedae3ed3a160541c8c83122aaa54c5bdc97dff85dfab6f`
- `apps/mobile/src/lib/consent/healthDataWriteAdmission.ts` - 5969 bytes - sha256 `f2b5741c792e52a2838f6b3344c084f2093163c332b67f21d485b95993ba51f6`
- `apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts` - 11623 bytes - sha256 `862fa0aba3d6153c257203e4a532361315e994852bc3294aac0ef4fb2bd11f3c`
- `apps/mobile/src/lib/consent/healthProcessingEpoch.test.ts` - 23000 bytes - sha256 `c2f9f6ee09c1513a1c47324c5009af5c861afed6fa957c5ecfaa16ca99a79b06`
- `apps/mobile/src/lib/consent/healthProcessingEpoch.ts` - 19927 bytes - sha256 `1b0af9d43eae6b98e7ffa633457910cef695c778f3f428d9b5a6b7b8c3b6407d`
- `apps/mobile/src/lib/consent/withdrawal.test.ts` - 13554 bytes - sha256 `a8756f43ce2e8cd74c32d0cb1432e58844f0dcbe1f506549f015e4f985838df6`
- `apps/mobile/src/lib/consent/withdrawal.ts` - 10772 bytes - sha256 `b7d21990c41149b67ffc4654fc1aa6a0a9d730d5d762a0a3a3508389635c229f`
- `apps/mobile/src/features/settings/actions.ts` - 21568 bytes - sha256 `44b97e2c1ccc41ff4b44225d474744b3df797e00ecefdbb7cf4334ac9e35101d`
- `supabase/functions/consent-withdrawal/index.ts` - 10637 bytes - sha256 `96ebbcf4dfc9f5d4d12c38871706f82ff0d4618546041acca85b804ee8631d99`
- `supabase/functions/consent-withdrawal/healthLifecycleCore.ts` - 20351 bytes - sha256 `25d76ec364824bbff6dc69346471ac87bcfcbc5a0de78db9e75e45ffa0e6b3af`
- `supabase/functions/health-consent-worker/combinedWorkerCore.test.ts` - 2190 bytes - sha256 `653fe3dce6575ba1e3814dc8f2eb56536b96761ae5e4521110904b3ed5f0d89b`
- `supabase/functions/health-consent-worker/combinedWorkerCore.ts` - 2121 bytes - sha256 `280379691c708b09a2e229df23a811faf36949aa37163961a7c7977621829a3b`
- `supabase/functions/health-consent-worker/dependentWorkerCore.test.ts` - 15717 bytes - sha256 `91374f0dbfd95d1d2758097370c54353ee059e93e13c178564f1188add0e2545`
- `supabase/functions/health-consent-worker/dependentWorkerCore.ts` - 16907 bytes - sha256 `22c67e77b0817ccbf33e4795a8ed7aabfe1d2903cf69d486a2e8552dd8ad86d6`
- `supabase/functions/health-consent-worker/httpHandler.test.ts` - 4400 bytes - sha256 `c59cfe60a470b03481f57d6db10b42b6d49c517a000e3a0c16f4454c84e27f2c`
- `supabase/functions/health-consent-worker/httpHandler.ts` - 3424 bytes - sha256 `733fa7d440cd2e57474e19f36bfac1605afe22714ecb3d8caf732d6ae1cfb1fe`
- `supabase/functions/health-consent-worker/index.ts` - 6570 bytes - sha256 `007625709369e66ef26fe7f9ec3d5ec2846108a63e0b2e5414925bb4d4d04963`
- `supabase/functions/health-consent-worker/workerCore.test.ts` - 13267 bytes - sha256 `028b66b1cfd00f38b80afa5cda514e0251716eabfe50b5f4329698ce37a32f27`
- `supabase/functions/health-consent-worker/workerCore.ts` - 14560 bytes - sha256 `c2dc458dfffc1d410833c1c73284fc3d45750df1a7cd38364e6b798c5144790c`
- `supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql` - 238933 bytes - sha256 `8bee91bcaedd3909b2f033ddbce47f1960e366fa30d6442a10b889941f3ad524`
- `supabase/ops/health-consent-work-lane.sql` - 2818 bytes - sha256 `4b338d4eccf85d7f2b3d0ffc418d4bb68c9843b538e45c4e07aa406f9c79b6a7`
- `scripts/phase9/health-consent-work-lane-smoke.mjs` - 6108 bytes - sha256 `8f50cad610a17394264d2382a2909b2a2ce09989395bd19fe22e4002f6cd784c`
- `scripts/phase9/health-processor-inventory-smoke.mjs` - 7698 bytes - sha256 `b002a39a771c92be4fe9df8b4e4d74ab0bf058d86be9b60ba6e61430529d3c21`

### privacySecurity - Photo privacy and local storage

- Worklist ID: `privacySecurity:photo-privacy-and-local-storage`
- Status: Not cleared
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `56652dbc584f94b62f9fb05b9c3e47c1dcb6b720a708830185252cd8e9071faa`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Physical-device encryption/restart/delete and explicit-share-only posture.

Sources:

- `docs/06-photo-progress.md` - 49432 bytes - sha256 `6f27bf72cb232e7e2ed251c45a38b1900984c0b5efe7f3eaf6e4dddda34ad3b4`
- `apps/mobile/src/features/photos/consent.ts` - 1267 bytes - sha256 `2349c73a64860f76611e7e72017bdd15de7a3bf068e348bcfdc39cd977a72100`
- `apps/mobile/src/features/photos/encryptedStorage.ts` - 25272 bytes - sha256 `6095256304aeebab4b7be41ddaea52002cfdc3a87c4ed8ce9b4f3dceeb7c4fd5`
- `apps/mobile/src/features/photos/store.ts` - 20362 bytes - sha256 `015473bbe02b850a161c98cd9f219dafae42e80e716e08506407649ce448e82f`

### privacySecurity - Trend and cloud-backup consent

- Worklist ID: `privacySecurity:trend-and-cloud-backup-consent`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `335fb7a65917d3d35788522b794e6ed6f5a818cd3c7c1172dc3de34f61ec4dbc`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review the future real-engine data flow, separate exact consent, installed-base reconsent, inference classification, retention/backup/export/deletion, local-only archive/network proof, fairness, incident response, and App Privacy answers. Source refusal is not clearance.

Sources:

- `apps/mobile/src/features/trend/applyConsentChoice.test.ts` - 1828 bytes - sha256 `45a12c3ef0f7cb17830606f98365e59b77111f7e9e45241f2c1aa1539c80c14e`
- `apps/mobile/src/features/trend/applyConsentChoice.ts` - 637 bytes - sha256 `3b960048debd59e0a0669167c408025159ad67cfd3f62076700fe78bcd429124`
- `apps/mobile/src/features/trend/claimsafety.test.ts` - 5935 bytes - sha256 `72b6e24abefe92212523ecfe62877adea6ab0111870c1cd6a8f252591ac2cf0e`
- `apps/mobile/src/features/trend/consent.test.ts` - 2518 bytes - sha256 `c8d5b14e464359308cc39cf16f880e77cff2184e0f0da36814256d9d937fb3ce`
- `apps/mobile/src/features/trend/consent.ts` - 1227 bytes - sha256 `a4e37054dfc470c935ec45249c8f2bb58d75d5c55407dc3b238b9f1d6e055106`
- `apps/mobile/src/features/trend/copy.ts` - 5381 bytes - sha256 `804c809a7f3acdebf3293fdb738d18524e6e3aa8095e78c0f00de0cf8cfc9318`
- `apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts` - 3420 bytes - sha256 `71eec188c7b7135d067ce1313be73dc4df8be5afc02fe3ec655fe44a81dac802`
- `apps/mobile/src/features/trend/store.test.ts` - 2466 bytes - sha256 `ba5aff392e2b0cec9abf07ecf89a8b14415ff5923795f484990e42bfe2c06ad3`
- `apps/mobile/src/features/trend/store.ts` - 2119 bytes - sha256 `7dff9753d4e1d2334a9e4b82be2eea727f8a16b5967051beeaefcffe69a7dc0e`
- `apps/mobile/src/features/trend/trend.test.ts` - 3224 bytes - sha256 `797f4e43ac5724fce8c6df388bdd6c84514ff8a10626f6c7866b8fb47bf3733b`
- `apps/mobile/src/features/trend/trend.ts` - 3598 bytes - sha256 `3a7c314b74b0ff8e166f1aa55f710745ad6d743793bc5f65441c1675d7aeb24d`
- `apps/mobile/src/features/trend/TrendInsight.tsx` - 462 bytes - sha256 `0cb5fe60f475a09c85e89b5aea4dd8a5f0092b90f87191605c958f8d760723c5`
- `apps/mobile/src/features/trend/trendRoutes.test.ts` - 2544 bytes - sha256 `a74a7c0516aa57fb610e0339d85a740505fe8f203f30d7f93f5e1713ddcf298a`
- `apps/mobile/src/features/trend/useTrend.test.ts` - 3959 bytes - sha256 `0900e378011668323b49eb2cd6a2054dfd7393ed62efa808badce8cf7fe72f72`
- `apps/mobile/src/features/trend/useTrend.ts` - 2605 bytes - sha256 `f66040eaa2090ad36f2b35244e6c70814f6709981448e5210b5577ec71d98f75`
- `apps/mobile/src/features/photos/consent.ts` - 1267 bytes - sha256 `2349c73a64860f76611e7e72017bdd15de7a3bf068e348bcfdc39cd977a72100`
- `docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md` - 21446 bytes - sha256 `1e1f85728bcea9e473bbe010f9f6bf0930b4c14f196a67378c6fc2ae6db359c3`

### privacySecurity - Ask, commerce, and community consent

- Worklist ID: `privacySecurity:ask-commerce-and-community-consent`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `d7cfefa6fd371e85ffc60752cce679feec2fe0034b98d1fa03cd8fa2217ee2e3`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Vendor/partner sharing and withdrawal copy must be reviewed.

Sources:

- `apps/mobile/src/features/ask/consent.ts` - 833 bytes - sha256 `ba732d8c83bd8951f2c33a11ef7555bd2d6ee23dd1b02d6bfb8de20cd219885b`
- `apps/mobile/src/features/commerce/consent.ts` - 1095 bytes - sha256 `80f0f30cacc7c0de3393568bb6fa4c23c703eccdba0c658788732cb1a66a73bd`
- `apps/mobile/src/features/community/consent.ts` - 1121 bytes - sha256 `9bacdd40ad62d380a482bb4de5f911c62b87a03002d95ac8b4f4fb7d6a2ae8c6`
- `docs/phase-3/consent-matrix.md` - 17993 bytes - sha256 `2ec41501d4fbd98e55f8edb4b7d83a9bd92ff8e5973f6eb37bd5117274d42342`

### privacySecurity - Account deletion and data export

- Worklist ID: `privacySecurity:account-deletion-and-data-export`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `d0b1b667332ed24e2eff3706b6edd26edecfcf009f48abbbbd765325f149630f`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Must prove owner-scoped staging server data, seeded local coverage, reverse-trial/service-event completeness, deletion/vendor scrubbing, redaction, and native cache cleanup.

Sources:

- `apps/mobile/src/features/settings/actions.ts` - 21568 bytes - sha256 `44b97e2c1ccc41ff4b44225d474744b3df797e00ecefdbb7cf4334ac9e35101d`
- `apps/mobile/src/features/settings/localDeviceExport.ts` - 13610 bytes - sha256 `9d41820db49c478fd0b6694ca5e58aec595e45a8ad67dd87a7e4d1fe6aa0c543`
- `apps/mobile/src/features/settings/localDeviceExport.test.ts` - 18393 bytes - sha256 `f266600513dd70ed77e045ea92ce3cff1d47506ba8fdbb151c543677beaebf4d`
- `apps/mobile/src/lib/storage/privateKV.ts` - 29437 bytes - sha256 `bef7441b904f59d7ba3cb8e96aa9642ecb3d23705076aa6ab58d73118dd04560`
- `apps/mobile/src/lib/storage/privateKV.test.ts` - 42903 bytes - sha256 `3c6b5292d1f33c4b0716da18c5912bc0aad329c130af9178ed94ca397f1585a4`
- `apps/mobile/src/lib/legal/policyLinks.ts` - 722 bytes - sha256 `0fe9cf269e6b5e48119771f7b111d1620c095ffe35bb6ac56f63c2cd2ec1c863`
- `supabase/functions/account-deletion/index.ts` - 1722 bytes - sha256 `d4fd2917de31d91d010788a3c45d390de61fefd770f090ff5f1242f385b2f7f2`
- `supabase/functions/data-export/index.ts` - 26103 bytes - sha256 `697f4541c384bad710072eac220e0e53160496536e1d4c550403fe7606655945`
- `supabase/functions/data-export/exportCore.ts` - 16680 bytes - sha256 `fafb4de7b05491d1f667253d50a9189fc0d6ff21d9c0d11c0666db76f9924875`
- `supabase/functions/data-export/exportCore.test.ts` - 13951 bytes - sha256 `549c69b091c2e38e6d2a980aa1c3f5ad7f2434b5e5837188beb46363803f9d63`
- `supabase/functions/data-export/exportRegistry.ts` - 10203 bytes - sha256 `bd73ec992a056cafebd21897147d02df37bd66b7545784c06ca797b9998a4ca0`
- `supabase/functions/data-export/exportRegistry.test.ts` - 10778 bytes - sha256 `118c081db46604ecfe9e02c2a27db5d7feb107822e5a49f37ff6756273e13b4a`
- `scripts/phase9/data-rights-smoke.mjs` - 76753 bytes - sha256 `49e02e7c1ac01ea39842bfef995317146831d389c06395ba2f23fa0511a966c2`
- `supabase/functions/_shared/storagePath.ts` - 591 bytes - sha256 `9367ade3719c7b7e38a7b090da7d904dd574bb43e29222bf5e8a839d3b377594`
- `supabase/functions/_shared/storagePath.test.ts` - 1355 bytes - sha256 `3caf9cbb38b676c4a96dd9ae3f19479c205a90d31bb83fee7c7474bc76a2a2e9`

### privacySecurity - Analytics and crash payloads

- Worklist ID: `privacySecurity:analytics-and-crash-payloads`
- Status: Not cleared
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `330c1a9245d3f46ec4445da71e2a02d9734905dab1bbeec057caf975e1ae2713`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: PostHog/Sentry setup, deletion process, source maps, and payload approval.

Sources:

- `apps/mobile/src/lib/analytics/eventRegistry.ts` - 6099 bytes - sha256 `51de958c223a1b32cf5d6fffdfff03ac1631bbfe9735de41995b084a90f23f53`
- `apps/mobile/src/lib/analytics/postHogPersistenceCleanup.test.ts` - 3763 bytes - sha256 `e215e3d84ff7e68abfadcfdab15f3e44d23365d436ede7e28361d2335c3760b8`
- `apps/mobile/src/lib/analytics/postHogPersistenceCleanup.ts` - 3542 bytes - sha256 `bc1c70b3507f3761171d9e6a1e613e7225421597b08738f47d588d1244858297`
- `apps/mobile/src/lib/analytics/postHogPersistenceSourceContract.test.ts` - 2241 bytes - sha256 `f87bb5e703f21c0223e3869310207242e8ca9e733bbabd6bbec06173f2035cd9`
- `apps/mobile/src/lib/analytics/productionTransportSourceContract.test.ts` - 1755 bytes - sha256 `ea60911ee29c1fd1d8a98a00767b54ef8bd153669bef6674f953331dc5888b01`
- `apps/mobile/src/lib/analytics/publicationGate.test.ts` - 6558 bytes - sha256 `ee6fb2d875a93acd2ab9f70c8a72a89a26afac4b7da1b9119eee796f11c350b8`
- `apps/mobile/src/lib/analytics/publicationGate.ts` - 3666 bytes - sha256 `5051e26e15cfb6643e8d4036051f2116b38943a062c3d08dd6a493cd0c259e36`
- `apps/mobile/src/lib/analytics/track.test.ts` - 23247 bytes - sha256 `2cf464437484710a79aa0392353bf4a77cf3a6eced7e374b6d1d3a7736599420`
- `apps/mobile/src/lib/analytics/track.ts` - 10499 bytes - sha256 `3087aac6c5d81fd34e070c2ee0fab7107e9fd911113c93febd3e3b9385c293ef`
- `apps/mobile/src/lib/observability/operationTiming.test.ts` - 2060 bytes - sha256 `a8d991ac951e2b93df2f3c16cf3d29b1fa0fe31d691a43d35f9a4367c2eddf68`
- `apps/mobile/src/lib/observability/operationTiming.ts` - 3433 bytes - sha256 `7a6ef4fa35effdad96b173caf1bcbafe149446daff3441a87e6841389f8b81d4`
- `apps/mobile/src/lib/observability/safeLog.test.ts` - 1553 bytes - sha256 `aeb56fc596436406245dd5abc2479c62ece48475201a972f1c83d505be245a21`
- `apps/mobile/src/lib/observability/safeLog.ts` - 674 bytes - sha256 `9be726f4471c30b6a6dec06c5f9075ec5e184182a12ae6dfdfa9cf275e4a0954`
- `apps/mobile/src/lib/observability/scrub.test.ts` - 2866 bytes - sha256 `3cfd91c4cc5b486d40fcb22bd5f67393f162154166162ffa540fe9931e2f1b0e`
- `apps/mobile/src/lib/observability/scrub.ts` - 3191 bytes - sha256 `ad231f592848825dbeaffcbd960a31e0ae916fe7e1916ded939e9b0f79deabed`
- `apps/mobile/src/lib/observability/sentry.test.ts` - 4915 bytes - sha256 `89b25d7a9934a167c8dd57d603ce94a9f5c56753c976af00eb8b442c526232af`
- `apps/mobile/src/lib/observability/sentry.ts` - 3603 bytes - sha256 `591ffcd81e9f012aaeacc4bc55c769d001d657b626b10f9a2a6fa2668e9aa2ed`
- `apps/mobile/src/lib/observability/startupInstrumentation.test.ts` - 922 bytes - sha256 `48cfcaf78e54fd4d8c25c8f6af7e0999d18537ec8f717ce5a736cb3ebca6de37`
- `supabase/functions/growth-event/index.ts` - 9910 bytes - sha256 `af59ae32fabd9310558274109db8cdd53455d09dc26074efb4758373f63a1770`

### privacySecurity - Auth and processor posture

- Worklist ID: `privacySecurity:auth-and-processor-posture`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `2d36da6647b9149e36004982c0680dbf7b89898ca943da8c8cbf0cd0e169ee2f`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Verify Apple/Google auth, Supabase DPA/region/backups, observed SDK traffic, processor/subprocessor contracts, HBNR posture, breach contacts, retention, deletion APIs, and RLS.

Sources:

- `apps/mobile/src/lib/auth/accountDeletionBarrier.test.ts` - 11926 bytes - sha256 `f6deaafa6e593ee1659449f9d47139e29463e5e130512a09f627953b43c96208`
- `apps/mobile/src/lib/auth/accountDeletionBarrier.ts` - 6939 bytes - sha256 `7045ae7ea23756bb9fd42d5cf19f7552a2adc95b8044e0f146f3b1409fa6f593`
- `apps/mobile/src/lib/auth/accountDeletionBarrierAuthProviderContracts.test.ts` - 6034 bytes - sha256 `5d77260cca93df3ac9c656caeaf5e00e4662657fbb399f8fa3849d731428f9fd`
- `apps/mobile/src/lib/auth/accountDeletionPublication.integration.test.ts` - 21931 bytes - sha256 `4a4f8e2025dc0ada8d6c6b28b1dd41f4d0a39c9c715e06183a61c75e271d0ab1`
- `apps/mobile/src/lib/auth/accountGeneration.test.ts` - 6652 bytes - sha256 `d372f38fcf8f24a4c07c3b19e5b7b428ffc4a4d8837d24c065cfa36bfae849d1`
- `apps/mobile/src/lib/auth/accountGeneration.ts` - 5604 bytes - sha256 `aa0a702874069f12a968f4e7edbaa1a35ad5ac3487ffea25ac451d69c7553217`
- `apps/mobile/src/lib/auth/accountIsolationE2E.test.ts` - 1129 bytes - sha256 `797ceccaa982f888ce3c03b7fb36599a314b1614b1f910077b0906bfdc3671a9`
- `apps/mobile/src/lib/auth/accountIsolationE2E.ts` - 1358 bytes - sha256 `6a89dc564d1e760034b85f0a805a1f86f35607ae84f99c4ecb31acd681be4103`
- `apps/mobile/src/lib/auth/accountPublicationAuthProviderContracts.test.ts` - 8187 bytes - sha256 `11966c8e2bf5f3e3c62b059d9376cbf404374e8b01f146dde9342da02744cdfc`
- `apps/mobile/src/lib/auth/accountPublicationController.test.ts` - 26954 bytes - sha256 `a8b9c687dd13c96ea32f36800c3ca12a7a05d44afdfcf6b9691224a56bcd9f70`
- `apps/mobile/src/lib/auth/accountPublicationController.ts` - 25301 bytes - sha256 `2b0c95ad5fcd805f4771e53c000fea313619720862598e69dc7a112700005be1`
- `apps/mobile/src/lib/auth/accountPublicationFence.test.ts` - 8661 bytes - sha256 `7e8775ee1149d8704c41ff0687785071b9d25328c62637a192f223d8d075a80d`
- `apps/mobile/src/lib/auth/accountPublicationFence.ts` - 9017 bytes - sha256 `1f6fe33a95253bea834a87cdc1cf831a237264152498a1d3a0859353affbfd4b`
- `apps/mobile/src/lib/auth/accountSessionIsolationContracts.test.ts` - 6795 bytes - sha256 `f09d7fe15bcc790ce9dc837f07216374cf654e84390de22bdff4771e4726f0d3`
- `apps/mobile/src/lib/auth/accountUpgrade.test.ts` - 20379 bytes - sha256 `92898ecc3eee1c793f635428fae4ef39fa7e2ba063fda9c9fff5c37a76e11509`
- `apps/mobile/src/lib/auth/accountUpgrade.ts` - 9601 bytes - sha256 `2eb750806a98057b7b904f68d0b6bbfd32997aa7c5bf1bbd9a898fe2e17e7db7`
- `apps/mobile/src/lib/auth/accountUpgradeE2E.test.ts` - 886 bytes - sha256 `febfafcf0461723583c5caa25d00f4ecc25193bdde754d56ba3c8ff523b011d2`
- `apps/mobile/src/lib/auth/accountUpgradeE2E.ts` - 568 bytes - sha256 `7f73680156e6ccbc060b9a69ec345ba9ab205fd6a104770e1bc4689998a14ac0`
- `apps/mobile/src/lib/auth/apple.test.ts` - 9443 bytes - sha256 `24de675100b4388abbcec5c41242a79ed16ad3c48428287d5ea3216cf4d36b81`
- `apps/mobile/src/lib/auth/apple.ts` - 5302 bytes - sha256 `ba35fc4aa35ed8f15bf0bf6acf200f135e7fecbf6ab022bc1f9366754925c53f`
- `apps/mobile/src/lib/auth/appleAuthLifecycleClient.test.ts` - 5154 bytes - sha256 `1abdfa0b0744f5467978cf23fd30d2a3d4457d7940aad100ca4af644e4b8e207`
- `apps/mobile/src/lib/auth/appleAuthLifecycleClient.ts` - 4479 bytes - sha256 `110a51f259599138f96b2fc5809642855a1d2beed3d1c276d97bdc0d9746ab2f`
- `apps/mobile/src/lib/auth/appleCredentialAuthProviderContracts.test.ts` - 5632 bytes - sha256 `9ce0b7fe6a25b668e922314463aaf835f9fd79c511a54d1726467bfe7b6f91cb`
- `apps/mobile/src/lib/auth/appleCredentialLifecycle.test.ts` - 10962 bytes - sha256 `95d04026a8afc9db98fac7216c23c9e8dea72af1b3319569a21deb2e514f73ad`
- `apps/mobile/src/lib/auth/appleCredentialLifecycle.ts` - 9268 bytes - sha256 `a86c5529661c5f5ab60b393526854314f590045b2f233f6a843a5023bb928406`
- `apps/mobile/src/lib/auth/appleCredentialQuarantine.test.ts` - 1635 bytes - sha256 `3910b09fc11dab0db35e792eea87d89eb76d63d04c01cbfeadd1405fb411cd50`
- `apps/mobile/src/lib/auth/appleCredentialQuarantine.ts` - 751 bytes - sha256 `15fdc37f16cd24fdec374a7cb6591446e3f10ed0c3a74fec8712b4cfa073c8bd`
- `apps/mobile/src/lib/auth/appleSignInAuthProviderContracts.test.ts` - 1922 bytes - sha256 `ee95e0a9f619b910c6f18f9beffc351bfd672764d50bf157f97a8cb80279a43e`
- `apps/mobile/src/lib/auth/authDerivedCleanupAuthProviderContracts.test.ts` - 3206 bytes - sha256 `f87bb763c40d79063eb119f77ce625131a8788d89367a08d3da065bc59428fef`
- `apps/mobile/src/lib/auth/authDerivedCleanupRequired.test.ts` - 2680 bytes - sha256 `7e8eeb906cf972d5bfc397da41b5a923dd1de3ceb421a7cc9ae380b49f61e7ac`
- `apps/mobile/src/lib/auth/authDerivedCleanupRequired.ts` - 1000 bytes - sha256 `6d2515a760ad78aeba94ca0d51f4b13f84e141081aaac3f7d805c365344c30ea`
- `apps/mobile/src/lib/auth/AuthProvider.lifecycle.test.ts` - 90903 bytes - sha256 `7e8cb16b77b4cf5f2c54b28ab66bdf9ea0c9e33d615f46f49afcd30b562204ed`
- `apps/mobile/src/lib/auth/AuthProvider.tsx` - 104418 bytes - sha256 `3663f395c97b0d227db6f01f6ebe6c7c2b272bb9246e64d2935e1cf62020cbbc`
- `apps/mobile/src/lib/auth/firstSessionE2E.test.ts` - 2618 bytes - sha256 `dcdd0167f6affc8b5019fc1ed543103b32b6982ab415c1b474c14fdd38e61bab`
- `apps/mobile/src/lib/auth/firstSessionE2E.ts` - 3044 bytes - sha256 `e6cf469779905f6893532e9fee2ee913793ac026c850488b09c8329fd55ef008`
- `apps/mobile/src/lib/auth/firstSessionE2EAuthProviderContracts.test.ts` - 2188 bytes - sha256 `6c630526697442756bc8e2fb8cd99fa6bbacdd1bcb0f998a75e1609fbbdd9bac`
- `apps/mobile/src/lib/auth/google.ts` - 1092 bytes - sha256 `d00aa0a7244120297ab824dce61e627090c9618a6906a0a6689b88bb47749ea7`
- `apps/mobile/src/lib/auth/localAccountIsolation.test.ts` - 10246 bytes - sha256 `31c934fe2297e2fc7e81d190b2af08ce73e59e625e4fd6a51102d1772e31ab22`
- `apps/mobile/src/lib/auth/localAccountIsolation.ts` - 4831 bytes - sha256 `1af3f7888388489d53c7ce7a803d4ed657a182e48dba5a83a7b300ab4a527509`
- `apps/mobile/src/lib/auth/revokedCredentialActivity.test.ts` - 4294 bytes - sha256 `84ba1cd1399c52eec30611a3059040ff76b54643e6f5850d78f4272bf39e0642`
- `apps/mobile/src/lib/auth/revokedCredentialActivity.ts` - 2303 bytes - sha256 `6a8eba9cd60438dec56b9c78428e8cce1870cb4f2c9f42328ef63591ea441b8c`
- `apps/mobile/src/lib/auth/sessionBoundary.test.ts` - 2772 bytes - sha256 `2ce2f5bd3fb45167699943cc169f721d00cb3564b15e07922ee7a78a9706fd23`
- `apps/mobile/src/lib/auth/sessionBoundary.ts` - 1030 bytes - sha256 `2acc0133ab03722de56439e248b2fa1bb9ec4ca2fdb530e96ad7eebb04058b69`
- `apps/mobile/src/lib/auth/SessionBoundaryGate.tsx` - 2842 bytes - sha256 `005de09b4eb97cbd042b6a0a30c05265cbf7b2efba971e028d886780c1dcc138`
- `apps/mobile/src/lib/auth/sessionInvalidation.test.ts` - 5090 bytes - sha256 `bb9c16dccff2a8b540210f9687a6782e383cccedff99cf23007a45fe81126eb1`
- `apps/mobile/src/lib/auth/sessionInvalidation.ts` - 2806 bytes - sha256 `b0ce38d618a493f9cad444e1ae066c8266f869a2010ce520a6d55ed543db6cdc`
- `apps/mobile/src/lib/auth/sessionOwner.test.ts` - 10360 bytes - sha256 `d9a4afc5abf08a0ee0bbcde285ed3cf1e36bce101b5965e89ace6acd1a14329b`
- `apps/mobile/src/lib/auth/sessionOwner.ts` - 7773 bytes - sha256 `b402808213bd63d665228e1ed013b62ce7781e0e3fc66b7985275836fccbda44`
- `apps/mobile/src/lib/auth/sessionOwnerKey.ts` - 361 bytes - sha256 `8685503a2c910754e2baf87a5d86b5551004d64ecd2952d21800cc20ee2c5f6a`
- `supabase/functions/_shared/auth.ts` - 321 bytes - sha256 `cac2bbac4936c570508b764482d8c396693bda989f4f605514b8a3ca06397999`
- `docs/phase-3/data-inventory.md` - 60082 bytes - sha256 `0adcbf9be7cbaf7908377e55d0ca482101f37f7ce0a048f3d020d4d4a4b52483`
- `docs/hugeToDo/health-processor-inventory-v1.json` - 3386 bytes - sha256 `491c5389e410aae42006b22705bb5c6426c813d048c47b10dec131c3b897801a`
- `docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md` - 37059 bytes - sha256 `c7fcaeb47bd9a53591c8f5b1a0dd78bbfb9045c54588cc382a27a27ed6120289`

### ipFto - Brand and trademark clearance

- Worklist ID: `ipFto:brand-and-trademark-clearance`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `5a76d8b08142eac12ac1868ef46763dcadd42260566499c5077a64798f23eeca`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Counsel must independently clear or reject the exact sequence and review the recorded comparators. Preliminary search completion is not clearance. Later founder selection and asset reservations are separate identity gates.

Sources:

- `docs/brand-decision-memo.md` - 6469 bytes - sha256 `c2506dfb241232eb5bab07ed5aa4a5d24900790a36c54eed6af7d615d767b612`
- `docs/brand-evidence.md` - 16884 bytes - sha256 `2a3dd031af6306949384b2ccdcadc1753a2624917eb06df6a6f4ededa8343b4d`
- `docs/hugeToDo/BRAND-01-naming-brief.md` - 6817 bytes - sha256 `4f3c0538267266d6f5524fd975ff88f550eceef0a9c1c1fb27b0aa795972c1c8`
- `docs/hugeToDo/BRAND-02-scored-longlist.md` - 11085 bytes - sha256 `a739776fc8ea0a379a5a84f408d2ca41d5f296041c092f91b86cf1261233094d`
- `docs/hugeToDo/BRAND-03-knockout-search-record-2026-07-12.md` - 39101 bytes - sha256 `e06e30ed883175f267b4b179310388cc91b5fb80c30e9c15890424295d8adfc2`
- `docs/hugeToDo/BRAND-04-recommendation.md` - 6763 bytes - sha256 `235a4a4f23f22db1e3beab5fae20225db39d6f793d8295152fb3686cabe39cc1`
- `docs/hugeToDo/BRAND-05-counsel-clearance-packet.md` - 25569 bytes - sha256 `26e61d98d50f182a00ca1d3ad62ba512b5a88425b8bca7055b50602494cdaed8`
- `docs/hugeToDo/evidence/BRAND-03/public-research/brand03-public-knockout-2026-07-16/query-ledger.md` - 10268 bytes - sha256 `ce1554dad59bdca4134f1c170556b98d988b9440c0e1d090b06a08432fdecbb3`
- `docs/hugeToDo/evidence/BRAND-03/public-research/brand03-public-knockout-2026-07-16/evidence.json` - 3674 bytes - sha256 `432f31667d8d145524059e3791cbb2fad1a857bf89017f9c2f5c58c1e307ea8d`
- `apps/mobile/app.base.json` - 4123 bytes - sha256 `c33864f530527e0b2aadc399a5bb773498e8e99e258cd94e6225d0a9acb8334f`
- `apps/mobile/app.config.js` - 18109 bytes - sha256 `4c92065418906f4eaa6d5ff3ed5aea7997ef1c0c70734673c2f7fceba685932c`

### ipFto - Native identifiers and callbacks

- Worklist ID: `ipFto:native-identifiers-and-callbacks`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `c7dacdda1f1bb0723d2b3330eb1ca164896cd7d2d5e6710a26dbcb4f5c70e6ac`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Final bundle ID, package ID, URL scheme, and auth callback allow-lists.

Sources:

- `apps/mobile/app.base.json` - 4123 bytes - sha256 `c33864f530527e0b2aadc399a5bb773498e8e99e258cd94e6225d0a9acb8334f`
- `apps/mobile/app.config.js` - 18109 bytes - sha256 `4c92065418906f4eaa6d5ff3ed5aea7997ef1c0c70734673c2f7fceba685932c`
- `supabase/config.toml` - 3806 bytes - sha256 `b912687a1a149e4fe317160b269d5deb7e6b5f36ce65b02b8c37cf47d0c7ca7c`

### ipFto - Onboarding quiz FTO

- Worklist ID: `ipFto:onboarding-quiz-fto`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `870bb41a0db131aece524b9a64a7cb604398575ef6ca32c0bdf36fb9a4830d2b`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Compare against SkinSort and competitor onboarding/typing flows.

Sources:

- `docs/phase-3/quiz-fto-summary.md` - 5009 bytes - sha256 `9acfde993d7551597d351ee993e51cf966f9828711f340eecafbd666a914c078`
- `apps/mobile/src/features/onboarding/quiz.ts` - 9591 bytes - sha256 `88de1dd0f6329fc792aa5697e66b0fc4bbedfe654181dcc740fd36a35b3fc3dc`
- `apps/mobile/src/app/onboarding/quiz.tsx` - 6966 bytes - sha256 `f1c41f3ab0f5c2c5db45d78582dc9ea269d70b6cdf1512958b686c447b60d9aa`
- `apps/mobile/src/app/onboarding/reveal.tsx` - 5609 bytes - sha256 `8c64e3a6e1ea7fe776310c381e8c8dfb7669f045de88feabbd540a1fb720789c`

### ipFto - Public positioning differentiation

- Worklist ID: `ipFto:public-positioning-differentiation`
- Status: Not cleared
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `60640c0b706c74b947cf01e3245639998c648be31c89cc74d270f1bb28dcb886`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm copy avoids competitor confusion and unsupported superiority.

Sources:

- `docs/phase-3/regulatory-positioning-memo.md` - 8907 bytes - sha256 `d0e67dde9ea011dd2846934f38f30b636b4233fccd4faf4773195c6a7016ea5d`
- `docs/phase-3/store-metadata-review.md` - 2533 bytes - sha256 `eaaefbb8f09bf99b12888fa847a13b2c93bbc585c61c1f07d48759858d8dd8b1`
- `docs/14-growth-to-seven-figures.md` - 57855 bytes - sha256 `a88aa20f72a65f653000e1c445878403e6effb983cc40181168e7de804a1dfd0`

### ipFto - Catalog source and image rights

- Worklist ID: `ipFto:catalog-source-and-image-rights`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `c312040055d74f26091477039bc9cff7cc2a99ea6f602d731f768bdf28e99a08`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: ODbL/source/image-rights posture and attribution obligations.

Sources:

- `docs/phase-4/catalog-source-memo-cosing.md` - 6696 bytes - sha256 `4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 11052 bytes - sha256 `8c4cd97589830a1dac8d65aa2468857cdd252dd5be9dfbcb1a69ac4a1d89f143`
- `docs/phase-4/odbl-compliance-memo.md` - 5338 bytes - sha256 `cf202bd20819b0a8f5b84cc81e7bb2f2470d45ae257a800d4e72f7e88e5bda7d`
- `apps/mobile/src/features/catalog/analytics.test.ts` - 3368 bytes - sha256 `aebe009cf40c8c8c07e88395c0395a90449d79bb24d514a187b06fee7b6bfacc`
- `apps/mobile/src/features/catalog/analytics.ts` - 1523 bytes - sha256 `0576db6223f0a0f0a3b4a3a12aa06818c91787b812438724867a7146ebd5c592`
- `apps/mobile/src/features/catalog/CatalogReportConfirmation.tsx` - 4702 bytes - sha256 `2cfd1ff61e88ea74dfa8aca794cc114554edb704bd81f3ddad9c387a6f092a4d`
- `apps/mobile/src/features/catalog/client.test.ts` - 31695 bytes - sha256 `42dc1c9e4d29c565827535836cf635c37bc19399f663859695a1546df518d297`
- `apps/mobile/src/features/catalog/client.ts` - 23827 bytes - sha256 `a134e2bb32ea3fde57ef7dbcbe987ef15a5010a440ec38700731a2ea339e9a0e`
- `apps/mobile/src/features/catalog/copy.ts` - 1913 bytes - sha256 `b182cec74cb72f850e83dcca14a5548c6277d73a9eaac229f6062e665090f958`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 3602 bytes - sha256 `a38abeedcf0b3a02e36b32ff6d3fa699d27c19dd5ffc2d3286f05e3278ec2afc`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 7815 bytes - sha256 `18da13e8858587faac9137a4ea93b0c24676cbdd215624e8ae30653f9e1173e8`
- `apps/mobile/src/features/catalog/normalization.test.ts` - 2110 bytes - sha256 `1f31a87618439a232cb1d96c17ac460a5b0d7fe7a6588f6ba61283f79ff875c8`
- `apps/mobile/src/features/catalog/normalization.ts` - 2647 bytes - sha256 `16317a4fcfc871414a1b902e8323f24eceb9982c9b40959d49225827c5aeb9ff`
- `apps/mobile/src/features/catalog/obf.test.ts` - 1862 bytes - sha256 `730dbc1d7f7d7610b0a4d73ca45efadb375768af806c634763c000fb81206e2f`
- `apps/mobile/src/features/catalog/obf.ts` - 4536 bytes - sha256 `fd176cfb945b3543b342acadc6f40c333d6c6b484023884998a6f448ebadd2b6`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2258 bytes - sha256 `b5187f33001f741cdb8636ad61343f072502b60ffe2fba70b5e831fce570e599`
- `apps/mobile/src/features/catalog/quality.ts` - 4663 bytes - sha256 `7156ff221071cf6ab90c3558c20d084c53e1f48d0025843ebea5275929103e53`
- `apps/mobile/src/features/catalog/recoveryReport.test.ts` - 1873 bytes - sha256 `b7e4593f9b49f40152266ff5f1ef68d45fc3d651fbaba7bc50bc10858c1a8e94`
- `apps/mobile/src/features/catalog/recoveryReport.ts` - 1449 bytes - sha256 `a1968787279dc1232a27426cf70724a5c8f0d7d65c3669fb462f7b0a25485912`
- `apps/mobile/src/features/catalog/reportOperation.test.ts` - 2745 bytes - sha256 `f306511b72663dfa01c24897a58ccdc6bdaba2081a28a64222e16e9f851c5752`
- `apps/mobile/src/features/catalog/reportOperation.ts` - 2796 bytes - sha256 `680cae013c853f82df16c3eec1c72c2623a752d1583204c1b7ecd917c83dfa37`
- `apps/mobile/src/features/catalog/reportPresentation.test.ts` - 5906 bytes - sha256 `226c050f99dae3e465fbf49da3c6618549bab261dccecb64773a8b3efaaaf4ab`
- `apps/mobile/src/features/catalog/reportPresentation.ts` - 5781 bytes - sha256 `6fbe26f5bfb254a22272603da403455763a4ac23f1966e998cf891fe36b7e615`
- `apps/mobile/src/features/catalog/reportTransport.ts` - 6607 bytes - sha256 `ef8e02518936fb1fd6bdbff03aebf4012d5fb84e2ef3467c948b727c420ff483`

### ipFto - Share-card marks and deep links

- Worklist ID: `ipFto:share-card-marks-and-deep-links`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `1a7d1458c68210d2d1057be20cd2b99ac4354d03bd89aea088ee9b4824a6b5cb`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Final watermark, domain, Universal Links/App Links, and attribution copy.

Sources:

- `apps/mobile/src/features/growth/cardCopy.test.ts` - 2319 bytes - sha256 `c288a67751c6a181f80c8a93933f2aee36fd7d286d0f7f3faee72e42716d45c9`
- `apps/mobile/src/features/growth/cardCopy.ts` - 1017 bytes - sha256 `e9f3d09dfa1ba628dd883088e2b67976eaa2164c3a509e5808f54435ef991776`
- `apps/mobile/src/features/growth/ConflictCard.tsx` - 4280 bytes - sha256 `c507a02987606253932950df0066322a724edfccdc08286640882d0b660af981`
- `apps/mobile/src/features/growth/publicLinkAdmission.test.ts` - 1401 bytes - sha256 `01dffc5dbcba810134a1f7939ff0212ef79fee924349008bde69a8ee43d05c23`
- `apps/mobile/src/features/growth/publicLinkAdmission.ts` - 1278 bytes - sha256 `2010dbd8de265052387c6d8930df10fc77f152aa3da1529622ed47b1adfc1ab0`
- `apps/mobile/src/features/growth/shareAdmission.test.ts` - 1775 bytes - sha256 `b91ac95fd984223a78d8cf7e90aafbecc93ca37b3720c998a2c74f9f50728db7`
- `apps/mobile/src/features/growth/shareAdmission.ts` - 2280 bytes - sha256 `02adedb821a476eeba4fd2bc06681feeba2008fa1c97ffd4937a39a569dc6327`
- `apps/mobile/src/features/growth/shareCard.test.ts` - 1667 bytes - sha256 `fcecf1cd61bf89aa3693ac9bd3e1dde3432de81926f4d52598209ce36ded0e7b`
- `apps/mobile/src/features/growth/shareCard.ts` - 405 bytes - sha256 `a7059162afa68ee7cdd765a117d5c8edee387eaf5a8d7d85c78ff23ee0faafac`
- `apps/mobile/src/features/growth/shareLandingRoute.test.ts` - 1958 bytes - sha256 `f4a329de6c143ef8b1ea376bf5f778e13861d28880a6462f6f1f03183632b8f0`
- `apps/mobile/src/features/growth/shareLinks.test.ts` - 1434 bytes - sha256 `a995256a1740d32d2608a0bfab05d053a80ec07407dbe86090690808bb92c706`
- `apps/mobile/src/features/growth/shareLinks.ts` - 318 bytes - sha256 `36af63e30c40653b8940d7f8dbf89e7e6b451c3286b522181f77ff1f9a1127f7`
- `apps/mobile/src/features/growth/shareProjection.test.ts` - 3366 bytes - sha256 `1bc71c2592968386a9d620c63fd33672c7fc78cf4f209b7344f0e1c83ffd03d4`
- `apps/mobile/src/features/growth/shareProjection.ts` - 3922 bytes - sha256 `181032634536521b98caee66fabda609be3e3832f238bf1c73b4f42fca08ab6b`
- `docs/14-growth-to-seven-figures.md` - 57855 bytes - sha256 `a88aa20f72a65f653000e1c445878403e6effb983cc40181168e7de804a1dfd0`
- `docs/brand-decision-memo.md` - 6469 bytes - sha256 `c2506dfb241232eb5bab07ed5aa4a5d24900790a36c54eed6af7d615d767b612`

## Blockers

- None.

## Warnings

- None.
