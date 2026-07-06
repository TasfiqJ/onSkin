# RoutineKind

Private skincare shelf, routine, and progress system for people who already own multiple skincare products and need a trustworthy way to use them in the right order, on the right nights.

## MVP Goal

Prove that users will add real products, receive a useful shelf/routine insight, return for daily AM/PM check-off, and pay for full routine intelligence.

Target business outcome: reach and retain 10,000+ active subscribers, which is the practical base needed to approach about $30k/month after store fees, refunds, tools, and churn.

## Current Product Position

[Decision] Do not launch as `OnSkin`. The existing public OnSkin app occupies the same name, category, and scanner language.

[Decision] Keep the full product vision, but expose and market only surfaces that are reviewed, production-real, and device-verified.

[Decision] The market wedge is not "another scanner." The wedge is: "Add your skincare shelf. Get a routine that knows what not to mix."

## Selected Stack Placeholder

Current repo stack:

- Expo React Native mobile app
- Supabase/Postgres backend
- RevenueCat subscriptions
- PostHog analytics
- Sentry crash reporting
- Local-first shelf, photos, and completion data

No tech stack decision is permanent. Future architecture changes must use `docs/MASTER_PLAN_UPDATE_PATCH.md`.

## Local Setup Placeholder

From the repo root:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm --workspace apps/mobile run start
```

## Main Scripts Placeholder

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm --workspace apps/mobile run typecheck`
- `npm --workspace apps/mobile run lint`
- `npm --workspace apps/mobile run test`
- `npm --workspace apps/mobile run ios`
- `npm --workspace apps/mobile run android`
- `npm --workspace apps/mobile run web`

## Project Structure

```text
apps/mobile/        Expo React Native app
packages/types/     Shared TypeScript and database types
supabase/           Migrations, seed data, Edge Functions
docs/               Product, architecture, launch, legal, QA docs
scripts/            Phase checks, QA packet builders, import scripts
04_repo_docs/       New source-of-truth pack generated from the master plan
```

## Important Docs

- `docs/MASTER_PLAN.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_INDEX.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/CODE_REVIEW.md`
- `docs/MASTER_PLAN_UPDATE_PATCH.md`
- `docs/CODEX_IMPLEMENTATION_PROMPT.md`

## Current Non-Negotiables

- Rebrand before production infrastructure.
- Do not market AI skin scores, diagnosis, skin age, or guaranteed outcomes.
- Keep photos local by default.
- Keep recommendations independent from commerce.
- Require clinical/cosmetic review before exposing conflict, safety, routine, pregnancy, Ask, or recommendation guidance.
- Use human-simulated E2E verification for UI-facing work.
