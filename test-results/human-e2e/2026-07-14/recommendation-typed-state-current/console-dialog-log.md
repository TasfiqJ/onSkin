# Console and dialog log

- Browser `error` entries: `0`
- JavaScript dialogs: none
- Raw recommendation storage codes in UI: none

Expected warnings observed during the local-preview run:

- blocked placeholder Supabase URL/publishable key (`B-SUPABASE`)
- Expo notifications listener limitation on web
- repeated GoTrue client warning across deliberate dev-server restarts
- Metro disconnect warnings caused by deliberately stopping each fixture server
- best-effort Shelf mirror warnings while the authenticated backend was intentionally unavailable

No warning indicated recommendation-state deletion, default fallback, React render failure, unhandled rejection, failed local persistence, or late navigation. The delayed mobile dismissal rerun added no browser `error` entry or JavaScript dialog.
