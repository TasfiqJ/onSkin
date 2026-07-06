# Code Review Checklist

## Review Checklist

- Does the change match the relevant source-of-truth doc?
- Is the scope limited to the requested feature or launch gate?
- Are unrelated user changes preserved?
- Are launch-readiness statuses updated if affected?
- Are new assumptions labeled or documented?

## Security Checklist

- RLS remains owner-scoped.
- No service-role logic leaks to client.
- No health/photo/product notes in logs.
- No tokens, URLs, order IDs, or raw provider errors in generated evidence.
- Input validation exists for user-entered text, barcode, URLs, and Edge Function bodies.
- Rate limits exist for public functions where relevant.

## UX Checklist

- User can recover from failure.
- No dead-end scan, OCR, camera, payment, or permission states.
- Copy is calm and claim-safe.
- Buttons meet 44 pt minimum.
- Text fits on small phones and with larger text.
- Empty/loading/error/success states exist.

## Data Checklist

- Data model is owner-scoped.
- Sensitive data has consent coverage.
- Deletion/export behavior is considered.
- Local-only claims are literally true.
- Catalog source/provenance is preserved.
- Analytics payloads are privacy-safe.

## Testing Checklist

- Unit tests cover deterministic logic.
- Integration tests cover cross-feature contracts.
- UI-facing change has human-simulated E2E evidence.
- Device-dependent change has device QA or is marked blocked.
- Claim-safety tests updated when copy changes.

## Performance Checklist

- No unnecessary render loops.
- Local stores handle empty/corrupt state.
- Camera/photo routes avoid excessive memory use.
- Catalog queries are indexed or cached.
- Edge Functions return quickly and do not block webhook acknowledgements.

## Definition Of Approval

A review can approve when:

- behavior is correct
- tests/evidence match risk
- no trust/privacy/legal gates are weakened
- public copy stays within approved claims
- docs are updated where needed
- remaining risks are explicit
