# Rebrand And Core-Loop Migration Checklist

Date: 2026-07-06

Purpose: turn the master plan into executable engineering slices without weakening launch gates.

## Current Strategic Position

- Working brand candidate and engineering default: `RoutineKind`.
- Final brand status: not legally cleared; production builds still require
  explicit final identity env values and `BRAND_LEGAL_CLEARANCE=cleared`.
- Public position: private skincare shelf and routine tracker, not generic scanner, AI beauty analyzer, or shopping marketplace.
- Launch loop: add owned products -> get useful reviewed insight -> see AM/PM routine -> complete Today check-off -> understand private progress -> pay after value.

## Rebrand Migration Checklist

Do not create production accounts or store records until final brand clearance exists.

1. Inventory public identity references.

   ```bash
   npm run brand:audit
   ```

2. Classify each reference.

   - User-facing copy.
   - App config.
   - Bundle/package/scheme.
   - Store metadata.
   - Policy/support URL.
   - Share-card/deep-link asset.
   - Internal package name or historical doc.

3. Make identity values config-driven where safe. Status: native
   development/staging defaults now use RoutineKind; production still fails
   closed without final identity evidence.

   - Display name.
   - URL scheme.
   - Bundle ID.
   - Android package.
   - Public domain and support URLs.
   - Policy links.
   - Share-card watermark.
   - Default local config reads must resolve to a development install identity;
     production identity must require `APP_VARIANT=production`.

4. Prepare, but do not execute, final account/domain migration.

   - Replace remaining public `OnSkin` references after final decision.
   - Keep historical docs honest if they refer to past state.
   - Update Supabase config, policy-link registry, store metadata source,
     share-link helpers, and public-site pages.
   - Re-run typecheck, lint, tests, and any affected phase checkers.

5. Exit criteria.

   - Counsel/founder brand decision recorded.
   - No public launch asset uses conflicted identity unless cleared.
   - Final identifiers match Apple, Google, RevenueCat, Supabase, policy URLs, and share links.

## Core-Loop Hardening Checklist

Target user outcome: a new user can add at least three real products and receive a clear, calm, useful routine insight in one session.

1. Shelf intake.

   - Manual add works offline.
   - Search, barcode, and label capture failures always offer manual fallback.
   - PAO/opened-date/edit provenance stays honest.
   - Product detail shows source and quality without fake precision.

2. First useful insight.

   - User sees at least one conflict, sequencing, routine gap, expiry/PAO, or AM/PM plan insight after adding enough products.
   - Empty shelf and no-conflict states are clearly different.
   - Unreviewed rules do not appear in production mode.

3. Routine builder.

   - AM/PM plan is generated from the user's shelf and profile.
   - Plan copy is explainable and calm.
   - Overrides or adaptations persist where the UI implies persistence.
   - Pregnancy, irritation, and potent-active guidance stays review-gated.

4. Today check-off.

   - AM and PM completion persists after navigation and relaunch.
   - Missed-day recovery is not punitive.
   - Streak/adherence copy stays calm and correct.

5. Paywall after value.

   - Paywall appears after the user has seen value whenever possible.
   - Prices come from RevenueCat in real builds; fallback prices are display-only.
   - Restore, Terms, Privacy, and cancellation/manage paths are reachable.

6. Verification.

   - Unit tests for deterministic logic touched by the slice.
   - Route/contract tests for changed surfaces.
   - `npm run typecheck`, `npm run lint`, and `npm test` when feasible.
   - Human-simulated E2E evidence for every UI-facing slice.

## First Autonomous Engineering Slices

1. Add a brand reference audit script or checker that reports remaining public identity references without renaming them.
2. Make remaining identity values config-driven where they are still hardcoded.
3. Inspect the first-session shelf-to-insight path and improve the smallest missing clarity or dead-end.
4. Add production-mode tests proving unreviewed conflict/routine guidance remains hidden.
5. Keep `docs/FOR_TAS_TO_DO.md`, `BLOCKERS.md`, `LAUNCH_READINESS.md`, and `PROGRESS.md` updated after each slice.
