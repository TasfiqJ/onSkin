# Phase 8 Acquisition Dashboard

The dashboard must show whether the public growth loop creates qualified users without leaking sensitive context.

## Funnel

| Stage | Event | Required dimensions |
| --- | --- | --- |
| Share card exported | `share_card_export_succeeded` | `creative_variant`, `share_id` |
| Share link opened | `landing_viewed` | `source`, `campaign`, `creative_variant`, `share_id`, `platform` |
| Store click | `store_click` | `store`, `source`, `campaign`, `share_id` |
| Install attributed | `install` | `store`, `source`, `campaign` |
| Onboarding started | `onboarding_started` | `source`, `campaign` |
| First product added | `first_product_added` | `source`, `campaign` |
| First reviewed insight | `first_reviewed_insight_viewed` | `source`, `campaign` |
| Trial started | `trial_started` | `source`, `campaign`, `store` |
| Paid started | `paid_started` | `source`, `campaign`, `store` |

## Privacy Rules

Never include:

- Product names or IDs
- Ingredient names
- Rule IDs
- Skin profile, goals, concerns, pregnancy status
- OCR text, photo path, image URI, note text
- Email, phone, address, user ID

## Seven-Figure Operating View

Track weekly:

- Qualified installs
- Install to first product
- First product to reviewed insight
- Trial start rate
- Trial to paid rate
- Annual subscriber count
- Gross ARR
- Net ARR after store fee
- Support tickets per 1,000 installs
- Store rating trend and review themes

## Alert Thresholds

- Any sensitive analytics key appears: stop release and purge bad events.
- Share card export failure rate above 5% on supported devices: stop public share.
- App-link fallback mismatch above 2% in device QA: stop public share.
- Store review average drops below launch threshold: pause creator/paid tests and inspect support themes.
- Refund/cancel reason points to misleading claims: pull metadata and creative.
