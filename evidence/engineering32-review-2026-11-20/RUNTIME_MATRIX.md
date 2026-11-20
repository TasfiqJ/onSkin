# Engineering32 finite runtime matrices

All38/all18 UNACCEPTED. Ordinary startup/handoff, induced contention, command recovery and historical assisted evidence are separate.

## First app execution (inert status page before app navigation)

| Size | Repeat | Startup | Reload | Direct | History return | Automatic/manual Retry |
|---|---|---|---|---|---|---|
| 375×667 | 1 | admitted | admitted | admitted | admitted | 0 / 0 |
| 375×667 | 2 | admitted | admitted | admitted | admitted | 0 / 0 |
| 375×667 | 3 | admitted | admitted | admitted | admitted | 0 / 0 |
| 390×844 | 1 | admitted | admitted | admitted | admitted | 0 / 0 |
| 390×844 | 2 | admitted | admitted | admitted | admitted | 0 / 0 |
| 390×844 | 3 | admitted | admitted | admitted | admitted | 0 / 0 |
| 430×932 | 1 | admitted | admitted | admitted | admitted | 0 / 0 |
| 430×932 | 2 | admitted | admitted | admitted | admitted | 0 / 0 |
| 430×932 | 3 | admitted | admitted | admitted | admitted | 0 / 0 |

Each checked document made exactly one exclusive request. The complete traces retain document/request IDs and callback timing. No query snapshot granted admission.

## Committed connected journey

| Size | Repeat | Unassisted journey | Apply / clear / retraction process restarts | Actual withdrawal/restart |
|---|---|---|---|---|
| 375×667 | 1 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 390×844 | 1 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 430×932 | 1 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 375×667 | 2 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 390×844 | 2 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 430×932 | 2 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 375×667 | 3 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 390×844 | 3 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |
| 430×932 | 3 | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |

Committed runtime-only handoff matrix: nine additional fresh profiles, three at each size, with all four navigation outcomes admitted using one request. The older helper initially creates an app target before tracing; first-app qualification therefore comes from the separate status-page probe above.

## Induced states

| Probe | Case | Result | Visible Retry actions |
|---|---|---|---|
| committed runtime | transient closing holder | PASS | 0 |
| committed runtime | live second tab | PASS | 1 |
| committed runtime | pending document reload termination | PASS | 0 |
| committed runtime | unsupported | PASS | 0 |
| committed runtime | denied | PASS | 0 |
| committed runtime | raw storage denial and unsupported schema | PASS | 0 |
| first document | transient closing holder | PASS | 0 |
| first document | live second tab | PASS | 1 |
| first document | pending document reload termination | PASS | 0 |
| first document | unsupported | PASS | 0 |
| first document | denied | PASS | 0 |
| first document | raw storage denial and unsupported schema | PASS | 0 |

The two visible Retry actions recover intentionally induced sustained contention after the real holder closes. Ordinary journeys use none. These are explicit user recovery, not a supervisor.

## Retained failed declared series

| Repeat | 375×667 | 390×844 | 430×932 |
|---|---|---|---|
| 1 | PASS | FAILED: missing canonical source; safe refusal | NOT_RUN |
| 2 | NOT_RUN | NOT_RUN | NOT_RUN |
| 3 | NOT_RUN | NOT_RUN | NOT_RUN |

Later queued work at that earlier source was NOT_RUN. Its logs, original evidence hashes, failure screenshot and independent source diagnostic remain retained. Every earlier qualification failure is listed in ALL_EXECUTION_RECEIPTS.json and ROOT_CAUSE.md. Engineering31 remains externally assisted (29 visible Retry actions), with no reclassification.
