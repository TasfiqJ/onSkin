# Master Plan Update Patch

Use this format when a future chat, researcher, or Codex session proposes changing the product, architecture, pricing, launch, legal, or growth plan.

## Patch Format

```markdown
# Master Plan Update Patch

Date:
Author:
Status: Proposed / Accepted / Rejected / Superseded

## Change Proposed

Describe the exact change.

## Reason / Evidence

List evidence. Label each item:

- [Researched]
- [Confirmed]
- [Assumption]
- [Needs Research]
- [Open Question]

## Affected Docs

- docs/MASTER_PLAN.md
- docs/PRODUCT_REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/FEATURE_INDEX.md
- docs/ROADMAP.md
- docs/DECISIONS.md
- docs/TESTING_STRATEGY.md
- docs/CODE_REVIEW.md
- other:

## Affected Features

List feature numbers and names.

## Risk

- Product risk:
- Market risk:
- Technical risk:
- Privacy/legal risk:
- Revenue risk:
- UX risk:

## Recommendation

Pick one:

- Accept now
- Accept after validation
- Reject
- Research first
- Defer

## Validation Plan

Explain what must be measured or checked.

## Implementation Notes

Explain how Codex should apply the change if accepted.
```

## Rules

- Do not silently change the master plan.
- Do not introduce new public claims without source and review.
- Do not add vendors touching health/photo/payment data without privacy review.
- Do not change pricing without saying how it affects the $30k/month subscriber math.
- Do not change architecture without alternatives and a decision matrix.
