# PAY-01 Pricing and Unit-Economics Recommendation

**Decision date:** 2026-07-13

**Status:** Provisional recommendation; founder approval required before PAY-02 or any App Store Connect, RevenueCat, product, offer, price, storefront, or account change

**Scope:** iOS auto-renewable subscriptions for the Layerwell launch contract

**Decision owner:** Founder
**Prepared from:** the active Layerwell launch packet plus current Apple, RevenueCat, FTC, California, and Canada Revenue Agency primary sources listed below

## Executive decision

Launch with an annual-first, two-plan subscription architecture:

- **Annual:** US$49.99 per year, presented as the recommended plan.
- **Monthly:** US$9.99 per month, presented as the flexible alternative.
- **Weekly:** no weekly subscription.
- **Reverse trial:** preserve the launch-contract requirement for a seven-day, app-granted Pro preview that requires no payment method and does not renew.
- **Store trial:** provisionally use a seven-day Apple introductory free trial on the annual product only, but only if the reverse-trial-to-store-trial eligibility and messaging can be made unambiguous and tested end to end. If the two experiences cannot be kept clear, ship one trial mechanism rather than stack ambiguous “free” periods. The existing 14-day proposal remains an explicit founder decision, not an implementation default.
- **Launch promotions:** no pay-up-front or pay-as-you-go introductory discount and no win-back offer at launch.
- **Initial storefront wave:** United States only, subject to legal, privacy, tax, catalog, support, localization, and App Review readiness. Do not silently enable every available storefront. Canada is a later wave because Apple's documented availability control is country/region-level and does not provide a province-exclusion switch for Quebec.
- **Payments:** Apple in-app purchase only for digital Pro access in the iOS app. Do not assume a web checkout or external purchase path is permitted or desirable.

This is a product hypothesis, not a revenue guarantee. US$49.99 is above RevenueCat's observed 2026 Health & Fitness annual price cluster of about US$39.94, while US$9.99 matches the category's monthly cluster. The annual premium therefore must earn its place through measured contribution LTV, retention, refunds, and customer trust. It must not be justified by list-price arithmetic alone.

At US$1,000,000 of collected gross subscription billings, the model below produces approximately:

- **US$818,750 platform net / US$798,746 contribution net** in a favorable case.
- **US$765,200 platform net / US$705,188 contribution net** in the planning case.
- **US$693,119 platform net / US$613,103 contribution net** in the scale-transition case.
- **US$537,400 platform net / US$377,368 contribution net** in the downside case.

The planning case requires approximately **US$1.418 million in collected gross billings**, or **28,367 annual-equivalent US$49.99 transactions**, to produce US$1 million of contribution net before payroll, marketing, professional fees, corporate/income taxes, and fixed overhead. “Seven figures” must always name the metric: gross billings, platform net, contribution net, or profit. They are not interchangeable.

## What PAY-01 decides — and what it does not

This memo recommends pricing, offer architecture, country sequencing, and a transparent planning model. It does not:

- create or edit an App Store Connect product, subscription group, offer, storefront, price, tax category, banking record, or agreement;
- create or edit a RevenueCat product, entitlement, offering, package, webhook, or paywall;
- enroll an account in Apple's App Store Small Business Program;
- determine the final tax treatment of the founder, company, or Apple relationship;
- approve a claim, paywall, privacy disclosure, or App Review submission;
- promise Apple approval, regulatory compliance, conversion, retention, profit, or a seven-figure outcome.

Those actions belong to later gates, particularly PAY-02 and the founder-controlled App Store Connect and legal/tax gates.

## Evidence and constraints

### Apple economics

Apple defines proceeds as the customer price minus applicable taxes and Apple's commission. Estimated proceeds can differ from final financial reports because of tax, foreign exchange, withholding, refunds, and adjustments. Apple financial reports, not a RevenueCat dashboard estimate, are the accounting source of truth.

For an eligible App Store Small Business Program participant, Apple states a 15% commission on paid apps and in-app purchases. Eligibility uses no more than US$1 million in prior-calendar-year proceeds across associated developer accounts. If current-year proceeds exceed US$1 million, the standard commission applies to future sales for the rest of that year. The threshold is based on proceeds, not customer gross billings, and associated-account rules matter.

Outside that program, an auto-renewable subscription generally pays 70% of the subscription price, less applicable taxes, during a subscriber's first year of paid service and 85% after one year. Free-trial time does not advance the paid-service clock; paid promotional time does. A service gap of no more than 60 days can preserve the clock. This creates a real transition risk: the business must be able to operate under 30% commission economics even if it expects 15% initially.

Apple supports up to 800 standard price points, plus 100 higher price points by request, and can calculate comparable prices across 174 other storefronts and 43 currencies. For auto-renewable subscriptions, however, Apple says retail-price changes caused by tax or foreign-exchange adjustments are excluded from its automatic retail-price adjustment process; tax changes can instead change developer proceeds. Subscription prices and proceeds therefore need a scheduled review rather than a one-time “set and forget” assumption.

Apple also imposes notice and, in some cases, subscriber-consent requirements for price increases. Existing-subscriber price preservation may be used. A later pricing test must never assume that a winning new-customer price can be applied to the installed base without disclosure, consent, churn, and fairness consequences.

### Offers and eligibility

Apple supports free, pay-up-front, and pay-as-you-go introductory offers. A customer can redeem one introductory offer per subscription group, and only one current or future introductory offer can exist per storefront. Apple supports free-trial durations including three days, one week, two weeks, one, two, three, or six months, and one year.

Apple win-back offers can target eligible lapsed subscribers. Eligibility includes a minimum paid duration, a lapsed duration of one to 24 months, and an optional wait of two to 24 months. A product can have no more than 350 total win-back offers and five active offers per storefront. Apple's in-app win-back sheet requires iOS 18 or later, while win-back visibility on the system Manage Subscriptions surface reaches older operating systems. Because Layerwell's current minimum is iOS 17, a future win-back implementation must verify the iOS 17 experience rather than assuming the iOS 18 sheet exists everywhere.

Offer codes can serve new, current, or expired subscribers, but they are operational tools, not permission to use artificial urgency or opaque discounts. Apple currently allows up to 10 active offers per subscription product and up to one million codes per app per quarter.

### 2026 subscription benchmarks

RevenueCat's 2026 report covers more than 115,000 apps, more than US$16 billion in revenue, more than one billion transactions, and primarily 2025 performance. Its sample contains apps integrated with RevenueCat and applies activity/revenue/install filters. It is directional benchmark evidence, not an Layerwell forecast or a substitute for a randomized experiment.

Relevant Health & Fitness observations include:

- day-35 download-to-paid conversion of 2.9% at the median and above 6.2% at the 75th percentile;
- freemium conversion of 2.1% at the median and above 4.5% at the 75th percentile across monetization models;
- trial-to-paid conversion of 37.7% at the Health & Fitness median and above 51.4% at the 75th percentile;
- 82.1% of Health & Fitness trial starts occurring on day zero;
- 5–9 day trials converting at 37.4% overall, compared with 42.5% for 17–32 days and 25.5% for trials of four days or less; 5–9 days is the category's most common trial band;
- 68% of Health & Fitness subscription revenue coming from annual plans;
- a Health & Fitness annual price cluster near US$39.94 and monthly cluster at US$9.99;
- day-60 revenue per install of US$0.66 and realized first-year LTV per payer of US$35.64 for the category;
- median first-year retention of about 28% for annual plans and 8% for monthly plans across the report, down from 31% and 10% respectively in the previous comparison;
- annual first-renewal rates of 37%, 27%, and 24% for low-, mid-, and high-priced tiers, and monthly first-renewal rates of 60%, 55%, and 51%;
- refund rates of 2.7%, 3.9%, and 4.5% for low-, mid-, and high-priced tiers, with North America at 3.4%;
- annual reactivation around 4–6%, versus 18–24% for monthly plans;
- offer use in 14% of Health & Fitness subscriptions.

The report's statement that 35% of annual cancellations happen in month one is a distribution of cancellation timing, not a claim that 35% of every annual cohort cancels in month one. The distinction must remain intact in forecasts and investor language.

RevenueCat's current public pricing is free through US$2,500 of monthly tracked revenue and 1% after that threshold. Monthly tracked revenue is measured before the platform cut, so this memo models RevenueCat as approximately 1% of gross billings at scale. Contract terms and the live invoice must be rechecked before procurement.

## Provisional product and pricing recommendation

### Annual plan: US$49.99

Use the annual product as the default visual recommendation, but do not preselect a purchase consent or initiate the StoreKit sheet without a deliberate user action. Show the full localized amount charged for the year more prominently than any “per month” equivalent. If an equivalent is shown, label it as arithmetic and never as the billed cadence.

At US$49.99, the customer pays 58.3% less than twelve US$9.99 monthly payments. That is a large annual commitment discount, supports simpler planning, and aligns with the category's annual-heavy revenue mix. It is also about 25% above the observed Health & Fitness annual cluster, so it needs a genuine value case: recurring routines, trusted tracking, useful analysis, export/history, and continuing product improvements. “AI” by itself is not sufficient value disclosure.

US$49.99 should be treated as the launch hypothesis. A later controlled test may compare it with US$39.99 or US$59.99, but US$59.99 must not be assumed superior because its transaction count is lower. RevenueCat's current data associates higher annual price tiers with lower first-renewal rates and higher refunds. The winner is the variant with better long-horizon contribution LTV per eligible install, subject to trust and reliability guardrails.

### Monthly plan: US$9.99

Keep US$9.99 as the lower-commitment alternative. It matches the observed category price cluster, gives cautious customers a real choice, and provides a useful path for reactivation. Do not make monthly visually illegible or describe it with shaming language.

Monthly churn is structurally high. A US$9.99 price is not US$119.88 of expected first-year revenue for a newly acquired payer. Under the retention sensitivity below, first-year gross per new monthly payer is approximately US$28.87–US$44.66 before tax, commission, refunds, RevenueCat, and service cost.

### No weekly plan

Do not create a weekly product at launch. Weekly plans can make comparison harder, elevate perceived annual savings, and generate more renewal moments. Layerwell has no evidence that a weekly cadence improves trusted, durable customer value. It would add App Review, support, analytics, price-display, and experiment complexity without solving a current launch requirement.

### Reverse trial: seven days, no payment method, no renewal

Preserve the launch-contract reverse trial as an app-granted preview. Use wording equivalent to:

> Pro preview: seven days. No payment method. Does not renew.

Do not label this preview an “Apple free trial,” “subscription trial,” or “risk-free subscription.” It has no StoreKit billing authorization and must end without a charge. The app must correctly revert only paid capabilities while preserving the user's free-tier data and making the next choice clear.

### Apple introductory trial: annual only, provisionally seven days

Recommend a seven-day Apple free trial for the annual product if, and only if, implementation can clearly distinguish it from the reverse preview and prevent misleading eligibility assumptions. The StoreKit purchase sheet and paywall must state the trial length, renewal date/cadence, and full localized annual amount that will be billed unless the customer cancels.

The repo's earlier proposal is 14 days. The benchmark evidence does not prove seven days will outperform 14 days for Layerwell: longer trials converted better overall in RevenueCat's current duration comparison, while 5–9 days is the common Health & Fitness pattern and produces faster learning. The founder must choose one launch hypothesis. This memo recommends seven days for launch and reserving 14 days for a later properly powered trial-duration experiment.

Do not offer an introductory trial on monthly at launch. Do not knowingly promise a second trial to someone ineligible under Apple's one-intro-per-subscription-group rule. If a user can receive both the reverse preview and Apple trial, disclose both honestly; if that message becomes confusing, remove one mechanism rather than obscure the sequence.

### No paid introduction and no day-one win-back

Launch without pay-up-front or pay-as-you-go introductory discounts. A clean full-price baseline is needed before discount effects can be measured.

Launch without a win-back offer. After enough real lapsed-subscriber data exists, consider a narrow native Apple win-back experiment, likely starting with the monthly product because current benchmark reactivation is materially higher for monthly than annual. Set eligibility from measured lapse behavior, cap duration and discount, and show the actual renewal price. Do not use countdown timers, “last chance” language without a real deadline, or repeated interruption.

### Country and storefront sequence

Provisional Wave 1 is the United States only. This is not authorization to enable the US storefront; all other launch gates still apply, including legal/privacy review, correct product availability, localized StoreKit display prices, support coverage, subscription metadata, screenshots, and tested purchase/restore/manage flows.

Canada is provisional Wave 2 only after a Canada/Quebec launch gate. Apple's public availability documentation lets a developer select countries or regions and identifies Canada as one App Store territory; it does not document province-level availability controls. The safe operational inference is that selecting Canada also reaches Quebec and that a province-excluded Canadian rollout is not available. Before Canada is selected, Layerwell therefore needs a complete French-capable app and commercial/store experience, French customer support on equivalent terms, French subscription/adhesion-contract terms and connected documents, and Quebec and national legal, privacy, consumer-protection, tax, claims/catalog, price, accessibility, and QA approval. Qualified Quebec counsel must determine the exact scope; translation alone is not legal approval.

Use Apple's comparable pricing as a starting point for a future Canada launch, then review the actual Canadian price and estimated proceeds. The founder must approve the exact Canadian tier. Do not hard-code a currency conversion in the app and do not infer a Canadian dollar point from today's exchange rate.

Provisional Wave 3 is the United Kingdom, Australia, New Zealand, and Ireland only after country-level legal/privacy, tax, catalog/claims, support, localization, price, and App Review checks. Other storefronts remain disabled until explicitly approved. If the United States health-privacy/legal posture is not cleared, there is no automatic Canada fallback; Canada may proceed only after its stricter language and country gates independently pass.

The correct base storefront depends on the legal entity, bank, tax position, operating market, and founder decision. No base-storefront choice is made here.

## Unit-economics model

### Required metric definitions

Every plan, dashboard, experiment, and public/internal claim must use these definitions:

- **Collected gross billings:** the subscription customer price successfully collected, before refunds and platform/vendor deductions. It excludes tax charged on top of the displayed price but includes tax embedded in the displayed price. Failed authorization is not collected gross billings.
- **Estimated Apple proceeds before developer-level tax:** collected gross billings after embedded transaction tax, Apple commission, and subscription refunds, but before RevenueCat, service cost, fixed operating cost, and the developer's corporate/income tax. Apple proceeds are after marketplace transaction taxes where Apple deducts those taxes; “before tax” here means before the developer's own income/corporate tax. Final Apple financial reports control.
- **Platform/vendor net proceeds:** estimated Apple proceeds after RevenueCat's variable fee but before service cost. This is the “platform net” shorthand used in this memo's executive summary.
- **Contribution net:** platform net proceeds minus variable cost to serve the paying customer, before payroll, paid acquisition, fixed infrastructure, professional fees, corporate/income tax, and other overhead.
- **Operating net before developer tax:** contribution net minus paid acquisition, payroll, fixed infrastructure, professional fees, insurance, support overhead, and all other fixed/semi-fixed operating costs, before the developer's corporate/income tax.
- **After-tax profit:** operating net after all applicable corporate/income taxes and other below-the-line items. This memo cannot forecast it without an approved entity, jurisdiction, expense budget, and professional tax analysis.
- **Annualized list-price run rate:** active subscriptions multiplied by list price and billing frequency. It is neither cash nor GAAP revenue and must not be called proceeds, profit, or collected billings.

For scenario planning:

```text
estimated Apple-proceeds margin before developer-level income/corporate tax
  = (1 - embedded transaction-tax rate)
    × (1 - Apple commission rate)
    × (1 - refund rate)

platform margin
  = estimated Apple-proceeds margin
    - RevenueCat rate on gross

contribution margin
  = platform margin
    - variable service cost per annual payer / annual price

platform net = collected gross billings × platform margin
contribution net = collected gross billings × contribution margin

operating net before developer tax
  = contribution net - fixed and semi-fixed operating costs
```

This formula intentionally treats RevenueCat as a percentage of gross at scale. It also applies refunds after embedded tax and commission as a simplified planning approximation. Actual Apple financial-report treatment, partial refunds, currency, tax, and adjustments can differ; the model must be reconciled monthly against reports.

### Scenario assumptions

| Scenario         | Embedded transaction tax | Apple commission | Refunds | RevenueCat | Variable service cost per annual payer | What it represents                                                                                  |
| ---------------- | -----------------------: | ---------------: | ------: | ---------: | -------------------------------------: | --------------------------------------------------------------------------------------------------- |
| Favorable        |                       0% |              15% |    2.5% |         1% |                                   US$1 | Low embedded tax, Small Business Program, category-level low refunds, highly efficient service      |
| Planning         |                       5% |              15% |      4% |         1% |                                   US$3 | Small Business Program with a blended embedded-tax allowance, mid-tier refunds, modest service cost |
| Scale transition |                       5% |            22.5% |    4.5% |         1% |                                   US$4 | Simplified 50/50 blend between 15% and 30% Apple rates plus higher refund/service pressure          |
| Downside         |                      15% |              30% |      8% |         1% |                                   US$8 | High embedded tax, standard Apple commission, elevated refunds, materially higher service use       |

These are stress-test inputs, not a tax conclusion, accounting policy, or prediction. The 22.5% transition blend is an intentionally simple planning proxy; the real mix depends on Small Business Program timing, subscriber tenure, associated accounts, renewal history, and product mix. Variable service cost is a placeholder until Layerwell measures storage, media, compute/AI, database, observability, messaging, moderation/support, and vendor cost per paid cohort.

### Results at US$1 million collected gross billings

| Scenario         | Estimated Apple proceeds before developer tax | Platform/vendor net after RevenueCat | Contribution margin | Contribution net after service cost |
| ---------------- | --------------------------------------------: | -----------------------------------: | ------------------: | ----------------------------------: |
| Favorable        |                                    US$828,750 |                           US$818,750 |             79.875% |                          US$798,746 |
| Planning         |                                    US$775,200 |                           US$765,200 |             70.519% |                          US$705,188 |
| Scale transition |                                    US$703,119 |                           US$693,119 |             61.310% |                          US$613,103 |
| Downside         |                                    US$547,400 |                           US$537,400 |             37.737% |                          US$377,368 |

Rounding causes minor differences between displayed margins and dollar results.

### Fixed-cost and operating-net sensitivity

The repo does not yet contain an approved annual hiring, acquisition, insurance, legal, support, and fixed-infrastructure budget. Rather than hide that omission, this table subtracts illustrative fixed/semi-fixed operating budgets from contribution net at US$1 million gross:

| Scenario         | No fixed-cost deduction | US$250k fixed costs | US$500k fixed costs | US$750k fixed costs |
| ---------------- | ----------------------: | ------------------: | ------------------: | ------------------: |
| Favorable        |              US$798,746 |          US$548,746 |          US$298,746 |           US$48,746 |
| Planning         |              US$705,188 |          US$455,188 |          US$205,188 |      **−US$44,812** |
| Scale transition |              US$613,103 |          US$363,103 |          US$113,103 |     **−US$136,897** |
| Downside         |              US$377,368 |          US$127,368 |     **−US$122,632** |     **−US$372,632** |

With US$500,000 of annual fixed/semi-fixed operating cost, producing US$1 million of operating net before developer-level income/corporate tax would require approximately:

| Scenario         | Gross billings required | US$49.99 annual-equivalent transactions |
| ---------------- | ----------------------: | --------------------------------------: |
| Favorable        |            US$1,877,944 |                                  37,567 |
| Planning         |            US$2,127,092 |                                  42,551 |
| Scale transition |            US$2,446,572 |                                  48,942 |
| Downside         |            US$3,974,900 |                                  79,514 |

The US$500,000 budget is an illustration, not permission to spend or a forecast. Paid acquisition must not be omitted from operating net merely because it is variable by campaign; if reported separately as customer-acquisition cost, it still must be deducted before a profit claim. After-tax profit remains unmodeled until the founder supplies the entity and an approved operating plan and a qualified adviser supplies the tax treatment.

### Gross billings required to reach US$1 million net

| Scenario         | Gross for US$1M platform net | US$49.99 annual-equivalent transactions | Gross for US$1M contribution net | US$49.99 annual-equivalent transactions |
| ---------------- | ---------------------------: | --------------------------------------: | -------------------------------: | --------------------------------------: |
| Favorable        |                 US$1,221,374 |                                  24,432 |                     US$1,251,962 |                                  25,044 |
| Planning         |                 US$1,306,848 |                                  26,142 |                     US$1,418,062 |                                  28,367 |
| Scale transition |                 US$1,442,754 |                                  28,861 |                     US$1,631,048 |                                  32,627 |
| Downside         |                 US$1,860,811 |                                  37,224 |                     US$2,649,933 |                                  53,009 |

“Annual-equivalent transaction” is only a normalization at the US annual list price. It is not a count of unique customers when refunds, repeat years, monthly plans, promotional prices, countries, and currencies are present.

### Price-point sensitivity

At exactly US$1 million of collected gross billings, the arithmetic transaction counts are:

| Annual price | Annual-equivalent transactions |
| ------------ | -----------------------------: |
| US$39.99     |                         25,006 |
| US$49.99     |                         20,004 |
| US$59.99     |                         16,669 |

Under the planning-case cost assumptions, holding conversion, retention, refunds, mix, and service behavior constant solely to expose the arithmetic:

| Annual price | Contribution per annual transaction | Gross for US$1M contribution | Annual transactions for US$1M contribution |
| ------------ | ----------------------------------: | ---------------------------: | -----------------------------------------: |
| US$39.99     |                            US$27.60 |                 US$1,448,900 |                                     36,231 |
| US$49.99     |                            US$35.25 |                 US$1,418,062 |                                     28,367 |
| US$59.99     |                            US$42.90 |                 US$1,398,200 |                                     23,308 |

This table must not be used to declare US$59.99 the winner. Conversion, renewal, refund, support burden, reputation, and acquisition efficiency are not constant. Current benchmark direction suggests that higher annual prices can have lower retention and higher refunds. Only a controlled cohort experiment and full-period measurement can estimate the causal trade-off.

### Monthly churn sensitivity

For a new US$9.99 monthly payer, model expected first-year paid months using the first renewal and a constant later-month renewal probability:

| Case     | First renewal | Later monthly renewal | Expected paid months in year one | Expected gross in year one per new payer |
| -------- | ------------: | --------------------: | -------------------------------: | ---------------------------------------: |
| Downside |           51% |                   74% |                             2.89 |                                 US$28.87 |
| Planning |           55% |                   80% |                             3.51 |                                 US$35.10 |
| Upside   |           60% |                   86% |                             4.47 |                                 US$44.66 |

The first-renewal inputs use RevenueCat's current monthly price-tier range. The later-renewal inputs are transparent sensitivities, not report values or an Layerwell forecast. They exclude involuntary churn recovery, pauses, refunds, price changes, tax, commission, discounts, and reactivation.

If every monthly subscriber were active throughout a month, a US$1 million annualized gross run rate at US$9.99 would require about 8,342 average active monthly subscribers. Real unique-customer acquisition must be higher because cohorts churn, fail payment, pause, refund, and reactivate.

### Retention and refund underwriting

Use these explicit planning bands until live data replaces them:

- Annual second-year paid retention: 23% downside, 28% planning, 36% upside.
- Refund rate: 2.5% favorable, 4% planning, 4.5% scale-transition, 8% downside.
- Monthly first renewal: 51% downside, 55% planning, 60% upside.
- Annual reactivation: benchmark context only at roughly 4–6%; do not book it into launch forecasts.
- Monthly reactivation: benchmark context only at roughly 18–24%; do not book it into launch forecasts.

Refund rate must be calculated consistently, with the numerator, denominator, cohort window, partial refunds, and currency treatment named. Apple financial reports are authoritative; RevenueCat estimates are monitoring aids.

### Acquisition-scale sensitivity

If US$1 million in gross billings consisted entirely of 20,004 first-year US$49.99 annual payers, applying benchmark download-to-paid rates mechanically gives:

| Download-to-paid assumption           | Installs needed for 20,004 paid annual transactions |
| ------------------------------------- | --------------------------------------------------: |
| 1.4% low-price overall comparison     |                                           1,428,857 |
| 2.1% freemium median                  |                                             952,571 |
| 2.9% Health & Fitness median          |                                             689,793 |
| 4.5% freemium 75th percentile         |                                             444,533 |
| 6.2% Health & Fitness 75th percentile |                                             322,645 |

These figures are benchmark translations, not a funnel forecast. They ignore monthly mix, renewals, price/country mix, attribution, organic/paid channel quality, trial eligibility, refunds, cohort maturation, and the fact that Layerwell may not behave like the report's Health & Fitness sample.

### Tax and cash timing

Apple requires the Paid Apps Agreement, banking, and tax forms before payment. It generally pays within 45 days after the end of its fiscal month once the payment threshold is met. Bank/intermediary fees and foreign-exchange effects may further change cash received. A gross-billings plan is therefore not a cash-flow schedule.

Apple's selected app and in-app-purchase tax categories affect proceeds. The default App Store software category must not be accepted blindly; the correct category and any product-level override require review. Apple instructs developers to consult a tax adviser.

For Canada, CRA generally requires GST/HST registration once a person ceases to be a small supplier, commonly measured against a C$30,000 threshold for worldwide taxable supplies, with timing rules depending on how the threshold is crossed. This does not by itself determine Layerwell's obligation because the legal entity, place of supply, Apple contractual/tax role, registration status, and supplies inside/outside the App Store matter. A Canadian CPA must review the actual entity and Apple agreements before launch and again before relevant thresholds or market expansion.

## Experiment plan and guardrails

### Objective

Optimize **day-90 contribution LTV per eligible install**, with a modeled day-365 view that is clearly labeled as projected until the full renewal period is observed. Never optimize only paywall conversion, trial starts, annual-plan mix, or gross billings.

An annual-price winner remains provisional until a full annual renewal window matures. Earlier decisions may select a launch operating point, but they must not be described as proof of long-term LTV superiority.

### Required measurement

For every variant, country, platform version, acquisition channel, and eligibility state, measure:

- eligible paywall views and unique eligible installs;
- StoreKit sheet opens, purchases, trial starts, trial-to-paid conversion, and day-35 paid conversion;
- annual/monthly plan mix and realized localized price;
- refunds, partial refunds, billing-retry/grace outcomes, involuntary churn, voluntary cancellation, and reactivation;
- purchase, restore, entitlement, downgrade, expiration, offline, relaunch, and cross-device errors;
- unexpected-charge, cannot-cancel, cannot-restore, misleading-price, and refund support contacts;
- retention by cohort and renewal number;
- Apple tax, commission, refund, and proceeds from financial reports;
- RevenueCat fee and measured variable service cost;
- day-30/day-60/day-90 realized contribution and projected day-365 contribution;
- guardrail differences by country and supported accessibility/device class.

Do not use skin photos, inferred conditions, skin tone, age, health-related answers, consent choices, or other sensitive data to assign a price or discount.

### Experimental discipline

- Write the hypothesis, primary metric, secondary metrics, variants, sample-size/power analysis, minimum detectable effect, eligibility, exclusions, stopping rules, and analysis date before exposure begins.
- Use stable, immutable random assignment and log the exact product, offer eligibility, localized StoreKit price, and app version.
- Change one material pricing variable at a time. Do not combine price, copy, trial length, layout, and benefit changes in one comparison.
- Exclude internal, sandbox, TestFlight, reviewer, automation, and known fraud/test transactions from the customer analysis while retaining them in reliability QA.
- Do not peek and stop on a transient conversion lead. Run to the pre-registered sample/window unless a safety, legal, financial, reliability, or trust stop is triggered.
- Keep enough traffic on a stable control and preserve cohort definitions through the renewal window.
- Report absolute and relative effects, uncertainty intervals, sample sizes, country/channel mix, and refunds. Do not promote a directional result as conclusive.
- Reconcile experiment events to App Store Server Notifications, RevenueCat customer history, and Apple financial reports before a finance decision.

### Automatic hard stops

Immediately pause the affected surface or variant when any of these is observed:

- the displayed billed amount/cadence differs from the StoreKit sheet or receipt;
- trial or promotional eligibility, conversion date, renewal cadence, or full post-offer price is materially wrong or hidden;
- Terms, Privacy Policy, Restore Purchases, subscription-management access, or required purchase disclosure is missing or broken;
- purchase, restore, expiration, refund, downgrade, or cross-device state grants the wrong entitlement;
- a legal, privacy, regulator, platform-review, or child-safety concern is raised;
- purchase/restore/entitlement errors materially spike versus the stable control;
- a variant causes negative measured contribution at the declared decision horizon without an approved strategic reason.

These are operational controls, not legal safe harbors.

### Provisional quantitative pause thresholds

The founder must approve or replace these before an experiment:

- refund rate above 6% or more than two percentage points above control on a comparable matured cohort;
- unexpected-charge support contacts above 0.5% of purchases;
- purchase, restore, or entitlement error rate above 1% of attempted transactions, or a statistically/operationally meaningful deterioration from control;
- negative day-90 contribution per eligible install;
- any material mismatch between Apple financial reports and the internal/RevenueCat ledger that cannot be explained and reconciled.

Low volume can make a percentage unstable, so any severe individual harm or systematic billing defect can trigger a pause before a numeric threshold is reached.

## Apple, legal, and trust constraints

### App Store purchase requirements

The paywall and purchase flow must satisfy all of the following before production:

- Use Apple's in-app-purchase system for digital Pro capabilities consumed in the iOS app unless counsel and App Review documentation establish a specific permitted exception.
- Provide continuing subscription value, use a subscription period of at least seven days, and make the subscribed service available across the user's devices as Apple's rules require.
- Explain what the user receives for the price. Do not market a generic “premium experience” without concrete included capabilities.
- Before the purchase action, present the plan name, full localized billed amount, billing period, whether it renews, trial/offer duration and eligibility, date/circumstance of conversion, and full post-offer amount/cadence.
- Use StoreKit's localized display values. Never assemble a currency symbol and number from a hard-coded US price.
- Make the total annual charge more prominent than an annual price divided by 12. Label savings against the real currently offered monthly price and do not use a fabricated “regular” price.
- Provide functional Restore Purchases, Terms of Use, Privacy Policy, and Manage Subscription paths. Test purchase, cancel-auto-renew, grace, billing retry, expiration, refund, restore, reinstall, relaunch, offline, and cross-device states.
- Preserve free-tier data on expiration or cancellation. Do not hold a user's skin history hostage to coerce renewal; apply the approved retention/export/deletion policy.
- Keep paywall metadata, App Review notes, subscription-product metadata, screenshots, product behavior, and StoreKit sheet consistent.

Apple approval cannot be guaranteed. App Review applies the current guidelines to the submitted binary, metadata, products, account state, and reviewer-observed behavior.

### Refunds, cancellation, and service recovery

Apple controls App Store refund decisions and can issue full, partial, or prorated refunds. The app must consume authoritative transaction/refund state and remove paid entitlement when appropriate without deleting free-tier data. The business must reconcile refunds in Apple's financial reports and provide a clear route to Apple's refund-request process.

Do not say “no refunds.” Do not promise that Layerwell can approve an Apple refund. Do not state that cancellation refunds the current period. Safe explanatory copy is materially equivalent to:

> Manage or turn off renewal in your App Store subscription settings. Access normally continues through the current paid period. Refund eligibility and decisions are handled by Apple under its policies.

That copy still requires legal and product review against the actual implementation. “Cancel anytime” must be qualified so it does not imply an instant prorated refund. Do not promise a custom pre-renewal reminder unless Layerwell has implemented, consented, monitored, and reliably delivered it; platform notices are not a substitute for an Layerwell claim.

### United States baseline

The federal Restore Online Shoppers' Confidence Act applies to online negative-option offers. FTC guidance summarizes three core requirements: clearly disclose all material terms before obtaining billing information, obtain express informed consent before charging, and provide a simple way to stop recurring charges.

California's amended Automatic Renewal Law has been effective since July 1, 2025. The California Attorney General states that it requires express affirmative consent and clear, straightforward cancellation; includes annual reminders; requires online cancellation at will for online enrollment; and imposes specified notices for annual renewals, longer free/discounted periods, and fee changes. Apple's subscription-management and notice machinery may satisfy some operational pieces, but Layerwell must not assume that platform delegation eliminates the developer/supplier's obligations. US counsel must map the actual App Store contract, paywall, communications, trial length, customer location, and division of responsibilities before California or a nationwide launch.

Other federal and state laws may apply. This memo is not a 50-state survey and cannot certify nationwide compliance.

### Canada baseline

The Competition Bureau states that materially false or misleading marketing is prohibited and that an advertised price generally must be attainable without later mandatory non-government charges. It also warns against fake savings, hidden total cost, false scarcity cues, and burying key renewal/payment information. Use the StoreKit total localized price, ensure any savings claim uses a real comparison, and never add an Layerwell mandatory fee after the displayed price.

Apple documents availability by App Store country or region and lists Canada as a single territory. It does not document an App Store control for excluding Quebec while distributing elsewhere in Canada. Accordingly, this memo treats any Canadian release as a Quebec release unless Apple provides a different verified control in the actual account.

The Office québécois de la langue française states that customers of businesses active in Quebec have the right to be informed and served in French before, during, and after a transaction, through the business's communication channels and under equivalent/comparable service conditions. Its current adhesion-contract guidance says new adhesion contracts generally must first be provided in French; for a contract made through a technological means, the applicable French clauses must be provided or the technological means — expressly including a mobile app — must be available in French with the French contract accessible. The OQLF also identifies French requirements for commercial publications and the right to a complete French website, subject to defined exceptions.

The founder must not interpret that summary as a minimum translation checklist. Before Canadian availability, Quebec counsel must review the French app UI and paywall, App Store metadata and screenshots, Terms and subscription agreement, Privacy Policy and consent text, cancellation/refund/support documents, customer support channels and service levels, claims/catalog content, notifications/emails, accessibility, and any legally available language-choice mechanism. National and other provincial requirements still apply.

Ontario's currently in-force Consumer Protection Act, 2002 includes disclosure, delivery, express accept/decline, error-correction, and cancellation rules for covered internet agreements. Ontario's Consumer Protection Act, 2023 is listed by e-Laws as not yet in force as of this memo's date, so it must be monitored rather than treated as operative law. Whether Apple, Layerwell, or both are the relevant supplier for any duty requires Ontario counsel to analyze the real agreements and flow.

CRA's registration and GST/HST rules also require entity-specific review. Apple tax forms, App Store tax treatment, and the developer's own sales-tax/income-tax duties are separate questions. A Canadian CPA and counsel must approve the launch posture.

### Prohibited dark patterns and sensitive pricing

Do not ship:

- a preselected consent, purchase action disguised as navigation, or accidental StoreKit invocation;
- a hidden close control, obstructed back path, repeated modal trap, or harder downgrade/cancellation path;
- a countdown, “only today,” inventory, popularity, or “last chance” claim unless it is true, substantiated, and tied to an actual offer deadline;
- guilt, shame, fear about acne/appearance, social pressure, or loss-framed copy aimed at forcing purchase;
- “free,” “risk free,” or “no cost” without the immediate complete billing consequence;
- a tiny renewal price, obscured billed total, hard-to-read contrast, or savings claim based on a price that was not genuinely offered;
- forced health answers, skin photos, notifications, contacts, tracking consent, review, or sharing as the price of dismissing or evaluating a paywall;
- personalized price or discount based layerwell photos, inferred condition, health-related data, age, skin tone, consent status, or another sensitive/protected trait;
- a fake testimonial, unsubstantiated medical/performance claim, guaranteed result, guaranteed savings, or guaranteed income/business outcome.

Accessibility is part of informed choice: disclosures and controls must work with VoiceOver, Dynamic Type, contrast requirements, reduced motion where relevant, switch/keyboard inputs where supported, and all launch-floor device sizes.

## Explicit uncertainty register

These unknowns can materially change the recommendation and must remain visible:

1. **Legal entity and tax residence:** not established in this memo; determines contracts, tax, bank, and professional advice.
2. **Apple associated accounts and Small Business Program status:** not verified; 15% economics cannot be booked until eligibility and enrollment are confirmed.
3. **Standard-commission transition:** timing and subscription-tenure mix are unknown; the 22.5% blend is only a sensitivity.
4. **Tax category and embedded tax mix:** not selected or validated; actual storefront proceeds can differ materially.
5. **Canada GST/HST and provincial obligations:** entity, supplies, registration, place-of-supply, and Apple's role require CPA/counsel analysis.
6. **Canada/Quebec readiness and exact later-country prices:** French-language and Quebec/national legal scope is not approved, no Canadian or later-country tiers are approved, and comparable pricing plus actual estimated proceeds must be reviewed in App Store Connect.
7. **Reverse preview plus Apple trial:** real eligibility, copy comprehension, analytics, and state transitions have not been proven end to end.
8. **Product value and willingness to pay:** US$49.99 has no Layerwell causal experiment yet.
9. **Refund, conversion, retention, and reactivation:** only external benchmarks exist; selection bias and category mismatch are material.
10. **Variable service cost:** US$1–US$8 is a placeholder range; AI/compute, media, storage, support, and moderation usage are not measured.
11. **Fixed operating plan and acquisition cost:** no approved budget exists, so after-fixed-cost operating net and after-tax profit are not forecast.
12. **RevenueCat commercial terms:** public pricing can change; the live contract, tracked-revenue definition, taxes, and invoice must be checked.
13. **App Review and legal outcome:** neither can be guaranteed; policy and law can change before submission.
14. **Country readiness:** US is the only provisional Wave 1 recommendation; Canada/Quebec and every later country remain closed until their named gates pass.

## Founder approval gate

PAY-01 remains blocked until the founder records an explicit answer for every item below. “Approve all” is acceptable only if it intentionally covers every numbered decision and open condition.

- [ ] **PAY01-A01 — Seven-figure metric:** approve separate reporting of collected gross billings, estimated Apple proceeds before developer income/corporate tax, platform/vendor net, contribution net, operating net before developer tax, and after-tax profit; select which one is the primary company target.
- [ ] **PAY01-A02 — Base US prices:** approve US$49.99 annual, US$9.99 monthly, and no weekly plan.
- [ ] **PAY01-A03 — Reverse preview:** approve seven app-granted days with no payment method and no renewal, plus the required terminology and free-data preservation.
- [ ] **PAY01-A04 — Apple introduction:** choose seven-day annual Apple trial as recommended, retain the earlier 14-day proposal, choose no store trial, or authorize a later controlled duration test; approve the non-stacking/clear-disclosure rule.
- [ ] **PAY01-A05 — Launch promotions:** approve no pay-up-front/pay-as-you-go introductory discount and no offer-code acquisition campaign at launch.
- [ ] **PAY01-A06 — Win-back:** approve no day-one win-back and require a later founder-approved eligibility, price, duration, storefront, iOS-version, and experiment plan based on live lapse data.
- [ ] **PAY01-A07 — Country sequence:** approve provisional Wave 1 US only; Canada as Wave 2 only after French app/store/support/contracts plus Quebec and national legal/privacy/tax/consumer/claims/accessibility/QA gates; and Wave 3 UK/Australia/New Zealand/Ireland after their country gates. Approve all unopened storefronts remaining disabled by default.
- [ ] **PAY01-A08 — Base storefront and localization:** approve who will select the base storefront, the use of Apple's comparable prices as a starting point, manual review of each local price/proceeds value, founder approval of the exact future Canadian tier, and a qualified Quebec localization/legal owner. Confirm that no province-exclusion availability assumption will be used for Canada.
- [ ] **PAY01-A09 — Apple fee posture:** disclose all associated developer accounts, verify/enroll in the Small Business Program if eligible, and approve operating the model under a 30% fallback/transition case.
- [ ] **PAY01-A10 — Tax/legal gate:** identify the legal entity and authorize qualified US/California/Canada counsel and a Canadian/US tax professional to approve tax category, GST/HST, tax forms, automatic-renewal duties, and launch countries.
- [ ] **PAY01-A11 — Model inputs:** approve or replace the four tax/commission/refund/RevenueCat/service-cost scenarios and provide the annual fixed/semi-fixed operating budget and acquisition-cost treatment.
- [ ] **PAY01-A12 — Experiment charter:** approve the primary metric, full renewal caveat, power/sample budget, assignment method, guardrails, quantitative pause thresholds, and named decision owner.
- [ ] **PAY01-A13 — RevenueCat budget:** approve use of the public free-through-US$2,500-MTR/1%-thereafter planning assumption subject to contract verification; name the procurement owner.
- [ ] **PAY01-A14 — PAY-02 authority:** separately authorize product creation/configuration only after PAY-01, brand, legal/tax, account, catalog, entitlement, QA, and rollback prerequisites are satisfied. This memo itself grants no such authority.

Record approval with founder name, date, selected alternatives, constraints, and links to professional advice. Any materially different price, trial, country, fee assumption, or target definition reopens PAY-01.

## Implementation handoff after approval

Only after PAY01-A01 through A14 are resolved:

1. Freeze the approved product IDs, subscription group, entitlement mapping, base storefront, exact localized prices, availability, offers, and tax category in a reviewed catalog contract.
2. Create products in App Store Connect and mirror them in RevenueCat through PAY-02's controlled, auditable procedure.
3. Implement StoreKit/RevenueCat purchase and entitlement state without relying on client-only flags; verify server notifications and reconciliation.
4. Implement copy from StoreKit localized values and reviewed terms, with no hard-coded currency or eligibility promise.
5. Test the complete human flow on the actual launch-floor iOS devices/simulators: preview, eligible/ineligible intro, purchase, cancel renewal, restore, refund, grace/retry, expiration, relaunch, offline, reinstall, account transfer/cross-device where supported, and free-data preservation.
6. Capture evidence, run repository gates, complete legal/tax/App Review checklists, and exercise rollback before release.
7. Reconcile the first live cohorts to Apple financial reports monthly and replace every placeholder in this model with observed values.

## Official primary sources

Sources were checked on 2026-07-13. Pricing, law, platform policy, reports, and vendor terms can change; re-check every source immediately before PAY-02 and submission.

### Apple

- [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/) — 15% commission, US$1 million proceeds threshold, associated accounts, and threshold transition.
- [Manage availability for your app](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store) and [Financial-report regions and currencies](https://developer.apple.com/help/app-store-connect/reference/reporting/financial-report-regions-and-currencies/) — availability at the country/region level and Canada as one listed territory.
- [Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/) — subscriber-year 70%/85% proceeds, Small Business Program treatment, and paid-service clock.
- [Offer auto-renewable subscriptions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions) — proceeds and billing-grace-period mechanics.
- [Set a price](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/) — price points, base storefront, comparable pricing, currencies, and overrides.
- [Manage subscription pricing](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions/) — subscription price changes, tax/FX treatment, consent, and price preservation.
- [View payments and proceeds](https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds) and [Overview of receiving payments](https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments) — proceeds definition, agreements, banking/tax, thresholds, timing, FX, and fees.
- [Set an app tax category](https://developer.apple.com/help/app-store-connect/manage-app-information/set-a-tax-category) and [Set an IAP tax category](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/set-a-tax-category-for-in-app-purchases) — tax-category responsibilities.
- [Download financial reports](https://developer.apple.com/help/app-store-connect/getting-paid/download-financial-reports) — authoritative financial, refund, and tax reporting.
- [Set up introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions) and [IAP/subscription pricing and availability reference](https://developer.apple.com/help/app-store-connect/reference/pricing-and-availability/in-app-purchase-and-subscriptions-pricing-and-availability) — offer types, one-per-group eligibility, and durations.
- [Set up win-back offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-win-back-offers) and [Set up offer codes](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes) — offer eligibility, limits, and OS surfaces.
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — in-app purchase, subscriptions, continuing value, disclosure, misleading behavior, privacy, and review rules.
- [Human Interface Guidelines: In-app purchase](https://developer.apple.com/design/human-interface-guidelines/in-app-purchase) — localized total price, trial conversion disclosure, restoration, and customer-centered presentation.
- [Download and view reports](https://developer.apple.com/help/app-store-connect/measure-app-performance/download-and-view-reports/) — transaction and refund reporting, including partial/pro-rated outcomes.
- [Provide tax information](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information) — required developer tax forms, including Canada context.

### RevenueCat

- [State of Subscription Apps 2026 interactive report](https://www.revenuecat.com/state-of-subscription-apps-2026-productivity/) — sample/methodology and the conversion, trial, price, plan-mix, retention, refund, cancellation, reactivation, RPI, and LTV benchmarks used here.
- [2026 report overview and methodology](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/) — scope, interpretation, and selection limitations.
- [RevenueCat pricing](https://www.revenuecat.com/pricing/) — current monthly-tracked-revenue threshold and percentage pricing.
- [Account management and MTR](https://www.revenuecat.com/docs/welcome/set-up-revenuecat/account-management) — monthly tracked revenue definition and billing context.
- [Taxes and commissions](https://www.revenuecat.com/docs/dashboard-and-metrics/taxes-and-commissions) — estimated proceeds calculations and Apple-report reconciliation caveat.

### Regulators and tax authorities

- [FTC ROSCA recap](https://www.ftc.gov/business-guidance/blog/2018/07/time-rosca-recap-ftc-says-risk-free-trial-was-risky-not-free) — material-term disclosure, express informed consent, and simple stopping mechanism for online negative options.
- [California Attorney General: Automatic Renewal Law](https://oag.ca.gov/news/press-releases/attorney-general-bonta-issues-consumer-alert-california%E2%80%99s-automatic-renewal-law) — July 1, 2025 amendments, consent, reminder/notice, and cancellation requirements.
- [Competition Bureau Canada: misleading representations](https://competition-bureau.canada.ca/en/deceptive-marketing-practices/types-deceptive-marketing-practices/misleading-representations-and-deceptive-marketing-practices), [drip pricing](https://competition-bureau.canada.ca/en/deceptive-marketing-practices/drip-pricing), and [digital informed choice](https://competition-bureau.canada.ca/en/how-we-foster-competition/collaboration-and-partnerships/digital-design-support-informed-consumer-choices) — general impression, attainable total price, fake savings/scarcity, and manipulative design.
- [CRA: when to register and charge GST/HST](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html) — small-supplier threshold and registration timing baseline.
- [Ontario Consumer Protection Act, 2002](https://www.ontario.ca/laws/statute/02c30) and [Ontario Consumer Protection Act, 2023](https://www.ontario.ca/laws/statute/23c23) — current internet-agreement baseline and not-yet-in-force successor status as of the research date.
- [OQLF: language of service](https://www.oqlf.gouv.qc.ca/francisation/entreprises/langue-de-service.html), [OQLF: adhesion contracts](https://www.oqlf.gouv.qc.ca/francisation/entreprises/contrats-adhesion.html), and [OQLF: consumer language rights](https://www.oqlf.gouv.qc.ca/francisation/droits_linguistiques/droits/langue-du-commerce-et-des-affaires.html) — French information/service, technological/mobile contracting, adhesion-contract, and commercial-publication requirements and guidance for Quebec.

## Final recommendation state

**Recommend conditionally:** US$49.99 annual / US$9.99 monthly / no weekly; seven-day no-card non-renewing reverse preview; provisionally a seven-day Apple annual intro only; no paid intro or win-back at launch; provisional US-only Wave 1; Canada only as a later wave after French app/store/support/contracts and Quebec/national gates; Apple IAP; Small Business Program economics only after verified eligibility; plan against a 30% downside; judge experiments on contribution LTV and trust, not conversion alone.

**Gate remains closed:** founder approvals PAY01-A01 through PAY01-A14, legal/tax advice, account eligibility, exact storefront prices, catalog/entitlement design, real variable/fixed-cost inputs, and human-simulated purchase lifecycle evidence are still required. No account or product configuration is authorized by this memo.
