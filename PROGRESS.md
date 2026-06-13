# Build Progress

Tracks the build against docs/00 §"build order". One slice per commit.
See [DECISIONS.md](DECISIONS.md) for implementation choices and
[BLOCKERS.md](BLOCKERS.md) for everything waiting on the founder.

Legend: ✅ done · 🟡 partial (built around a blocker) · ⬜ not started · 🚫 blocked on missing doc

---

## Done

### Slice 0 — Project scaffold & tooling ✅ (2026-06-12)
- Turborepo monorepo: `apps/mobile` (Expo SDK 56) + `packages/types` (`@onskin/types`) + `supabase/` (next slice).
- Expo SDK 56 baseline (RN 0.85.3 / React 19.2.3), expo-router, New Architecture on.
- NativeWind v4 + Tailwind v3.4 wired (babel/metro/tailwind config) with the
  "paper · greige · clay · ink · night" design-token palette + Instrument Serif /
  Hanken Grotesk font families from the design spec.
- TypeScript (strict) + ESLint 9 flat config (eslint-config-expo) + Prettier.
- `@onskin/types` shared domain enums (consents, axes, goals, routines, conflicts,
  analytics taxonomy) derived from docs/01 §3 + design spec.
- Tracking files: DECISIONS.md, BLOCKERS.md (seeded), .env.example (every var documented).
- **Gates:** `turbo run typecheck` ✅ · `eslint` ✅. (App not runtime-tested — no
  Mac/simulator in this environment; flagged B-VERIFY-METRO.)

## In progress

### Slice 1 — Data model + RLS (docs/01 §3) — next

## Next (per docs/00 build order)
1. ✅ scaffold → **Slice 1: Auth + data model + RLS** (in progress)
2. 🚫 Ingredient/product DB + conflict engine — needs Document 2 (schema sketched only)
3. 🚫 AM/PM routine builder — needs Document 3 (tables exist)
4. 🚫 Smart shelf (PAO/expiry) — needs Document 4
5. 🚫 Actives / skin-cycling scheduler — needs Document 5
6. 🚫 Guided photo capture + comparison — needs Document 6
7. 🚫 Reminders / streaks / widgets — needs Document 7
8. 🟡 Subscriptions / paywall — design-spec paywall buildable; RC config blocked (Document 8)
9–12. 🚫 recommendations / creator stacks / community / AI — need their docs

## Open questions for the founder
- See [BLOCKERS.md](BLOCKERS.md) — consolidated. Highest priority: Documents 2–15
  are missing from /docs (B-MISSING-DOCS); legal copy + quiz questions (B-QUIZ-COPY,
  B-PRIVACY-COPY); and the account/key items (Supabase, RevenueCat, Apple, Google,
  PostHog, Sentry, Turnstile).
