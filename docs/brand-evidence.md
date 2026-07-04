# Brand Evidence Packet

Date: 2026-07-04

Purpose: give the founder and trademark counsel a clean packet for deciding
whether this product can launch as `OnSkin`. This is evidence, not legal advice.

## Existing Public OnSkin Evidence

| Evidence | What it shows | Source |
| --- | --- | --- |
| Existing website at `onskin.com` | Existing skincare/cosmetic ingredient scanner branded `OnSkin`; public claims include 2M+ products, 8M+ users, and 4.7 rating | [onskin.com](https://onskin.com/) |
| Apple App Store listing | App name `OnSkin: Beauty Product Scanner`; claims over 8M users and 2M-product database | [Apple App Store](https://apps.apple.com/us/app/onskin-beauty-product-scanner/id1630768985) |
| Google Play listing | App name `OnSkin - Skincare Scanner`; describes barcode/product scanning, cosmetics checker, face scanner, routine personalization, and product alternatives | [Google Play](https://play.google.com/store/apps/details?id=skin.care.product.scanner.skincare.cosmetic.ingredient.checker&hl=en_US) |
| Social handle | Public Instagram handle appears to use `@onskin.app` | [Instagram search result](https://www.instagram.com/onskin.app/) |
| Recent App Store activity | Store listing has recent release notes, including shelf scanning and expanded product scope | [Apple App Store listing](https://apps.apple.com/us/app/onskin-beauty-product-scanner/id1630768985) |

## Current Code Identity

Current identifiers in `apps/mobile/app.json`:

| Field | Current value |
| --- | --- |
| Display name | `OnSkin` |
| Slug | `onskin` |
| URL scheme | `onskin` |
| iOS bundle ID | `com.onskin.app` |
| Android package | `com.onskin.app` |

These are too close to the existing public app to treat as a routine naming
issue. They affect App Store search, paid search, app review, support confusion,
trademark risk, domain strategy, and user trust.

## DNS Checks

Local DNS checks on 2026-07-04:

| Domain | DNS result | Interpretation |
| --- | --- | --- |
| `onskin.com` | Resolves to Cloudflare IPs | Existing public web property is active |
| `onskin.app` | DNS NXDOMAIN | No DNS record found, but this is not proof that the domain is available to register |
| `routinekind.com` | DNS NXDOMAIN | Candidate domain target needs registrar check and legal clearance |
| `routinekind.app` | DNS NXDOMAIN | Candidate app domain target needs registrar check and legal clearance |

DNS NXDOMAIN only means no current DNS record was found. It does not prove domain
availability, trademark availability, or social handle availability.

## Similarity Assessment

| Dimension | Risk |
| --- | --- |
| Exact brand string | High: same `OnSkin` name |
| Category | High: skincare/cosmetic app |
| Core action | High: product scan, ingredient analysis, routine guidance |
| Keywords | High: scanner, skincare, cosmetic checker, ingredient analysis, routine |
| Domain/customer memory | High: incumbent controls `onskin.com`; `onskin.app` is close to existing social handle usage |
| Store confusion | High: users could search for one app and install/support the other |
| Paid search/ASO | High: exact-brand search would be contested from day one |

## Initial Trademark Search Notes

Initial web search did not produce a conclusive clearance answer. Counsel should
run a proper search through USPTO, WIPO/Madrid, Canadian CIPO, EUIPO/UKIPO if
international launch is planned, app stores, domains, social handles, and common
law usage.

Useful official starting point:

- [USPTO trademark search](https://tmsearch.uspto.gov/)
- [USPTO guide to comprehensive clearance searches](https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks)

## Counsel Questions

1. Can a new skincare routine, shelf scanner, ingredient intelligence, and photo
   progress app safely launch as `OnSkin` given the incumbent app and domain?
2. Is `com.onskin.app` likely to increase confusion or app-review risk?
3. Does using `onskin.app` as a domain or support address increase risk because
   the incumbent uses `onskin.com` and appears to use `@onskin.app` socially?
4. Would a subtitle or differentiated logo meaningfully reduce confusion, or is
   a full rebrand required?
5. If a rebrand is recommended, are `RoutineKind`, `routinekind.com`, and
   `routinekind.app` viable candidates after full clearance?

## Packet For Counsel

- Current `apps/mobile/app.json` identifiers
- Screenshots or PDFs of `onskin.com`, App Store listing, Google Play listing,
  and social handle
- This app's practical V1 scope from `docs/v1-scope-freeze.md`
- Store listing draft, once written
- Target launch countries
- Candidate rebrand list and domain targets
