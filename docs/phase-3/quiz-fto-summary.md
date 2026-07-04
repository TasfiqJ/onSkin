# Quiz FTO Summary

Status: blocked pending IP/legal review  
Last updated: 2026-07-04

## Current State

The onboarding quiz remains intentionally placeholder-gated:

- Source: `apps/mobile/src/features/onboarding/quiz.ts`
- Flag: `PLACEHOLDER_QUIZ`
- Blocker: `B-QUIZ-COPY`
- Current labels include placeholder markers and must not ship.

The quiz scoring engine can remain as internal structure, but user-facing questions, answer options, copy, and scoring labels need freedom-to-operate review before production.

## Why This Matters

The quiz is a conversion-critical surface. It is also high IP and consumer-protection risk because it can resemble competitor onboarding flows, imply diagnosis, or collect consumer health data before adequate notice. A seven-figure app needs this surface to feel proprietary, defensible, and trustworthy.

## Competitor/FTO Review Scope

Counsel should review:

- Question wording.
- Question order.
- Answer options.
- Scoring model and labels.
- Reveal screen claims.
- Similarity to SkinSort and other skincare quiz/onboarding flows.
- Whether any question implies diagnosis or medical screening.
- Whether any data category is consumer health data or sensitive personal information.
- Whether brand/product matching language creates endorsement or substantiation risk.

## Replacement Requirements

Production quiz copy must:

- Ask about routine goals and preferences in appearance/routine language.
- Avoid disease labels as diagnosis.
- Avoid clinical screening.
- Avoid "skin type diagnosis" wording.
- Avoid outcome promises.
- Use separate, clear consent before collecting consumer health data.
- Be versioned in the consent ledger when relevant.

## Required Approval Row

| Reviewer | Role             | Date | Reviewed source/hash | Decision     | Conditions                    |
| -------- | ---------------- | ---- | -------------------- | ------------ | ----------------------------- |
| TBD      | IP/legal counsel | TBD  | TBD                  | Not reviewed | Do not ship placeholder quiz. |
