# Quiz FTO Summary

Status: launch-blocked pending exact-hash IP/legal and clinical review
Last updated: 2026-09-21

## Current Source Contract

The app now has one deterministic draft quiz and scorer:

- Contract ID: `urn:layerwell:onboarding:skin-profile`
- Content version: `draft-2026-09-21-layerwell`
- Scoring version: `draft-2`
- Output schema version: `1`
- Content SHA-256:
  `f5169de7f1985063f97efc70cd740de4be63cada27f2041de36e0c864aa310e0`
- Scoring SHA-256:
  `7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef`
- Combined contract SHA-256:
  `4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c`
- Review status embedded in local/server receipts: `launch-blocked`

Changing any semantic content or scoring byte requires a new version, new
hashes, and a fresh review. Determinism and provenance do not constitute
freedom-to-operate, clinical validation, legal approval, or App Review
acceptance.

Migration `20260921000075` admits this newly versioned exact tuple while
retaining two prior exact client tuples for old-client writes: the pre-rebrand
RoutineKind identity with `be00ee60`/`ffd16579`/`95022003`, and the interim
Layerwell identity with `8398b025`/`be3a05c5`/`c434e4f0` under the previous
draft version labels. Those historical tuples are **not** current reader
authority. The incoherent Layerwell identity paired with the RoutineKind
hashes in migration `0064` cannot be produced by an honest canonical manifest:
preexisting rows, if any, remain untouched but quarantined by the unvalidated
successor constraint, and new writes of that mixed tuple are rejected. No
historical row is silently rewritten or professionally approved.

The profile receipt stores derived axis values, integer basis points, DSPT,
discrete tone outputs, sensitivities, pregnancy choice, and the exact
provenance tuple. It deliberately stores no raw answers, question IDs, or
answer hash.

## Primary-Source Screening

This engineering screen is not a legal opinion:

- Apple App Review Guideline 4.1 rejects simple copycats, and Guideline 5.2
  requires the developer to own or license protected content, trademarks,
  copyrighted works, and patented ideas:
  [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
- Apple Guideline 1.4.1 applies greater scrutiny to medical apps and requires
  support for accuracy/methodology claims. The product must remain within its
  reviewed cosmetic/general-wellness intended use and must not present the
  draft profile as diagnosis or treatment.
- [US20140018634A1](https://patents.google.com/patent/US20140018634A1/en)
  is listed as abandoned and describes four axes, letter poles, and sixteen
  skin types.
- The related
  [US9724287B2](https://patents.google.com/patent/US9724287B2/en) is listed as
  expired-fee-related, and
  [US20170290758A1](https://patents.google.com/patent/US20170290758A1/en) is
  listed as abandoned.

Those public status labels reduce neither the need for claims-family,
continuation, territory, ownership, license, trademark, trade-dress, and
copyright analysis nor the risk created by a similar four-letter consumer
presentation. Counsel must independently verify current legal status and the
exact shipped behavior.

## Required Review Scope

IP/legal counsel must review:

- every question, option, ordering choice, eyebrow, label, and reveal phrase;
- the four axes, poles, tie rule, DSPT letters, and sixteen-type implications;
- scoring weights, basis-point normalization, discrete Fitzpatrick/Monk use,
  and the distinction between user preference, cosmetic profile, and medical
  assessment;
- similarity to identified competitor quizzes, published systems, patents,
  trademarks, copyrighted questionnaires, and trade dress in every launch
  territory;
- the source and license for each concept, phrase, tone scale, and illustration;
- consumer-protection substantiation and the app's intended-use boundary; and
- whether health, pregnancy, sensitivity, and tone inputs require changes to
  the consent, privacy notice, retention, access/export/deletion, age, or
  regional availability posture.

Clinical/cosmetic-chemistry reviewers must separately determine whether the
questions and derived outputs are scientifically supportable for the exact
product behavior. Counsel cannot substitute for that review, and engineering
cannot self-approve either lane.

## Launch Conditions

Production remains closed until:

1. Counsel records a territory-specific allow, allow-with-conditions, license,
   redesign, or do-not-ship decision against all three exact hashes.
2. Named clinical/cosmetic-chemistry reviewers bind their intended-use,
   methodology, limitations, user copy, and escalation conditions to those
   hashes.
3. Privacy counsel approves the exact data flow, retention, export/deletion,
   consent, minors/age-assurance, and vendor posture.
4. App Store metadata, age-rating answers, regulated-medical-device
   declaration, privacy labels, review notes, and screenshots match the same
   build.
5. Any required redesign is rehashed, re-reviewed, and re-tested before
   submission.

## Required Approval Rows

| Reviewer | Role                   | Date | Reviewed source/hash            | Territory | Decision     | Conditions  |
| -------- | ---------------------- | ---- | ------------------------------- | --------- | ------------ | ----------- |
| TBD      | IP/legal counsel       | TBD  | All three hashes above          | TBD       | Not reviewed | Do not ship |
| TBD      | Clinical reviewer      | TBD  | All three hashes above          | TBD       | Not reviewed | Do not ship |
| TBD      | Privacy/minors counsel | TBD  | Data-flow and age-policy hashes | TBD       | Not reviewed | Do not ship |
