# Phase 3 Reviewer Worklist

Generated: 2026-07-18T15:51:41.571Z
Status: pass
Git SHA: 2d5cb849ac0f926556df7a991be39074a1640fc8
Git status: clean

This generated worklist converts the legal, clinical, cosmetic chemistry,
privacy/security, and IP/FTO review logs into an operator handoff. It does
not mark anything approved; it records the exact source files and hashes
reviewers must inspect before launch gates can close.

## Summary

- Review items: 38
- Source files hashed: 398
- Missing source files: 0
- Current detached signoffs: 0
- Release dispositions missing signoff: 0
- Blockers: 0
- Warnings: 0

## Items

| Domain            | Area                                              | Status      | Reviewer | Date | Signoff        | Sources | Missing sources |
| ----------------- | ------------------------------------------------- | ----------- | -------- | ---- | -------------- | ------- | --------------- |
| legalRegulatory   | Regulatory launch classification                  | Not cleared | TBD      | TBD  | not-applicable | 3       | 0               |
| legalRegulatory   | Launch claims vocabulary                          | Not cleared | TBD      | TBD  | not-applicable | 2       | 0               |
| legalRegulatory   | Store metadata and review notes                   | Blocked     | TBD      | TBD  | not-applicable | 4       | 0               |
| legalRegulatory   | Subscription and cancellation                     | Not cleared | TBD      | TBD  | not-applicable | 38      | 0               |
| legalRegulatory   | Commerce and paid-link disclosure                 | Blocked     | TBD      | TBD  | not-applicable | 21      | 0               |
| legalRegulatory   | Ask and AI disclosures                            | Blocked     | TBD      | TBD  | not-applicable | 19      | 0               |
| clinical          | Ingredient interaction rules                      | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Routine application ordering                      | Not cleared | TBD      | TBD  | not-applicable | 4       | 0               |
| clinical          | Pregnancy safety and active cadence               | Not cleared | TBD      | TBD  | not-applicable | 5       | 0               |
| clinical          | PAO defaults                                      | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Recommendation types                              | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Shoppable stacks                                  | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Community notes and posts                         | Not cleared | TBD      | TBD  | not-applicable | 17      | 0               |
| clinical          | Ask OnSkin deterministic answers                  | Not cleared | TBD      | TBD  | not-applicable | 2       | 0               |
| clinical          | Trend analysis                                    | Not cleared | TBD      | TBD  | not-applicable | 14      | 0               |
| clinical          | Photo progress copy                               | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Onboarding quiz                                   | Blocked     | TBD      | TBD  | not-applicable | 1       | 0               |
| clinical          | Consent copy                                      | Blocked     | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Functional tags                                   | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | PAO defaults                                      | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Recommendation catalog                            | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Shoppable stack item labels                       | Not cleared | TBD      | TBD  | not-applicable | 1       | 0               |
| cosmeticChemistry | Routine sequencing                                | Not cleared | TBD      | TBD  | not-applicable | 4       | 0               |
| cosmeticChemistry | Active concentration and pregnancy-caution matrix | Not cleared | TBD      | TBD  | not-applicable | 20      | 0               |
| cosmeticChemistry | Smart shelf labels                                | Not cleared | TBD      | TBD  | not-applicable | 23      | 0               |
| privacySecurity   | Health-data consent and withdrawal                | Blocked     | TBD      | TBD  | not-applicable | 63      | 0               |
| privacySecurity   | Photo privacy and local storage                   | Not cleared | TBD      | TBD  | not-applicable | 4       | 0               |
| privacySecurity   | Trend and cloud-backup consent                    | Blocked     | TBD      | TBD  | not-applicable | 15      | 0               |
| privacySecurity   | Ask, commerce, and community consent              | Blocked     | TBD      | TBD  | not-applicable | 4       | 0               |
| privacySecurity   | Account deletion and data export                  | Blocked     | TBD      | TBD  | not-applicable | 15      | 0               |
| privacySecurity   | Analytics and crash payloads                      | Not cleared | TBD      | TBD  | not-applicable | 16      | 0               |
| privacySecurity   | Auth and processor posture                        | Blocked     | TBD      | TBD  | not-applicable | 50      | 0               |
| ipFto             | Brand and trademark clearance                     | Blocked     | TBD      | TBD  | not-applicable | 11      | 0               |
| ipFto             | Native identifiers and callbacks                  | Blocked     | TBD      | TBD  | not-applicable | 3       | 0               |
| ipFto             | Onboarding quiz FTO                               | Blocked     | TBD      | TBD  | not-applicable | 4       | 0               |
| ipFto             | Public positioning differentiation                | Not cleared | TBD      | TBD  | not-applicable | 3       | 0               |
| ipFto             | Catalog source and image rights                   | Blocked     | TBD      | TBD  | not-applicable | 14      | 0               |
| ipFto             | Share-card marks and deep links                   | Blocked     | TBD      | TBD  | not-applicable | 9       | 0               |

## Item Details

### legalRegulatory - Regulatory launch classification

- Worklist ID: `legalRegulatory:regulatory-launch-classification`
- Status: Not cleared
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `5dedd64811ece8b49f00ed610e6590216ab465bac47356a260317c062ad9c687`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Counsel must approve launch classification and forbidden-claim floor.

Sources:

- `docs/phase-3/regulatory-positioning-memo.md` - 8472 bytes - sha256 `e0118d857672f79febfbc4c19491f967e1624db92a89698db66d479d334d4c9a`
- `docs/legal-readiness.md` - 14784 bytes - sha256 `f8452a88d28214bc94d1468b1ad9eb80eda1ba7224696a07fbcda79ebfbda748`
- `apps/mobile/src/lib/legal/disclaimer.ts` - 926 bytes - sha256 `b9cc550cb5802a61fbc0c782585b4fcc388719d2475e5f7d476005da4f26e174`

### legalRegulatory - Launch claims vocabulary

- Worklist ID: `legalRegulatory:launch-claims-vocabulary`
- Status: Not cleared
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `0105014dcd8a61bcc4747695e575f1ecdcbec23c8b216d7e732152d5e4493e2f`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Store, ads, screenshots, pushes, paywalls, and review replies.

Sources:

- `docs/phase-3/launch-claims-vocabulary.md` - 3613 bytes - sha256 `18a587dde1f99b877e6489b44a6454488efa22ca020fe825b4e1246305912891`
- `apps/mobile/src/lib/legal/storeMetadata.ts` - 7852 bytes - sha256 `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`

### legalRegulatory - Store metadata and review notes

- Worklist ID: `legalRegulatory:store-metadata-and-review-notes`
- Status: Blocked
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `3784308bd5621eff8306d6abb8fd4b44e8151cd44b78d6b8c77f10c5e26a69b6`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Requires final brand, support/policy URLs, privacy labels.

Sources:

- `docs/phase-3/store-metadata-review.md` - 2533 bytes - sha256 `eaaefbb8f09bf99b12888fa847a13b2c93bbc585c61c1f07d48759858d8dd8b1`
- `docs/phase-3/app-review-notes.md` - 4875 bytes - sha256 `1d38121d118b40a00c71de955766d1f1ddaf38d09b6c56e4e75e31d1de43827d`
- `docs/phase-3/google-play-health-declaration-notes.md` - 1901 bytes - sha256 `12329457687f1d91a80099badea762832c3e123cfcf8dc82ce739c8ed1fb5658`
- `apps/mobile/src/lib/legal/storeMetadata.ts` - 7852 bytes - sha256 `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`

### legalRegulatory - Subscription and cancellation

- Worklist ID: `legalRegulatory:subscription-and-cancellation`
- Status: Not cleared
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `d45872bc60beb74f849b6dec93b08be0322191bb5b9c1fa1a174e37d2f2d5372`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Auto-renew, restore, cancellation, trial, and win-back copy.

Sources:

- `apps/mobile/src/features/subscription/cancelIntent.test.ts` - 1780 bytes - sha256 `d950be6fe9113911fb318323d4a5b7a0fdcb2a1574ee2ce567dd56377d019660`
- `apps/mobile/src/features/subscription/cancelIntent.ts` - 542 bytes - sha256 `401681a7d3bed2d27b84599b1fc6321de1afb8d4cef1930bbe0d54597fc86dbe`
- `apps/mobile/src/features/subscription/claimsafety.test.ts` - 3455 bytes - sha256 `ada28dacdc9700b7b387e4a89980fe84c70423f07d1021172cf5230ad9680b45`
- `apps/mobile/src/features/subscription/ComplianceRow.tsx` - 5025 bytes - sha256 `116fc975b950f6cf919471bd41c0530d1da8c08875d64d9f141bec10416cf514`
- `apps/mobile/src/features/subscription/conflictQuota.test.ts` - 4710 bytes - sha256 `240c045085f2c6a9b622d723607df62e6697edc3d50e5db877a4efb004503f5d`
- `apps/mobile/src/features/subscription/conflictQuota.ts` - 3595 bytes - sha256 `0e88478e0ca325c0650bde53a223a2b06a0252f8dba370688b4b7d3eb06dd538`
- `apps/mobile/src/features/subscription/copy.ts` - 8325 bytes - sha256 `1a9ce7ca24c4de4b8631166a12351307e8facb6372bec4262193ad726147477c`
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
- `apps/mobile/src/features/subscription/proGatedRoutes.test.ts` - 15570 bytes - sha256 `f9514722836aafe40e3882fb20a188f3c0a8ce4b494cb4ab49761779cd4b5356`
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
- Review snapshot SHA-256: `a39977e52b2bfe89268e1bf9ea3a4b346dbcec2390f54c80473317ef66a80d8c`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: FTC disclosure, partner data sharing, source rights, order reports.

Sources:

- `docs/phase-4/odbl-compliance-memo.md` - 5099 bytes - sha256 `ed14fda2e129ee22293ab5d28433626971c0ba8998034547e5f15dc23746c191`
- `apps/mobile/src/features/commerce/attribution.test.ts` - 5254 bytes - sha256 `8d759dcc16a3324d872895664b9dfc23b35224190d2441588782a2cdaa257d43`
- `apps/mobile/src/features/commerce/attribution.ts` - 4062 bytes - sha256 `1c69b53246f2396a00620ef2b032e18c481aff3682fd1b44b29d75e7fd44ac51`
- `apps/mobile/src/features/commerce/claimsafety.test.ts` - 4518 bytes - sha256 `73a396b16adcce8d9736fb7ce578e8b88a54cf255aa625a6e35ceb71565562d9`
- `apps/mobile/src/features/commerce/commerce.test.ts` - 5924 bytes - sha256 `9bb6f8f73510267201a6850801ed86c86fa64b817822ab2dc497fb0205ce1253`
- `apps/mobile/src/features/commerce/CommerceLinkNotice.tsx` - 751 bytes - sha256 `911862ba2aa65e417f186c920738dc977ab3acb65fddc46ad9682b32b31ad2f7`
- `apps/mobile/src/features/commerce/commerceRoutes.test.ts` - 7974 bytes - sha256 `81e737f3f9405d604fff015768213cbff8b3ff954fd1c97fa94572599133cd77`
- `apps/mobile/src/features/commerce/consent.test.ts` - 2415 bytes - sha256 `3da8f82f15725cde17ddcc3ee07f13d1250b2a5b426049b7e14a38084c751427`
- `apps/mobile/src/features/commerce/consent.ts` - 1227 bytes - sha256 `355ba414c9719156b12c5772e9550d986f64b312395f82dde8e313e20ab1b5ef`
- `apps/mobile/src/features/commerce/consentLogic.ts` - 670 bytes - sha256 `a93343b81c5af690fc74abbf8b21846496a8e8804b3ced589c27cf3609f4973f`
- `apps/mobile/src/features/commerce/copy.ts` - 5252 bytes - sha256 `994d09c84b011cd536622cf282f861b26a5a9aa00734fab1ee503fe8a2acc7b4`
- `apps/mobile/src/features/commerce/disclosureOperation.test.ts` - 2299 bytes - sha256 `e01a36798ea54b01e5e0752cab247ea86d6c7cdfc6eaac41e9a7d3e78fffddf6`
- `apps/mobile/src/features/commerce/disclosureOperation.ts` - 867 bytes - sha256 `54553d40eefd384ed2c464e933528ce334b9ac9e552aff66bc08de8500a6fb5f`
- `apps/mobile/src/features/commerce/links.ts` - 4058 bytes - sha256 `b64f6505d6cf060e4c0e7d86f2da33503ae84b09e2c6919824c72a74ca37d5d8`
- `apps/mobile/src/features/commerce/LockGlyph.tsx` - 1284 bytes - sha256 `a6a4bc8696bc94c4fd5acc0a39226a258607b3778dd21f90bb23bd22fe0c9ca8`
- `apps/mobile/src/features/commerce/stacks.ts` - 3159 bytes - sha256 `eeb8e490a598f45660b936bcc874c49fba5b2b0fc3b03b0d7a0dcb254c0dee0f`
- `apps/mobile/src/features/commerce/store.test.ts` - 3697 bytes - sha256 `8caf13c05f082a9f2aa24384b395fb557b002f84ef062fae907c463ee302d449`
- `apps/mobile/src/features/commerce/store.ts` - 2567 bytes - sha256 `932dae44db15aaf7456a997ac59c10d4fc1e5dc319241567ec6cd13fdbddba08`
- `apps/mobile/src/features/commerce/useCommerce.ts` - 1609 bytes - sha256 `a542c1503fe78f280f0d98e369e49a4d35209a1f261ef138b95526225072135c`
- `apps/mobile/src/features/commerce/WhereToBuy.tsx` - 9240 bytes - sha256 `928812bf1f63a3af964dba397d94e52599474a9677b211f29202036939dccc90`
- `supabase/functions/order-report-poll/index.ts` - 5552 bytes - sha256 `8574b39ddfac908f1fa156b5c8e64fed8899f682563dff1fdc6981ec4e81d8ce`

### legalRegulatory - Ask and AI disclosures

- Worklist ID: `legalRegulatory:ask-and-ai-disclosures`
- Status: Blocked
- Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `456b22f56d5b57aa6225f797168510c13e168f2bb79ee25e829e85d2cf22723d`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Vendor, AI disclosure, safety, privacy, and state-law review needed.

Sources:

- `docs/13-ask-onskin-assistant.md` - 116206 bytes - sha256 `b10347f01671cac49f4039e6f47bf9637377043cb6c489bb0e0d9e49a89f9ad9`
- `apps/mobile/src/features/ask/answer.test.ts` - 7151 bytes - sha256 `5cc0f7342b5839a880ee6839283a62ec2362463f65ad879c4675366436684788`
- `apps/mobile/src/features/ask/answer.ts` - 11305 bytes - sha256 `62e8f3bca768b462c74117b3215dfe32fdc23488a9c9219eb3a37f8394ae1971`
- `apps/mobile/src/features/ask/applyConsentChoice.test.ts` - 1932 bytes - sha256 `ad650b6161eac3e5f051ef8f9351b0312bef6ba2b05aaf5c67acb887e053705a`
- `apps/mobile/src/features/ask/applyConsentChoice.ts` - 599 bytes - sha256 `61a6d68a997af32f0caf5d68c5b347cb2ed3a085874172a48f0489875441c24f`
- `apps/mobile/src/features/ask/AskTeaser.tsx` - 1467 bytes - sha256 `a9dfaa2f4cfe8d805c26d5fa6aefff91c02327b8d7dca8f09376c788a0a8108d`
- `apps/mobile/src/features/ask/claimsafety.test.ts` - 7602 bytes - sha256 `2af74cb07a39bb25b0b4204c845539cb2f5d4c2835bb63a056a1cf6565063cc3`
- `apps/mobile/src/features/ask/consent.test.ts` - 2193 bytes - sha256 `86c27236e060f6fabfca22049f195041475523bd2f147f1a1e5658a694ee0b71`
- `apps/mobile/src/features/ask/consent.ts` - 833 bytes - sha256 `ba732d8c83bd8951f2c33a11ef7555bd2d6ee23dd1b02d6bfb8de20cd219885b`
- `apps/mobile/src/features/ask/copy.ts` - 8534 bytes - sha256 `3417a7d79f70df50d1a25d00aac004e7e06ca4be28313432d9c19409d31d6ca3`
- `apps/mobile/src/features/ask/gate.test.ts` - 1777 bytes - sha256 `cb2c0af6d08be18530a703dc12ff36bb727dbe33f54085e3b4fc9742f8f33c1a`
- `apps/mobile/src/features/ask/gate.ts` - 2131 bytes - sha256 `337f2bb2f6d0e7208102648233da198c9f4c4cc3f3f392a8b57082969e6fc3c4`
- `apps/mobile/src/features/ask/guard.ts` - 2015 bytes - sha256 `bd0e051294a02a78bab242b4fdfbad5f7e08258467232009f027536258a433ee`
- `apps/mobile/src/features/ask/intent.test.ts` - 2674 bytes - sha256 `8f1680dc85f47891fdb8b41e8756d69f3526a54d9bb659926e4955879686166a`
- `apps/mobile/src/features/ask/intent.ts` - 3815 bytes - sha256 `83c3468965521a3a37db6d513d9e12ffd679cd23d8a83ee1560a4fe4bd3de15b`
- `apps/mobile/src/features/ask/routeContract.test.ts` - 11208 bytes - sha256 `8248bd9b78c9e171f6b4e923b49412c604ac10aa65ce6834c80f86a8dc09ef74`
- `apps/mobile/src/features/ask/store.test.ts` - 9357 bytes - sha256 `42a01c5d0a828912b92978a0b1921f1a7df8ca67effc0b0ebbc47e965e248de7`
- `apps/mobile/src/features/ask/store.ts` - 5622 bytes - sha256 `76af6872cc1376d2d515534bf463ad71a8e7a1c51d838000ca1ed3a421331cec`
- `apps/mobile/src/features/ask/useAsk.ts` - 5305 bytes - sha256 `43f52fa66c6ef5b79ba18fad4cf6134dd37cd3941d6a94cc7d1d44100c261ba8`

### clinical - Ingredient interaction rules

- Worklist ID: `clinical:ingredient-interaction-rules`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `58d958b2f4ae182a5d9575e571d3f6dcdb2e64bad5ac0fbf5dfe3e3f1cacce32`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: All launch rules currently have `reviewedBy: null`.

Sources:

- `apps/mobile/src/features/intelligence/rules.ts` - 10189 bytes - sha256 `00a368beef8a4b59edbf5b5847868093bf402de4c65eabaa79ec7d0517116aa4`

### clinical - Routine application ordering

- Worklist ID: `clinical:routine-application-ordering`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `e6d91eeb2c10c0f2f9710f7124e3001f42f29997ddcfa870316ab3a89480db0f`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review every role's phase, priority, exact full/compact display copy, rule version, and partial-review behavior. No manual add-to-AM/PM recovery exists.

Sources:

- `apps/mobile/src/features/routine/sequencing.ts` - 10036 bytes - sha256 `9f96c0395548df4780b68991599633bc919946832e3a811b0b1b43909559a06d`
- `apps/mobile/src/features/routine/generate.ts` - 7889 bytes - sha256 `b95e242b8e14abbe555302c2be92d1a620a650addda359e0ca261cf907f6b314`
- `apps/mobile/src/features/today/routineProjection.ts` - 7275 bytes - sha256 `6fd3051255557caeaa3e92bb4c3ca29713c3dc2c620aad7fc4beaf17b0d998c0`
- `apps/mobile/src/app/(tabs)/today.tsx` - 30507 bytes - sha256 `76da3fdb66337d118e8a5381a9cd8333e17aa02698595db5f30abcbc8510b935`

### clinical - Pregnancy safety and active cadence

- Worklist ID: `clinical:pregnancy-safety-and-active-cadence`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `bd7b7bb104b24e631494c7fab0c58dfdedc78336de0871d4830b87344406ca7d`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review statuses, retinoid/hydroquinone/BHA matrix and threshold, unknown-strength handling, cadence, replacement suppression, and every visible explanation together.

Sources:

- `apps/mobile/src/features/intelligence/pregnancySafety.ts` - 1703 bytes - sha256 `ac39dca4dcc9f9cf19cdb695a42c8cc4c92df8abe2ea8838773d749b10de5c71`
- `apps/mobile/src/features/intelligence/concentration.ts` - 7024 bytes - sha256 `a44ab1e6e6020e7e01a432d82c5aa8e8f941db4b4a870f8e0fa55e94bd8a6230`
- `apps/mobile/src/features/routine/generate.ts` - 7889 bytes - sha256 `b95e242b8e14abbe555302c2be92d1a620a650addda359e0ca261cf907f6b314`
- `apps/mobile/src/features/scheduler/orchestrate.ts` - 12566 bytes - sha256 `cc78a6d95295d2dd3cf2db03e00401fcd01bf3142ca0a329e25d5e2e2e884a37`
- `apps/mobile/src/features/recommendations/engine.ts` - 17809 bytes - sha256 `ccd83caffac064fa690bb5acbf67ec350a86398ce64f22e5f3ecc06ca691693d`

### clinical - PAO defaults

- Worklist ID: `clinical:pao-defaults`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `73d0d7f05e4186588b5b0e4c8a84fb897a16f779bfc10e34f366bb28c1c024c1`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Keep conservative until chemist/derm signoff.

Sources:

- `apps/mobile/src/features/intelligence/pao.ts` - 8291 bytes - sha256 `fcf9d36c694715069f527a60586ca9c0d075a00d9162263cd4b7d71f1d4baa27`

### clinical - Recommendation types

- Worklist ID: `clinical:recommendation-types`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `fab15cff8ce3028f7d70e6c54f72555c8bcbeb51b1ee9d4cd63d6611802379ef`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Structural routine types may remain; medical-adjacent needs signoff.

Sources:

- `apps/mobile/src/features/recommendations/catalog.ts` - 9381 bytes - sha256 `e5d35422d6e33398d362b5c2e4483da8808bf2654d83d470013f537aa09e59c4`

### clinical - Shoppable stacks

- Worklist ID: `clinical:shoppable-stacks`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `ea4989bbf191f63c77cd615cddd82515b853d3dafef32a71b53604ffe7329370`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Paid link disclosure does not replace clinical review.

Sources:

- `apps/mobile/src/features/commerce/stacks.ts` - 3159 bytes - sha256 `eeb8e490a598f45660b936bcc874c49fba5b2b0fc3b03b0d7a0dcb254c0dee0f`

### clinical - Community notes and posts

- Worklist ID: `clinical:community-notes-and-posts`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `b660a08c73f0da2bc49cbcf5ba6a429e99176734662d4491f9e9eb342ac8a430`
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
- `apps/mobile/src/features/community/copy.ts` - 3450 bytes - sha256 `b0036701ab6fc1b6127fac3fb836340d7e265d387d0c8f4f034cf6922598569a`
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
- Review snapshot SHA-256: `cd5e83fe0016a8c09751f3a3f130efb58d186fee2f56e972149d20af6ec7a477`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Deterministic answers are still regulated user-facing copy.

Sources:

- `apps/mobile/src/features/ask/answer.ts` - 11305 bytes - sha256 `62e8f3bca768b462c74117b3215dfe32fdc23488a9c9219eb3a37f8394ae1971`
- `apps/mobile/src/features/ask/copy.ts` - 8534 bytes - sha256 `3417a7d79f70df50d1a25d00aac004e7e06ca4be28313432d9c19409d31d6ca3`

### clinical - Trend analysis

- Worklist ID: `clinical:trend-analysis`
- Status: Not cleared
- Required reviewer: board-certified dermatologist or equivalent qualified clinician
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `746885f02411e90a4adecd47006edf6cc7753297a099553a7ad189a0d3ed996d`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Requires real engine, calibration, fairness, privacy, clinical, legal, and device review before launch.

Sources:

- `apps/mobile/src/features/trend/applyConsentChoice.test.ts` - 2646 bytes - sha256 `86e179a895d4f1c9d78b468c4d0450e7caf4679818549e5b849812a9187fcdd7`
- `apps/mobile/src/features/trend/applyConsentChoice.ts` - 506 bytes - sha256 `8322b4a9b03c8edc25f6e07761ea4a923159edc90cf8002712aca36a815758a9`
- `apps/mobile/src/features/trend/claimsafety.test.ts` - 5885 bytes - sha256 `15e1553b3f22d7585e7c2b507e745a2e3eb9b66566a781927f8b06900e86398d`
- `apps/mobile/src/features/trend/consent.test.ts` - 2117 bytes - sha256 `d38f73eedc62e72285f015ffd150096ab87f1e0d358658a7e09570f0f5639c51`
- `apps/mobile/src/features/trend/consent.ts` - 1022 bytes - sha256 `17975a720bbe22bd6ca95449308c0d8c33d54377bebd5c17c7956e38f7103acc`
- `apps/mobile/src/features/trend/copy.ts` - 5381 bytes - sha256 `804c809a7f3acdebf3293fdb738d18524e6e3aa8095e78c0f00de0cf8cfc9318`
- `apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts` - 3425 bytes - sha256 `d4b9128f7a7309f2117d3df3ef5016950bf4cd9a58ce2a253dc3517288fda6e1`
- `apps/mobile/src/features/trend/store.test.ts` - 2466 bytes - sha256 `ba5aff392e2b0cec9abf07ecf89a8b14415ff5923795f484990e42bfe2c06ad3`
- `apps/mobile/src/features/trend/store.ts` - 2119 bytes - sha256 `7dff9753d4e1d2334a9e4b82be2eea727f8a16b5967051beeaefcffe69a7dc0e`
- `apps/mobile/src/features/trend/trend.test.ts` - 3224 bytes - sha256 `797f4e43ac5724fce8c6df388bdd6c84514ff8a10626f6c7866b8fb47bf3733b`
- `apps/mobile/src/features/trend/trend.ts` - 3598 bytes - sha256 `3a7c314b74b0ff8e166f1aa55f710745ad6d743793bc5f65441c1675d7aeb24d`
- `apps/mobile/src/features/trend/TrendInsight.tsx` - 2322 bytes - sha256 `d033b5f0572da342702b29f72ee2864808757525f2804a688789c79661029c1b`
- `apps/mobile/src/features/trend/trendRoutes.test.ts` - 3695 bytes - sha256 `3f4c93276730c9725fe274b70587c539316f924f03ef6b328aaa7dff2739bab7`
- `apps/mobile/src/features/trend/useTrend.ts` - 3487 bytes - sha256 `f2ba58512a8322ad112f66d79762743c97856d2770a248185f71e065b9609df5`

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
- Review snapshot SHA-256: `e958de30ee62070c1ed0be3d660532eb4ceab71d2f888a7dab7a0cab688a9c49`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Needs IP/legal plus clinical review.

Sources:

- `apps/mobile/src/features/onboarding/quiz.ts` - 11021 bytes - sha256 `e467bfb1e6605e41cb2e62e764ff33cefbed98a936c94150de1a704654d23527`

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
- Review snapshot SHA-256: `4e7da28a09de281b79483a56b80887dc28c96e84afbb089a73ad19ed167c4eb8`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Verify naming and category boundaries.

Sources:

- `packages/types/src/index.ts` - 19206 bytes - sha256 `241dc550353903b7f111f13df80ee35bb5a24c8f0dd99e7c2bde7ddd89b72f1e`

### cosmeticChemistry - PAO defaults

- Worklist ID: `cosmeticChemistry:pao-defaults`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `7eec280e52e2a820c3c0debe29ff1e628cf91260bbc7005a59e190d3b684ba69`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review by category and preservative risk assumptions.

Sources:

- `apps/mobile/src/features/intelligence/pao.ts` - 8291 bytes - sha256 `fcf9d36c694715069f527a60586ca9c0d075a00d9162263cd4b7d71f1d4baa27`

### cosmeticChemistry - Recommendation catalog

- Worklist ID: `cosmeticChemistry:recommendation-catalog`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `d571fe46121ed6f882835c3cbf7c444964b737cb2219b95cb50a8a2a7a64ecff`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm evidence notes and caveats.

Sources:

- `apps/mobile/src/features/recommendations/catalog.ts` - 9381 bytes - sha256 `e5d35422d6e33398d362b5c2e4483da8808bf2654d83d470013f537aa09e59c4`

### cosmeticChemistry - Shoppable stack item labels

- Worklist ID: `cosmeticChemistry:shoppable-stack-item-labels`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `57b346d30eab10589faadd7f05d6311913d9b4c3977a1dc4be54b4ae5d10a409`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Product examples illustrative only.

Sources:

- `apps/mobile/src/features/commerce/stacks.ts` - 3159 bytes - sha256 `eeb8e490a598f45660b936bcc874c49fba5b2b0fc3b03b0d7a0dcb254c0dee0f`

### cosmeticChemistry - Routine sequencing

- Worklist ID: `cosmeticChemistry:routine-sequencing`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `6b56f47582752859ae205cb954cde396efc280edd6462d3c570a00e9a66a220e`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm every role's phase, priority, exact displayed instruction, and partial-review behavior. No manual add-to-AM/PM recovery exists.

Sources:

- `apps/mobile/src/features/routine/sequencing.ts` - 10036 bytes - sha256 `9f96c0395548df4780b68991599633bc919946832e3a811b0b1b43909559a06d`
- `apps/mobile/src/features/routine/generate.ts` - 7889 bytes - sha256 `b95e242b8e14abbe555302c2be92d1a620a650addda359e0ca261cf907f6b314`
- `apps/mobile/src/features/today/routineProjection.ts` - 7275 bytes - sha256 `6fd3051255557caeaa3e92bb4c3ca29713c3dc2c620aad7fc4beaf17b0d998c0`
- `apps/mobile/src/app/(tabs)/today.tsx` - 30507 bytes - sha256 `76da3fdb66337d118e8a5381a9cd8333e17aa02698595db5f30abcbc8510b935`

### cosmeticChemistry - Active concentration and pregnancy-caution matrix

- Worklist ID: `cosmeticChemistry:active-concentration-and-pregnancy-caution-matrix`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `c8ee86626aa5b5f09722900cdddd68c0abfcbc8b0663ad61faf302aea79f6e15`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Validate aliases, thresholds, multi-active ambiguity, low/high/unknown BHA, hydroquinone, and replacement behavior.

Sources:

- `apps/mobile/src/features/intelligence/concentration.ts` - 7024 bytes - sha256 `a44ab1e6e6020e7e01a432d82c5aa8e8f941db4b4a870f8e0fa55e94bd8a6230`
- `apps/mobile/src/features/intelligence/pregnancySafety.ts` - 1703 bytes - sha256 `ac39dca4dcc9f9cf19cdb695a42c8cc4c92df8abe2ea8838773d749b10de5c71`
- `apps/mobile/src/features/scheduler/cadence.ts` - 1364 bytes - sha256 `f7164eef26e124c398c3f79e3088c7500c2e35adc41f02ac47abdf675bab3b21`
- `apps/mobile/src/features/scheduler/classes.ts` - 4339 bytes - sha256 `e90dedddd1881ee44433e22a2237387ef7daffa29595a67dea6dd6a774010045`
- `apps/mobile/src/features/scheduler/customCycle.test.ts` - 9291 bytes - sha256 `9cec61bc36016b5c2acc6afeaff48b37cae861271141203520574ea3399f8e14`
- `apps/mobile/src/features/scheduler/customCycle.ts` - 13146 bytes - sha256 `3e6fc08ddf8813933f5e07216fc04c411d7683a44f3761b33b82132f95ee9cda`
- `apps/mobile/src/features/scheduler/CycleMutationError.tsx` - 685 bytes - sha256 `e8b9e8ed76aa9397a387cdfa718edf9d78569522166a5b5aeb267afff69aee81`
- `apps/mobile/src/features/scheduler/cycleStore.test.ts` - 16213 bytes - sha256 `31e88a5607ab9662926b2758931e5f7e2876f24c2f5f87f9eabbde4bb1a109de`
- `apps/mobile/src/features/scheduler/cycleStore.ts` - 17247 bytes - sha256 `5c7681266c67f7edc7283d2c9a3b72b8aec2fbb13e320b37a3c623776919d091`
- `apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts` - 15702 bytes - sha256 `c95cabb80b34ba878449ef6d401495d35ce6a3498bb53293a1d29322b107610e`
- `apps/mobile/src/features/scheduler/orchestrate.test.ts` - 19231 bytes - sha256 `da53077967a8907cc35ac85b032fc1dba1537cc9b92d99b180b3ffb7a4e388b2`
- `apps/mobile/src/features/scheduler/orchestrate.ts` - 12566 bytes - sha256 `cc78a6d95295d2dd3cf2db03e00401fcd01bf3142ca0a329e25d5e2e2e884a37`
- `apps/mobile/src/features/scheduler/profile.test.ts` - 7847 bytes - sha256 `7e5c1c901b8fb572218995a1abd8d2038181356e5a50a683db287054aea7b1b1`
- `apps/mobile/src/features/scheduler/profile.ts` - 5457 bytes - sha256 `43bc89ef7998fc04c548340e7b85b10334b5f36ac1e195eaf74e5e043e6525f3`
- `apps/mobile/src/features/scheduler/profileMapping.ts` - 1507 bytes - sha256 `577df4e8f085fd7944388bbd0dd9609e35007f24a8320d2362020e73d3a27f84`
- `apps/mobile/src/features/scheduler/projection.test.ts` - 3041 bytes - sha256 `a4cd2533262ca8fc73aa5403bff6f43be21fab7fa96b03fec19b9a4ba2687a59`
- `apps/mobile/src/features/scheduler/projection.ts` - 3918 bytes - sha256 `8d5e9983dd125f4f1438534f6aec7f855f2d9f8ccb0189b56ac6dd6e31443782`
- `apps/mobile/src/features/scheduler/useCycle.ts` - 10274 bytes - sha256 `19f53607aa158df0c4f05a51972d9d3a3ba598141ebe07ae8a0f80725ada31bc`
- `apps/mobile/src/features/scheduler/useCycleAnalytics.test.ts` - 805 bytes - sha256 `ac98d3eb19e85d67dfd368b06189c7e6b76ac23557de92918db68b4d40c56fed`
- `apps/mobile/src/features/recommendations/engine.ts` - 17809 bytes - sha256 `ccd83caffac064fa690bb5acbf67ec350a86398ce64f22e5f3ecc06ca691693d`

### cosmeticChemistry - Smart shelf labels

- Worklist ID: `cosmeticChemistry:smart-shelf-labels`
- Status: Not cleared
- Required reviewer: qualified cosmetic chemist/formulator
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `080a891eec17f2ca278d95b6daef8603b7d2b3a1c56bd8490b9e82b3eb36c2c3`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm terms are cosmetic, not medical.

Sources:

- `apps/mobile/src/features/shelf/analytics.test.ts` - 543 bytes - sha256 `fce0e7cd2128b9c01644369a7dde86d178f44aaa80b0c7f9a58079ab08d4cc17`
- `apps/mobile/src/features/shelf/analytics.ts` - 599 bytes - sha256 `1e514f5fc1a96111a8b792dc8841ad41a11130dd6de7031eb08a353f85ef1050`
- `apps/mobile/src/features/shelf/categories.test.ts` - 2124 bytes - sha256 `4aae0710713ddf321c7cb078b8434b4c77931270f68591802be2d2366cbdf4a9`
- `apps/mobile/src/features/shelf/categories.ts` - 2691 bytes - sha256 `4a08833bd1d80b64748e2b8b635c2e39dce596d2eef4d52ea36f39912bac29d0`
- `apps/mobile/src/features/shelf/expiry.ts` - 1306 bytes - sha256 `0846816c55e3ccab674ba04ab9b9332eef7e7301436620fbaaf9fea2fa9cb734`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 2976 bytes - sha256 `3ab2cc0066fb2c9880b8a294424fcf15b21b749e39106b95fda14153bab5b962`
- `apps/mobile/src/features/shelf/freshness.ts` - 3758 bytes - sha256 `db7f03175302ca10c75668056d8ca1ce0ff3f41de06b36e8428e09437ddc1ee2`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 1325 bytes - sha256 `39696409e00d951d5a8d57b065b35f051bdc12a791471d8564c146446dc1dd73`
- `apps/mobile/src/features/shelf/IntakeContext.tsx` - 2833 bytes - sha256 `afc1156ac26b2a759511c95e8acc7f84ab8b6487d46f72c359c3dc4fee6c3252`
- `apps/mobile/src/features/shelf/labels.ts` - 947 bytes - sha256 `b39bac34c85280eda82ce9b8a5e3d8ea31d90dcd3e53f6daeb636cd0df0a8552`
- `apps/mobile/src/features/shelf/LocalDateField.tsx` - 1765 bytes - sha256 `e0b6cc071362f286582498c4333650d0ead57b58dbc6cc9f270e53c70e1e87a4`
- `apps/mobile/src/features/shelf/metadata.ts` - 1352 bytes - sha256 `3d5ea0795d0b2460a4d14b070496a41c84fc5cbaac0431e05f0c48d2ca29194e`
- `apps/mobile/src/features/shelf/mutations.ts` - 7190 bytes - sha256 `0e7259ca6764665b6ca46ad82d3f9634d06d4a713966bbf54d95109443f439de`
- `apps/mobile/src/features/shelf/pairedConflicts.ts` - 766 bytes - sha256 `eb4cc3b857828ae8d123890b0771a44fe57e73e29da3e6207604fd3ed640a918`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 508 bytes - sha256 `dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3`
- `apps/mobile/src/features/shelf/scanLog.test.ts` - 5724 bytes - sha256 `ccf91fca6b913eeb1b5c46c29320a2fbf640bc66d0688a57a6632d505ce43ac5`
- `apps/mobile/src/features/shelf/scanLog.ts` - 2544 bytes - sha256 `b573ee6ea5a07aca95196a3f9a2b25a0c5e38acad442a42c6172146a1b23d0fc`
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts` - 46944 bytes - sha256 `2f45fdbde9cd192859748f334866f575099991a691ad408b3937d15306ee16a5`
- `apps/mobile/src/features/shelf/store.test.ts` - 11630 bytes - sha256 `9f17b0e0fa83743dcdf058fc8dcf5bea2201e7c65537a75a9d4288de0c73b0c2`
- `apps/mobile/src/features/shelf/store.ts` - 16642 bytes - sha256 `2f155ccad6592e2381dacc525477bf862b81bc15597e61a01af0a28311861fa8`
- `apps/mobile/src/features/shelf/useShelf.test.ts` - 4753 bytes - sha256 `63d228877532e01ded924cfc5693c6789ee2a311207ebc840e8bc88a1b6b69ac`
- `apps/mobile/src/features/shelf/useShelf.ts` - 10850 bytes - sha256 `30250aed26eef5b6a2509541301728db5c26aff4ca1cbb2270596f8b70071edb`

### privacySecurity - Health-data consent and withdrawal

- Worklist ID: `privacySecurity:health-data-consent-and-withdrawal`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `b1840ccee9b88bb5d70524b60679e2d657e3c84341683ed1d076854dfcaffbc0`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Review age -> consent -> goals ordering; immediate local/server freeze; exact deletion/preservation scope; legacy users; terminal-only fresh reconsent; installed-client rollout; minimized receipt retention; Supabase backup/restore; processor versioning; and final consumer-health notice.

Sources:

- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`
- `docs/store-privacy-inventory.md` - 31965 bytes - sha256 `620804f163e296ed0faac3bff466fe47f16c86ae5789b8f7bde687938a2342a7`
- `docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md` - 32996 bytes - sha256 `91b3cf005056be01faaed0fe845bb5beef4068dfcb32753b581edf4a10f8deb4`
- `docs/hugeToDo/health-processor-inventory-v1.json` - 3039 bytes - sha256 `fe43760534c95ef96f53d9c5375d2c8646a14230d3dc5f34fb36a73b80990674`
- `docs/hugeToDo/credential-inventory.json` - 22214 bytes - sha256 `8424ffa22560bc3a82d0b820cc79d509e2de54dea5c1a0ae353ad09ada160d3f`
- `apps/mobile/src/features/onboarding/consentCopy.ts` - 5658 bytes - sha256 `6e0cc1d6de3cad0b84c5cdb7463ed8b171820a9e436d5075f3b54623e6a47034`
- `apps/mobile/src/features/onboarding/healthConsentStore.ts` - 7274 bytes - sha256 `3a9356ffd904a36fc034b5650f98f932f0517a3dc2ed4532e774787e57ea92e3`
- `apps/mobile/src/features/scheduler/profile.ts` - 5457 bytes - sha256 `43bc89ef7998fc04c548340e7b85b10334b5f36ac1e195eaf74e5e043e6525f3`
- `apps/mobile/src/features/healthConsent/activationInterlock.test.ts` - 7300 bytes - sha256 `56ae9f642fb7b71eed61d3fbbaa1c3345791688435c265a46c6dd5a22a072312`
- `apps/mobile/src/features/healthConsent/activationInterlock.ts` - 4493 bytes - sha256 `bc07baebb5133b36e5a6cdec09e76f9776442f4c6261090b0f82e219a0f5d0e1`
- `apps/mobile/src/features/healthConsent/dependentConsentCleanup.test.ts` - 5128 bytes - sha256 `565ec081b99bd1c2548cba7a725de6bd6a550239b68712fbf9f74e029b7e899a`
- `apps/mobile/src/features/healthConsent/HealthDataActivationMount.test.ts` - 6015 bytes - sha256 `959dc00e71eaf0053908c2ad3095177b9dab19d535ea21e3549f9d76ec1bd8b7`
- `apps/mobile/src/features/healthConsent/HealthDataActivationMount.tsx` - 3261 bytes - sha256 `aef498d084e3233bba3ed43315193e52a3b308e5a6d0f37108cb66ea3c114611`
- `apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts` - 6504 bytes - sha256 `f56e2bbb8c971ac55fa0f677c351f3a1bbd323a981f0ce15fbba4dc61b446f71`
- `apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx` - 31585 bytes - sha256 `9caaf70078a24d3aacec87691bbe56a73314726d3c2f89edad33f340079478a9`
- `apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts` - 12354 bytes - sha256 `cace0f73d9bc3f95aad8c3e5fbad2036e942dea56523098256b94f992e0a5904`
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
- `apps/mobile/src/lib/consent/dependentConsentContract.ts` - 9035 bytes - sha256 `780d5474dc8fc7ce995b6215d858f7fad2df2b3ffc34488ecb14466b5d9325c5`
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
- `apps/mobile/src/lib/consent/healthDataWriteAdmission.ts` - 5929 bytes - sha256 `f99ebd3f1f5120671e7702b0c7e1a55adde2f316bb8ddb9a0b5e5fedeb1af109`
- `apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts` - 10182 bytes - sha256 `bb21dbffc0a0cbc51caffdfd04c3c374b093623b150188b92acb28a0bacfe0d6`
- `apps/mobile/src/lib/consent/healthProcessingEpoch.test.ts` - 18018 bytes - sha256 `5bfe73fe0b706557cfeabaa94bc964a891e2f07c2315667506da696c00d392fd`
- `apps/mobile/src/lib/consent/healthProcessingEpoch.ts` - 17870 bytes - sha256 `c4b94c58bf99fedd072ab1f040d4609386581864f5bdda8dd442ab573e0c39a9`
- `apps/mobile/src/lib/consent/withdrawal.test.ts` - 13554 bytes - sha256 `a8756f43ce2e8cd74c32d0cb1432e58844f0dcbe1f506549f015e4f985838df6`
- `apps/mobile/src/lib/consent/withdrawal.ts` - 10772 bytes - sha256 `b7d21990c41149b67ffc4654fc1aa6a0a9d730d5d762a0a3a3508389635c229f`
- `apps/mobile/src/features/settings/actions.ts` - 21753 bytes - sha256 `d43c040013c0a79c7a91c329aa68a98d9f40406151fe9ca7b5f6d7f3b563dc91`
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
- `scripts/phase9/health-processor-inventory-smoke.mjs` - 7408 bytes - sha256 `87d5bafca4ebe1f391407d888a7cfd1ca2531362e0f0446e9767f37bcacc264a`

### privacySecurity - Photo privacy and local storage

- Worklist ID: `privacySecurity:photo-privacy-and-local-storage`
- Status: Not cleared
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `3482b72e0a8ec2f8ced6fb2afca898ec054587c5702c7b30bf47968a5e3c17fe`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Physical-device encryption/restart/delete and explicit-share-only posture.

Sources:

- `docs/06-photo-progress.md` - 47692 bytes - sha256 `36073a018dbaaee73df42eb50d21c3d54501412a3a46ee78988ec25971b1e58d`
- `apps/mobile/src/features/photos/consent.ts` - 1267 bytes - sha256 `2349c73a64860f76611e7e72017bdd15de7a3bf068e348bcfdc39cd977a72100`
- `apps/mobile/src/features/photos/encryptedStorage.ts` - 25272 bytes - sha256 `6095256304aeebab4b7be41ddaea52002cfdc3a87c4ed8ce9b4f3dceeb7c4fd5`
- `apps/mobile/src/features/photos/store.ts` - 17941 bytes - sha256 `88c92a487d9e8823406c443f7289ec89ed1074ae3d902b698c3b0765401358fc`

### privacySecurity - Trend and cloud-backup consent

- Worklist ID: `privacySecurity:trend-and-cloud-backup-consent`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `41af5a6e9c8e58a58b096561e2eca1256f37f162874abf5105f31dce881ad7e7`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Fairness/legal review and live consent ledger evidence are required.

Sources:

- `apps/mobile/src/features/trend/applyConsentChoice.test.ts` - 2646 bytes - sha256 `86e179a895d4f1c9d78b468c4d0450e7caf4679818549e5b849812a9187fcdd7`
- `apps/mobile/src/features/trend/applyConsentChoice.ts` - 506 bytes - sha256 `8322b4a9b03c8edc25f6e07761ea4a923159edc90cf8002712aca36a815758a9`
- `apps/mobile/src/features/trend/claimsafety.test.ts` - 5885 bytes - sha256 `15e1553b3f22d7585e7c2b507e745a2e3eb9b66566a781927f8b06900e86398d`
- `apps/mobile/src/features/trend/consent.test.ts` - 2117 bytes - sha256 `d38f73eedc62e72285f015ffd150096ab87f1e0d358658a7e09570f0f5639c51`
- `apps/mobile/src/features/trend/consent.ts` - 1022 bytes - sha256 `17975a720bbe22bd6ca95449308c0d8c33d54377bebd5c17c7956e38f7103acc`
- `apps/mobile/src/features/trend/copy.ts` - 5381 bytes - sha256 `804c809a7f3acdebf3293fdb738d18524e6e3aa8095e78c0f00de0cf8cfc9318`
- `apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts` - 3425 bytes - sha256 `d4b9128f7a7309f2117d3df3ef5016950bf4cd9a58ce2a253dc3517288fda6e1`
- `apps/mobile/src/features/trend/store.test.ts` - 2466 bytes - sha256 `ba5aff392e2b0cec9abf07ecf89a8b14415ff5923795f484990e42bfe2c06ad3`
- `apps/mobile/src/features/trend/store.ts` - 2119 bytes - sha256 `7dff9753d4e1d2334a9e4b82be2eea727f8a16b5967051beeaefcffe69a7dc0e`
- `apps/mobile/src/features/trend/trend.test.ts` - 3224 bytes - sha256 `797f4e43ac5724fce8c6df388bdd6c84514ff8a10626f6c7866b8fb47bf3733b`
- `apps/mobile/src/features/trend/trend.ts` - 3598 bytes - sha256 `3a7c314b74b0ff8e166f1aa55f710745ad6d743793bc5f65441c1675d7aeb24d`
- `apps/mobile/src/features/trend/TrendInsight.tsx` - 2322 bytes - sha256 `d033b5f0572da342702b29f72ee2864808757525f2804a688789c79661029c1b`
- `apps/mobile/src/features/trend/trendRoutes.test.ts` - 3695 bytes - sha256 `3f4c93276730c9725fe274b70587c539316f924f03ef6b328aaa7dff2739bab7`
- `apps/mobile/src/features/trend/useTrend.ts` - 3487 bytes - sha256 `f2ba58512a8322ad112f66d79762743c97856d2770a248185f71e065b9609df5`
- `apps/mobile/src/features/photos/consent.ts` - 1267 bytes - sha256 `2349c73a64860f76611e7e72017bdd15de7a3bf068e348bcfdc39cd977a72100`

### privacySecurity - Ask, commerce, and community consent

- Worklist ID: `privacySecurity:ask-commerce-and-community-consent`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `036fb9237f9fc6049bf049b192dc3e68c25c151071abe162a840f0f89ff83d1e`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Vendor/partner sharing and withdrawal copy must be reviewed.

Sources:

- `apps/mobile/src/features/ask/consent.ts` - 833 bytes - sha256 `ba732d8c83bd8951f2c33a11ef7555bd2d6ee23dd1b02d6bfb8de20cd219885b`
- `apps/mobile/src/features/commerce/consent.ts` - 1227 bytes - sha256 `355ba414c9719156b12c5772e9550d986f64b312395f82dde8e313e20ab1b5ef`
- `apps/mobile/src/features/community/consent.ts` - 1121 bytes - sha256 `9bacdd40ad62d380a482bb4de5f911c62b87a03002d95ac8b4f4fb7d6a2ae8c6`
- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`

### privacySecurity - Account deletion and data export

- Worklist ID: `privacySecurity:account-deletion-and-data-export`
- Status: Blocked
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `30321d89f2d1fee569dc173e2cafa92cd5dc9852e57f7f63196b5aedf9b6d04e`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Must prove owner-scoped staging server data, seeded local coverage, reverse-trial/service-event completeness, deletion/vendor scrubbing, redaction, and native cache cleanup.

Sources:

- `apps/mobile/src/features/settings/actions.ts` - 21753 bytes - sha256 `d43c040013c0a79c7a91c329aa68a98d9f40406151fe9ca7b5f6d7f3b563dc91`
- `apps/mobile/src/features/settings/localDeviceExport.ts` - 12735 bytes - sha256 `5bac79d437c1a3446a2bb3c84c99aa5a67485a0f48ac1d08c27e1120279ddbbb`
- `apps/mobile/src/features/settings/localDeviceExport.test.ts` - 10334 bytes - sha256 `33f7d0b41d5325c56f08b3d0a4601b5aa6840eac0c8c7d5bf544deb1f06fc470`
- `apps/mobile/src/lib/storage/privateKV.ts` - 26761 bytes - sha256 `8d81f1091e59e824f2db61a2699defe04d48330b77ac0720264fe5d80cad8c69`
- `apps/mobile/src/lib/storage/privateKV.test.ts` - 31043 bytes - sha256 `aed5c6cbd8fcd6faa8db3bbe469d0b509d6cc95822c8e0b7d254171a77d6b8ba`
- `apps/mobile/src/lib/legal/policyLinks.ts` - 722 bytes - sha256 `0fe9cf269e6b5e48119771f7b111d1620c095ffe35bb6ac56f63c2cd2ec1c863`
- `supabase/functions/account-deletion/index.ts` - 1722 bytes - sha256 `d4fd2917de31d91d010788a3c45d390de61fefd770f090ff5f1242f385b2f7f2`
- `supabase/functions/data-export/index.ts` - 22658 bytes - sha256 `78097b7d4cbbcdd3bb4194ccb97d7fcf3217af111b9de64d72238006a23bcd94`
- `supabase/functions/data-export/exportCore.ts` - 16251 bytes - sha256 `ef8828ff0f29dff17cebfca4064860ec2549a249023d9621385d7bce70a9a9bd`
- `supabase/functions/data-export/exportCore.test.ts` - 12978 bytes - sha256 `f952985bb4a7d3679c5d4752896c72e25540f002ddb0a49ba1c510fe5c335b3b`
- `supabase/functions/data-export/exportRegistry.ts` - 9516 bytes - sha256 `2535337af91faa1150aa41fb2d1608385eef6cb0787682399ec0475d7cc6fb41`
- `supabase/functions/data-export/exportRegistry.test.ts` - 7293 bytes - sha256 `6680aaeafc26910dffeca595130a07f13e9f669b27424f40da724883756d9194`
- `scripts/phase9/data-rights-smoke.mjs` - 64113 bytes - sha256 `f2349d336fb4e3967f99703b57cd52013ea2b9b68f8dbeb30a596a5ab174385f`
- `supabase/functions/_shared/storagePath.ts` - 591 bytes - sha256 `9367ade3719c7b7e38a7b090da7d904dd574bb43e29222bf5e8a839d3b377594`
- `supabase/functions/_shared/storagePath.test.ts` - 1355 bytes - sha256 `3caf9cbb38b676c4a96dd9ae3f19479c205a90d31bb83fee7c7474bc76a2a2e9`

### privacySecurity - Analytics and crash payloads

- Worklist ID: `privacySecurity:analytics-and-crash-payloads`
- Status: Not cleared
- Required reviewer: privacy counsel plus technical security owner
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `738714365fa0fe1c00c38c4f8ec450c815704d8e29eb4384bca4c13b28e69d59`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: PostHog/Sentry setup, deletion process, source maps, and payload approval.

Sources:

- `apps/mobile/src/lib/analytics/eventRegistry.ts` - 4208 bytes - sha256 `154066b64567d5ab25cb77e3a6a614f7b604e41ddb3d109c70dc84335b1353cc`
- `apps/mobile/src/lib/analytics/postHogPersistenceCleanup.test.ts` - 3763 bytes - sha256 `e215e3d84ff7e68abfadcfdab15f3e44d23365d436ede7e28361d2335c3760b8`
- `apps/mobile/src/lib/analytics/postHogPersistenceCleanup.ts` - 3542 bytes - sha256 `bc1c70b3507f3761171d9e6a1e613e7225421597b08738f47d588d1244858297`
- `apps/mobile/src/lib/analytics/postHogPersistenceSourceContract.test.ts` - 1959 bytes - sha256 `3a37c224a970201ffa4955a43a5ac8536e03cd964476a13f23662902d11f4c00`
- `apps/mobile/src/lib/analytics/track.test.ts` - 8327 bytes - sha256 `a678c0e1565e96d2e74788413a0d32f482b4bbeb5f4216004f2a2c0b71065a37`
- `apps/mobile/src/lib/analytics/track.ts` - 4644 bytes - sha256 `b705e35e12f4a584bb97abc02df1d6855d44cc725834812a275a077132f9d617`
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
- Review snapshot SHA-256: `0de51e0bf775debe21fc339bd43bd954a9b06a4023e72e88e012c1317c7e718d`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Verify Apple/Google auth, Supabase DPA/region/backups, observed SDK traffic, processor/subprocessor contracts, HBNR posture, breach contacts, retention, deletion APIs, and RLS.

Sources:

- `apps/mobile/src/lib/auth/accountDeletionBarrier.test.ts` - 11926 bytes - sha256 `f6deaafa6e593ee1659449f9d47139e29463e5e130512a09f627953b43c96208`
- `apps/mobile/src/lib/auth/accountDeletionBarrier.ts` - 6939 bytes - sha256 `7045ae7ea23756bb9fd42d5cf19f7552a2adc95b8044e0f146f3b1409fa6f593`
- `apps/mobile/src/lib/auth/accountDeletionBarrierAuthProviderContracts.test.ts` - 6034 bytes - sha256 `5d77260cca93df3ac9c656caeaf5e00e4662657fbb399f8fa3849d731428f9fd`
- `apps/mobile/src/lib/auth/accountDeletionPublication.integration.test.ts` - 21839 bytes - sha256 `36bef420183dcaa3a592ce01de5bda1863abf77072cac84b651bc51447902213`
- `apps/mobile/src/lib/auth/accountGeneration.test.ts` - 6652 bytes - sha256 `d372f38fcf8f24a4c07c3b19e5b7b428ffc4a4d8837d24c065cfa36bfae849d1`
- `apps/mobile/src/lib/auth/accountGeneration.ts` - 5604 bytes - sha256 `aa0a702874069f12a968f4e7edbaa1a35ad5ac3487ffea25ac451d69c7553217`
- `apps/mobile/src/lib/auth/accountIsolationE2E.test.ts` - 1129 bytes - sha256 `797ceccaa982f888ce3c03b7fb36599a314b1614b1f910077b0906bfdc3671a9`
- `apps/mobile/src/lib/auth/accountIsolationE2E.ts` - 1358 bytes - sha256 `6a89dc564d1e760034b85f0a805a1f86f35607ae84f99c4ecb31acd681be4103`
- `apps/mobile/src/lib/auth/accountPublicationAuthProviderContracts.test.ts` - 7640 bytes - sha256 `4083fac6e341994de65d6d007de08ab3dc560206264fddcc0d44674521d60b37`
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
- `apps/mobile/src/lib/auth/AuthProvider.lifecycle.test.ts` - 90811 bytes - sha256 `1896f769677740c7e588db4d5f958e2bc7755f0079ed252163683b3e50b17edd`
- `apps/mobile/src/lib/auth/AuthProvider.tsx` - 101190 bytes - sha256 `3c6c45c4247763a2ee9d89d66739cd97cf432f2cdbe0efb6b0d39178e3215bf9`
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
- `docs/phase-3/data-inventory.md` - 36362 bytes - sha256 `39cf1a9caf5c435fafa23f0074ad4934dfeab6243ef0764949a504b9382a2eda`
- `docs/hugeToDo/health-processor-inventory-v1.json` - 3039 bytes - sha256 `fe43760534c95ef96f53d9c5375d2c8646a14230d3dc5f34fb36a73b80990674`
- `docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md` - 32996 bytes - sha256 `91b3cf005056be01faaed0fe845bb5beef4068dfcb32753b581edf4a10f8deb4`

### ipFto - Brand and trademark clearance

- Worklist ID: `ipFto:brand-and-trademark-clearance`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `31fda6a360e4479b80aff335c8a464764b9404de307a16550eb9c68537131a87`
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
- `apps/mobile/app.base.json` - 3981 bytes - sha256 `c741d1b60cc04f354955316d29a581274b208789dc8c357c49494a3584bfbb84`
- `apps/mobile/app.config.js` - 15355 bytes - sha256 `2355312e00ff824a4092e5ab8d0a16b35e0e4910afaffaa1edf15f18d7f2ce43`

### ipFto - Native identifiers and callbacks

- Worklist ID: `ipFto:native-identifiers-and-callbacks`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `f0b9ac3c1967f5a52d7314fc26c9c428ad65c5145fab90aba2593e99d5df3677`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Final bundle ID, package ID, URL scheme, and auth callback allow-lists.

Sources:

- `apps/mobile/app.base.json` - 3981 bytes - sha256 `c741d1b60cc04f354955316d29a581274b208789dc8c357c49494a3584bfbb84`
- `apps/mobile/app.config.js` - 15355 bytes - sha256 `2355312e00ff824a4092e5ab8d0a16b35e0e4910afaffaa1edf15f18d7f2ce43`
- `supabase/config.toml` - 3705 bytes - sha256 `9e9a43474b23512ede53dc855800a5671da39255ad65babec0263241bc08154a`

### ipFto - Onboarding quiz FTO

- Worklist ID: `ipFto:onboarding-quiz-fto`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `96703b4bd2969d7b5920bd97fd42ad28b302517d8514cdd470173929cf38415e`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Compare against SkinSort and competitor onboarding/typing flows.

Sources:

- `docs/phase-3/quiz-fto-summary.md` - 2050 bytes - sha256 `ac8ad15f610d262d05c9196ad952a276e3b1f2cfafcdf4e7d4c09fda635e1ba6`
- `apps/mobile/src/features/onboarding/quiz.ts` - 11021 bytes - sha256 `e467bfb1e6605e41cb2e62e764ff33cefbed98a936c94150de1a704654d23527`
- `apps/mobile/src/app/onboarding/quiz.tsx` - 6966 bytes - sha256 `f1c41f3ab0f5c2c5db45d78582dc9ea269d70b6cdf1512958b686c447b60d9aa`
- `apps/mobile/src/app/onboarding/reveal.tsx` - 5488 bytes - sha256 `f38ab745a996a1cdc4aef4fabb6d8119fe51c3e59dcff47d177e40fc41cda31d`

### ipFto - Public positioning differentiation

- Worklist ID: `ipFto:public-positioning-differentiation`
- Status: Not cleared
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `245c39dc1ed92bfb8018d8d620dd09461b74e3ed3e84aa8fdc5846f4ac9cb832`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Confirm copy avoids competitor confusion and unsupported superiority.

Sources:

- `docs/phase-3/regulatory-positioning-memo.md` - 8472 bytes - sha256 `e0118d857672f79febfbc4c19491f967e1624db92a89698db66d479d334d4c9a`
- `docs/phase-3/store-metadata-review.md` - 2533 bytes - sha256 `eaaefbb8f09bf99b12888fa847a13b2c93bbc585c61c1f07d48759858d8dd8b1`
- `docs/14-growth-to-seven-figures.md` - 57855 bytes - sha256 `a88aa20f72a65f653000e1c445878403e6effb983cc40181168e7de804a1dfd0`

### ipFto - Catalog source and image rights

- Worklist ID: `ipFto:catalog-source-and-image-rights`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `3a92e49b047ccea289eecc649bda2f297be4142b8a766dfee8415ae06e8e9d2f`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: ODbL/source/image-rights posture and attribution obligations.

Sources:

- `docs/phase-4/catalog-source-memo-cosing.md` - 6696 bytes - sha256 `4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 10698 bytes - sha256 `e9214896b57d59414865dd221ae14f8ca811a47190d1b1ab247781f389c424bf`
- `docs/phase-4/odbl-compliance-memo.md` - 5099 bytes - sha256 `ed14fda2e129ee22293ab5d28433626971c0ba8998034547e5f15dc23746c191`
- `apps/mobile/src/features/catalog/client.test.ts` - 12335 bytes - sha256 `92250d319ea33fc14bb57c0bf131e732847762036f9ed132788033aea0c78dbd`
- `apps/mobile/src/features/catalog/client.ts` - 11357 bytes - sha256 `ac891d9253e2f2d81be440eda468ab02d0f9e3afddb84822be14f9a48f451438`
- `apps/mobile/src/features/catalog/copy.ts` - 1913 bytes - sha256 `b182cec74cb72f850e83dcca14a5548c6277d73a9eaac229f6062e665090f958`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 1497 bytes - sha256 `fc196a7b95de58ed71a6deff1d9df7afb4ea394b00ca482e8b1eae27204baf25`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 6913 bytes - sha256 `1030094651254b5e6a934ae515bd42bf2f10ba10229b1164a12d3fd2ca99eee4`
- `apps/mobile/src/features/catalog/normalization.test.ts` - 750 bytes - sha256 `255e781eb918fc8581ff91fa9048309b1e2560b204c9b66216ccc5bb0e9de759`
- `apps/mobile/src/features/catalog/normalization.ts` - 2203 bytes - sha256 `9d4f8294db57ab98b4fa6a2997e29512a11ccf91a18e3273c7312c7117393ac7`
- `apps/mobile/src/features/catalog/obf.test.ts` - 1862 bytes - sha256 `730dbc1d7f7d7610b0a4d73ca45efadb375768af806c634763c000fb81206e2f`
- `apps/mobile/src/features/catalog/obf.ts` - 4536 bytes - sha256 `fd176cfb945b3543b342acadc6f40c333d6c6b484023884998a6f448ebadd2b6`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2258 bytes - sha256 `b5187f33001f741cdb8636ad61343f072502b60ffe2fba70b5e831fce570e599`
- `apps/mobile/src/features/catalog/quality.ts` - 4663 bytes - sha256 `7156ff221071cf6ab90c3558c20d084c53e1f48d0025843ebea5275929103e53`

### ipFto - Share-card marks and deep links

- Worklist ID: `ipFto:share-card-marks-and-deep-links`
- Status: Blocked
- Required reviewer: qualified trademark, copyright, and product/FTO counsel
- Current reviewer/date: TBD / TBD
- Review snapshot SHA-256: `a191de682d4388380ef6e5bdd7992a2b86cfc8d5a412cbdfaa615f3d3beac1c5`
- Detached signoff: not-applicable
- Required evidence: Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.
- Review-log notes: Final watermark, domain, Universal Links/App Links, and attribution copy.

Sources:

- `apps/mobile/src/features/growth/cardCopy.test.ts` - 2319 bytes - sha256 `c288a67751c6a181f80c8a93933f2aee36fd7d286d0f7f3faee72e42716d45c9`
- `apps/mobile/src/features/growth/cardCopy.ts` - 1017 bytes - sha256 `e9f3d09dfa1ba628dd883088e2b67976eaa2164c3a509e5808f54435ef991776`
- `apps/mobile/src/features/growth/ConflictCard.tsx` - 4790 bytes - sha256 `af9704a8f4b431594d59fff460d6c162ccfd8fb3ee7408ea20a29f57664b01fc`
- `apps/mobile/src/features/growth/shareCard.test.ts` - 5266 bytes - sha256 `e5e46d4018c95d6b7c14a1239acd51108b830618a0332824737a9bd7b4e0ca82`
- `apps/mobile/src/features/growth/shareCard.ts` - 1967 bytes - sha256 `e8254e8c72c51ea30f3fad1d9259e6c810c114bea2ee3d5bcabe89b00c936436`
- `apps/mobile/src/features/growth/shareLandingRoute.test.ts` - 1531 bytes - sha256 `a2359a07e6efe0b61846a85c42757284975ebedd05e2085dc6e8a9589da546ae`
- `apps/mobile/src/features/growth/shareLinks.ts` - 1224 bytes - sha256 `0173ed4e39393e7c16a597b305f15c02b471f70041574ca785d161137a4b7e4d`
- `docs/14-growth-to-seven-figures.md` - 57855 bytes - sha256 `a88aa20f72a65f653000e1c445878403e6effb983cc40181168e7de804a1dfd0`
- `docs/brand-decision-memo.md` - 6469 bytes - sha256 `c2506dfb241232eb5bab07ed5aa4a5d24900790a36c54eed6af7d615d767b612`

## Blockers

- None.

## Warnings

- None.
