# Phase 8 Acquisition Dashboard

The dashboard must show whether the public growth loop creates qualified users without leaking sensitive context.

## Conflict-card measurement boundary

The current share-card exporter and `/s/:shareId` destination exist only for a
conflict card. They emit no analytics and carry no campaign, content, creative,
build, platform, or share-ID attribution query. A generic event name would not
make this safe: its conflict-only execution context would still reveal
health-adjacent interaction state. Measure the ordinary, non-clinical product
and routine funnel only after the recipient independently enters those surfaces.

## Non-clinical acquisition funnel

| Stage                  | Event                           | Required dimensions                  |
| ---------------------- | ------------------------------- | ------------------------------------ |
| Store click            | `store_click`                   | `store`, `source`, `campaign`        |
| Install attributed     | `install`                       | `store`, `source`, `campaign`        |
| Onboarding started     | `onboarding_started`            | reviewed non-clinical source buckets |
| First product added    | `first_product_added`           | reviewed non-clinical source buckets |
| First reviewed insight | `first_reviewed_insight_viewed` | reviewed non-clinical source buckets |
| Trial started          | `trial_started`                 | `store`, reviewed source buckets     |
| Paid started           | `paid_started`                  | `store`, reviewed source buckets     |

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
- Any telemetry or attribution appears on the conflict-only exporter or link
  destination: stop release and purge the affected events.
- Share-card export failures in supported-device QA exceed the reviewed
  threshold: stop public share.
- App-link fallback mismatch above 2% in device QA: stop public share.
- Store review average drops below launch threshold: pause creator/paid tests and inspect support themes.
- Refund/cancel reason points to misleading claims: pull metadata and creative.
