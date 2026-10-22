# Exact-head CI observations

Provider metadata and relevant raw static-job log were independently read. Re-query when acting. A successful continued step label cannot erase a raw nonzero result. This record is not protected acceptance.

```json
{
  "observed_at_utc": "2026-10-20T19:45:14+00:00",
  "head_commit": "31307694ebb9895ed8cfb77fa6ac532b789d2810",
  "head_tree": "c52f49d6f3dfa8cdee98d4a26c707ad8747576d0",
  "event": "pull_request",
  "checkout_commit": "a54d9bd4d70fc1757f0828a8d69be48604941257",
  "checkout_tree": "c52f49d6f3dfa8cdee98d4a26c707ad8747576d0",
  "checkout_parents": [
    "bbc28dc3d1f945191a81be56945b8bda7bb6ef73",
    "31307694ebb9895ed8cfb77fa6ac532b789d2810"
  ],
  "tree_equality_independently_verified": true,
  "quality": {
    "run_id": 39483363359,
    "workflow_id": 312030668,
    "status": "in_progress",
    "conclusion": null,
    "repository_job": {
      "id": 118837969888,
      "conclusion": "success"
    },
    "canonical_database_job": {
      "id": 118837969766,
      "status": "in_progress",
      "conclusion": null
    },
    "pg15_job": {
      "id": 118837969712,
      "conclusion": "success"
    },
    "pg17_job": {
      "id": 118837969992,
      "conclusion": "success"
    },
    "exports": [
      {
        "platform": "android",
        "job_id": 118840780888,
        "conclusion": "success"
      },
      {
        "platform": "ios",
        "job_id": 118840781089,
        "conclusion": "success"
      }
    ]
  },
  "security": {
    "run_id": 39483363438,
    "workflow_id": 308213475,
    "status": "completed",
    "conclusion": "failure",
    "static_job": 118837379401,
    "secret_job": 118837379015,
    "secret_conclusion": "success",
    "code_job": 118837379325,
    "code_conclusion": "success",
    "live_job": 118837383836,
    "live_conclusion": "skipped",
    "source_acceptance_job": 118840279042,
    "source_acceptance_conclusion": "failure",
    "raw_observed_refusals": [
      "SOURCE_INVENTORY_DRIFT",
      "braces: review is expired or dates are invalid",
      "node-forge: review is expired or dates are invalid",
      "unreviewed OSV advisory: vite@8.1.3:GHSA-698v-4r3x-3vcv",
      "unreviewed OSV advisory: mcp@1.29.0:GHSA-84m7-p3x7-pcfv"
    ],
    "interpretation": "Observed raw refusals, not an independent advisory applicability/exploitability assessment. Continued workflow steps do not erase nonzero raw results."
  },
  "ios_launch_contract": {
    "run_id": 39483363534,
    "workflow_id": 312030667,
    "status": "completed",
    "conclusion": "success",
    "axis": "SOURCE_ONLY"
  },
  "proposal_notAfter": "2026-10-21T00:00:00Z",
  "protected_source_go": false,
  "main_promotion_authorized": false,
  "historical_quality_recovery": {
    "head": "fdf040cf28a4b3576f98b60d3b8d96a54bf689b0",
    "run_id": 39470402671,
    "canonical_db_job": 118793354045,
    "conclusion": "success",
    "may_be_borrowed_for_new_head": false
  },
  "refresh_rule": "Refresh actual source/head/run/checkout and results on next execution. Pending is not PASS; expiry must not be renewed mechanically."
}
```
