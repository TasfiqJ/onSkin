# BRAND-03 Knockout Search Record

Search date: 2026-07-12 America/Toronto / 2026-07-13 UTC
Candidates: `RoutineKind`, `Ritunera`, `Rituvia`; additional screens for
`Ritualoom` and `Shelfkind`
Purpose: preliminary knockout only; not a comprehensive search, reservation,
legal opinion, or availability statement

## Coverage summary

| Surface                    | Coverage                                                                                                           | Result status                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Apple public Search API    | US, Canada, UK, Australia; exact candidate plus returned near names                                                | Completed; no exact title for the three finalists                                      |
| Google Play public search  | US English quoted search; exact rendered-title marker                                                              | Completed; no exact marker for the three finalists                                     |
| Broad web/common law       | Exact quoted names, skincare/app/trademark context, known-product collision follow-up                              | Completed as a public-web screen; inherently incomplete                                |
| Domains                    | DNS plus registry RDAP for `.com` and `.app`                                                                       | Completed as a point-in-time registration screen; not a registrar checkout/reservation |
| Public social handles      | Search-engine indexing for Instagram, X, YouTube, Facebook; TikTok blocked by robots                               | No indexed exact finalist result found; handle ownership remains **unverified**        |
| CIPO                       | Exact, wildcard, and component queries in official Canadian database                                               | Completed; database showed last update 2026-07-08                                      |
| USPTO                      | Official search/help pages reachable; result interface unavailable without an interactive browser in this task     | **Not verified**; mandatory counsel search                                             |
| WIPO Global Brand Database | Official coverage/help pages reachable; WIPO prohibits automated querying and no interactive browser was available | **Not verified**; mandatory manual/counsel search                                      |
| EUIPO/TMview               | Official availability guidance reachable; result interface unavailable without an interactive browser              | **Not verified**; mandatory manual/counsel search if EU is in scope                    |

WIPO itself says its global database is not a substitute for national/regional
register searches and that absence does not establish availability:
[Global Brand Database](https://www.wipo.int/en/web/global-brand-database) and
[FAQ](https://www.wipo.int/en/web/global-brand-database/faqs_branddb). EUIPO
likewise says to search for the same and similar signs and notes that unregistered
rights can matter: [EUIPO availability guidance](https://www.euipo.europa.eu/uk/trade-marks/before-applying/availability).

## Apple App Store

Official query form:

`https://itunes.apple.com/search?term={candidate}&entity=software&country={country}&limit=50`

| Candidate   |                    US |        CA |        GB |        AU | Notable returned adjacency                                             |
| ----------- | --------------------: | --------: | --------: | --------: | ---------------------------------------------------------------------- |
| RoutineKind | 0 exact / 44 returned |    0 / 45 |    0 / 43 |    0 / 45 | `Routine Planner`, `RoutineFlow`, `Me+ Lifestyle Routine`, `MyRoutine` |
| Ritunera    |                 0 / 4 | Not rerun | Not rerun | Not rerun | No exact title in US response                                          |
| Rituvia     |                 0 / 1 |     0 / 1 |     0 / 1 |     0 / 1 | Unrelated `myRivadiUgento`                                             |
| Ritualoom   |                0 / 41 |    0 / 42 |    0 / 42 |    0 / 42 | UK response included `Rituals Home & Body Cosmetics`                   |
| Shelfkind   |                0 / 39 | Not rerun | Not rerun | Not rerun | Many books/shelf apps; no exact title                                  |

Reproducible finalist links:

- [RoutineKind US](https://itunes.apple.com/search?term=RoutineKind&entity=software&country=us&limit=50)
- [Ritunera US](https://itunes.apple.com/search?term=Ritunera&entity=software&country=us&limit=50)
- [Rituvia US](https://itunes.apple.com/search?term=Rituvia&entity=software&country=us&limit=50)

The Apple public API is not App Store Connect and does not expose reserved or
unpublished names. Apple says another developer may already use a name and that
a trademark-rights holder can submit a claim; real reservation therefore
requires an authorized App Store Connect record:
[Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/).

## Google Play public screen

Quoted US English search pages returned HTTP 200 and no exact rendered-title
marker for `RoutineKind`, `Ritunera`, `Rituvia`, or `Ritualoom` in the checked
HTML. This is a weak public screen, not a Play Console or package reservation.

- [RoutineKind](https://play.google.com/store/search?q=%22RoutineKind%22&c=apps&hl=en_US&gl=US)
- [Ritunera](https://play.google.com/store/search?q=%22Ritunera%22&c=apps&hl=en_US&gl=US)
- [Rituvia](https://play.google.com/store/search?q=%22Rituvia%22&c=apps&hl=en_US&gl=US)

Android release is out of scope, but public Play use remains relevant common-law
and customer-confusion input.

## Broad web and common-law screen

Queries included the exact quoted candidate alone and in combinations with
`app`, `skincare`, `software`, and `trademark`, plus site-restricted App Store,
Google Play, and social queries.

| Candidate   | Exact/common-law observation                                                                         | Interpretation                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| RoutineKind | Results were programming identifiers such as a `RoutineKind` type, not an identified consumer brand. | No exact consumer use found in the checked index; common words and routine apps remain adjacent.   |
| Ritunera    | No meaningful exact commercial result found in the checked index.                                    | Encouraging only; not proof of non-use.                                                            |
| Rituvia     | `rituvia.com` resolved to a GoDaddy parked sale page offering the domain for USD $500.               | Domain is registered; no identified operating product on the parked page. Purchase not authorized. |
| Ritualoom   | No meaningful exact commercial result found in the checked index.                                    | Ritual-formative field remains crowded.                                                            |
| Shelfkind   | Exact term appeared as a generic/code/fandom label; `shelfkind.com` is registered.                   | No identified skincare app, but domain and shelf-formative risk remain.                            |

Known hard collisions from the longlist are linked in
[`BRAND-02-scored-longlist.md`](./BRAND-02-scored-longlist.md).

## Domain record

Point-in-time checks used DNS and the applicable registry RDAP service:

- `.com`: `https://rdap.verisign.com/com/v1/domain/{domain}`
- `.app`: `https://pubapi.registry.google/rdap/domain/{domain}`

| Domain          | DNS                     | RDAP HTTP | Recorded conclusion                           |
| --------------- | ----------------------- | --------: | --------------------------------------------- |
| routinekind.com | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |
| routinekind.app | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |
| ritunera.com    | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |
| ritunera.app    | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |
| rituvia.com     | Resolved to parking IPs |       200 | Registered and offered for sale               |
| rituvia.app     | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |
| ritualoom.com   | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |
| ritualoom.app   | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |
| shelfkind.com   | Resolved                |       200 | Registered; ownership/use not verified        |
| shelfkind.app   | NXDOMAIN/no A           |       404 | No registry record returned; **not reserved** |

NXDOMAIN and RDAP 404 do not guarantee registrability, price, eligibility, or a
successful checkout. No domain was purchased, held, or placed in a cart.

## Social record

Search-engine queries for exact finalist strings on Instagram, X, YouTube, and
Facebook returned no indexed results. TikTok blocked automated access. Direct
handle availability, dormant/private accounts, impersonation variants, and
platform reservation were not verifiable. Every handle is therefore recorded as
`unverified`, not `available`.

Counsel/founder should manually check at least the exact lowercase handle plus
`get`, `app`, and `hq` variants immediately before reservation on Instagram,
TikTok, X, YouTube, Facebook, Threads, Pinterest, and Reddit.

## CIPO official database

Official source: [Canadian Trademarks Database](https://ised-isde.canada.ca/cipo/trademark-search/srch?lang=eng).
The database page reported last update `2026-07-08`. Searches used `TM lookup`,
all statuses and types, and up to 500 results. CIPO recommends searching
phonetic equivalents, synonyms, translations, and the separate elements of a
multiword mark: [CIPO confusion guidance](https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/trademarks/additional-search-options#confusion).

| Candidate   | Exact/near queries                                                          | Result                                          |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| RoutineKind | `"RoutineKind"`, `routin?kind`, `"routine kind"`                            | 0 each                                          |
| Ritunera    | `"Ritunera"`, `ritun*`, `ritu?era`                                          | 0 each                                          |
| Rituvia     | `"Rituvia"`, `ritu?ia`, `rituv*`                                            | 0 each                                          |
| Ritualoom   | exact checked through public screens; CIPO `ritual*` component set reviewed | No exact recorded; 163 ritual-formative results |
| Shelfkind   | `"Shelfkind"`, `shelf*kind`, `"shelf kind"`                                 | 0 each                                          |

Material adjacent CIPO records include:

| Mark           | Application | Status shown | Nice classes     | Why counsel should review                                        |
| -------------- | ----------- | ------------ | ---------------- | ---------------------------------------------------------------- |
| Skin&Routine   | 2412865     | Advertised   | 3, 9, 35, 42, 44 | Same sector and exact `Routine` component                        |
| Routine Review | 2047002     | Registered   | 42, 44, 45       | Software/beauty-adjacent service classes                         |
| RITUAL         | 1726451     | Registered   | 9                | Exact crowded root in software class                             |
| RITUAL         | 1919057     | Registered   | 42               | Exact crowded root in technology-services class                  |
| RITUO          | 2348061     | Registered   | 10               | Close short `RITU-` visual/phonetic form in medical-device class |
| RITUZENA       | 1840101     | Registered   | 5                | Close `RITU-` form in pharmaceutical class                       |
| EVERSHELF      | 2372521     | Registered   | 9, 42            | Software/technology shelf-formative mark                         |
| Shelf Health   | 2475967     | Formalized   | 9, 35, 44        | Shelf plus health-adjacent goods/services                        |

These records are leads, not conclusions about confusion. Counsel must review
the full goods/services, owners, dates, status histories, and marketplace use.

## USPTO, WIPO, and EUIPO gate

The official interfaces could not be driven in this task because no interactive
browser was available; WIPO also expressly disallows automated querying. No
negative search conclusion is recorded for these systems.

Required manual/counsel searches:

1. USPTO exact, plural, spacing, wildcard, phonetic, and design searches across
   live and dead records, especially classes 9, 35, 41, 42, 44, and 45:
   [USPTO trademark search](https://tmsearch.uspto.gov/) and
   [comprehensive clearance guidance](https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks).
2. WIPO Global Brand Database exact/fuzzy/phonetic searches plus Madrid Monitor:
   [WIPO GBD](https://www.wipo.int/en/web/global-brand-database).
3. EUIPO/TMview exact/fuzzy/phonetic searches if any EU country is in launch or
   near-term expansion scope: [TMview guidance](https://www.euipo.europa.eu/uk/trade-marks/before-applying/availability).
4. State/provincial company names, business registries, common-law web, app
   stores, social handles, and relevant marketplace use.

USPTO explains that clearance normally includes its database, state trademark
databases, and the internet, and that similar marks on related goods/services
may create likelihood of confusion:
[USPTO search-before-filing flyer](https://www.uspto.gov/sites/default/files/documents/TM-Searching-flyer.pdf).

## Search conclusion

- `OnSkin` remains a hard reject.
- `RoutineKind`, `Ritunera`, and `Rituvia` survived the accessible knockout
  screen.
- None is cleared, available, reserved, or approved for production.
- `RoutineKind` carries the highest observed component/crowding risk;
  `Ritunera` carries the highest pronunciation/category-learning risk;
  `Rituvia` carries a registered `.com` and pharmaceutical-sound risk.
- Formal counsel review and actual authorized reservation are release blockers.
