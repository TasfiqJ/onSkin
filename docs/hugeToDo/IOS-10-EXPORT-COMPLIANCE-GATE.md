# IOS-10 Export Compliance Gate

Date researched: 2026-07-13

Applies to: exact RoutineKind iOS binary and US-only Wave 1 availability

Status: **blocked pending qualified export review and App Store Connect evidence**

This packet is an engineering and release-control record, not legal advice and
not an export classification. Neither Apple approval nor legal compliance can
be guaranteed by source code, a checklist, or an environment variable. The
Account Holder remains responsible for accurate App Store answers, and a
qualified U.S. export reviewer must classify the exact shipped binary.

## Release Decision

Do not hard-code `ITSAppUsesNonExemptEncryption=false`, do not answer Apple's
encryption questionnaire from memory, and do not distribute a production or
external-TestFlight build until the evidence in this packet is complete.

The app contains encryption implemented outside the Apple operating system:

- `@noble/ciphers` XChaCha20-Poly1305 protects progress-photo files, encrypted
  private key/value records, and large persisted auth/session values.
- `aes-js` AES-CTR remains in the binary as a read-only legacy migration path
  for prior large secure-store records.
- Expo SecureStore/Keychain protects content keys, and network SDKs use TLS.
- Expo Crypto performs hashes and random-value functions in additional flows.
- Linked native and JavaScript dependencies may add cryptography beyond the
  first-party imports above.

Apple expressly says the determination covers encryption the app "uses,
accesses, contains, implements, or incorporates," including third-party
libraries. The fact that the product uses standard algorithms for privacy, or
that distribution starts in the United States, does not by itself prove an
exemption.

The repo now enforces this release posture:

- Development and staging config leave Apple's declaration unset so internal
  work can continue without inventing a legal result.
- Production config fails unless
  `EXPORT_COMPLIANCE_CLEARANCE=cleared` and
  `APP_ENCRYPTION_CLASSIFICATION=exempt|non_exempt` are explicitly supplied.
- An `exempt` reviewed result writes
  `ITSAppUsesNonExemptEncryption=false`.
- A `non_exempt` reviewed result writes
  `ITSAppUsesNonExemptEncryption=true` and also requires the approved
  `APP_ENCRYPTION_EXPORT_COMPLIANCE_CODE`.
- These flags encode a retained professional decision; they do not create one.

## Primary-Source Rules

### Apple submission rule

Apple's current [export-compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/)
says an app that uses, accesses, contains, implements, or incorporates
encryption must determine its export-compliance requirements before upload,
testing, and distribution. Apple also says the developer is responsible for
reviewing the U.S. Export Administration Regulations and the liability from an
incorrect exemption claim.

Apple's [`ITSAppUsesNonExemptEncryption` reference](https://developer.apple.com/documentation/BundleResources/Information-Property-List/ITSAppUsesNonExemptEncryption)
defines `NO` as meaning the app, including every linked third-party library,
uses no encryption or only encryption exempt from export-compliance
requirements. `YES` means non-exempt encryption and normally accompanies an
Apple-issued `ITSEncryptionExportComplianceCode`. Omitting the key causes App
Store Connect to ask the questions for each uploaded version; omission is safer
than a false declaration while classification is open.

Apple's [documentation matrix](https://developer.apple.com/help/app-store-connect/reference/export-compliance-documentation-for-encryption/)
currently distinguishes:

- encryption limited to the Apple operating system;
- an industry-standard algorithm not provided by the Apple operating system;
  and
- proprietary or non-standard algorithms.

It states that the French encryption declaration applies when distributing in
France. Wave 1 is US-only, so no French filing should be claimed or uploaded for
Wave 1 unless Apple or counsel determines otherwise. France must not be added
to availability without a new territory review.

Apple's [submission workflow](https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation/)
requires an Account Holder, Admin, or App Manager to answer the questionnaire
and upload required material before TestFlight App Review or App Review. Apple
reviews documentation case by case and supplies the code used in the binary
when documentation is approved. The corresponding
[TestFlight procedure](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-export-compliance-information-for-beta-builds)
must be completed for a build marked Missing Compliance.

### U.S. export-control rule

The Bureau of Industry and Security's current
[15 CFR section 740.17 presentation](https://www.bis.gov/regulations/ear/740)
describes License Exception ENC for qualifying encryption commodities,
software, and technology and identifies classification and self-classification
reporting obligations for specified mass-market executable software and other
encryption items. It also excludes destinations and persons covered by Country
Groups E:1/E:2 from the authorization.

BIS's current [15 CFR section 742 presentation and Supplement No. 8](https://www.bis.gov/regulations/ear/742)
explains that encryption software is controlled for its functional capacity to
encrypt. Following classification or self-classification, qualifying
mass-market items under the Category 5 Part 2 Cryptography Note may be
classified under ECCN 5D992, and Supplement No. 8 specifies information for
applicable self-classification reports. The official text, its effective date,
destination restrictions, sanctions rules, and any reporting exception must be
checked again when the release binary is ready.

Engineering must not infer an ECCN, License Exception ENC paragraph, reporting
exception, CCATS requirement, or sanctions result. Those are review outputs.

## Exact Repository Cryptography Inventory

This is a source inventory for a reviewer, not a complete binary finding.

| Component                                                                             | Current use                                                                                    | Algorithm / key facts                                                                           | Review significance                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/features/photos/encryptedStorage.ts`                                 | Encrypts private progress-photo bytes and photo text envelopes on device                       | XChaCha20-Poly1305; 256-bit random content key; 192-bit nonce; content key in Expo SecureStore  | User-data confidentiality is a core product function, not authentication-only cryptography        |
| `apps/mobile/src/lib/storage/privateKV.ts`                                            | Encrypts local health-adjacent preferences, routines, consent state, and other private records | XChaCha20-Poly1305; 256-bit random content key; per-record random nonce; authenticated envelope | General local data encryption implemented in JavaScript outside the Apple OS                      |
| `apps/mobile/src/lib/supabase/largeSecureStoreCrypto.ts`                              | Encrypts large persisted auth/session values                                                   | XChaCha20-Poly1305 for current writes                                                           | General data encryption outside the Apple OS                                                      |
| same large secure-store module                                                        | Reads prior records for one-way migration                                                      | AES-CTR through `aes-js`; fixed legacy counter behavior; no new legacy writes                   | AES implementation remains linked even though its operational use is migration-only               |
| `expo-secure-store`                                                                   | Stores local content keys and sensitive small values                                           | Apple Keychain/native platform protection                                                       | Apple-OS cryptography is present in addition to app-provided cryptography                         |
| `expo-crypto` and hashing calls                                                       | Consent-copy hashes, owner identifiers, and related integrity/identity functions               | SHA-256/random APIs where invoked                                                               | Reviewer must distinguish hashing, authentication, and confidentiality functions                  |
| Supabase, RevenueCat, Sentry, PostHog, Apple/Google auth, Expo Updates and other SDKs | Network transport, tokens, code/update delivery, authentication                                | TLS and SDK-specific cryptographic code                                                         | Linked libraries are part of Apple's declaration scope and must be included in binary/SBOM review |

Known current first-party design limits:

- The app does not expose a VPN, arbitrary secure messenger, password manager,
  remote administration tool, cryptanalytic tool, or user-selectable algorithm.
- Encryption protects the app's own local photos, records, auth/session state,
  and service communications.
- Users do not provide their own algorithms or key lengths.
- Photos are device-only by launch policy; there is no cloud-photo backup
  feature in the current release.
- The exact native binary may still contain additional SDK cryptography and
  must be inspected after EAS prebuild/linking.

These facts may matter to classification but do not establish the result.

## Required Reviewer Packet

The release owner must provide the qualified reviewer a frozen packet containing:

1. Legal exporter/developer entity name, address, citizenship/incorporation,
   Account Holder, and export-compliance owner.
2. Exact Git SHA, EAS build ID, bundle ID, marketing version, build number,
   runtime fingerprint, build image, Xcode version, and iOS SDK version.
3. Final US-only App Store availability selection and confirmation that France
   and all other territories are off.
4. `package-lock.json`, native dependency lockfiles from the generated build,
   Expo autolinking output, embedded frameworks list, and a software bill of
   materials for the archived `.xcarchive`/IPA.
5. Symbol/binary scans and vendor cryptography declarations for every linked
   SDK, not only direct application imports.
6. The table above reconciled against the exact binary, with algorithm,
   protocol, implementation provider, purpose, key length, key control, user
   configurability, source availability, and whether new encryption or only
   decryption/migration is possible.
7. A data-flow diagram covering local encryption, Keychain/SecureStore,
   Supabase/TLS, RevenueCat, authentication, analytics, crash reporting, and
   EAS Update/code signing.
8. Export destinations, remote-access locations, developer/support access,
   vendors/subprocessors, sanctioned-destination controls, and restricted-party
   screening process.
9. The reviewer's written ECCN or EAR99 result, exact EAR citations, License
   Exception or license basis, mass-market/Cryptography Note analysis, CCATS or
   self-classification requirement, report fields and due date, recordkeeping
   period, territory restrictions, and change triggers.
10. The exact App Store Connect questionnaire answers, documents uploaded,
    Apple case/declaration identifier, approval date, and Apple-issued code if
    applicable.

## Required Signed Decision Record

Retain a signed, access-controlled record with all of these fields:

| Field             | Required value                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Reviewer          | Real name, organization, export-law role/credential, contact                                                     |
| Review date       | Valid ISO date and next review date                                                                              |
| Scope             | Exact binary/build ID, Git SHA, bundle ID, version/build, SBOM hash, launch territories                          |
| Algorithms        | Complete reconciled algorithm/protocol list and purposes                                                         |
| U.S. result       | ECCN/EAR99, exact legal basis, ENC paragraph if used, mass-market result, destination limits                     |
| Filing result     | CCATS, self-classification report, license, exception, or no-filing result with rationale and evidence reference |
| Apple result      | Exact questionnaire answers, exempt/non-exempt result, uploaded documents, Apple declaration/case ID             |
| Info.plist result | `ITSAppUsesNonExemptEncryption` value and compliance code when applicable                                        |
| Conditions        | Every territory, version, algorithm, vendor, feature, reporting, screening, and recordkeeping condition          |
| Approval          | Signed disposition and confirmation that all conditions are satisfied                                            |

Store the retained reference in the release evidence workspace. Do not commit
private legal correspondence, personal data, account credentials, or export
codes to the public repository.

## Release Workflow

1. Freeze the release candidate and dependency graph.
2. Generate the native iOS project/archive through the reviewed EAS profile.
3. Capture the resolved EAS image, Xcode/iOS SDK, entitlements, frameworks,
   privacy manifests, SDK signatures, and binary/SBOM inventory.
4. Reconcile every encryption implementation against this packet.
5. Obtain the signed U.S. export decision and complete any filing/report before
   the deadline specified by the reviewer.
6. Have an authorized App Store Connect user answer Apple's questionnaire for
   this exact app and availability set.
7. Upload and obtain approval for any required documentation; retain Apple's
   declaration/case ID and compliance code.
8. Set production EAS environment values from the signed result:

   ```text
   EXPORT_COMPLIANCE_CLEARANCE=cleared
   APP_ENCRYPTION_CLASSIFICATION=exempt
   ```

   or, only when Apple's approved result is non-exempt:

   ```text
   EXPORT_COMPLIANCE_CLEARANCE=cleared
   APP_ENCRYPTION_CLASSIFICATION=non_exempt
   APP_ENCRYPTION_EXPORT_COMPLIANCE_CODE=<Apple-issued value>
   ```

9. Resolve the production Expo config and inspect the resulting Info.plist;
   do not rely on environment screenshots alone.
10. Upload the exact reviewed build, clear any Missing Compliance state, attach
    the declaration to TestFlight/App Review as required, and retain the final
    App Store Connect evidence.

## Acceptance Evidence

IOS-10 can advance only when all of the following are true:

- the exact archived binary/SBOM is reviewed, not merely the TypeScript source;
- the signed decision identifies the exporter, ECCN/EAR basis, filing and
  reporting posture, territories, and change triggers;
- required BIS submissions or classification material are completed and
  retained where applicable;
- Apple's exact questionnaire is completed by an authorized account role;
- required Apple documentation is approved and attached to the build;
- resolved production Info.plist matches the signed exempt/non-exempt result;
- TestFlight no longer reports Missing Compliance;
- the App Store availability list matches the reviewed territories; and
- no dependency, algorithm, purpose, key length, remote-access model, entity,
  or territory changed after review.

## Refusal Conditions

Do not build, upload, externally test, submit, or release the candidate when:

- the reviewer or legal exporter is unnamed;
- the decision covers source code but not the actual linked binary;
- XChaCha20-Poly1305, AES migration code, or any SDK cryptography is omitted;
- someone proposes `false` because the algorithm is "standard," the data is
  local, or the app is initially US-only;
- the BIS classification, ENC paragraph, reporting requirement, or destination
  limits are guessed;
- required filing/reporting evidence is missing or expired;
- Apple's questionnaire result and Info.plist disagree;
- a non-exempt result has no approved Apple compliance code;
- App Store Connect shows Missing Compliance;
- France or another unreviewed territory is enabled;
- the binary, SBOM, cryptography, vendor set, entity, or availability changed
  after the retained decision; or
- credentials, export codes, or private legal evidence would need to be
  committed to make the build work.

## Mandatory Re-review Triggers

Repeat this gate before release whenever any of these changes:

- cryptographic dependency, version, algorithm, mode, key length, protocol, or
  implementation provider;
- local-only photo posture, cloud backup, sharing, messaging, remote access,
  authentication, EAS Update, or security feature;
- linked SDK/framework list or vendor/subprocessor;
- bundle ID, developer/exporter entity, build pipeline, or signing owner;
- App Store territory, developer/support location, or remote-access location;
- U.S. EAR/BIS rule, sanctions list, Apple questionnaire, or Apple documentation
  requirement; or
- reviewer conditions, classification, filing, reporting, or Apple approval.

## Current Open Questions For The Qualified Reviewer

1. What is the exact ECCN/EAR basis for this consumer iOS app and its bundled
   XChaCha20-Poly1305 implementation?
2. Does the executable qualify for the Category 5 Part 2 Cryptography Note and,
   if so, under which precise path and conditions?
3. Is a classification request, self-classification report, or other filing
   required, and when must it be submitted?
4. Does retaining AES-CTR decryption solely for migration change the result?
5. Which linked SDKs introduce encryption material relevant to the declaration?
6. Which restricted destinations/persons, developer access paths, and vendor
   locations must be technically or operationally blocked?
7. What exact answers should be entered in App Store Connect for the frozen
   US-only binary, and what evidence must be uploaded?
8. Which changes require a new BIS review, Apple declaration, or compliance
   code?

Until those questions are answered for the release binary, IOS-10 remains
externally blocked by design.
