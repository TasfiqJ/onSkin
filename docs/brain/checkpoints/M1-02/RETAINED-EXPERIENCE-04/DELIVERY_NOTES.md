# Delivery verification correction

The first evidence-tail commit omitted 56 raw `.log` files because the existing
ignore rules excluded them. The committed verifier correctly refused that
incomplete Git-blob set. Its actual nonzero output is retained in
`receipts/evidence-verifier-first-refusal.log`. A forward evidence-only correction
adds the exact ignored checkpoint logs, regenerates the execution index and byte
manifest, and reruns the unchanged checks. No ignore rule, source, gate or original
test was changed. The original incomplete evidence commit remains in history.
