# Phase 9 Edge Function Auth Matrix

| Function | Mode | Required proof |
| --- | --- | --- |
| `account-deletion` | User JWT required | Missing auth is 401; caller can delete only self; Apple/PostHog/RevenueCat/storage failures do not return false success. |
| `data-export` | User JWT required | Missing auth is 401; export rows are caller-scoped; service-role reads are filtered by user ID or user click tokens. |
| `subscription-grants` | User JWT required | Missing/wrong auth rejected; only current caller receives a grant. |
| `catalog-search` | User JWT required | Missing auth rejected; service-role search writes lookup event only for caller. |
| `catalog-lookup` | User JWT required | Missing auth rejected; barcode/query sanitized; lookup event belongs to caller. |
| `catalog-report` | User JWT required | Missing auth rejected; correction/report rows belong to caller. |
| `revenuecat-webhook` | External webhook | Supabase JWT disabled only with RevenueCat auth/HMAC verification; replay/stale/duplicate events covered. |
| `order-report-poll` | Scheduled service | Inert without ShopMy key; requires scheduler secret/owner approval before activation. |
| `growth-event` | Public web endpoint | Event and props allowlisted; no contact/health/product/barcode payloads accepted. |
| `waitlist` | Public web endpoint | Email validated; attribution allowlisted and sanitized. |

Strict Phase 9 signoff requires live negative tests for missing auth, forged auth, wrong-user access, webhook signature failure, stale webhook signature, duplicate webhook delivery, and log review.
