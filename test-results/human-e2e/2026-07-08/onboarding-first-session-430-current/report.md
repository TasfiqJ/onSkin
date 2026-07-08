# Human-Simulated E2E: First-Session Activation 320x430

Date: 2026-07-08
Surface: Expo web at http://localhost:8233
Viewport: 320x430
Reset fixture: /?e2eReset=local with EXPO_PUBLIC_E2E_LOCAL_RESET=1
Verdict: PASS

## Flow Covered

- Reset local private state and query cache, then confirmed Welcome rendered Begin.
- Completed age gate, goals, health consent, and quiz.
- Confirmed product intake started clean at 0 of 3 with Skip for now.
- Added Retinol 0.3% Night Serum, Glycolic 7% Toner, and Mineral SPF 50.
- Verified CTA/count states after each product: Add 2 more, Add 1 more, then Continue.
- Completed reveal, skipped notifications/account creation, and selected the no-card Explore first path on paywall.
- Verified generated routine plan: Mineral SPF 50 in morning, Glycolic 7% on Night 1, Retinol 0.3% Night Serum on Night 2.
- Checked off Today morning routine and Today PM Night 1 routine.

## Evidence

- 00-welcome-reset.png
- 01-products-empty-after-reset.png
- 02-product-count-after-one.png
- 03-product-count-after-two.png
- 04-product-count-after-three.png
- 05-paywall-explore-path.png
- 06-routine-plan.png
- 07-today-am-before-checkoff.png
- 08-today-am-after-checkoff.png
- 09-today-pm-before-checkoff.png
- 10-today-pm-after-checkoff.png
- summary.json

## Notes

- The previous contaminated run showed persisted shelf data on product intake. The new dev-only, env-gated reset fixture prevents that for first-session E2E without affecting production builds.
- Store checkout remains unavailable in local preview because production RevenueCat/store credentials are intentionally absent. The no-card exploration path was verified instead.
