# Brand Evidence Packet

Date: 2026-07-04

Purpose: give the founder and trademark counsel a clean packet for deciding
whether this product can launch as `OnSkin`. This is evidence, not legal advice.

## Existing Public OnSkin Evidence

| Evidence                         | What it shows                                                                                                                                                | Source                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Existing website at `onskin.com` | Existing skincare/cosmetic ingredient scanner branded `OnSkin`; public claims include 2M+ products, 8M+ users, and 4.7 rating                                | [onskin.com](https://onskin.com/)                                                                                                    |
| Apple App Store listing          | App name `OnSkin: Beauty Product Scanner`; claims over 8M users and 2M-product database                                                                      | [Apple App Store](https://apps.apple.com/us/app/onskin-beauty-product-scanner/id1630768985)                                          |
| Google Play listing              | App name `OnSkin - Skincare Scanner`; describes barcode/product scanning, cosmetics checker, face scanner, routine personalization, and product alternatives | [Google Play](https://play.google.com/store/apps/details?id=skin.care.product.scanner.skincare.cosmetic.ingredient.checker&hl=en_US) |
| Social handle                    | Public Instagram handle appears to use `@onskin.app`                                                                                                         | [Instagram search result](https://www.instagram.com/onskin.app/)                                                                     |
| Recent App Store activity        | Store listing has recent release notes, including shelf scanning and expanded product scope                                                                  | [Apple App Store listing](https://apps.apple.com/us/app/onskin-beauty-product-scanner/id1630768985)                                  |

## Current Code Identity

Current engineering defaults in `apps/mobile/app.base.json` after the
2026-07-07 native-default migration:

| Field           | Current default       |
| --------------- | --------------------- |
| Display name    | `RoutineKind`         |
| Slug            | `routinekind`         |
| URL scheme      | `routinekind`         |
| iOS bundle ID   | `com.routinekind.app` |
| Android package | `com.routinekind.app` |

Production builds still require explicit final identity environment values and
`BRAND_LEGAL_CLEARANCE=cleared`. These defaults reduce accidental use of the
conflicted `OnSkin` identity in dev/staging, but they are not trademark
clearance, domain registration, App Store name reservation, or Google Play
package reservation.

Legacy `OnSkin`, `onskin`, `onskin://`, `com.onskin.app`, and placeholder
`onskin.app` references remain high risk where they are still present in
public launch config. `npm run brand:audit:strict` now passes because those
public/review-needed launch references are gone; remaining hits are classified
as guard rails, internal namespaces, or historical context. The final production
app name, project refs, domains, store records, and OAuth allow-lists still need
real clearance and reservation.

## DNS Checks

Local DNS checks on 2026-07-04:

| Domain            | DNS result                 | Interpretation                                                                      |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `onskin.com`      | Resolves to Cloudflare IPs | Existing public web property is active                                              |
| `onskin.app`      | DNS NXDOMAIN               | No DNS record found, but this is not proof that the domain is available to register |
| `routinekind.com` | DNS NXDOMAIN               | Candidate domain target needs registrar check and legal clearance                   |
| `routinekind.app` | DNS NXDOMAIN               | Candidate app domain target needs registrar check and legal clearance               |

DNS NXDOMAIN only means no current DNS record was found. It does not prove domain
availability, trademark availability, or social handle availability.

## RoutineKind Candidate Spot Checks

These checks are useful screening evidence only. They do not replace trademark
counsel, registrar checkout, App Store Connect name reservation, Google Play
package creation, social-handle checks, or paid-search/common-law review.

| Date       | Surface                                    | Result                                                                                                                                                                                             | Source                                                                                                                             |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-07 | Apple public app search API                | Query for `RoutineKind` returned routine-related apps but no exact `RoutineKind` `trackName` in the first 20 US software results.                                                                  | [Apple Search API](https://itunes.apple.com/search?term=RoutineKind&entity=software&country=us&limit=20)                           |
| 2026-07-07 | Google Play public search page             | Exact quoted query responded successfully; page inspection found no exact `>RoutineKind<` rendered-title marker. Google Play search HTML is not a reservation or authoritative availability proof. | [Google Play search](https://play.google.com/store/search?q=%22RoutineKind%22&c=apps&hl=en_US&gl=US)                               |
| 2026-07-07 | Web-indexed App Store / Google Play search | Search over App Store, Google Play, and broad web results did not surface an exact `RoutineKind` app listing.                                                                                      | Search queries: `site:apps.apple.com RoutineKind app`, `site:play.google.com/store/apps RoutineKind`, `"RoutineKind" skincare app` |
| 2026-07-07 | DNS                                        | `routinekind.app` and `routinekind.com` returned NXDOMAIN or no DNS answer from local DNS resolution. This is not registrar availability.                                                          | Local `Resolve-DnsName`                                                                                                            |

## Similarity Assessment

| Dimension              | Risk                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Exact brand string     | High: same `OnSkin` name                                                                     |
| Category               | High: skincare/cosmetic app                                                                  |
| Core action            | High: product scan, ingredient analysis, routine guidance                                    |
| Keywords               | High: scanner, skincare, cosmetic checker, ingredient analysis, routine                      |
| Domain/customer memory | High: incumbent controls `onskin.com`; `onskin.app` is close to existing social handle usage |
| Store confusion        | High: users could search for one app and install/support the other                           |
| Paid search/ASO        | High: exact-brand search would be contested from day one                                     |

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
