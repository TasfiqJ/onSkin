# Optional browser r3 driver API diagnostic

The adaptive onboarding category check incorrectly called the harness's internal `controlExpression` helper as an exported function. The run stopped at `TypeError: b.controlExpression is not a function`, before optional-feature interaction. The driver now uses the harness's existing exported `enabledControlExpression` to detect the category picker by its accessibility label. This changes only the test driver; original logs, screenshots and exit receipt remain retained.
