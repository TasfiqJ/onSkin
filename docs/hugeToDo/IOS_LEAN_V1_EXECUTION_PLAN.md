# iOS Lean V1 Execution Plan

Date: 2026-09-27

Status: Active execution charter

Release platform: iPhone / iOS only

Release mode: Lean V1 core loop

## 1. Rule

This plan deliberately separates work into only two buckets:

- **C** — work ChatGPT/Codex can fully execute in the repository or an authorized tool session without asking the founder to perform engineering/research/documentation work.
- **H/V** — actions that genuinely require a legal person, licensed reviewer, physical device, payment/MFA/identity challenge, Apple decision, vendor approval, or final release authorization.

A task belongs in H/V only when automation cannot legitimately perform the decisive act. Everything surrounding that act stays C-owned.

## 2. Public V1 scope

Required indexed features: `F-01`, `F-02`, `F-03`, `F-05`, `F-06`, `F-07`, `F-08`, `F-09`, `F-10`, `F-11`.

No Phase 7/8 optional growth surface is required for V1. Deferred source remains fail-closed.

## 3. Founder / external-only list

| ID | Owner | Unavoidable action | Acceptance |
| --- | --- | --- | --- |
| H-01 | Founder | Complete Apple Account/Developer/App Store Connect identity, MFA, membership, truthful seller/legal entity, agreements, tax/banking and required payment steps. | Redacted membership/team/role/agreement/tax-banking-status evidence exists; no secrets are retained. |
| H-02 | Founder + trademark counsel | Obtain written clearance for the exact final public name in the actual launch territory/classes, approve that exact spelling, and authorize/pay any domain/filing/reservation spend. | Written clearance/conditions plus founder selection and authenticated reservation receipt exist. |
| H-03 | Qualified reviewers | Review the exact V1 release facts/corpora that require professional judgment: privacy/consumer-health/regulatory claims, conflict/routine/cycle clinical meaning, cosmetic-chemistry/application copy, relevant IP/content rights and export classification. | Dated credentialed decisions bind the exact source/build hashes and list conditions or required changes. |
| H-04 | Founder | Create/approve/pay the minimum production services and complete any identity/MFA/terms challenge: Expo/EAS, Supabase, RevenueCat, final domain/DNS/hosting. | Authorized accounts exist with least-privilege access and approved budgets/renewals; vendor secrets stay outside chat/repo. |
| H-05 | Founder/tester | Provide supported physical iPhone access and perform real-only actions: camera/OCR labels, protected photo flows/biometric unlock where used, local notification delivery, accessibility checks, StoreKit sandbox purchase/restore/manage, signed-build install/relaunch/background scenarios. | Exact device/iOS/build evidence is retained and every P0/P1 is fixed/retested. |
| H-06 | Founder | Approve final US-first launch territory, App Store prices/offers, spending ceilings, tax/business choices, support owner and any material residual risk. | Dated decision record exists and production/store configuration matches it. |
| H-07 | Founder | After reviewing the immutable release packet, explicitly authorize App Review submission and, separately, public availability. | Two dated authorizations exist; release remains manual until the second authorization. |
| V-01 | Apple | Issue membership/capability/TestFlight/App Review/subscription/public-release outcomes. | Apple-issued state is retained; no approval is predicted or fabricated. |
| V-02 | Vendors | Issue production account/limit/contract approvals where the selected minimum services require them. | Vendor-issued production state/limits are retained and reflected in release configuration. |

## 4. ChatGPT/Codex fully executable list

| ID | Owner | Deliverable | Acceptance |
| --- | --- | --- | --- |
| C-01 | C | Cut the repository from the superseded all-features launch contract to this lean V1 contract; rebuild validators, feature/task/status artifacts, active docs and legacy-task disposition. | Launch contract/validators agree on the 10 required features, zero optional Phase 7/8 surfaces, and every legacy task has a disposition. |
| C-02 | C | Apply the full iOS UI/UX overhaul for Welcome, onboarding, native system tabs, Today, Shelf and shared design primitives. | Typecheck/lint/tests pass and human-simulated supported-size UI evidence shows no overlap/dead-end/regression. |
| C-03 | C | Hard-close and unlink deferred product/growth surfaces. | Cloud Ask, recommendations, community, trend, commerce/public share, widgets/Live Activities, review prompts, creator links and paid measurement cannot become user-visible from V1 flags/navigation. |
| C-04 | C | Preserve guest-first onboarding and existing Apple/email account portability; defer Google sign-in in ordinary V1 navigation. | Existing Apple/email entry, owner-scoped anonymous sessions, cancellation and data-rights protections remain intact. Google sign-in is not a V1 requirement. |
| C-05 | C | Make Shelf V1 manual-entry and local ingredient parsing first (optional local-label OCR); remove catalog/search/barcode as launch dependencies and ordinary entry points. | Empty/populated Shelf has obvious Add + label OCR paths, manual fallback always works, unknowns stay unknown, remote catalog routes are not linked by V1 navigation. |
| C-06 | C | Preserve/finish fail-closed reviewed guidance source boundary and produce exact professional-review packets for conflict/routine/cycle. | No unreviewed positive guidance is admitted; hashes/copy/citations/reviewer scopes are deterministic and ready for H-03. |
| C-07 | C | Finish the owned-product routine/Today/cycle persistence and recovery source path. | Check-offs/order/cycle state are durable, owner-bound, offline-safe, non-punitive, and pass focused + human E2E. |
| C-08 | C | Finish private Progress V1 source path without trend/score claims. | Encrypted/local photo lifecycle, thumbnails, timeline, compare, notes, deletion, app-lock boundaries and no-content-flash source contracts pass; trend issuer remains false. |
| C-09 | C | Finish local reminders V1 and make remote push non-required. | On-device reminder permission/schedule/reschedule/quiet-hour/cleanup behavior passes source tests; no APNs server dependency is needed for V1. |
| C-10 | C | Finish subscription source path for normal monthly/annual StoreKit + RevenueCat only. | Paywall, localized pricing, purchase, restore, entitlement fail-closed logic and free fallback are source-complete; custom reverse trial/win-back stays disabled. |
| C-11 | C | Finish V1 privacy/data-rights source path for the guest-first model with optional Apple/email accounts. | Consent/withdrawal, export, deletion, photo-local-only disclosure, temporary-file cleanup and owner/session isolation pass source/adversarial tests. |
| C-12 | C | Produce final-brand-ready public web/policy/support source packet with placeholders that fail closed until H-02/H-04 values exist. | Home, Privacy, Terms, consumer-health privacy, support, deletion and export pages/copy are internally consistent and production URL validators reject placeholders. |
| C-13 | C | Finish production infrastructure scripts/config/runbooks for the minimum stack. | Clean local migrations/RLS, environment guards, deploy manifests, backup/restore/rollback, EAS/App Store/RevenueCat/Supabase setup instructions and secret boundaries are source-verified and ready for authorized accounts. |
| C-14 | C | Finish release QA/security/performance/TestFlight/App Store packet source work for lean V1. | Scope-aware unit/contract/human-E2E/native checklists, privacy/network/security/supply-chain checks, App Review notes/metadata templates and internal TestFlight instructions are complete without deferred-feature gates. |
| C-15 | C | Run final source verification after all C changes, incorporate H/V evidence as it arrives, fix regressions, and build the immutable submission/release packet. | Repository gates pass on a clean commit; all remaining blockers are exclusively H/V; packet is ready for H-07. |

## 5. Deferred backlog (not launch blockers)

Keep the source and historical checkpoints for these, but do not require implementation, vendors, professional reviews, beta evidence or launch operations for V1:

- production catalog import/search/barcode and catalog operator program;
- Google account-upgrade expansion;
- reverse trial / custom Pro grant / win-back experiments;
- product recommendations and product discovery;
- cloud Ask/model provider;
- share/public links;
- affiliate commerce/creator attribution/order polling;
- community posting/aggregates/moderation staffing;
- photo trend engine/calibration/fairness;
- widgets/Live Activities and remote push;
- review prompts, creator links, paid measurement;
- production-scale admin/operator product;
- 50–100-user mandatory beta and D14/D30 launch delay.

## 6. Completion semantics

A C item may be marked complete when its acceptance is fully satisfied by source/tests/evidence that do not require an H/V action. A C item must never stay open merely because a related H/V task is pending; the external dependency belongs on the H/V task instead.

H/V tasks stay external pending until real evidence exists. Generated documents, fixtures, screenshots of local mocks, or self-authored signoffs never substitute for those outcomes.
