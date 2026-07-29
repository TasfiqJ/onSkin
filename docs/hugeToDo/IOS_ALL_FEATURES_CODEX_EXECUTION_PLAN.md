# iOS All-Features Codex Execution Plan

Date: 2026-07-12

Status: Active execution charter requested by the founder

Primary delivery owner: Codex

Release platform: iOS only

Release mode: Every current indexed and gated product feature is required

## 1. Purpose

This document is the authoritative execution contract for taking this repository
from its current local/scaffolded state to a production iOS App Store launch.

The founder has directed Codex to perform every task that can safely and
legitimately be performed by Codex. The founder should not be handed research,
engineering, configuration, documentation, testing, evidence organization,
vendor comparison, store-packet, or launch-operations work merely because it is
time-consuming. Those tasks are Codex-owned.

The founder-only register in Section 5 is intentionally small. It contains only
actions that require a real legal person, identity verification, payment,
acceptance of binding terms, private financial information, a licensed or named
professional decision, possession of a physical device, genuine beta users,
staffed human moderation/support, or final authorization for a public release.

This plan does not declare any current blocker cleared. It defines who will
clear it, what evidence is required, and how completion will be verified.

## 2. Non-Negotiable Scope

The launch includes all 20 entries in docs/FEATURE_INDEX.md:

1. Rebrand and identity migration.
2. Onboarding, age gate, and consent.
3. Shelf intake through manual entry, search, barcode, and real OCR.
4. Production product catalog import and quality.
5. Reviewed conflict engine.
6. Routine builder.
7. Today check-off and adherence.
8. Skin cycling and ramp scheduler.
9. Private photo progress.
10. Reminders.
11. RevenueCat paywall and entitlements.
12. Reverse trial.
13. Recommendations.
14. Ask advisor, including the production cloud path.
15. Shareable conflict cards.
16. Commerce and replenishment.
17. Community and Skin Notes.
18. Trend insights.
19. Widgets and Live Activities.
20. Admin and operator review tooling.

The launch also includes the currently gated Phase 7 and Phase 8 surfaces:

- Commerce.
- Community posting and community aggregate behavior.
- Trend insights.
- Cloud Ask.
- Widgets.
- Share cards.
- Reviewed conflict sharing.
- Goal-active recommendations.
- Public links.
- Review prompts.
- Creator links.
- Paid measurement.

Android source code may remain healthy, but Android credentials, Play Console,
Android builds, Android device evidence, Play subscriptions, Android App Links,
Android performance evidence, and Google Play testing are not release
requirements for this iOS launch.

Google Cloud OAuth remains in scope only because Google Sign-In is an iPhone
feature. Google Play is not in scope.

Everything in scope must be production-real. A screen, route, fixture, flag,
preview price, simulated result, local-only test grant, inert native target, or
stubbed vendor response is not a completed feature.

This directive does not add product behavior the repository expressly rejects:

- No disease diagnosis, treatment, cure, or prevention claims.
- No AI skin score, skin age, or percentage-improvement claims.
- No commission-influenced recommendation ranking.
- No unconsented cloud photo analysis.
- No public before-and-after gallery without a separate future directive.
- No weakening of Row-Level Security or local-photo privacy.

## 3. Readiness and Evidence Model

Existing readiness labels remain authoritative:

- implemented
- stubbed
- simulated
- inert
- needs-device-verification
- launch-blocked

Evidence maturity is tracked separately:

1. Code complete.
2. Locally verified.
3. Live staging verified.
4. Physical iPhone verified.
5. External professional review signed.
6. Production verified.
7. Store approved.

A feature is launch-ready only when every applicable evidence level is complete.
No environment flag, checkbox, generated packet, or screen appearance may
substitute for missing live, device, professional, production, or store
evidence.

## 4. Ownership Rules

Legend:

- C: Codex owns the task and continues until it is complete or reaches a
  genuine human/external gate.
- H: The founder or another authorized real person must perform the action.
- R: A named external reviewer or staffed human operator must make the decision
  or perform the ongoing duty; Codex prepares and manages everything around it.
- V: A vendor or Apple controls the outcome; Codex prepares, submits when
  authorized, monitors, and responds.

Default ownership is C. A task is not founder-owned merely because it requires
browser work, research, repetitive console configuration, documentation,
testing, or judgment. Codex may operate authorized signed-in browser sessions
and local tools, but must never ask the founder to send raw passwords, MFA
codes, private keys, full payment details, or secret values through chat.

When a human gate is pending, Codex records the exact dependency and continues
the next unblocked task. Pending external work does not pause the whole launch.

## 5. Minimal Founder and External Touchpoint Register

These are the only categories that are not Codex-owned.

| ID   | Owner              | Unavoidable action                                                                                                                                                                           | What Codex still does                                                                                                                  |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 | Founder            | Create/control the Apple Account, complete identity verification and MFA, enroll, and pay Apple membership                                                                                   | Prepare exact enrollment choices, guide the session, verify the resulting team/account, and configure everything afterward             |
| H-02 | Founder            | Choose individual versus organization seller and provide truthful legal-entity information                                                                                                   | Research and recommend the best structure, prepare the information checklist, and validate consistency                                 |
| H-03 | Founder            | Provide banking/tax information and accept Apple or vendor legal agreements                                                                                                                  | Prepare field-by-field guidance, check for inconsistencies, and complete all non-attestation fields                                    |
| H-04 | Founder            | Pay for domains, memberships, professionals, vendors, moderation, or approved usage budgets                                                                                                  | Research vendors and prices, recommend selections, prepare purchases, and track renewals                                               |
| H-05 | Founder            | Complete MFA, CAPTCHA, identity, phone, email, or payment challenges in external consoles                                                                                                    | Operate the authorized session before and after the challenge and complete configuration                                               |
| H-06 | Founder            | Approve the final recommended name after formal clearance and authorize paid reservation/filing                                                                                              | Perform naming research, select the recommended winner, prepare clearance material, and execute the entire migration                   |
| H-07 | Reviewer           | Provide genuine trademark/IP, privacy/legal, clinical, cosmetic-chemistry, and security decisions with real identity/authority                                                               | Identify candidates, prepare packets, draft copy, organize questions, incorporate changes, generate signoff records, and verify hashes |
| H-08 | Founder/tester     | Provide or connect supported physical iPhones and perform actions that cannot be simulated, including Face ID, real-world camera conditions, and sandbox purchase confirmation when required | Build binaries, write scripts, direct the session, collect logs/screenshots, diagnose defects, fix them, and rerun the matrix          |
| H-09 | Founder/community  | Supply genuine beta users and any legally required tester consent                                                                                                                            | Prepare recruiting materials, forms, invitations, feedback flows, dashboards, triage, fixes, and reports                               |
| H-10 | Human staff/vendor | Staff real community moderation and customer-support escalation                                                                                                                              | Build the moderation/support tooling, rules, queues, macros, SLAs, training, monitoring, and audits                                    |
| H-11 | Founder            | Approve pricing, launch countries, budget ceilings, binding contracts, and material business risk                                                                                            | Research, model, recommend, document, and implement the approved decision                                                              |
| H-12 | Founder            | Give explicit authorization to submit to App Review and to make the approved app public                                                                                                      | Prepare and validate the complete submission, submit when authorized, handle review, and operate launch                                |
| V-01 | Apple              | Approve membership, app, subscriptions, TestFlight external beta, and App Store release                                                                                                      | Prepare compliant artifacts, submit, monitor, respond, fix, and resubmit                                                               |
| V-02 | Vendors            | Approve affiliate, AI, domain, email, or other provider applications                                                                                                                         | Select the provider, prepare applications, configure approved accounts, and implement fallbacks                                        |

The founder is not expected to manually edit environment files, write policies,
run migrations, create screenshots, configure RevenueCat, write App Review
notes, investigate build failures, manage generated packets, or execute test
commands.

## 6. Operating Protocol

For every work item, Codex will:

1. Read the relevant source-of-truth docs.
2. Inspect the current code and evidence state.
3. Make the smallest complete production implementation.
4. Add or update unit, integration, contract, and route tests.
5. Update docs/USER_FLOW_TREE.md for UI behavior.
6. Run human-simulated E2E for UI-facing work.
7. Run the actual native or live-service surface when required.
8. Capture redacted evidence.
9. Record defects using docs/E2E_BUG_REPORT_TEMPLATE.md.
10. Fix defects and rerun the same scenario.
11. Update readiness, blockers, progress, and execution status.
12. Continue to the next unblocked item.

Evidence must never contain secrets, tokens, private keys, raw auth identifiers,
photo paths, health answers, user content, or unredacted personal data.

Every evidence record will include, where applicable:

- Work-item and feature IDs.
- iOS, environment, and feature scope.
- Git commit and relevant file hashes.
- EAS build ID, app version, and build number.
- Commands and test results.
- Human E2E manifest and evidence directory.
- Device model and iOS version.
- Redacted provider/project configuration proof.
- Network/privacy inspection.
- Reviewer identity, authority, decision, and retained reference.
- Named tester/operator signoff.
- Unresolved findings and rollback procedure.

## 7. Source-of-Truth and Gate Migration

The current source docs freeze a smaller cross-platform V1 and several strict
validators require Android. That conflicts with this founder directive.

| ID     | Owner | Codex deliverable                                                                                                                                                 | Acceptance                                                                                                     |
| ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GOV-01 | C     | Create an accepted Master Plan Update Patch for iOS-only, all indexed features at launch                                                                          | Patch names every affected doc, feature, risk, validation plan, and implementation effect                      |
| GOV-02 | C     | Add the founder directive to docs/DECISIONS.md                                                                                                                    | Decision records iOS-only, all-features, safety limits, and evidence rule                                      |
| GOV-03 | C     | Reconcile MASTER_PLAN, PRODUCT_REQUIREMENTS, ARCHITECTURE, FEATURE_INDEX, ROADMAP, TESTING_STRATEGY, LAUNCH_READINESS, BLOCKERS, FOR_TAS_TO_DO, and V1 scope docs | No active source doc instructs agents to hide or defer an in-scope feature                                     |
| GOV-04 | C     | Create one source-controlled launch contract consumed by validators                                                                                               | Contract specifies platforms ios, required features 1-20, release mode all-features, and Android release false |
| GOV-05 | C     | Make Phase 2-11 validators, packet builders, device QA, performance, beta, and launch checks read that contract                                                   | iOS gates remain strict; Android evidence is not requested or faked                                            |
| GOV-06 | C     | Split Google Sign-In for iOS from Google Play/Android blockers                                                                                                    | Google OAuth may remain required while Play requirements are excluded                                          |
| GOV-07 | C     | Replace FOR_TAS_TO_DO with a true founder-touchpoint register generated from this ownership model                                                                 | Founder list contains only H/R/V actions, not Codex-executable work                                            |
| GOV-08 | C     | Add this execution plan to the active source-doc index in AGENTS.md and CLAUDE.md                                                                                 | Future sessions must read and follow it                                                                        |
| GOV-09 | C     | Add machine-readable execution status and an audit that detects missing features/tasks                                                                            | All 20 features and Phase 7/8 surfaces remain represented                                                      |

No Android pass flag will be set to true for this launch. Android-specific
checks will become not-applicable through the launch contract.

## 8. Baseline Audit and Delivery Infrastructure

| ID      | Owner | Codex deliverable                                                                                                | Acceptance                                                                              |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| BASE-01 | C     | Inventory every route, feature flag, native module, data store, Edge Function, vendor call, and generated packet | Inventory maps each item to a feature ID and readiness label                            |
| BASE-02 | C     | Run typecheck, lint, unit/integration tests, docs audits, brand audit, and non-mutating launch sweep             | Baseline report records every failure without changing evidence flags                   |
| BASE-03 | C     | Classify existing user changes and preserve the clean worktree boundary                                          | No unrelated user work is overwritten                                                   |
| BASE-04 | C     | Create a dependency-aware task graph from this plan                                                              | Every work item has prerequisites and a next action                                     |
| BASE-05 | C     | Create a secure credential-name inventory without values                                                         | Client, server, EAS, Supabase, Apple, and vendor storage locations are explicit         |
| BASE-06 | C     | Create redaction, evidence-retention, rollback, and incident conventions                                         | All later evidence follows one auditable format                                         |
| BASE-07 | C     | Add CI jobs for iOS-scope contract validation and safe non-live checks                                           | Pull requests cannot silently drop a feature or reintroduce Android launch requirements |

## 9. Brand, Name, and Final Identity

Codex owns the name recommendation. “Available” means a documented, current
knockout search plus actual reservations and formal counsel review; it never
means an unsupported guarantee from a web search.

| ID       | Owner | Codex deliverable                                                                                                                                 | Acceptance                                                                                                                                   |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| BRAND-01 | C     | Build the naming brief from product positioning, audience, claims limits, pronunciation, searchability, and global risk                           | Brief is approved as a faithful representation of the product                                                                                |
| BRAND-02 | C     | Generate and score a longlist                                                                                                                     | Scoring covers distinctiveness, category fit, memorability, pronunciation, spelling, expansion fit, and risk                                 |
| BRAND-03 | C     | Search exact and confusingly similar App Store names, web/common-law uses, launch-country trademark databases, domains, and public social handles | Search record includes dates, queries, results, limitations, and evidence links                                                              |
| BRAND-04 | C     | Recommend one winner and two backups                                                                                                              | Recommendation explains why it beats alternatives and identifies residual risks                                                              |
| BRAND-05 | C     | Produce the counsel-ready clearance packet                                                                                                        | Packet includes candidate classes, adjacent marks, product description, domains, and evidence                                                |
| BRAND-06 | R/H   | Obtain formal clearance and approve the winner                                                                                                    | Signed/retained decision identifies the exact name and conditions                                                                            |
| BRAND-07 | C     | Reserve or prepare reservation of domain, App Store name, and public handles through authorized accounts                                          | Reservation receipts/records exist; founder performs payment/attestation only                                                                |
| BRAND-08 | C     | Freeze the identity registry                                                                                                                      | Display name, legal seller, domain, support email, slug, scheme, bundle ID, policy root, App Group, share watermark, and project names match |
| BRAND-09 | C     | Migrate code, config, assets, copy, packages where appropriate, Supabase callbacks, RevenueCat, analytics, support, links, and store metadata     | Strict brand audit passes and physical build shows the final identity                                                                        |
| BRAND-10 | C     | Create final icon, splash, wordmark, store artwork, share watermark, and brand-use guide                                                          | Assets pass native rendering and App Store specifications                                                                                    |

## 10. Account, Vendor, and Access Setup

Codex will research and recommend providers, prepare accounts, and configure
them in an authorized signed-in session. The founder only handles H-01 through
H-05 when a provider requires them.

| ID      | Owner | Account or service                    | Codex responsibility                                                                                               |
| ------- | ----- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ACCT-01 | H/C   | Apple Developer and App Store Connect | Founder creates/enrolls; Codex configures team, identifiers, app, roles, subscriptions, TestFlight, and submission |
| ACCT-02 | C/H   | Expo/EAS                              | Codex creates/links/configures after founder completes any identity/MFA/terms gate                                 |
| ACCT-03 | C/H   | Supabase staging and production       | Codex selects region/plan, creates/configures projects, deploys, and verifies after any signup/payment gate        |
| ACCT-04 | C/H   | RevenueCat                            | Codex creates/configures project, app, products, entitlement, offering, keys, webhook, and tests                   |
| ACCT-05 | C/H   | Domain, DNS, and hosting              | Codex selects provider, prepares purchase, configures DNS/HTTPS/hosting and renewals; founder pays                 |
| ACCT-06 | C/H   | Transactional email/SMTP              | Codex compares providers, configures domain/auth/templates/rate limits; founder accepts contract/payment           |
| ACCT-07 | C/H   | PostHog                               | Codex creates/configures project, region, taxonomy, dashboards, privacy, and deletion                              |
| ACCT-08 | C/H   | Sentry                                | Codex creates/configures project, releases, source maps, scrubbing, alerts, and deletion posture                   |
| ACCT-09 | C/H   | Cloudflare Turnstile                  | Codex creates/configures site, keys, domains, auth/public forms, and failure behavior                              |
| ACCT-10 | C/H/V | Catalog sources                       | Codex handles source applications, licensing packet, imports, attribution, correction workflow, and monitoring     |
| ACCT-11 | C/H/V | AI/model provider                     | Codex evaluates privacy, safety, latency, residency, cost, and contract fit, then configures approved provider     |
| ACCT-12 | C/H/V | Commerce/affiliate provider           | Codex selects and applies to ShopMy or approved alternative, configures API, links, disclosures, and polling       |
| ACCT-13 | C/H   | Support/helpdesk                      | Codex selects/configures inbox, forms, taxonomy, SLAs, macros, escalation, privacy, and reporting                  |
| ACCT-14 | C/H   | Moderation service/staff              | Codex prepares staffing/vendor recommendation, tools, runbook, training, and audit; founder contracts real humans  |
| ACCT-15 | C/H   | Attribution/paid measurement          | Codex selects privacy-preserving approach, configures consent/ATT where required, and validates payloads           |
| ACCT-16 | C     | Subprocessor register                 | Codex records purpose, data categories, region, DPA status, deletion path, owner, renewal, and incident contact    |

## 11. iOS Native, Apple, and EAS Configuration

| ID     | Owner | Codex deliverable                                                                                                                                   | Acceptance                                                                                            |
| ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| IOS-01 | C     | Register the explicit App ID and exact final bundle ID                                                                                              | Apple, Expo, RevenueCat, callbacks, and App Store records match                                       |
| IOS-02 | C     | Configure Sign in with Apple, Push Notifications, Associated Domains, In-App Purchase, App Groups, WidgetKit, and Live Activity capabilities        | Provisioning profile and signed entitlements contain only required capabilities                       |
| IOS-03 | C     | Fix native Sign in with Apple config, including Expo property/plugin and deletion revocation credentials                                            | Real iPhone Apple sign-in and revocation pass                                                         |
| IOS-04 | C     | Decide and configure iPhone/iPad support based on complete device QA                                                                                | Store device support and screenshots match actual behavior                                            |
| IOS-05 | C     | Configure version/build numbering, deployment target, icons, splash, permission text, localization, and encryption declaration                      | Resolved production Expo config is final and placeholder-free                                         |
| IOS-06 | C     | Link the EAS project, owner, project ID, channels, and development/preview/production environments                                                  | EAS project info and environment inventory match the launch contract                                  |
| IOS-07 | C     | Configure distribution certificate, provisioning, APNs key, App Store Connect API key, and submit profile                                           | Reproducible production build and upload succeed                                                      |
| IOS-08 | C     | Make EAS use a current Apple-compliant build image                                                                                                  | Build log proves Xcode 26+ and iOS 26 SDK+                                                            |
| IOS-09 | C     | Generate and inspect the full privacy manifest/report, required-reason API declarations, SDK signatures, entitlements, symbols, and binary metadata | No App Store processing warning remains unexplained                                                   |
| IOS-10 | C/R   | Complete export-compliance assessment and configuration                                                                                             | App Store build has the correct declaration or approved documentation                                 |
| IOS-11 | C     | Create rollback-safe EAS Update/channel policy                                                                                                      | Native changes require new binary; JS updates cannot cross native/privacy/feature-contract boundaries |

## 12. Supabase, Data, Security, and Deployment

Known deployment contradictions are Codex work.

| ID    | Owner | Codex deliverable                                                                                                                                                                                       | Acceptance                                                                                        |
| ----- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| DB-01 | C     | Add shared support for hosted SUPABASE_SECRET_KEYS and SUPABASE_PUBLISHABLE_KEYS maps with safe local/legacy fallback                                                                                   | All functions work with current hosted keys; no secret is exposed to the client                   |
| DB-02 | C     | Correct revenuecat-webhook and order-report-poll gateway authentication                                                                                                                                 | External signed/authenticated requests reach handlers and fail closed on bad credentials          |
| DB-03 | C     | Deploy every required function: account-deletion, catalog lookup/search/report, consent-withdrawal, data-export, growth-event, order-report-poll, revenuecat-webhook, subscription-grants, and waitlist | Staging function inventory is complete and hashed                                                 |
| DB-04 | C     | Add explicit APP_ENV and complete secret/config validation                                                                                                                                              | Staging never defaults silently to production behavior                                            |
| DB-05 | C     | Reconcile every migration and apply to a fresh local instance                                                                                                                                           | Clean reset applies all migrations with zero drift                                                |
| DB-06 | C     | Create and deploy staging through reviewed migration order                                                                                                                                              | Before/after counts, migration IDs, function versions, and types are retained                     |
| DB-07 | C     | Configure anonymous auth, manual linking, email OTP, SMTP, Apple/Google providers, Turnstile, redirect allowlists, rate limits, and session security                                                    | All auth paths pass live staging                                                                  |
| DB-08 | C     | Regenerate database types and remove schema drift                                                                                                                                                       | Generated types match staging                                                                     |
| DB-09 | C     | Prove two-user and anonymous RLS, adversarial writes, canonical conflict pairs, Shelf provenance, consent immutability, moderation ownership, and admin isolation                                       | Live redacted evidence shows no cross-user access                                                 |
| DB-10 | C     | Verify export, deletion, consent withdrawal, provider deletion, account-boundary cancellation, and temporary-file cleanup                                                                               | Privacy-rights matrix passes on staging                                                           |
| DB-11 | C     | Configure Security Advisor, Performance Advisor, SSL/network posture, indexes, backups, recovery, resource alerts, and load limits                                                                      | Production checklist has owners and evidence                                                      |
| DB-12 | C     | Create reviewed production migration/deploy/rollback procedure                                                                                                                                          | No dashboard-only production schema mutation is required                                          |
| DB-13 | C/H   | Create and deploy production after staging signoff                                                                                                                                                      | Production project, schema, functions, secrets, auth, and monitoring pass the live release matrix |

## 13. Authentication and Account Isolation

| ID      | Owner | Codex deliverable                                                                                                                         | Acceptance                                                 |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| AUTH-01 | C     | Complete anonymous-first onboarding and same-user Apple, Google, and email upgrade                                                        | Supabase UUID remains identical before/after each upgrade  |
| AUTH-02 | C     | Complete email-change OTP templates, expiry, resend, rate-limit, invalid-code, and offline handling                                       | No failure destroys the anonymous session or local data    |
| AUTH-03 | C     | Complete Sign in with Apple token revocation during account deletion                                                                      | Apple credential is revoked and provider data is deleted   |
| AUTH-04 | C     | Configure Google OAuth for iOS without any Google Play dependency                                                                         | Google sign-in works on the signed iOS build               |
| AUTH-05 | C     | Prove sign-out, token expiry, cold start, owner mismatch, cleanup failure, and A-to-B switching isolation                                 | No prior-owner data appears on any route                   |
| AUTH-06 | C     | Bind RevenueCat identity, analytics identity, query caches, encrypted stores, exports, and in-flight operations to the account generation | No stale write/share or cross-account entitlement survives |

2026-07-15 source checkpoint: the current candidate implements the native
state/raw-nonce contract, composite ID-token plus server-capture permit,
one-use authorization-code exchange, versioned encrypted refresh-token vault,
daily validation worker, canonical signed Apple event ingress, native
credential invalidation, terminal event-before-identity reconciliation before
code exchange, deletion-vault reuse, and exact-session
RLS/Storage/Edge/direct-RPC fence. This advances IOS-03, AUTH-01, AUTH-03,
AUTH-05, AUTH-06, DB-09, and DB-10 source work; it does not complete their live
acceptance. Existing Apple accounts require fresh capture or a compatible
mandatory-version recovery plan. Vault and subject-HMAC keyrings allow up to
three overlapping versions. Every successful daily validation atomically
advances the current subject digest and freshly sealed vault envelope; dormant,
deferred, or failing rows do not advance from configuration alone. Hosted
migration/function deployment, primary-App-ID event
registration and actual delivery, Vault/Cron continuity and rotation,
stale-JWT adversarial proof, physical-iPhone/TestFlight, privacy/security/legal
review, and App Review remain required. Operations are defined in
`docs/phase-9/apple-auth-lifecycle-operations-runbook.md`.

The local migration-0055 replay gate passed two clean resets, exact 54/0055
history, the full structural suite plus 114/114 Apple pgTAP, schema lint, empty
shadow diff, temporary types, 20/20 focused event/lifecycle Edge tests, and the
47-test Apple auth work lane. These results advance source evidence only.

## 14. Catalog, Shelf, Camera, Barcode, and Native OCR

| ID     | Owner | Codex deliverable                                                                                                                    | Acceptance                                                                                                                                               |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAT-01 | C/R   | Complete OBF/CosIng exact-artifact, attribution, image-rights, database-classification, no-runtime-recipient, and correction posture | Counsel-approved source decisions and production artifact identifiers exist; imports stay offline/hash-bound and runtime lookup/contribution stay absent |
| CAT-02 | C     | Build reviewed import, normalization, provenance, dedupe, QA, correction, and rollback pipelines                                     | Fixture data is excluded; every production record is traceable                                                                                           |
| CAT-03 | C     | Curate a production launch catalog from a defined consented beta-shelf corpus and untouched holdout                                  | Catalog reaches signed coverage/quality targets without a market-representativeness claim                                                                |
| CAT-04 | C     | Complete search, barcode, wrong-match, no-match, manual fallback, and catalog-report flows                                           | Every failure has a safe recovery and owner-scoped report                                                                                                |
| CAT-05 | C     | Validate and release-gate the iOS-native OCR source candidate with bounded editable output and local-only photo handling             | Exact signed-build evidence passes the governed two-iPhone, 25-label/50-run accuracy, RTL, privacy/cleanup, accessibility, and performance contracts     |
| CAT-06 | C     | Complete camera permission, denied/permanently-denied, Settings handoff, mount/capture failure, retry, and offline behavior          | Physical iPhone evidence passes                                                                                                                          |
| CAT-07 | C/R   | Complete reviewed Shelf freshness, PAO, physical-package date, source precedence, provenance, and unknown-state behavior             | Chemistry/legal review and live data evidence pass                                                                                                       |
| CAT-08 | C     | Add catalog/admin correction tooling and operational queues                                                                          | Authorized operators can review sources/reports without direct database editing                                                                          |
| CAT-09 | C     | Measure search/barcode/OCR completion, misses, wrong matches, unknown tokens, latency, and support impact                            | Dashboards and thresholds are production-ready                                                                                                           |

2026-07-22 CAT-08 source checkpoint: the local candidate defines a dedicated
operator boundary whose Edge verifies the exact issuer/subject/audience/live
token and AAL2 claim while Postgres independently derives the actor from the
exact live Auth session and verified TOTP factor. A dedicated constrained
transaction-pooler login can execute only the six application-gateway
functions; browser/API roles cannot execute them, and hosted transport requires
CA/hostname verification. Ten-minute work-session checks, five-minute lease/CAS
queue claims, committed global and per-action database rate budgets, immutable
operation/audit records, and capability-separated triage, disposition, repair
attestation, and release are fail-closed. `open` reports do not suppress serving; triage creates
an independent reporter-free product hold that survives withdrawal/account
deletion. Accepted/rejected dispositions cannot release it. A third person may
attest only an exact current CAT-02 projection and signed staged CAT-03
successor over the active-hold root. A fourth distinct person releases; release
advances the root and cannot activate serving, so CAT-03 owners must complete a
fresh post-release campaign/activation/readback. API roles receive no raw
operator/correction/hold table lane, and the legacy service-role correction
review lane is revoked. A deterministic local two-connection rehearsal proves
action-first and session-revocation-first grant-lock ordering against the real
database gateway.

CAT-08 remains `in_progress` and blocked by CAT-07. A separate publishable-key-
only internal-console source candidate exists, but it is not deployed or E2E-
proven. A local ignored synthetic-fixture browser packet predates the final
claim-bound-detail and authority revisions, so it is not current governed
acceptance evidence. Real named MFA-enrolled operators and coverage, hosted
full-chain/RLS/stale-session/two-connection race/deletion/audit evidence,
verified operator/build/capability/incident display, hosted rate-threshold/load
evidence and scheduled idle-period bucket purge, an approved workforce
audit-retention/deprovisioning contract, legacy-hold cutover remediation,
current human-simulated operator E2E, incident drills, and
privacy/security/legal review are absent. Local source
controls do not establish production operation, legal compliance, Apple
acceptance, product-market fit, or revenue.

2026-07-25 CAT-09 source checkpoint: search and barcode result/latency,
on-device OCR result/latency, ingredient-parse result/source/unknown-count,
true search no-match recovery, accepted correction workload, and directional
support-impact definitions now have fixed coarse vocabularies and frozen
aggregate formulas. Exact queries, barcodes, OCR/ingredient content, product
identity, duration, timestamp, and free text are excluded. The publication gate
is default closed, contains no event buffer or replay path, and invalidates
stale generations when deletion or Auth account/background/deletion boundaries
close synchronously. No non-test production caller opens the gate and no vendor
transport is enabled, so no live CAT-09 measurement is claimed.

CAT-09 remains `in_progress`, blocked by CAT-08 and by the absence of a separate
approved analytics-consent record and authoritative owner/receipt verifier,
vendor/processor terms and privacy/legal review, exact-build live payload and
withdrawal/account-switch/deletion/no-replay evidence, named dashboard owners,
links, reviewed thresholds, and real support-impact evidence. Local source
contracts do not complete CAT-09 or establish App Review, legal, product-
quality, market, or revenue outcomes.

2026-07-19 CAT-07 source checkpoint: the current candidate preserves physical-package dates,
explicit label PAO, reviewed catalog PAO, reserved future catalog-linked
category estimate, and unknown as distinct states. Unknown is not an estimate;
only printed or label/catalog-PAO evidence can drive countdown, expired,
Expiring-filter, or replenishment behavior. Replacement requires an explicit
opening-state choice and clears inherited physical-package dates. Canonical local v1
bytes remain unchanged on read and failed mutation; v2 is emitted only after a
successful authorized atomic mutation. The regulatory basis is EU Article
19(1)(c) plus Annex VII point 2, with ordinary U.S. cosmetic-label gaps and
classification-specific U.S./Canadian sunscreen rules; no universal printed
sunscreen date is assumed. Migration `0060` fully purges, force-RLS seals, and
prevents repopulation of legacy `ingredient_pao_defaults`; current
`product_categories` values are editorial/future metadata and every current
category-default Shelf claim fails closed to unknown. See
`docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md`.

CAT-07 remains `in_progress`, blocked by CAT-06 and launch-blocked by a green
integrated source/static-policy checkpoint, named chemistry/legal review, fresh
local and hosted migration/RLS plus live catalog truth-table evidence, and
exact signed-build physical-iPhone encrypted-storage/relaunch/accessibility/
notification evidence. The retained 2026-07-11 Expo-web packet predates the
current replacement and storage contracts and is stale for acceptance.

CAT-07 also remains blocked on qualified classification of user-initiated,
item-specific affiliate navigation under Apple 2.5.18 and 5.1.2. Treat consent
as necessary but not sufficient; do not ship commerce sourced from Shelf data
until App Review/privacy counsel approve the exact contextual-shopping versus
sensitive-data-targeted-advertising boundary and the FTC-reviewed net impression.

## 15. Reviewed Guidance, Core Loop, and Recommendations

| ID      | Owner | Codex deliverable                                                                                                                     | Acceptance                                                                        |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| CORE-01 | C/R   | Finalize onboarding, age gate, health profile, consent copy, scoring, and quiz IP posture                                             | Legal/privacy/clinical/IP signoffs bind to exact hashes                           |
| CORE-02 | C/R   | Complete versioned conflict taxonomy, pregnancy/breastfeeding rules, concentration evidence, severity, explanations, and replacements | Only signed rules are production-visible                                          |
| CORE-03 | C/R   | Complete routine sequencing, frequency caps, skin-cycling, ramping, pause/recovery, overrides, and stop/refer behavior                | Plan, Week, Why Tonight, Settings, and Today agree                                |
| CORE-04 | C     | Complete durable AM/PM routine order and custom-cycle persistence                                                                     | Relaunch, edits, offline, DST/timezone, and failure recovery pass                 |
| CORE-05 | C     | Complete Today check-off, adherence, missed-day recovery, and calm streak behavior                                                    | Persistence and analytics pass without punitive/fake behavior                     |
| CORE-06 | C/R   | Complete goal-active and product-specific recommendations with source provenance, reviewed eligibility, and commission isolation      | Ranking audit proves safety/quality only; no unreviewed product appears           |
| CORE-07 | C/R   | Complete shareable reviewed conflict behavior and privacy-safe selection                                                              | Only reviewed content and intentionally selected product details leave the device |

## 16. Photos, Progress, Trend Insights, and App Lock

| ID       | Owner | Codex deliverable                                                                                                                    | Acceptance                                                                     |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| PHOTO-01 | C     | Complete local encrypted photo capture, storage, thumbnails, timeline, compare, detail, notes, and deletion                          | Photos remain device-only and recover safely from failures                     |
| PHOTO-02 | C     | Complete app-wide lock, Progress unlock, key corruption/read failure, authenticated reset, and no-content-flash behavior             | Sensitive content never mounts before successful gates                         |
| PHOTO-03 | C     | Complete post-capture face framing/pose and lighting measurement without identity embeddings                                         | Diverse-condition device matrix passes; analyzer data never leaves device      |
| PHOTO-04 | C     | Complete time-lapse playback, pause/replay/background/Reduce Motion/accessibility behavior                                           | No decrypted frame is written to share/cache or analytics                      |
| PHOTO-05 | C/R   | Replace PHOTO-05A literal zero admission with a versioned real on-device Trend engine/result issuer; never restore simulated output | Exact-build provenance, measurement/calibration, limitations, abstention/failure states, zero egress, and performance are measurable |
| PHOTO-06 | C/R   | Run diverse-condition calibration/fairness evaluation across skin tones, lighting, hair, glasses, devices, and ordinary environments | Predeclared thresholds and false accept/reject report are signed               |
| PHOTO-07 | C/R   | Finalize photo, face-signal, trend, local-only, retention, key-loss, export, and deletion disclosures                                | App, policies, privacy labels, and network behavior match                      |

## 17. Payments, RevenueCat, Reverse Trial, and Finance

| ID     | Owner | Codex deliverable                                                                                                                                                                 | Acceptance                                                                       |
| ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| PAY-01 | C/H   | Model and recommend annual/monthly pricing, trial, introductory offer, win-back, countries, fees, tax, refund, and churn assumptions                                              | Founder approves the commercial decision                                         |
| PAY-02 | C     | Create one Apple subscription group and final monthly/annual products with localized metadata, price, availability, review image, and notes                                       | Products are Ready to Submit and match the app                                   |
| PAY-03 | C     | Configure RevenueCat iOS app, Apple IAP key/issuer, imported products, pro entitlement, current offering, packages, SDK key, secret key, and restore behavior                     | Dashboard validation passes                                                      |
| PAY-04 | C     | Fix webhook deployment and cover purchase, renewal, cancellation, billing issue, grace, expiry, refund, refund reversal, extension, transfer/redemption, and idempotency behavior | Lifecycle contract tests and sandbox events reconcile                            |
| PAY-05 | C     | Preserve Supabase UUID as RevenueCat App User ID across anonymous upgrade and account switching                                                                                   | Identity matrix passes                                                           |
| PAY-06 | C     | Resolve reverse trial as an atomic Supabase app-granted entitlement, remove the fake store-product requirement, and implement expiry/reconciliation                               | One-time grant, rollback, expiry, deletion, and UI lifecycle pass                |
| PAY-07 | C     | Complete purchase, restore, manage/cancel, Terms/Privacy failure, missing offering, and offline UI                                                                                | No local or preview path grants Pro in production                                |
| PAY-08 | C     | Configure and test iOS win-back discovery for the approved commercial state: native offer when enabled, or explicit no-offer launch configuration                                 | Purchase and fallback are accurate; no unavailable or invented discount is shown |
| PAY-09 | C/H   | Reconcile Apple, RevenueCat, Supabase, refunds, taxes, fees, and payouts                                                                                                          | Finance report and named owner signoff exist                                     |

## 18. Ask Advisor and AI Safety

| ID     | Owner | Codex deliverable                                                                                                                                  | Acceptance                                              |
| ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| ASK-01 | C     | Compare and select model/provider architecture using privacy, residency, safety, quality, latency, cost, and deletion criteria                     | Decision record and fallback plan are approved          |
| ASK-02 | C     | Build the authenticated server gateway, secret management, quotas, timeouts, cost ceilings, retries, and outage behavior                           | No provider key enters the client; abuse tests pass     |
| ASK-03 | C/R   | Build and review the source-controlled knowledge corpus and retrieval pipeline                                                                     | Every answer can cite approved source content           |
| ASK-04 | C/R   | Implement consent, user disclosure, data minimization, retention, export/deletion, vendor deletion, and logging redaction                          | Privacy review and network inspection pass              |
| ASK-05 | C/R   | Implement medical/diagnostic refusal, pregnancy safety, uncertainty, urgent escalation, prompt-injection defense, and unsupported-claim prevention | Red-team/evaluation suite meets signed thresholds       |
| ASK-06 | C     | Complete local and cloud Ask UI, loading, cancel, offline, timeout, quota, unsafe, empty, citation, and feedback states                            | Physical iPhone E2E passes                              |
| ASK-07 | C     | Build production quality, safety, latency, cost, refusal, feedback, and incident dashboards                                                        | Launch on-call can identify and disable unsafe behavior |

## 19. Commerce, Replenishment, and Creator Links

| ID     | Owner | Codex deliverable                                                                                                                           | Acceptance                                           |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| COM-01 | C/V/H | Select and obtain ShopMy or approved alternative access                                                                                     | Approved account supports intended first-party links |
| COM-02 | C/R   | Finalize affiliate, paid-link, creator, retailer, ranking, privacy, and consent posture                                                     | Legal/privacy decisions bind to exact copy           |
| COM-03 | C     | Implement secure server credentials, link creation/validation, allowlisting, retailer handoff, failure UI, and broken-link monitoring       | No secret or unsafe URL reaches the client           |
| COM-04 | C     | Complete order-report-poll authentication, scheduling, idempotency, rate limits, and reconciliation                                         | Staging and production polling evidence pass         |
| COM-05 | C     | Prove commission data is isolated from recommendations and client-readable ranking                                                          | Code/data audit and negative tests pass              |
| COM-06 | C     | Complete PAO/finished/replenishment triggers, explicit default-off opt-in, deep links, opt-out cancellation, and routine-reminder isolation | Physical notification matrix passes                  |
| COM-07 | C     | Complete creator links, disclosures, attribution, support, and privacy-safe measurement                                                     | Creator compliance and native handoff QA pass        |

## 20. Community, Skin Notes, Experts, and Moderation

| ID     | Owner | Codex deliverable                                                                                                                          | Acceptance                                      |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| UGC-01 | C/R   | Finalize community EULA, rules, age/audience, privacy, creator/expert, copyright, takedown, appeals, and enforcement policies              | Legal/privacy review passes                     |
| UGC-02 | C     | Build production community tables/APIs/RLS for profiles, posts, notes, comments where present, reports, blocks, moderation, and audit logs | Adversarial ownership and visibility tests pass |
| UGC-03 | C     | Implement posting, editing, deletion, reporting, blocking, filtering, rate limits, spam prevention, contact, and recovery UI               | Apple UGC guideline matrix passes               |
| UGC-04 | C     | Build operator moderation queue, evidence view, actions, audit log, escalation, appeal, and metrics                                        | Moderators never need raw database access       |
| UGC-05 | C/R/H | Create staffing plan, shifts/SLAs, training, severity policy, crisis escalation, and quality audits                                        | Real named moderation coverage exists at launch |
| UGC-06 | C/R   | Build expert/Skin Notes identity, credential, content review, versioning, correction, withdrawal, and disclosure workflow                  | Only reviewed current expert content is public  |
| UGC-07 | C     | Implement community notification delivery, preference control, token cleanup, and deep links                                               | Remote notification and opt-out matrix passes   |

## 21. Widgets, Live Activities, Notifications, Share Cards, and Growth

| ID        | Owner | Codex deliverable                                                                                                                                 | Acceptance                                                               |
| --------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| NATIVE-01 | C     | Build WidgetKit extension targets, App Group sharing, timeline provider, deep links, privacy redaction, and update policy                         | Widgets work on supported iPhones and remain private when locked         |
| NATIVE-02 | C     | Build Live Activity attributes/extension, lifecycle, stale/end behavior, deep links, and privacy                                                  | Lock Screen, Dynamic Island where supported, and termination matrix pass |
| NATIVE-03 | C     | Configure APNs/Expo push, token registration/rotation, local/remote categories, preferences, quiet hours, badges, deep links, and failure cleanup | Notification matrix passes without unintended delivery                   |
| SHARE-01  | C     | Build share-card rendering, selected-data boundary, watermark, native share sheet, fallback, and failure behavior                                 | Cards contain only intentional reviewed data                             |
| LINK-01   | C     | Configure domain, HTTPS, AASA, Associated Domains, Universal Links, store fallback, and routing                                                   | Apple CDN/device validation and cold/warm link tests pass                |
| GROW-01   | C/R   | Implement review-prompt timing at genuine satisfaction moments without incentives or pressure                                                     | StoreKit prompt policy and QA pass                                       |
| GROW-02   | C/R   | Implement public/creator links and privacy-approved attribution/paid measurement, including ATT only if legally/technically required              | Payload audit and consent behavior pass                                  |
| GROW-03   | C     | Complete waitlist/growth-event functions, Turnstile, rate limits, validation, public forms, dashboards, and support handoff                       | Live abuse and privacy tests pass                                        |

## 22. Admin and Operator Tooling

| ID       | Owner | Codex deliverable                                                                                                           | Acceptance                                                     |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ADMIN-01 | C     | Define roles for catalog, clinical review, legal/privacy review, moderation, support, finance, and release                  | Least-privilege matrix is documented                           |
| ADMIN-02 | C     | Build authenticated operator access and audit logging                                                                       | No operator tool is public or dependent on shared credentials  |
| ADMIN-03 | C     | Complete catalog reports/corrections, source provenance, reviewer queues, signoff snapshots, and publish/withdraw actions   | Every production content change is attributable and reversible |
| ADMIN-04 | C     | Complete moderation, support, data-rights, payment escalation, and incident queues                                          | Operator workflow passes role and audit tests                  |
| ADMIN-05 | C     | Build launch dashboards across Supabase, RevenueCat, PostHog, Sentry, AI, catalog, community, commerce, support, and growth | P0/P1 conditions alert a named human                           |

## 23. Legal, Privacy, Clinical, Chemistry, IP, and Public Policies

Codex drafts, researches, cross-checks, hosts, and maintains every artifact.
Named professionals make only the decisions that require their authority.

| ID     | Owner | Deliverable                                                                                                                                                                                               | Acceptance                                                        |
| ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| REV-01 | C/R   | Trademark/name clearance packet and decision                                                                                                                                                              | Final name/identity approved                                      |
| REV-02 | C/R   | Regulatory positioning, claims vocabulary, store metadata, medical-device posture, and subscription terms                                                                                                 | Legal review signed                                               |
| REV-03 | C/R   | Privacy policy, consumer health policy, data inventory, consent matrix, processor register, analytics/AI/commerce/community/photo posture, deletion/export, and breach response                           | Privacy/security review signed                                    |
| REV-04 | C/R   | Conflict, pregnancy, cadence, sequencing, recommendations, Ask, trend, PAO, replacement, and expert-content corpus                                                                                        | Clinical review signed                                            |
| REV-05 | C/R   | Ingredient taxonomy, concentrations, compatibility, PAO, product types, expiry, OCR/catalog interpretation, and replacements                                                                              | Cosmetic-chemistry review signed                                  |
| REV-06 | C/R   | Onboarding quiz, source/content/image rights, share cards, creator content, community IP, and catalog licensing                                                                                           | IP/FTO review signed                                              |
| REV-07 | C     | Generate current worklists and detached signoff templates, incorporate decisions, verify credentials out-of-band, and bind signoffs to source hashes                                                      | Strict Phase 3 release gate passes                                |
| WEB-01 | C     | Publish production HTTPS home, Privacy, Terms, consumer health privacy, support, deletion, export, community rules, AI disclosure, commerce disclosure, creator disclosure, and catalog attribution pages | Every app/store link is live, accurate, accessible, and versioned |

## 24. Observability, Security, Privacy Rights, and Reliability

| ID     | Owner | Codex deliverable                                                                                                                   | Acceptance                                           |
| ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| OPS-01 | C     | Finalize consented PostHog event taxonomy, identities, dashboards, deletion, and session-replay prohibition                         | Privacy payload audit passes                         |
| OPS-02 | C     | Configure Sentry release/dist/source maps, scrubbing, no PII/screenshots/view hierarchy, alerts, and deletion posture               | Test crashes symbolize without private data          |
| OPS-03 | C     | Complete threat model for auth, local encryption, exports, payments, AI, commerce, community, moderation, admin, links, and vendors | Security review has no unresolved P0/P1              |
| OPS-04 | C     | Complete data export, deletion, consent withdrawal, processor deletion, provider token revocation, and retention behavior           | Online/offline/account-boundary matrix passes        |
| OPS-05 | C     | Configure backups, recovery, migration rollback, EAS rollback/update, feature kill switches, and incident communications            | Drills meet predeclared recovery targets             |
| OPS-06 | C/H   | Create on-call, escalation, support, moderation, AI safety, payment, privacy, and security runbooks                                 | Named real humans acknowledge duties                 |
| OPS-07 | C     | Run dependency audit/SBOM, secret scan, binary inspection, privacy report, and supply-chain review                                  | Release candidate has no unaccepted critical finding |

## 25. Verification and Evidence Program

| ID    | Owner | Codex deliverable                                                                                                                                               | Acceptance                                                                                                                   |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| QA-01 | C     | Unit/integration/property tests for all deterministic logic, parsers, schedulers, stores, migrations, auth, payments, AI guards, community, commerce, and links | Changed production logic has meaningful coverage                                                                             |
| QA-02 | C     | Route/contract tests and complete USER_FLOW_TREE for every feature, error, empty, denied, offline, and recovery branch                                          | Human E2E manifest covers every public route                                                                                 |
| QA-03 | C     | Human-simulated E2E on actual app surfaces for every UI-facing slice                                                                                            | Evidence meets HUMAN_SIMULATED_E2E_TESTING and checklist                                                                     |
| QA-04 | C/H   | Physical iPhone matrix for iOS 17+ support floor and current devices                                                                                            | Camera, OCR, photos, Face ID, notifications, payments, widgets, Live Activities, links, accessibility, and all features pass |
| QA-05 | C     | Accessibility audit with VoiceOver, Dynamic Type, Reduce Motion, contrast, focus, touch targets, keyboard, and safe areas                                       | No supported-flow accessibility blocker remains                                                                              |
| QA-06 | C     | Privacy/network audit across every vendor and feature                                                                                                           | No prohibited photo/health/auth/private payload leaves its approved boundary                                                 |
| QA-07 | C     | Security/adversarial tests for RLS, account isolation, admin roles, UGC abuse, AI injection, URLs, webhooks, rate limits, and data rights                       | No unresolved P0/P1                                                                                                          |
| QA-08 | C     | Predeclare and measure startup, product add, barcode/OCR, routine, photos, trend, Ask, community, commerce, widgets, and memory thresholds                      | Physical-device performance packet passes                                                                                    |
| QA-09 | C     | Fresh install, upgrade from legacy data, reinstall, key loss, storage pressure, backgrounding, force-stop, timezone/DST, offline, and vendor outage matrix      | No data corruption, privacy leak, or dead end                                                                                |
| QA-10 | C     | Run full repository and phase verification after each release candidate                                                                                         | Commands in Section 30 pass with real evidence                                                                               |

## 26. TestFlight and All-Features Beta

| ID      | Owner | Codex deliverable                                                                                                                                                                      | Acceptance                                                                                |
| ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| BETA-01 | C     | Build and upload internal TestFlight candidate with all launch features enabled against staging                                                                                        | Processing warnings resolved and internal smoke passes                                    |
| BETA-02 | C     | Prepare Beta App Review metadata, demo account, review notes, privacy/support links, and test instructions                                                                             | External testing approved                                                                 |
| BETA-03 | C/H   | Recruit and manage the defined target beta cohort                                                                                                                                      | Genuine target users and tested-device coverage exist; no market-representativeness claim |
| BETA-04 | C     | Configure feedback/support intake with category, severity, privacy, SLA, and routing                                                                                                   | Every beta report is triageable                                                           |
| BETA-05 | C     | Measure activation, catalog, routine, adherence, photos, notifications, payments, Ask, commerce, community, trends, widgets, sharing, retention, cost, safety, moderation, and support | Signed beta dashboards/reports meet thresholds                                            |
| BETA-06 | C     | Conduct scripted usability sessions and prepare interview guides; founder/testers provide genuine responses                                                                            | Findings link to fixes or accepted risk                                                   |
| BETA-07 | C     | Fix every P0/P1 and rerun the exact surface                                                                                                                                            | Exit review has no unresolved launch blocker                                              |
| BETA-08 | C/H/R | Produce go/hold decision packet                                                                                                                                                        | Founder and required reviewers authorize release candidate                                |

## 27. App Store Product Page, Compliance, and Submission

| ID       | Owner | Codex deliverable                                                                                                                                                                  | Acceptance                                                  |
| -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| STORE-01 | C     | Produce final name, subtitle, promotional text, description, keywords, categories, copyright, localization, and claims review                                                      | Metadata describes every real feature without unsafe claims |
| STORE-02 | C     | Produce final iPhone screenshots and optional preview showing the actual release build                                                                                             | Assets meet current size/content rules and match the app    |
| STORE-03 | C/R   | Complete age rating including UGC/social/medical questions, regulated-device declaration, DSA trader status, content rights, and export compliance                                 | App Store fields match legal decisions                      |
| STORE-04 | C/R   | Complete App Privacy Nutrition Labels for app and every SDK/vendor, plus privacy choices URL                                                                                       | Labels match observed network/data behavior                 |
| STORE-05 | C     | Complete subscription metadata, localization, price, tax, review screenshots, availability, and first-submission attachment                                                        | Monthly/annual products are included and Ready to Submit    |
| STORE-06 | C     | Create non-expiring reviewer account and detailed steps for onboarding, every gated feature, purchases, restore, deletion, community moderation, Ask, commerce, widgets, and links | Reviewer can reach and test every feature                   |
| STORE-07 | C     | Build production candidate, inspect binary, select build, resolve processing, export, privacy, entitlement, symbol, and SDK warnings                                               | App version is Ready for Review                             |
| STORE-08 | C/H   | Present final submission packet for explicit authorization                                                                                                                         | Founder authorizes submission                               |
| STORE-09 | C/V   | Submit app and subscriptions, monitor review, respond, fix, and resubmit                                                                                                           | Apple approves the app and products                         |
| STORE-10 | C/H   | Keep release manual until production and operations recheck passes                                                                                                                 | Founder authorizes public availability                      |

## 28. Production and Controlled Launch

| ID        | Owner | Codex deliverable                                                                                                                                                                | Acceptance                                            |
| --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| LAUNCH-01 | C     | Reverify production identity, policies, Supabase, auth, RevenueCat, AI, commerce, community, moderation, notifications, links, observability, support, backup, and kill switches | Production readiness packet passes                    |
| LAUNCH-02 | C     | Run Ring 0 internal production smoke                                                                                                                                             | No P0/P1 and no private-data or payment mismatch      |
| LAUNCH-03 | C/H   | Release a controlled Ring 1/public availability when authorized                                                                                                                  | Real acquisition is observable and support is staffed |
| LAUNCH-04 | C     | Monitor crashes, auth, catalog, payments, AI safety/cost, commerce, community/moderation, trends, notifications, links, support, privacy requests, refunds, and reviews          | Alert/dashboard ownership is active                   |
| LAUNCH-05 | C     | Produce 24-hour, 72-hour, and week-one reports with go/hold/rollback recommendations                                                                                             | Decisions use real evidence                           |
| LAUNCH-06 | C/H   | Reconcile Apple/RevenueCat/Supabase revenue, taxes, fees, refunds, trials, and payouts                                                                                           | Finance report signed                                 |
| LAUNCH-07 | C     | Maintain store responses, support macros, moderation QA, incidents, privacy requests, dependency updates, and release backlog                                                    | No launch duty is unowned                             |

## 29. Feature Kill Switches and Rollback

Every networked or high-risk feature must have a production kill switch that
fails closed without corrupting data:

- Cloud Ask.
- Commerce and order polling.
- Community posting and public aggregates.
- Trend insights.
- Goal-active recommendations.
- Reviewed conflict sharing.
- Share cards and public links.
- Creator links and paid measurement.
- Widgets/Live Activities publication.
- Review prompt.
- Catalog source-artifact promotion/import.

OBF request-time API access and external contribution are excluded from the
launch architecture, not hidden behind a kill switch. Product Opener documents
API v3 as current and v2 as deprecated, but OnSkin calls neither. Any future
proposal to add OBF as a runtime recipient is a new privacy, legal, architecture,
and release decision. Counsel must first classify the exact OBF database use and
approve the resulting ODbL obligations.

A kill switch is an incident control, not a way to submit an unfinished feature.
Every feature must first pass its full launch gate while enabled.

## 30. Required Verification Commands

The command set will be made iOS-scope aware before it is treated as final.
Codex owns running, diagnosing, fixing, and rerunning it.

Repository baseline:

    npm run typecheck
    npm run lint
    npm test

Identity and documentation:

    npm run brand:audit:strict
    npm run docs:source-packet-audit:check
    npm run docs:tas-todo-audit:check
    npm run docs:readiness-status-audit:check
    npm run docs:device-support-policy-audit:check
    npm run docs:performance-readiness-audit:check
    npm run docs:generated-packet-status-audit:check

Review and sources:

    npm run phase3:audit-copy:strict
    npm run phase3:review-worklist:check
    npm run phase3:review-operator-queue:check
    npm run phase4:check-source-env:strict
    npm run phase4:qa-report
    npm run phase4:beta-coverage-report:strict

Infrastructure and native:

    npm run phase2:check-env:strict
    npm run phase2:rls-smoke
    npm run phase5:check-native-config:strict
    npm run cat05:native-ocr-source-contract:test
    PHASE5_NATIVE_OCR_EVIDENCE_PATH=... npm run phase5:native-ocr-evidence:strict
    npm run phase5:performance-evidence:strict
    npm run phase5:qa-packet:strict

Payments and full product:

    npm run phase6:check-payments-env:strict
    npm run phase6:qa-packet:strict
    npm run phase7:check-core-loop:strict
    npm run phase7:qa-packet:strict
    npm run phase8:check-growth-store:strict
    npm run phase8:qa-packet:strict

Release, beta, and launch:

    npm run phase9:verify
    npm run phase10:verify
    npm run phase11:verify
    npm run launch:verify

Human E2E:

    npm run e2e:human:manifest:check
    npm run e2e:cat05-native-ocr-ui

The CAT-05 Expo-web command is deterministic UI-state evidence only and must
record `nativeDeviceProof=false`; it cannot satisfy the native evidence command.

## 31. Current Known State

As of this document date:

- No root or mobile environment file exists.
- EAS CLI is installed but not logged in.
- The app is not linked to an EAS project.
- Supabase CLI is not on PATH.
- No live staging or production Supabase project is verified.
- RevenueCat runtime code exists, but real Apple products, keys, offering,
  webhook, sandbox lifecycle, and finance signoff are missing.
- Current working identity RoutineKind is not legally cleared.
- Production config deliberately fails closed without final brand and Phase 3
  review clearance.
- All Phase 7 and Phase 8 public feature flags are false.
- Community aggregates/submissions and the trend engine retain hardcoded
  incapability paths that require implementation, not flag changes. Native
  widgets now have a RoutineKind-specific SQLite/CAS/outbox source candidate,
  but publication and Live Activity start remain disabled by literal signed
  flags and cannot be enabled by an environment or OTA flag alone.
- Native OCR now has an Apple Vision revision-3 source candidate. Only the
  internal `staging` EAS profile enables it for evidence collection;
  `development` and `production` remain disabled. No Xcode/Swift compilation,
  signed-archive linkage, physical-iPhone, real-label accuracy, zero-network,
  cache cleanup, VoiceOver/Dynamic Type, or performance proof exists yet.
- Cloud Ask lacks a completed production provider/gateway/safety contract.
- Commerce lacks an approved live rail.
- Community lacks complete live moderation operations.
- Widgets and Live Activities now have a hash-pinned `expo-widgets` native
  patch, typed bridge, owner-bound coordinator/host source, deterministic stale
  handling, and unconditional cleanup call sites. They still lack a
  macOS-compiled and signed final-identity target plus archive and supported
  physical-iPhone evidence, so feature 19 remains launch-blocked.
- The active IOS-02 work was performed in a Windows workspace without Xcode or
  a Swift compiler. Local source/model/static tests do not prove Swift
  compilation, code signing, entitlements, device behavior, privacy/legal
  compliance, App Review acceptance, or revenue.
- Cross-platform validators still require Android and must be migrated.
- The Supabase staging deploy wrapper has missing functions/auth/secrets.
- Native Sign in with Apple lifecycle source is implemented, but final Apple
  identifiers/keys, hosted migration and function deployment, primary-App-ID
  event registration/delivery, the one-minute Vault/Cron worker, existing-user
  recapture cutover, rotation/rollback drills, and physical-iPhone/TestFlight
  evidence remain open.
- The reverse-trial environment/validator contract contradicts its app-granted
  implementation.
- App Store privacy, export, metadata, subscriptions, reviewer packet, and
  signed production build do not yet exist.

## 32. Immediate Execution Order

Codex will pursue work in this order while parallelizing independent streams:

1. Normalize scope docs and create the iOS all-features launch contract.
2. Run the full baseline inventory and fix validator/deployment foundations.
3. Perform name research and issue the final recommendation/clearance packet.
4. Prepare account/provider decisions and the exact founder enrollment packet.
5. Configure EAS/iOS native foundations and staging infrastructure.
6. Complete Supabase/auth/data/privacy rights.
7. Complete catalog/OCR/Shelf and reviewed guidance.
8. Complete photos/trends, payments, Ask, commerce, community, widgets, links,
   notifications, growth, and admin tooling.
9. Complete all external review packets in parallel and incorporate decisions.
10. Run automated, human E2E, physical-device, accessibility, privacy, security,
    and performance verification.
11. Run all-features TestFlight beta and close every P0/P1.
12. Build the production environment, store packet, and release candidate.
13. Submit when authorized, handle review, and launch under controlled
    monitoring and staffed operations.

## 33. Completion Rule

This plan is complete only when:

- Every in-scope feature is production-real and enabled in the approved build.
- Every applicable evidence maturity level is complete.
- No public behavior depends on fixtures, stubs, simulations, or inert native
  paths.
- Professional decisions are genuine and tied to exact source hashes.
- Live staging and production evidence exists.
- The exact production build passes physical-iPhone, privacy, security,
  accessibility, performance, payment, AI, commerce, community, and operational
  verification.
- Apple approves the app and subscriptions.
- The founder authorizes release.
- Monitoring, support, moderation, privacy response, incident rollback, and
  finance operations are staffed and active.

Codex may not claim completion merely because the code compiles, a screen
exists, a flag is true, a packet was generated, or an external dependency is
pending. Codex must continue with the next safe unblocked task until the entire
objective is achieved or the founder explicitly changes the objective.
