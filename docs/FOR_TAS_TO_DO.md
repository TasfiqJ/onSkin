# Founder And External Touchpoint Register

> Active scope (2026-09-27): iOS lean V1 supersedes earlier all-features launch requirements. Required feature IDs: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11. See `docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md` and `docs/hugeToDo/launch-contract.json`. Manual Shelf/local ingredient parsing, reviewed guidance, routine/cycle, Today, private Progress, local reminders and standard subscriptions remain required. Catalog/search/barcode, custom grants/reverse trial/win-back, recommendations, Ask, public sharing, commerce, community, trends, widgets and growth experiments are post-launch and must stay closed. Existing Apple/email account functionality and all current privacy, payment, persistence, accessibility and owner-isolation safeguards are preserved. Historical sections below do not add deferred features back to the V1 launch gate.


Date: 2026-07-12
Status: Active, externally controlled gates only

This file is intentionally short. It lists only actions Codex cannot safely or
legitimately perform because they require a real legal person, identity check,
MFA/payment challenge, binding agreement, private financial information,
licensed or named professional judgment, possession of a physical iPhone,
genuine users, staffed human operations, or final public-release authority.

All research, engineering, configuration, documentation, testing, evidence
organization, vendor comparison, application preparation, store-packet work,
and launch operations around these touchpoints remain Codex-owned. Detailed
work-item state belongs in `docs/hugeToDo/execution-status.json`, not in a
founder task dump.

Never send passwords, MFA codes, private keys, API secrets, full payment-card
details, banking data, tax identifiers, government ID, or unredacted user data
through chat. Codex may operate an authorized signed-in session before and
after a private challenge without recording the private value.

Android credentials, builds, device evidence, Play records, payments, links,
performance, beta, and release approval are outside the current release and are
not founder work. Google OAuth for iPhone remains in scope.

## Founder Touchpoints

| ID   | Status         | Unavoidable founder action                                                                                                                                                    | Codex-owned preparation and follow-through                                                                                                                                                          | Evidence required                                                                           |
| ---- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| H-01 | Pending        | Control the Apple Account, complete identity verification/MFA, enroll, and pay the Apple Developer membership                                                                 | Recommend enrollment choices, prepare the checklist, guide/operate the session around private challenges, verify team/account, then configure identifiers, capabilities, TestFlight, and submission | Active membership, Team ID, account role, and redacted receipt/reference                    |
| H-02 | Pending        | Choose individual versus organization seller and provide truthful legal-entity information                                                                                    | Research the appropriate structure, prepare a field checklist, and verify consistency across Apple, policies, tax, banking, and public seller identity                                              | Recorded decision and consistent legal seller details                                       |
| H-03 | Pending        | Privately enter banking/tax information and accept Apple/vendor binding agreements                                                                                            | Prepare field-by-field guidance, flag inconsistencies, and complete every non-attestation field                                                                                                     | Agreements active; banking/tax status accepted, with no private values retained in repo     |
| H-04 | Pending        | Pay approved domains, memberships, reviewers, vendors, moderation/support, and usage budgets                                                                                  | Compare providers/prices, recommend choices, prepare purchases, configure approved services, and track renewals                                                                                     | Redacted purchase/account references and renewal owners                                     |
| H-05 | As encountered | Complete provider MFA, CAPTCHA, identity, phone, email, or payment challenges                                                                                                 | Operate the authorized session before/after the challenge and finish configuration                                                                                                                  | Redacted provider status; no challenge value retained                                       |
| H-06 | Pending        | Approve the recommended final name after formal clearance and authorize any paid reservation/filing                                                                           | Perform naming research, recommend one winner/two backups, prepare counsel packet, reserve approved assets through authorized accounts, and execute migration                                       | Written founder decision plus counsel conditions and reservation records                    |
| H-08 | Pending        | Provide/connect supported physical iPhones and perform gestures or confirmations that cannot be automated, including Face ID and sandbox purchase confirmation where required | Build binaries, write the matrix, direct sessions, collect redacted evidence/logs, fix defects, and rerun                                                                                           | Device/build matrix with model, iOS, build ID, scenarios, evidence, and named tester        |
| H-09 | Pending        | Provide genuine target beta users and any required tester consent                                                                                                             | Prepare recruiting materials, consent, invitations, scripts, feedback/support flows, dashboards, triage, fixes, and reports                                                                         | Declared cohort/device coverage, genuine D1/D7/D14/D30 outcomes, and honest sampling limits |
| H-11 | Pending        | Approve pricing, launch countries, budget ceilings, binding contracts, and material business-risk decisions                                                                   | Research/model/recommend options, prepare approval packets, and implement the approved choice                                                                                                       | Signed/recorded decision with date, owner, scope, and conditions                            |
| H-12 | Pending        | Explicitly authorize App Review submission and, after approval/recheck, public availability                                                                                   | Prepare and validate the complete submission, operate App Store Connect, respond/fix/resubmit, and present go/hold packets                                                                          | Submission authorization and later public-release authorization                             |

## External Professional And Staffed-Operation Touchpoints

| ID   | Status  | Required real-person action                                                                                                                   | Codex-owned preparation and follow-through                                                                                                                 | Evidence required                                                                                                              |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| H-07 | Pending | Named qualified reviewers make genuine trademark/IP, privacy/legal, clinical, cosmetic-chemistry, and security decisions                      | Identify candidates, prepare exact-hash packets and questions, coordinate review, incorporate changes, create detached records, and validate source hashes | Reviewer identity/authority verified out of band; retained approval reference; current signed decision for every released item |
| H-10 | Pending | Contract and staff real community moderation, customer support, incident escalation, privacy response, AI safety, and launch on-call coverage | Build tools, queues, rules, macros, SLAs, training, schedules, escalation trees, dashboards, and audit procedures                                          | Named coverage schedule, acknowledgements, test tickets/incidents, and escalation evidence                                     |

## Vendor And Apple Outcomes

| ID   | Status  | External decision                                                                                                                       | Codex-owned work                                                                                                              | Exit evidence                                                                       |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| V-01 | Pending | Apple approves membership, TestFlight external beta, subscriptions, app review, and release                                             | Prepare artifacts, submit when H-12 authorizes, monitor, answer, fix, and resubmit                                            | Apple status/approval references and approved build/product IDs                     |
| V-02 | Pending | Selected domain, email, AI, catalog, commerce/affiliate, analytics, support, moderation, or other vendors approve accounts/applications | Research/select, prepare applications, configure approved accounts, verify privacy/security/deletion, and implement fallbacks | Approved account/contract state, DPA/licence references, and verified configuration |

## Current Critical Order

1. H-02 legal seller structure and H-06 name decision after H-07 trademark review.
2. H-01 Apple enrollment and H-04 domain/reviewer/vendor budgets.
3. H-07 legal/privacy/clinical/chemistry/security/IP decisions against current
   exact source hashes.
4. H-08 physical-iPhone matrix and H-09 all-features TestFlight cohort.
5. H-10 staffed operations.
6. H-11 final commercial/country/budget approval.
7. H-12 submission and public-release authorizations; V-01 controls approval.

Pending external work never pauses safe Codex-owned work in another stream.
