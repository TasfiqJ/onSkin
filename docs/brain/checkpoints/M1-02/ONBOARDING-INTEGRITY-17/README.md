# Campaign17 privacy and re-entry integrity candidate

Authority: BRAIN-M1X-PRIVACY-REENTRY17-REPAIR-01. Authenticated R1 input manifest SHA256: `d2c9cbf835145ba4f98bc1c4162e9264ff81b4ce4982951c3d20e36c2b98a628`.

Draft [PR21](https://github.com/TasfiqJ/onSkin/pull/21), branch `stage/m1-first-session-integrity17`, targets PR20's `stage/m1-first-session-recovery16`. Immutable base `28953aa3a84fed0684b80b442d0cd9c2de0663b2`, tree `6776b61b49c63345e992da63f82920fedd07518b`. Frozen source `27b2171385a56cace13d485e2a5280da1d45dcf1`, tree `a084d538d3d45e92f40103623376fe77b5b8b733`. Runtime/code freeze `2f70429be4233d45cf48ea5acf4a0e6e1f9be727`, tree `e25556dc666365e858424d13da871a1d2a03cd74`; the last source commit contains only the unchanged Phase4 producer's two outputs.

Authenticate with the external checkpoint manifest SHA256 supplied in the return and PR description:

```text
python -B docs/brain/checkpoints/M1-02/ONBOARDING-INTEGRITY-17/verify17.py --expected-manifest-sha256 <external-sha256> --git-root .
```

Without `--git-root`, this authenticates only the finite artifact and member bytes. With a complete clean delivery checkout it also checks all baseline/source Git objects and SHA256 witnesses, the exact source commit chain, changed file witnesses, and exactly one five-path evidence-only tail. It derives the delivery HEAD/tree. Run the unchanged source checker separately; artifact verification is not source, release or qualified Security/DB acceptance.

`payload.zip` contains the report, every changed source snapshot, all 23k-plus baseline/source object witnesses, per-commit changes, exit-coded command receipts, actual Expo-web PNGs and browser logs, explicit failed exploratory attempts, and separate complete-checkout and simulated-fixture proofs. Browser console/network evidence has no request bodies, headers, DOB, raw quiz responses or owner identifiers. Browser profiles/storage and export binaries are excluded.

PARTIAL_BLOCKED / SUBMITTED_REVIEW_REQUIRED. Four protected historical navigation tests mount Quiz without an owner lease and fail under the repaired admission; they remain unchanged. Provider-wide private draft owner tagging/retirement in protected `OnboardingContext.tsx` remains UNAPPLIED. The route masks unknown inherited drafts and requires an explicit current-lease reset. It does not claim provider-wide cleanup while unmounted.

The evidence tail's own SHA/tree and exact final-head CI cannot be embedded in its own payload without a circular identity. They are supplied after the tail in the external `FINAL_REPORT.md`, return manifest and PR description. Source-head CI is separately labelled and never borrowed as final-head CI.

G97 FAIL/NO_GO; original Security findings remain privately undispositioned. DB06/DB08/R2B NOT_ACCEPTED; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED. J01 G1/G2/G3/G5 and longitudinal G4 remain closed. F09 remains required; F18 and J02–J27/J05 remain deferred. Installed iPhone, genuine OS notifications, native keyboard/Dynamic Type, VoiceOver, signed build, providers, paid services, clinical/legal, Apple review and public release remain NOT_RUN/CLOSED. No merge, auto-merge or maintainer modification. USD0 incremental spend.
