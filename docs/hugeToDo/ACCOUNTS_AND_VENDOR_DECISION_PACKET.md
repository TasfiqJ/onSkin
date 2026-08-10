# Accounts and Vendor Decision Packet (ACCT-03–ACCT-16)

**Decision date:** 2026-07-13

**Status:** Research-backed recommendation; no account, contract, purchase, integration, approval, or launch authorization is implied

**Applies to:** iOS-only launch contract in the Layerwell repository; public launch country, final brand, budget, and legal entity remain human decisions

**Currency:** USD unless stated otherwise; taxes, FX, overages, implementation, and negotiated enterprise fees are excluded

## Executive decision

Use a deliberately small vendor surface, keep photos and sensitive routine data local by default, and require a signed data-flow review before any cloud feature receives user content. The recommended launch stack is:

| ID      | Recommended path                                                                      | Launch posture                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ACCT-03 | Supabase Pro, separate staging and production projects in the launch-aligned region   | East US (North Virginia) for the current US-only Wave 1 hypothesis; Canada/EU only if launch scope changes and counsel approves |
| ACCT-04 | RevenueCat Pro                                                                        | Pseudonymous App User ID only; no health/profile attributes                                                                     |
| ACCT-05 | Cloudflare Registrar, DNS, and Pages                                                  | Only after the name/domain is cleared; DNSSEC and MFA required                                                                  |
| ACCT-06 | Amazon SES SMTP in the launch-aligned AWS region                                      | Transactional mail only; no tracking or sensitive content                                                                       |
| ACCT-07 | PostHog Cloud EU                                                                      | Explicit allowlist; autocapture and replay off; consent before initialization                                                   |
| ACCT-08 | Sentry Team EU                                                                        | Aggressive client/server scrubbing; sensitive data is prohibited                                                                |
| ACCT-09 | Cloudflare Turnstile Free                                                             | Risk-triggered flows only; server verification is mandatory                                                                     |
| ACCT-10 | Direct brand feeds + physical-label facts, with segregated Open Beauty Facts fallback | Licensing review before merging or redistributing data                                                                          |
| ACCT-11 | Provider-neutral AI gateway; OpenAI Responses API as the first evaluation candidate   | No provider call until contract, retention, safety, and clinical/legal gates pass                                               |
| ACCT-12 | impact.com application as the primary affiliate path                                  | Ranking remains independent of commission; plain merchant links are the safe fallback                                           |
| ACCT-13 | Help Scout Standard                                                                   | Two trained human seats; AI features off; sensitive-content intake blocked                                                      |
| ACCT-14 | Named internal human moderation rota with automated triage                            | Community posting stays disabled until staffing and escalation gates pass                                                       |
| ACCT-15 | Apple-native measurement only at launch                                               | No MMP SDK and no ATT prompt while there is no cross-company tracking                                                           |
| ACCT-16 | Maintained internal vendor/subprocessor register and release gate                     | No new SDK/vendor without review, contract record, data map, and deletion test                                                  |

This packet cannot guarantee App Review acceptance, regulatory compliance, vendor approval, deliverability, or commercial success. Those outcomes depend on the final implementation, representations in App Store Connect, launch countries, contracts, operating practice, and human/legal review. Any recommendation below is therefore conditional on the exact gates in this document.

## Decision method

Each option is scored from 1 (poor) to 5 (strong). The total is a weighted score out of 100, not a claim of compliance or vendor quality.

| Code | Criterion                    | Weight | What is being judged                                                      |
| ---- | ---------------------------- | -----: | ------------------------------------------------------------------------- |
| P    | Privacy and minimization     |     25 | Ability to avoid, pseudonymize, and isolate sensitive data                |
| D    | DPA, residency, deletion     |     15 | Contract clarity, region choice, deletion and transfer controls           |
| S    | Security and reliability     |     15 | Security posture, incident support, availability and operational maturity |
| F    | Product and architecture fit |     15 | Fit for the documented local-first, iOS-only architecture                 |
| O    | Operator burden              |     10 | Effort to configure, monitor, support, and safely exit                    |
| C    | Cost predictability          |     10 | Transparent pricing and controllable scale cost                           |
| X    | Portability                  |      5 | Exportability and ease of replacement                                     |
| A    | Apple/legal fit              |      5 | Compatibility with App Review and the documented safety posture           |

Formula: `weighted total = Σ(score × weight ÷ 5)`. A higher fallback score can reflect lower risk while still failing a required business outcome; the narrative decision remains controlling.

## Non-negotiable cross-vendor controls

Before any production account or contract is approved, its owner must record:

1. legal entity, controller/processor role, purpose, exact data fields, data subjects, and lawful basis/consent path;
2. DPA version and signature status, processing locations, transfer mechanism, subprocessor list and change-notice method;
3. production region, retention configuration, deletion API/process, tested account-exit/export path, and backup-deletion behavior;
4. incident/security contact, contractual notification language, operational escalation owner, and evidence-retention path;
5. account owner plus backup owner, phishing-resistant MFA where supported, least-privilege roles, recovery codes, API-key rotation and offboarding process;
6. pricing owner, approved cap, overage alerts, renewal date, cancellation window, and reminders at 60/30/7 days;
7. SDK privacy manifest/signature status, Apple privacy-label mapping, consent behavior, and a release diff proving that no undeclared collection was introduced;
8. support and data-subject-request procedure, including deletion verification and the response when the vendor cannot meet the required deadline.

No production data may be entered while any of these fields is unknown. No vendor is allowed to receive photos, routine history, skin concerns, Ask text, product shelf contents, search terms, or identifiers merely because its SDK can collect them.

## Scorecard

| ID / option                                 |   P |   D |   S |   F |   O |   C |   X |   A |  Total |
| ------------------------------------------- | --: | --: | --: | --: | --: | --: | --: | --: | -----: |
| ACCT-03 Supabase Pro, region-aligned        |   4 |   4 |   4 |   5 |   5 |   4 |   4 |   5 | **86** |
| ACCT-03 Supabase Team                       |   4 |   5 |   5 |   4 |   2 |   1 |   4 |   5 |     77 |
| ACCT-03 custom managed Postgres/API         |   5 |   5 |   4 |   3 |   1 |   2 |   5 |   5 |     77 |
| ACCT-04 RevenueCat Pro                      |   4 |   4 |   5 |   5 |   5 |   4 |   3 |   5 | **88** |
| ACCT-04 direct StoreKit 2/server API        |   5 |   5 |   4 |   4 |   1 |   5 |   5 |   5 |     86 |
| ACCT-05 Cloudflare registrar/DNS/Pages      |   4 |   4 |   5 |   5 |   5 |   5 |   4 |   5 | **91** |
| ACCT-05 separate registrar/static host      |   4 |   3 |   4 |   4 |   3 |   4 |   5 |   5 |     77 |
| ACCT-06 Amazon SES                          |   5 |   5 |   5 |   5 |   2 |   5 |   4 |   5 | **93** |
| ACCT-06 Resend Pro                          |   3 |   3 |   4 |   5 |   5 |   4 |   4 |   5 |     78 |
| ACCT-06 Postmark Basic                      |   3 |   2 |   4 |   5 |   5 |   4 |   4 |   5 |     75 |
| ACCT-07 PostHog Cloud EU                    |   5 |   5 |   4 |   5 |   4 |   5 |   4 |   5 | **94** |
| ACCT-07 first-party aggregate analytics     |   5 |   5 |   3 |   3 |   1 |   4 |   5 |   5 |     78 |
| ACCT-08 Sentry Team EU                      |   4 |   4 |   5 |   5 |   4 |   4 |   4 |   5 | **87** |
| ACCT-08 Apple-only diagnostics              |   5 |   5 |   4 |   3 |   3 |   5 |   5 |   5 |     87 |
| ACCT-09 Turnstile Free                      |   4 |   4 |   5 |   5 |   3 |   5 |   4 |   5 | **87** |
| ACCT-09 hCaptcha                            |   3 |   3 |   4 |   4 |   3 |   4 |   4 |   5 |     71 |
| ACCT-10 layered/direct-source catalog       |   5 |   5 |   4 |   5 |   2 |   3 |   5 |   5 | **87** |
| ACCT-10 Open Beauty Facts only              |   3 |   3 |   2 |   4 |   4 |   5 |   5 |   3 |     68 |
| ACCT-10 proprietary aggregator              |   4 |   4 |   4 |   5 |   4 |   2 |   2 |   5 |     78 |
| ACCT-11 OpenAI behind neutral gateway       |   4 |   4 |   5 |   5 |   4 |   4 |   5 |   4 | **87** |
| ACCT-11 Vertex AI fallback                  |   5 |   5 |   5 |   4 |   2 |   3 |   5 |   4 |     86 |
| ACCT-11 Anthropic API fallback              |   4 |   3 |   5 |   4 |   4 |   3 |   5 |   4 |     79 |
| ACCT-12 plain merchant links, no commission |   5 |   5 |   5 |   2 |   5 |   5 |   5 |   5 | **91** |
| ACCT-12 impact.com affiliate path           |   3 |   3 |   4 |   5 |   4 |   5 |   4 |   4 |     77 |
| ACCT-12 ShopMy fallback                     |   3 |   3 |   4 |   3 |   5 |   5 |   3 |   4 |     72 |
| ACCT-13 Help Scout Standard                 |   3 |   3 |   5 |   5 |   5 |   4 |   4 |   5 | **81** |
| ACCT-13 Plain Foundation                    |   4 |   4 |   4 |   4 |   4 |   3 |   4 |   5 |     79 |
| ACCT-14 named humans + automated triage     |   5 |   5 |   4 |   5 |   2 |   3 |   5 |   5 | **87** |
| ACCT-14 managed TaskUs service              |   4 |   4 |   5 |   5 |   5 |   1 |   3 |   5 |     82 |
| ACCT-14 automated-only moderation           |   2 |   2 |   2 |   1 |   5 |   5 |   4 |   1 |     50 |
| ACCT-15 Apple-native measurement            |   5 |   5 |   5 |   5 |   4 |   5 |   4 |   5 | **97** |
| ACCT-15 AppsFlyer Growth                    |   3 |   3 |   4 |   4 |   4 |   4 |   3 |   3 |     70 |
| ACCT-15 Adjust with residency contract      |   4 |   4 |   4 |   4 |   3 |   2 |   3 |   3 |     72 |
| ACCT-16 internal governed register          |   5 |   5 |   4 |   5 |   2 |   5 |   5 |   5 | **91** |
| ACCT-16 dedicated GRC platform              |   4 |   4 |   5 |   3 |   4 |   1 |   3 |   5 |     74 |

## ACCT-03 — Supabase staging and production

**Recommendation.** Use one paid organization with two isolated Pro projects: staging and production. For the current US-only Wave 1 hypothesis, select Supabase's general **East US (North Virginia)** region (or exact `us-east-1` only if a documented automation/read-replica requirement needs a specific region). If the approved launch changes to Canada-first, evaluate `ca-central-1`; for EU/UK-first, evaluate Frankfurt. Do not mix those conditional options into the current US pricing plan. Regions cannot be treated as a cosmetic switch; a later move requires migration. Use owner-scoped RLS, service-role keys only on trusted server surfaces, separate secrets, database backups, rate limits, and a documented restore drill.

**Cost snapshot.** [Supabase pricing](https://supabase.com/pricing) lists Pro from $25/month and a $10 monthly compute credit that covers one Micro compute instance; an additional active Micro project begins around $10/month. A two-project baseline is therefore approximately **$35/month**, before storage, egress, MAU, compute upgrades, custom domains, or add-ons. Free projects can pause and are not production. PITR is separately priced and should be bought only against a signed RPO/RTO. Team begins at $599/month and is justified when project-scoped roles, formal compliance access, or contracted health-data handling require it—not for launch optics.

**Data and contract posture.** Supabase publishes [available regions](https://supabase.com/docs/guides/platform/regions), a current [DPA](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf), [backup behavior](https://supabase.com/docs/guides/platform/backups), [SOC 2/shared-responsibility guidance](https://supabase.com/docs/guides/security/soc-2-compliance), [project deletion](https://supabase.com/docs/guides/platform/delete-project), and a [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod). Counsel must determine whether regulated health obligations apply; no HIPAA or equivalent claim is allowed without the required plan/add-on, BAA, configuration, and legal determination.

**Exact gate.** Founder/finance approves the recurring cap and overage alerts; security owner enables MFA and recovery; engineering records region, RPO/RTO, restore evidence, RLS test evidence, deletion/export procedure, DPA, incident address, and subprocessor notices; privacy counsel signs the transfer/role analysis. No production project is created under an uncleared brand.

**Fallback and exit.** Export PostgreSQL data and object storage to a managed Postgres/custom API provider. Keep migrations portable and avoid coupling safety rules to provider-only features. If the DPA, region, or BAA requirement cannot be met, cloud sync stays disabled.

## ACCT-04 — RevenueCat

**Recommendation.** Use RevenueCat Pro as the subscription entitlement coordinator. The App User ID must be the pseudonymous Supabase user UUID (or a domain-separated stable identifier), never email, advertising ID, skin concern, or health/routine data. Store only entitlement state and the minimum transaction identifiers required to reconcile Apple events. Webhooks terminate server-side and must be signature/auth checked, idempotent, logged without payload secrets, and replay-tested.

**Cost snapshot.** [RevenueCat pricing](https://www.revenuecat.com/pricing/) lists Pro at no charge through $2,500 in monthly tracked revenue and 1% of monthly tracked revenue above that threshold; Enterprise is quoted. At $30,000 monthly tracked revenue, a rough 1% illustration is **$300/month**, but finance must verify the then-current definition, threshold, taxes, and contract before relying on it.

**Data and contract posture.** Record the current [DPA](https://www.revenuecat.com/dpa), [security/compliance material](https://www.revenuecat.com/security-and-compliance/), key model in [authentication guidance](https://www.revenuecat.com/docs/projects/authentication), and the distinction between [deleting a customer profile](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile) and cancelling an Apple subscription. Deletion must be tested without misrepresenting subscription status.

**Exact gate.** Apple agreements, products, price tiers, tax/banking, privacy disclosures, and the subscription paywall copy are human approvals. Finance approves the variable-fee model. Privacy signs the field-level data map. Engineering proves restore/reconciliation against App Store Server notifications and verifies that deleting the app profile does not silently cancel or strand an Apple entitlement.

**Fallback and exit.** StoreKit 2 plus App Store Server API/notifications with an internal entitlement ledger. Export subscriber/entitlement records before termination and retain Apple as the source of truth. If RevenueCat terms or variable fees are unacceptable, this fallback is launch-capable but requires more engineering and operational testing.

## ACCT-05 — Domain, DNS, and static hosting

**Recommendation.** After trademark/name clearance, register the domain through Cloudflare Registrar, host authoritative DNS there, and publish privacy, terms, support, safety, and account-deletion pages on Cloudflare Pages. Use separate subdomains for web, auth mail, links, and API boundaries. Enable registry lock where available, DNSSEC, MFA, least-privilege access, and a non-personal recovery mailbox.

**Cost snapshot.** Cloudflare describes [Registrar](https://developers.cloudflare.com/registrar/) as at-cost registration/renewal with redacted WHOIS and auto-renew by default; exact TLD and registry fees are visible only at selection/checkout and must be recorded before purchase. Static Pages requests are described as free/unlimited, while dynamic functions consume [Workers/Pages Functions allowances](https://developers.cloudflare.com/pages/functions/pricing/); published [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) still apply.

**Data and contract posture.** Archive the [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) and [privacy/data-protection information](https://www.cloudflare.com/trust-hub/privacy-and-data-protection/). Legal pages must not use trackers before consent and must stay available independently of app/API incidents.

**Exact gate.** Trademark counsel/founder approves the final name and domain before registration. Finance approves the exact registry price. Security records registrant, recovery, MFA, DNSSEC, renewal method, and 60/30/7-day expiry alerts. Legal signs the published pages and contact addresses before the domain is linked from App Store Connect.

**Fallback and exit.** Use a reputable ICANN-accredited registrar while retaining Cloudflare DNS/Pages, or export DNS and static assets to another host. If name clearance is incomplete, use a private non-brand test hostname only; do not launch or create customer-facing accounts under the provisional name.

## ACCT-06 — Transactional email

**Recommendation.** Use Amazon SES SMTP/API in the same jurisdictional region selected for the launch data path, subject to region feature availability and counsel. Create a dedicated transactional subdomain, configure SPF, DKIM, DMARC, bounce/complaint handling, sending limits, and alarms. Email contains only verification, security, receipt/status, or support-routing content—never photos, skin concerns, product shelf/history, Ask text, diagnostic language, or behavioral tracking pixels.

**Cost snapshot.** [Amazon SES pricing](https://aws.amazon.com/ses/pricing/) lists outbound mail at $0.10 per 1,000 messages, with separate attachment/data and optional dedicated-IP charges. Ten thousand simple outbound messages is therefore roughly **$1 in message charges** after any applicable free allowance, excluding AWS support, bandwidth, inbound processing, attachments, tax, and operational work. Exact eligibility and current region price must be checked at approval. [SES regions](https://docs.aws.amazon.com/ses/latest/dg/regions.html) and sending-production approval are separate gates.

**Data and contract posture.** AWS states in its [data privacy FAQ](https://aws.amazon.com/compliance/data-privacy-faq/) that customers choose regions and describes controls on moving customer content. The signed AWS service terms/DPA, region-specific subprocessors, deletion/log retention, IAM design, incident contact, and sending-event destinations must still be recorded. Supabase requires [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for a production auth-mail posture.

**Exact gate.** Founder or authorized human accepts AWS terms and payment; AWS approves production sending; security approves IAM and key rotation; privacy approves templates and field map; support owns bounce/complaint handling; domain owner publishes authenticated DNS; finance sets a monthly budget alarm. Deliverability is verified with test accounts before production.

**Fallback and exit.** Resend Pro is the operationally simpler fallback: [pricing](https://resend.com/pricing), [DPA](https://resend.com/legal/dpa), [region/storage caveats](https://resend.com/docs/dashboard/domains/regions), [subprocessors](https://resend.com/legal/subprocessors), and [account deletion](https://resend.com/docs/knowledge-base/how-can-i-delete-my-resend-account) must be reviewed; sending region does not make all account/log metadata regional. Postmark Basic is a second fallback; its [pricing](https://postmarkapp.com/pricing/) and [EU/privacy explanation](https://postmarkapp.com/eu-privacy) disclose US processing and configurable message retention. If no provider clears contract and deliverability gates, email-dependent sign-up must not launch.

## ACCT-07 — PostHog

**Recommendation.** Use separate staging/production projects in PostHog Cloud EU. Initialize only after the applicable consent choice. Disable autocapture, session replay, heatmaps, surveys, exception capture, person profiles, and default URL/property collection unless a later field-level review explicitly approves them. Send a small versioned event allowlist with a random, domain-separated analytics ID. Discard IP/GeoIP. Never send email, raw account UUID, device advertising ID, photo metadata, routine/shelf/Ask content, barcodes, product names, free text, or precise timestamps that enable reconstruction of a sensitive routine.

**Cost snapshot.** [PostHog pricing](https://posthog.com/) lists Product Analytics with 1 million events/month free and $0.00005 per event after the free amount. At two million events/month, the illustrative incremental event charge is about **$50/month**, before other products and plan changes. Cap event volume at the source and alert before the free tier is exhausted.

**Data and contract posture.** PostHog documents [privacy controls](https://posthog.com/docs/privacy), [EU storage, transformations, and deletion](https://posthog.com/docs/privacy/data-storage), and [GDPR configuration](https://posthog.com/docs/privacy/gdpr-compliance); security attestations are linked from its [trust center](https://trust.posthog.com/). EU hosting does not replace consent, minimization, transfer, DPA, or subprocessor analysis.

**Exact gate.** Product and privacy jointly approve the event dictionary and each property. Engineering proves from a proxy/log capture that disabled features do not transmit and that denied/withdrawn consent stops future events. Legal approves privacy-label and notice text. Finance approves event caps. The release gate rejects any event/property absent from the dictionary.

**Fallback and exit.** Disable product analytics or emit only first-party aggregated counters with no user-level trail. Export the minimal allowed data before termination and delete persons/events via the documented path. Analytics absence must never block the core routine.

## ACCT-08 — Sentry

**Recommendation.** Use a new Sentry Team organization in the EU region for production, with a separate staging project. Region choice is effectively immutable for an organization, so make it before ingesting data. Set `sendDefaultPii` false and disable session replay, screenshots, view hierarchy, attachments, console capture/breadcrumbs, request bodies, user feedback attachments, and source-context fields that can include user content. Apply client-side and server-side allowlists plus `beforeSend` scrubbing; use random release/session correlation only. Health, photo, shelf, routine, Ask, search, support, and user-identity content must never enter Sentry.

**Cost snapshot.** [Sentry pricing](https://sentry.io/pricing/) lists Developer free with one user/5,000 errors, Team at **$26/month billed annually** with 50,000 errors and additional telemetry allowances, and Business at $80/month, subject to current usage details. Developer may be used for solo non-production evaluation; Team is the minimum practical launch tier for multiple operators and controls.

**Data and contract posture.** Sentry documents [US/EU storage choice](https://docs.sentry.io/organization/data-storage-location/), [retention periods](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/), [React Native collection defaults](https://docs.sentry.io/platforms/react-native/data-management/data-collected/), and [sensitive-data scrubbing](https://docs.sentry.io/platforms/react-native/data-management/sensitive-data/). Critically, the current [Sentry DPA](https://sentry.io/legal/dpa/) prohibits submitting Sensitive Data. Its [subprocessor list](https://sentry.io/legal/subprocessors/) and notice/objection process must be tracked. This is a hard architectural prohibition, not a best effort.

**Exact gate.** Privacy approves the allowlist and DPA interpretation. Engineering provides captured-event samples for every major flow and a seeded-secret/PII canary test proving scrub/drop behavior. Security records region, retention, alert roles, incident contact, export/delete procedure, and subprocessor notices. Release is blocked if an event includes user content or unapproved identifiers.

**Fallback and exit.** Apple crash reports/MetricKit plus locally redacted first-party server logs. This scores equally on risk/cost but provides less cross-stack context. If Sentry cannot remain free of prohibited data, it is disabled—not operated on consent alone.

## ACCT-09 — Cloudflare Turnstile

**Recommendation.** Use Turnstile Free in managed mode with separate staging and production widgets. Invoke it only on risk-triggered public/auth actions, not on every app interaction. Every token must be verified by a trusted server against the expected hostname and action; tokens are short-lived and single-use. Secrets never ship in the app.

**Cost snapshot.** [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/) list the Free plan with up to 20 widgets, 10 hostnames per widget, unlimited challenges, and seven days of analytics; Enterprise is quoted. The official [Siteverify guidance](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) says server-side validation is mandatory and tokens expire after five minutes and cannot be reused.

**Mobile constraint.** Cloudflare's [mobile implementation guidance](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/) does not provide native execution; React Native requires a WebView that loads a controlled webpage and satisfies JavaScript/storage/network conditions. The WebView origin, navigation allowlist, accessibility, offline/error behavior, privacy notice, and token handoff must be human-simulated and security tested. Supabase documents [Turnstile/hCaptcha support for Auth](https://supabase.com/docs/guides/auth/auth-captcha).

**Exact gate.** Security approves hostname/action validation, rate limits, replay tests, and fail behavior. Privacy approves the vendor/data map. QA proves VoiceOver, Dynamic Type, slow network, offline, blocked-cookie, and cancellation flows on real iOS surfaces. Abuse operations owns false-positive escalation. The feature cannot silently bypass validation when Turnstile is unavailable.

**Fallback and exit.** hCaptcha under a separately reviewed contract, or a fail-closed/rate-limited support queue for the affected action. Existing signed-in users must retain safe local access during an external CAPTCHA outage; privileged public writes remain closed.

## ACCT-10 — Catalog licensing and source path

**Recommendation.** Treat catalog facts as source-attributed records, not as one blended truth table:

1. Prefer the physical package and signed manufacturer/brand feeds for label text, ingredients, warnings, images, variants, and market/version dates.
2. Use Open Beauty Facts only as a segregated seed/fallback layer with source URL, retrieval date, license version, edit history where available, and a visible confidence/source label. Never turn crowd data into a safety, efficacy, allergy, or compatibility claim.
3. Use the European Commission's CosIng database only to normalize ingredient names and provide regulatory context. Its own [CosIng notice](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en) says the database is informative and has no legal value; an INCI listing is not approval or proof that an ingredient/product is safe.
4. Use GS1 only under an appropriate enterprise/API agreement to verify GTIN identity/company ownership—not to infer ingredients, product quality, or authorization. Public [Verified by GS1](https://www.gs1.org/services/verified-by-gs1) access is limited and its [terms](https://www.gs1.org/docs/verified-by-gs1/public-verified-by-gs1-tou.pdf) must not be treated as a bulk redistribution license.

**License and quality posture.** The official [Open Beauty Facts project description](https://wiki.openfoodfacts.org/images/e/ed/OpenBeautyFacts.pdf) describes ODbL database licensing and CC BY-SA product photographs. The sibling Open Food Facts project's official [API/data documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/) warns that data may be inaccurate or incomplete, applies read/search rate limits, and directs bulk users to exports rather than high-volume search calls. Its [photo-upload guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-uploading-photo-to-a-product/) also makes clear that contributed photos become reusable under the project terms. Counsel must confirm which current terms apply specifically to each Open Beauty Facts endpoint/export and whether selection, normalization, corrections, or redistribution create share-alike obligations. Do not upload Layerwell user photos or corrections without a separate explicit contribution design and consent.

**Cost snapshot.** Public Open Beauty Facts/CosIng access has no listed license fee, but ingestion, attribution, quality review, and legal work are real costs. GS1 enterprise/API and proprietary catalog feeds are quote-based. A `$0` source must not be modeled as `$0` catalog operations.

**Exact gate.** H-07 professional legal/licensing review signs a source-by-source matrix covering database rights, image rights, trademarks, attribution placement, share-alike/export behavior, caching, deletion/correction, rate limits, countries, and termination. A data steward signs quality thresholds and recall/correction workflow. Brand/GS1 vendors must approve the intended API, display, cache, and redistribution use in writing under V-02. Engineering demonstrates provenance survives every transform and export. Until then, scanning can return “not found” and offer local manual entry; it cannot scrape retailer pages or unlicensed ingredient sites.

**Fallback and exit.** Physical-label/manual entry with no cloud catalog, plus later signed direct-brand feeds. Source adapters must be removable, and deleting one source must not delete a user's local record. If rights are unclear, suppress that source's images/data rather than infer permission.

## ACCT-11 — AI/model provider

**Recommendation.** Build a provider-neutral server gateway and evaluate OpenAI's Responses API as the first candidate. The app sends a versioned structured request to Layerwell, never a vendor API directly; provider IDs, prompts, credentials, retries, policy rules, and model selection stay server-side. At the 2026-07-13 decision date, OpenAI's [latest-model guide](https://developers.openai.com/api/docs/guides/latest-model) identifies `gpt-5.6-terra` as a candidate model and recommends the Responses API. The guide does not establish that name as an immutable dated snapshot. Evaluation must record the exact resolved model/version and configuration observed, and production promotion requires the tested version plus a controlled canary/rollback. Never auto-upgrade production to a moving alias or unevaluated version.

The gateway may receive only a redacted, minimal question and a small set of approved/reviewer-backed excerpts. Set `store: false`; disable web search and provider-hosted tools; send no photos, raw profile, routine history, shelf, precise dates, or contact details. OpenAI's [API authentication reference](https://developers.openai.com/api/reference/overview/) says keys must not be exposed in client-side apps, so the mobile binary can call only Layerwell's authenticated backend. OpenAI's [safety guidance](https://developers.openai.com/api/docs/guides/safety-best-practices) recommends a stable privacy-preserving `safety_identifier` for end-user applications: if approved, derive it server-side as a purpose/domain-separated keyed HMAC of the internal user ID, never the raw ID, email, device ID, or a value shared with analytics/commerce. Pre-model deterministic checks reject emergency, diagnosis/treatment, unsafe-combination, pregnancy/medication, or unsupported-product cases as defined by the approved policy. Post-model checks enforce the structured schema, citations, prohibited-claim rules, uncertainty, and escalation. The product must never output diagnosis, treatment/cure claims, AI skin score, skin age, or percentage improvement.

**Cost snapshot.** OpenAI's current [API pricing](https://developers.openai.com/api/docs/pricing) lists standard short-context `gpt-5.6-terra` at $2.50 per million input tokens and $15 per million output tokens, with a regional-processing uplift noted for eligible models. An illustration of 10,000 asks/month at 2,000 input plus 500 output tokens each is about **$125/month** (`20M × $2.50 + 5M × $15`), before retries, retrieval, safety calls, caching choices, taxes, and any 10% eligible regional uplift. This is a planning example, not a quote or approved budget.

**Data and contract posture.** OpenAI's [API data controls](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint) say API input/output is not used to train models unless the customer opts in, while default abuse-monitoring logs may retain content for up to 30 days and Responses application state is retained for roughly 30 days by default unless the endpoint/configuration changes that behavior. `store: false` is mandatory but its actual endpoint behavior must still be independently confirmed and tested. Zero Data Retention/Modified Abuse Monitoring require approval. Canada currently offers regional storage but not regional processing; non-US residency requires approved abuse-monitoring controls plus a ZDR amendment, and system data can remain outside the selected region. Web Search is excluded because it is not listed as HIPAA-eligible/BAA-covered in OpenAI's current [HIPAA endpoint list](https://cdn.openai.com/osa/hipaa-endpoints.pdf) and is unnecessary for the grounded design. Archive the signed [OpenAI DPA](https://openai.com/policies/data-processing-addendum/), current [subprocessor list](https://openai.com/policies/sub-processor-list/), approved data-residency/retention configuration, deletion behavior, incident contact, and change-notice subscription.

**Exact gate.** The authorized human accepts commercial terms, DPA, payment, and any ZDR/MAM/residency amendments; the provider approves requested controls. Legal/privacy signs the field-level transfer map and notices. Independent clinical/safety reviewers sign the policy, sources, red-team cases, abstention/escalation behavior, and exact promoted model/version/configuration. Security signs secrets, abuse limits, logs, incident path, and deletion test. Product signs user consent and clear AI disclosure. No gate may be replaced by a benchmark score. Until all evidence exists, Ask remains reviewer-authored/local, limited, or disabled.

**Fallback and exit.** Google Vertex AI in the launch-aligned region is the first contractual/residency fallback; official [zero-retention/training controls](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention), [security/residency controls](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/security-controls), and [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum/) must be reviewed feature by feature because caching, grounding, and abuse controls vary. Anthropic API is second; its official [commercial retention explanation](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) and [ZDR scope](https://privacy.anthropic.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to) require the same review. Provider neutrality supports exit; it does not authorize an automatic failover to an unevaluated model.

## ACCT-12 — Commerce and affiliate programs

**Recommendation.** Apply to impact.com's partner marketplace only after the brand, entity, countries, disclosure copy, and recommendation-independence controls are approved. impact.com explicitly supports [publishers and mobile apps](https://impact.com/partners/); joining requires profile/tax/media details and vendor review, and [each brand relationship](https://help.impact.com/partner/readme/im-a-partner/step-2-apply-to-brands) has its own application and contract. Publisher signup is described as free on [impact.com's pricing page](https://impact.com/integrated-platform-prices/), while commissions, reversals, payment thresholds, and merchant terms vary. Acceptance and revenue are not assumed.

The recommendation engine and UI must rank on the reviewer-approved fit/safety rubric before and independently of merchant availability, price, commission, or campaign. Label unavailable offers without substituting a higher-paying product. Adjacent to every compensated outbound control, use conspicuous plain language such as “Paid link — we may earn a commission,” plus a persistent affiliate policy. The US FTC says “affiliate link” or a bare “Buy Now” may be insufficient in its [endorsement guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking); Canada's Competition Bureau similarly says links/discount codes alone may not adequately disclose a material connection in its [influencer-marketing guidance](https://competition-bureau.canada.ca/en/deceptive-marketing-practices/types-deceptive-marketing-practices/influencer-marketing-and-competition-act).

**Apple posture.** Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) permit external payment methods for physical goods, require authorization for third-party services/content, prohibit misleading marketing, and restrict health data from targeted advertising. Premium digital app functionality remains Apple IAP. Layerwell does not auto-checkout, present a merchant price as guaranteed, or share health/routine data with affiliate networks.

**Exact gate.** H-07 professional legal review signs affiliate/endorsement, tax, consumer, trademark, deep-link, price freshness, refund, and country analysis; H-11 approves pricing, countries, contracts, and risk; the authorized human signs applications/contracts and payout details; each network/merchant approves Layerwell under V-02; product/clinical governance proves the ranker contains no compensation input; QA verifies disclosure adjacency, VoiceOver reading order, destination/merchant identity, failure/return flows, and price timestamp. Silence is not vendor approval.

**Fallback and exit.** Plain non-affiliate merchant/manufacturer links are the highest-scoring safety fallback, even though they do not satisfy affiliate-revenue goals. ShopMy's [creator program](https://shopmy.us/home/creators) is a curated/application fallback only if its terms support a mobile health-adjacent product. If no network approves the use, launch with no commission and do not degrade recommendations.

## ACCT-13 — Support/helpdesk

**Recommendation.** Launch with Help Scout Standard and two trained human seats (primary plus backup). Use one support inbox and a minimal in-app/email form. Before submission, warn users not to include photos, medical details, passwords, or emergency information; disable attachments initially; redact accidental sensitive content; and route emergencies to local emergency resources rather than offering clinical advice. Turn off AI drafting, summarization, enrichment, tracking pixels, session replay, and third-party marketplace apps until separately reviewed.

**Cost snapshot.** [Help Scout pricing](https://www.helpscout.com/pricing/) lists Standard at **$25/user/month**, making two seats approximately **$50/month**, before taxes/add-ons and subject to billing terms. The Free plan's contact/feature limits are useful only for pre-launch evaluation, not a staffed launch SLA.

**Data and contract posture.** Archive Help Scout's current [DPA](https://www.helpscout.com/company/legal/dpa/) and [security terms](https://www.helpscout.com/company/legal/security/). Its DPA describes global/US processing, incident notice, subprocessor handling, and termination deletion that may take up to the stated period; the register must capture the actual configuration, notice subscription, and deletion-test result.

**Exact gate.** Two named trained humans accept an on-call/support rota; support leadership signs severity, escalation, deletion/DSAR, abuse, refund, subscription, and clinical-boundary macros; privacy approves fields and retention; security approves MFA/roles/export; finance approves seats and renewal. App Store support/contact URLs must work without sign-in. Launch is blocked if the inbox is unstaffed or no backup can access it.

**Fallback and exit.** Plain Foundation is the residency-oriented fallback; [pricing](https://www.plain.com/pricing), [security/UK storage](https://help.plain.com/article/security), [DPA](https://www.plain.com/legal/dpa), and [subprocessors](https://www.plain.com/legal/subprocessors) require review, and any AI feature stays off. Export open/history records before exit, verify deletion, and retain the public support address. Zendesk is a later scale option, not a launch default.

## ACCT-14 — Moderation staffing and tools

**Recommendation.** Community posting/commenting remains disabled until there are at least two accountable, trained moderation leads **and enough scheduled employees, contractors, or contracted service coverage to leave zero P0 shifts uncovered**, including breaks, leave, sickness, surge, and escalation. Staffing must comply with applicable labor rules and moderator-wellness safeguards; two people alone are not represented as sustainable 24/7 coverage. Automated classifiers may quarantine or prioritize; they never make the only irreversible decision. Users must be able to report content, block abusive users, receive appeal instructions, and reach a published contact. This directly reflects Apple's [UGC requirements in Guideline 1.2](https://developer.apple.com/app-store/review/guidelines/).

Proposed internal service objectives, pending counsel and staffing validation, are: P0 credible self-harm/imminent threat/CSAM—immediate quarantine and page, human target under 15 minutes; P1 harassment, nudity, doxxing, or dangerous misinformation—human target under one hour; ordinary reports—under 24 hours; appeals—under 72 hours. These are proposed operating targets, not statutory deadlines or vendor promises. Counsel must supply jurisdiction-specific preservation, reporting, law-enforcement, child-safety, and emergency rules.

OpenAI's [omni-moderation model](https://developers.openai.com/api/docs/models/omni-moderation-latest) may be evaluated as free text/image triage for explicitly posted UGC only. It must not inspect private routine/photo libraries, and the same DPA/retention/provider gates apply. False positives, dialect/skin-tone/language performance, appeals, and model-version regression require evaluation.

**Cost snapshot.** Internal staffing cost depends on scheduled coverage and jurisdiction; it is not `$0`. [TaskUs Trust & Safety](https://www.taskus.com/services/trust-and-safety/) is a scale fallback offering human operations and multilingual/media coverage at custom pricing. A quote does not replace a staffing, wellness, DPA, location, training-data, quality, or incident review.

**Exact gate.** Named humans complete policy, trauma/wellness, privacy, self-harm, child-safety, escalation, evidence handling, and appeals training; legal signs the jurisdiction matrix; safety leadership runs scenario drills and signs coverage; security approves least-privilege tooling; QA proves report/block/appeal/contact flows and SLA telemetry. If a shift or escalation path is uncovered, posting is automatically disabled/read-only. Automated-only moderation is prohibited.

**Fallback and exit.** Read-only reviewer-curated content with no user posting, messaging, comments, or public profile fields. At higher sustained volume, contract TaskUs or another reviewed specialist and maintain internal policy ownership plus audit sampling.

## ACCT-15 — Attribution and paid measurement

**Recommendation.** Do not ship an MMP SDK at launch. Use App Store Connect [campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links/), [App Analytics](https://developer.apple.com/app-store/measuring-app-performance/), custom product pages, AdServices for Apple Ads, and Apple's privacy-preserving [AdAttributionKit](https://developer.apple.com/app-store/ad-attribution/) for registered networks where needed. These answer initial channel/creative questions without building a cross-app user trail.

Do not request App Tracking Transparency permission while Layerwell does not track as Apple defines it. If a future design links Layerwell/user data with third-party data for advertising/measurement or enables tracking, it requires a new legal/Apple/privacy-label review and ATT before that activity. Fingerprinting is never permitted. Apple's [privacy/data-use requirements](https://developer.apple.com/app-store/user-privacy-and-data-use/) remain controlling.

**Cost snapshot.** Apple-native analytics/attribution has no separate listed vendor subscription fee. AppsFlyer's [pricing](https://www.appsflyer.com/pricing) lists a limited free allowance and Growth usage pricing; its [DPA](https://www.appsflyer.com/legal/dpa/) and [user-level retention](https://support.appsflyer.com/hc/en-us/articles/360006091197-User-level-data-retention) still require review. Set an internal reconsideration trigger—not an automatic purchase—when signed paid-media spend exceeds **$10,000/month** or Apple-native reporting cannot answer a documented budget decision.

**Exact gate.** Growth defines the decision Apple-native measurement cannot answer; privacy/legal classify every identifier/event and determine ATT/consent; engineering proves no health, routine, shelf, Ask, support, or precise user event reaches an ad network; finance approves spend and conversion-cost caps; App Store privacy labels are updated and reviewed. No SDK is added merely for dashboard convenience.

**Fallback and exit.** AppsFlyer Growth only after the above gate and strict configuration; Adjust is the fallback if a contracted EEA/US [data-residency option](https://help.adjust.com/en/article/data-residency) materially improves the approved design. If neither passes, paid channels use aggregate campaign reporting or are paused.

## ACCT-16 — Subprocessor and third-party governance

**Recommendation.** Maintain a version-controlled governance register owned jointly by privacy and security. Review it before every release, quarterly for subprocessor/term changes, annually for full evidence renewal, and before adding or materially changing any SDK, API, model, region, field, purpose, retention, or downstream disclosure. Apple's [third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/) make the app publisher responsible for included SDK behavior, privacy manifests, and signatures; Xcode's merged report is evidence, not a substitute for review.

The register must contain: service/legal entity; business owner/backup; controller, processor, independent-controller, or source/licensor role; purpose; exact fields; data-subject categories; legal basis/consent; environments; regions/transfers; DPA/BAA/contract version and signature; subprocessors and notice channel; retention; deletion/export procedure and last test; encryption/key boundary; incident contact and contractual notice; DSAR mapping; Apple privacy manifest/signature; security evidence; spend/renewal/cancellation; status; last/next review; exit owner.

Canadian accountability remains with Layerwell when processing is transferred: the Office of the Privacy Commissioner discusses contractual safeguards and accountability in its [cross-border processing findings](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2020/pipeda-2020-001/) and requires organizations to maintain and assess breach records in its [breach guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/). The UK ICO's [controller-processor contract checklist](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/what-needs-to-be-included-in-the-contract/) is a useful minimum for processing instructions, confidentiality, security, subprocessors, rights support, audit, and delete/return terms even when UK law is not the only applicable regime. Counsel determines applicability.

### Provisional role/status register

“Candidate” means researched only. It does **not** mean an account exists, a contract is signed, a DPA is effective, a vendor approved Layerwell, or data may be sent.

| Service                    | Provisional role (counsel confirms)                                              | Status on 2026-07-13                                        | Intended data boundary                                         | Required next evidence                                                               |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Apple/App Store            | Independent platform/controller for store transactions; processor roles may vary | Existing platform dependency; launch approvals unknown      | Store account, purchase/diagnostic data under Apple terms      | Agreements, privacy labels, server-notification security, review approval            |
| Supabase                   | Processor                                                                        | Candidate recommendation                                    | Pseudonymous account/sync data; no default cloud photos        | Signed DPA, region, RLS/restore/deletion tests, incident/subprocessor contacts       |
| RevenueCat                 | Processor/service provider; transaction role to confirm                          | Candidate recommendation                                    | Pseudonymous entitlement and store transaction identifiers     | DPA, webhook/reconciliation/deletion test, variable-fee approval                     |
| Cloudflare                 | Processor/service provider; registrar role varies                                | Candidate recommendation                                    | DNS/static-site requests and risk token data                   | Name clearance, DPA, DNSSEC/MFA, region/log/retention map                            |
| Amazon SES/AWS             | Processor                                                                        | Candidate recommendation                                    | Minimal transactional recipient/template metadata              | AWS DPA, region, production-sending approval, IAM and deletion/log evidence          |
| PostHog                    | Processor                                                                        | Candidate recommendation                                    | Consent-gated allowlisted pseudonymous events only             | EU project/DPA, event capture proof, deletion test, subprocessor notices             |
| Sentry                     | Processor                                                                        | Candidate recommendation                                    | Redacted technical diagnostics only; Sensitive Data prohibited | EU org/DPA, canary scrub test, retention/deletion and incident path                  |
| OpenAI                     | Processor for approved API use                                                   | Evaluation candidate only; Ask must not depend on approval  | Redacted minimal Ask text + approved excerpts only             | DPA/ZDR or MAM/residency decision, model eval, reviewers, deletion/incident evidence |
| Open Beauty Facts          | Source/licensor; processor role may not apply                                    | Public-source candidate                                     | Segregated attributed product facts/images                     | Current endpoint/license matrix, ODbL/CC BY-SA opinion, provenance test              |
| GS1/brand feeds            | Licensor/independent source; role by contract                                    | Not applied/contracted                                      | GTIN/company verification or contracted catalog facts          | Written API/cache/display/redistribution rights and price                            |
| impact.com/merchants       | Likely independent controllers/service providers; counsel confirms               | Not applied/approved                                        | Outbound campaign/link and conversion data; no health data     | Network/merchant acceptance, disclosures, DPA/terms, country/tax review              |
| Help Scout                 | Processor                                                                        | Candidate recommendation                                    | Minimal support contact/case data; attachments off             | DPA, seats/staffing, retention/deletion, incident/subprocessor evidence              |
| Moderation model/service   | Processor if engaged                                                             | No managed service engaged                                  | Posted UGC only after consent; never private library           | Staffing first; DPA/region/eval/appeals/incident evidence for any tool               |
| AppsFlyer/Adjust           | Processor/service provider if engaged                                            | **Not recommended for launch; not engaged**                 | None                                                           | New business need, ATT/legal review, DPA/region/retention and SDK audit              |
| Expo/EAS and build tooling | Role depends on actual build/update use                                          | Existing architecture dependency; governance audit required | Source/build artifacts, credentials/logs as configured         | Account/role/secret audit, DPA/region/retention, update-signing and exit evidence    |

**Exact gate.** Privacy and security both sign a completed row before production use. Procurement/founder alone cannot override a missing DPA, data map, region, deletion path, incident contact, Apple manifest/signature, or human owner. Subscribe to vendor change notices; create a review ticket for every material change; apply 60/30/7-day renewal reminders; suspend new ingestion when an objection or expired contract is unresolved. A quarterly “no change” assertion must link evidence, not rely on memory.

**Fallback and exit.** Disable the optional vendor/SDK, preserve the local core flow, export only authorized data, revoke credentials/webhooks, remove SDK and privacy declarations, request contract/account deletion, verify downstream/backups according to contract, update notices/labels, and retain the minimum closure evidence. A GRC platform may automate reminders later, but it does not replace accountable owners.

## Human and vendor approval ledger

| Gate                                  | Required human/vendor action                                                                      | Evidence that closes it                                                                  | Blocks                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| H-01 Apple account                    | Authorized human creates/maintains the Apple Developer/App Store Connect account                  | Active account, verified authority/roles and recovery evidence                           | Apple capabilities, IAP setup and submission                                            |
| H-02 Seller/entity                    | Authorized human supplies and approves seller/legal-entity identity                               | Verified seller/entity record matching contracts and public disclosures                  | Paid agreements, vendor contracts and store identity                                    |
| H-03 Banking/tax/agreements           | Authorized human completes banking, tax, and platform agreements                                  | App Store Connect/vendor status plus retained executed records                           | Payouts, paid apps/IAP and affiliate receipts                                           |
| H-04 Payments/budgets                 | Authorized human approves payments, recurring budgets, overage caps and renewal/cancellation      | Signed budget with billing owner/backup and 60/30/7 reminders                            | Every paid or variable-cost account                                                     |
| H-05 MFA/challenges                   | Authorized human completes MFA, recovery and vendor identity/challenge steps                      | MFA/role export, recovery test and challenge completion record                           | Privileged access and production credentials                                            |
| H-06 Brand approval                   | Founder/counsel approves final brand, marks, domain and public contacts                           | Written clearance and approved identity/domain record                                    | Customer-facing accounts, metadata and domain purchase                                  |
| H-07 Professional decisions           | Qualified legal, privacy, clinical and security reviewers make the decisions reserved to them     | Dated opinions/sign-offs tied to exact data flow, claims, sources and configuration      | Production processing, AI, catalog, affiliate, community and submission representations |
| H-08 Physical devices                 | Humans provide and authorize required physical iOS devices                                        | Device inventory and real-device evidence                                                | Device-only features and release validation                                             |
| H-09 Beta users                       | Real beta participants are recruited, consented and supported                                     | Cohort/consent record and beta findings                                                  | Claims based on beta usability/reliability evidence                                     |
| H-10 Moderation/support staff         | Real trained support and moderation humans are contracted/scheduled with adequate coverage        | Contracts/rota, training, wellness safeguards, escalation drills and accessible contacts | Support launch and all UGC                                                              |
| H-11 Pricing/countries/contracts/risk | Founder/authorized decision-maker approves launch countries, pricing, contracts and residual risk | Signed launch/business decision record                                                   | Country launch, commerce, subscriptions and accepted residual risk                      |
| H-12 Submission authority             | Authorized human approves and performs/authorizes final submission                                | Dated submission authorization and App Store Connect record                              | App submission                                                                          |
| V-01 Apple approvals                  | Apple approves required accounts, capabilities, agreements, products and submitted app/metadata   | App Store Connect status and retained Apple correspondence                               | The specific Apple-dependent capability or public distribution                          |
| V-02 Vendor/provider applications     | Each non-Apple provider approves applications, production access, limits and negotiated controls  | Vendor-issued approval/executed agreement plus configured-control evidence               | The relevant production vendor path                                                     |

## Cost planning floor

The following is a non-binding planning floor using public list prices and the recommended launch posture. It is not a budget approval.

| Item                                                               |         Illustrative monthly amount | Caveat                                                              |
| ------------------------------------------------------------------ | ----------------------------------: | ------------------------------------------------------------------- |
| Supabase Pro with staging + production Micro baseline              |                                ~$35 | Before overages, PITR, domains, storage, egress, higher compute     |
| RevenueCat                                                         |        $0 initially; variable later | Free through listed MTR threshold, then listed 1%; verify basis     |
| Cloudflare domain/DNS/Pages                                        | TLD-specific; static host can be $0 | Registry renewal, Workers/functions, taxes not included             |
| Amazon SES at 10k simple outbound messages                         |                                 ~$1 | Excludes support, attachments, events, bandwidth and operations     |
| PostHog at or below 1M listed analytics events                     |                                  $0 | Strict event cap and no other products                              |
| Sentry Team                                                        |       $26 annual-billing equivalent | Verify telemetry/seat/overage terms                                 |
| Turnstile Free                                                     |                                  $0 | Enterprise/SLA and implementation not included                      |
| Help Scout, two Standard seats                                     |                                ~$50 | Taxes/add-ons and staffing excluded                                 |
| AI illustration, 10k stated-size asks                              |                               ~$125 | Evaluation only; provider controls and real token volume may differ |
| Catalog, moderation/support labor, legal/clinical/security reviews |                **TBD and material** | These cannot be budgeted as free                                    |

Known listed-vendor subtotal from the examples is roughly **$112/month before AI**, or **$237/month with the illustrative AI volume**, plus domain, RevenueCat at scale, labor, reviews, overages, cloud extras, affiliate reversals, taxes, and contingency. Finance must build low/base/high scenarios and set alerts before any purchase.

## Launch decision rule

An account may be recommended yet remain uncreated. A vendor may be technically integrated in a non-production sandbox yet remain unauthorized for production data. The launch gate is **closed** unless every applicable ledger row and vendor-register field has dated evidence, the final app behavior matches that evidence, the real-device/user flow has been verified, and App Store disclosures match actual collection.

Where a vendor gate fails, the default is the documented local/static/read-only fallback—not weakened privacy, silent collection, an unreviewed provider, or a claim that approval is likely. Vendor and Apple decisions can change; re-check official terms, prices, SDK manifests, model availability, regions, and review rules at contracting and again before submission.
