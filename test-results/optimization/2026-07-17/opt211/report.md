# OPT-211 measured route ownership report

- Parent SHA: `f3de3ea12223820abac8114d51a929e1ef74a4ea`
- Route source files: 93
- Routes over 500 lines: 17
- Profiler- or test-proven ownership splits: 7
- Missing measured boundaries: 0
- Missing evidence markers: 0
- Unmeasured oversized routes intentionally left unchanged: 10

The pass condition is not a line-count target. It protects the seven existing
React render/ownership boundaries and the evidence that justified them while
preventing an arbitrary extraction claim for the ten unmeasured routes.
