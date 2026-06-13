# Decisions Log

Small, reversible implementation choices NOT dictated by `/docs`. Anything with
schema / privacy / RLS / legal / cost / account implications goes to
[BLOCKERS.md](BLOCKERS.md) instead and is built around, not decided here.

Format: `D-NNN — date — decision — rationale`.

---

## Scaffold & tooling

- **D-001 — 2026-06-12 — Expo SDK 56 (not the "52+" the docs cite).** SDK 56 is
  the current stable release (`expo@56.0.11`, React Native 0.85.3, React 19.2.3)
  as verified against npm at build time. The docs' "Expo SDK 52+ / New Arch" is
  satisfied — New Architecture is the default in SDK 56. Pinned versions come
  from the official `create-expo-app` template so the whole native set stays
  mutually compatible; additions use `expo install` for the same reason.

- **D-002 — 2026-06-12 — Turborepo monorepo** (`apps/mobile` + `packages/types`
  + `supabase/`), per docs/00 §9 ("Turborepo monorepo with shared TS packages").
  Shared `@onskin/types` package holds the Supabase `Database` type + domain
  enums so the mobile client and Edge Functions share one source of truth.
  NOTE: Metro's monorepo module resolution cannot be runtime-verified in this
  environment (no Mac/simulator/device). Standard Expo monorepo `metro.config.js`
  is used; flagged for first-device verification (see BLOCKERS B-VERIFY-METRO).

- **D-003 — 2026-06-12 — expo-router (file-based navigation).** Not specified in
  docs; expo-router is the current Expo default and what the template ships.
  Reversible.

- **D-004 — 2026-06-12 — NativeWind v4 + Tailwind CSS pinned to 3.4.x.** docs/00
  §8 specifies "design tokens → NativeWind." NativeWind v4's peer dep is
  `tailwindcss >3.3.0`, but it is built against the Tailwind **v3** config format
  (`tailwind.config.js` content/theme), so Tailwind v4 (CSS-first config) is
  avoided to prevent an untestable broken build. Pinned `tailwindcss@^3.4`.

- **D-005 — 2026-06-12 — Fonts via `@expo-google-fonts`:** Instrument Serif
  (display) + Hanken Grotesk (UI), the exact families named on the design spec
  cover page. Both are SIL OFL (zero-cost, embeddable) per docs/00 §8's free
  route. A monospaced face (system mono) is used for the spec's caption/label
  treatment ("01 · Welcome", "2 of 4", "NEXT").

- **D-006 — 2026-06-12 — App identifiers:** bundle id `com.onskin.app`, URL
  scheme `onskin://`. Placeholder defaults; must match the registered App
  ID / Play package once accounts exist (see BLOCKERS B-APPLE / B-GOOGLE).

- **D-007 — 2026-06-12 — Offline/data layer: TanStack Query + a persisted
  mutation queue** for v1, exactly per docs/01 §6 recommendation. Persistence
  via AsyncStorage. Legend-State/PowerSync deferred to a future multi-device
  decision.

- **D-008 — 2026-06-12 — Face detection lib: `react-native-vision-camera-face-detector@2.0.1`**
  (ML Kit-backed, cross-platform) over a custom Apple Vision Swift plugin for
  v1. docs/00 §4 presents both; the ML Kit wrapper is the lower-risk
  cross-platform path and stores no faceprint template (BIPA-safe). Camera
  capture is a later slice; only the dependency choice is logged here.

- **D-009 — 2026-06-12 — Token storage: LargeSecureStore (AES-256) pattern**
  exactly as docs/01 §5 prescribes — `expo-secure-store` holds an AES key,
  `aes-js` encrypts the Supabase session JSON into AsyncStorage to dodge the
  ~2KB SecureStore limit. `react-native-get-random-values` polyfills CSPRNG.

- **D-010 — 2026-06-12 — Supabase client flags:** `autoRefreshToken: true`,
  `persistSession: true`, `detectSessionInUrl: false` (docs/01 §5), with
  `AppState`-driven start/stop of auto-refresh.
