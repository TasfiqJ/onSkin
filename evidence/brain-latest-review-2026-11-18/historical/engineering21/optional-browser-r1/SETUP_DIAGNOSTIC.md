# Optional browser r1 setup diagnostic

The driver completed the visible adult eligibility and health-consent screens, then navigated directly from the goals screen to Today. This left the fresh synthetic profile and routine unset. Today correctly displayed `Your routine is unavailable. We could not confirm your saved routine, products or profile.`

No optional editor was opened and no optional event was created. The run stopped at the missing panel assertion, exited 1 in 101.64 seconds, and preserved `FAILURE.png`, `FAILURE.json`, `summary.json`, `steps.json` and its external command log/receipt. Both recorded helper PIDs were absent afterward.

This is a driver precondition defect rather than evidence of optional recovery failure. The next driver revision completes the actual existing goals, twelve-answer quiz, one synthetic manually added cleanser, profile reveal, notifications/account skips and free-plan continuation. It does not inject a profile, routine or health authority and does not activate a paid trial. It then begins the unchanged optional-change assertions.
