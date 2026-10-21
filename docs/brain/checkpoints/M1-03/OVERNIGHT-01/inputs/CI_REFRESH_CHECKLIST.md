# CI refresh and bounded execution

Fetch original Quality/Security/iOS runs for actual submitted SHA. Bind any PR merge checkout/tree/parents separately. Read failed/pending/skipped jobs and raw outputs, not just aggregate success-looking continue-on-error steps. Distinguish scanner execution errors, findings, coverage, source drift and expiry refusal.

Observe current runs with a bounded polling window; do not wait indefinitely, retry-until-green or issue repeated unrelated workflow dispatches. A final pending job is reported pending with its run ID and timestamp. Candidate experiments run locally and cannot create an alternative green acceptance badge. No new workflow/permissions/env variables, registry auth, provider keys or paid minutes are authorized.
