# Campaign21 audit evidence

Existing delivery bytes uploaded at the founder's request. SOURCE_ONLY_CANDIDATE; audit incomplete; public release NO_GO. No acceptance, merge or product release is granted.

- [Actual return ZIP](./onSkin_Campaign21_F09_Layout_Compatibility_Return_2026-10-27.zip)
- [Complete final report](./FINAL_REPORT.md)
- [Return manifest](./return_manifest.json)
- [Return verifier](./verify_return21.py)
- [SHA-256 checksums](./SHA256SUMS.txt)

The ZIP is byte-identical to the previously delivered file: 64838fd20b2ddd1b1aed1f984da1db6359f0b96221c61a772c11f0af77b87b72.
Return manifest external SHA-256: 3813d3160bf62141bbc9194db320da56faa5ace21d6d34b3ee84bb926d75e345.

This evidence-only branch has independent history and no workflows. The reviewed source remains [draft PR25](https://github.com/TasfiqJ/onSkin/pull/25) at 2cffa9e92be101af4e3b371f1815ec9f458d8da4. PR24, PR25 and main are unchanged by this upload. The report includes all qualifications and failed gates. USD0; no merges.

Verify without extracting:

```sh
python -B verify_return21.py --zip onSkin_Campaign21_F09_Layout_Compatibility_Return_2026-10-27.zip --expected-manifest-sha256 3813d3160bf62141bbc9194db320da56faa5ace21d6d34b3ee84bb926d75e345
```
