# Stage branch protocol

Continue `stage/m1-retained-safety` from `7305ff24c78d2f9d883e26a7ba2a8e6169902fd8` after fresh fetch and ancestry/dirty-state checks. Do not create a new stage or reset it from main. One writer. Main and M0/PR8 are read-only; PR9 remains draft/unmerged. Normal commits and pushes only, never force-push, destructive reset or shared-history rewrite.

Push safe coherent milestones and root ONSKIN_BRAIN_HANDOFF.txt at every session end even when partial or red. Safe partial work is preferable to lost local work, but restricted files/credentials and unauthorized source changes must never be pushed. PUSH_BLOCKED stays explicit. Refresh refs before push and reconcile normal concurrent remote commits safely. No merge without a later exact-head Brain authorization.
