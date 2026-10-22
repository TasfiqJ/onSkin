# Hard stop rules

1. Any external manifest digest mismatch; missing/altered context file; wrong exact base SHA/tree/branch; dirty source; moving PR head; prior duplicate writer; wrong original source/protected SHA256/Git blob/bytes. **Do not patch an authorization locally.**
2. Any need for changes outside exact listed allowlist, including new native Swift/widget patch, root manifest, Security source/test fixture, policy/expiry, Docker/ECR workflow, SQL/types/Edge, client runtime, clinical or release. Never combine QR02 and QR03 allowance.
3. New `expo-notifications` package integrity/source mismatch or unresolved graph, or extra hidden Expo incompatibility: after at most two meaningful bounded approaches, STOP with exact evidence. No `expo install --fix`, check exclusion, waiver, copied metadata, fake hashes or overwritten failures.
4. Any mapping installed source-pin or native package entry drift: mapping edit is FORBIDDEN; preserve error and stop. The only legal mapping modification is exactly three `lockIntegrity.packageLockSha256` values if all ten pins/four entries verify identical.
5. Any original Security adversarial negative test unexpectedly weakened, missing historical Git object without authentic approved recovery, exposure of patient or raw secret content, or published scanner credentials. No found-credential testing. No protected GO or expiry extension.
6. Cannot acquire canonical exact ECR image: preserve failure, no replacement/quota workaround/payments. No hosted replay.
7. Never self-accept, merge PR9, push to main, issue M2, deploy, sign, TestFlight, clinical activation or claim release acceptance.
