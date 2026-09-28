# Layerwell Brand Decision Memo

Date: 2026-08-09

Status: founder-selected product identity; pending qualified trademark counsel
clearance and authenticated reservation evidence.

## Decision

The founder selected `Layerwell` as the product name. Active product copy,
application configuration, package namespaces, launch documentation, and new
technical identifiers use Layerwell.

This selection is not a legal clearance. Production builds remain fail-closed
until qualified counsel reviews the exact mark, goods and services, countries,
classes, and planned marketing use, and the founder records that decision with
`BRAND_LEGAL_CLEARANCE=cleared`. That environment value is a build assertion;
it is not evidence of a legal opinion.

## Selected Identity

| Asset                   | Selected value             |
| ----------------------- | -------------------------- |
| App display name        | `Layerwell`                |
| App subtitle            | `Skincare shelf & routines` |
| URL scheme              | `layerwell`                |
| iOS bundle ID           | `com.layerwell.app`        |
| Android package         | `com.layerwell.app`        |
| Supabase project prefix | `layerwell`                |
| RevenueCat project      | `Layerwell`                |
| PostHog/Sentry project  | `Layerwell`                |

No domain is claimed as owned or available until an authenticated registrar
receipt proves control. Public policy, support, universal-link, and marketing
URLs must therefore stay blocked or use explicitly non-production placeholders
until the selected domain is reserved and verified.

## Evidence Boundary

Earlier research and captured test evidence remain immutable historical facts.
They document the previously rejected working identity and earlier candidate
research; editing those records to say Layerwell would falsify what was
actually searched or tested. They do not clear Layerwell.

The repository also retains a small, manifest-bound set of old internal
cryptographic domains and committed migration literals. They are not public
branding. They remain byte-compatible to avoid breaking persisted digests,
locks, replay protection, and migration verification. New namespaces use
Layerwell. The exact exceptions are governed by
`scripts/brand-legacy-compatibility.json`, and strict auditing rejects any new
or unclassified use.

## Required Before Public Launch

1. Qualified trademark counsel searches and assesses `Layerwell` for the exact
   launch countries, classes, goods, services, and marketing use.
2. Founder records counsel's written keep, modify, acquire, or rebrand decision
   and every condition attached to it.
3. Reserve and verify the final domain, App Store name, social handles, and
   support identity without claiming unavailable assets.
4. Freeze the exact production identifiers across Apple, Supabase, RevenueCat,
   Sentry, PostHog, OAuth, policy pages, email, and universal links.
5. Re-run the strict brand audit, native configuration tests, full verification
   suite, signed-build inspection, and physical-device review on the exact
   release candidate.

## Current Engineering Rule

Layerwell is the sole active product identity. No public surface may display the
rejected working name. Historical evidence and the exact compatibility manifest
are the only permitted exceptions, and neither is legal clearance.
