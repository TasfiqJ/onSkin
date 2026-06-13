\# OnSkin — Skincare Routine App



\## What this is

Cross-platform (iOS + Android) skincare routine app. Building toward a

subscription + affiliate business. Full specs live in /docs — those are

the source of truth.



\## Source-of-truth docs (READ before building anything in scope)

\- docs/00-architecture.md — stack, system architecture, data architecture, design system

\- docs/01-auth-onboarding.md — auth, onboarding flow, full data model + RLS, consent

\- docs/design-spec.pdf — hi-fi visual direction (type, color, screen layouts)



\## Hard rules

\- The /docs files are authoritative. If something isn't specified there,

&#x20; STOP and ask — do not invent product behavior, schema, or copy.

\- Confirm the current version of any library before using it; do not assume

&#x20; APIs from memory. Flag anything the docs marked "re-verify at build time."

\- Build in the order given by docs/00 §"build order". One feature slice at a time.

\- After each slice: run typecheck + lint, then update PROGRESS.md.

\- Never weaken Row-Level Security. Every table is owner-scoped per docs/01.

\- Privacy is a product rule: photos are local-only by default; consent is

&#x20; unbundled per docs/01. Do not add analytics/sharing the docs don't authorize.



\## Stack (per docs/00 — confirm versions at install)

\- React Native + Expo (New Architecture), TypeScript end-to-end

\- Supabase (Postgres + Auth + Storage + Edge Functions), RLS on every table

\- RevenueCat (subscriptions), PostHog (analytics), Sentry (crashes)



\## Commands

\- (fill in once scaffolded: build, typecheck, lint, test commands)



\## Workflow

\- Read the relevant /docs file fully before writing code for that feature.

\- Propose a plan, wait for approval on anything destructive or schema-changing.

\- Commit working slices to git with clear messages.

