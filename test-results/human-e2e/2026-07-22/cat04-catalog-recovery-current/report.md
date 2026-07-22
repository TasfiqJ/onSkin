# CAT04 Catalog Recovery Expo-Web Audit

- Verdict: pass
- Surface: Expo web deterministic development fixtures
- Native-device proof: No
- Source Git SHA: 0d9a143dfb1b0e43425fb37777abc6ea98239a1f
- Limitation: This audit uses Expo web and deterministic development fixtures.
- Limitation: It does not prove native camera hardware, OS permission sheets, or physical-iPhone behavior.
- Limitation: The existing scan fixture seeds only the Scan screen; no production fixture drives lookupBarcode from an offline queued retry to a ready match. A restart-same-origin, Shelf-ready review accept/reject cycle therefore requires a real staging catalog and is deliberately not faked here.

## Explicit-consent bootstrap

| Fixture group | Viewport | Verdict | Error |
| --- | --- | --- | --- |
| matched | 375x667 | pass |  |
| matched | 390x844 | pass |  |
| matched | 430x932 | pass |  |
| no-match | 375x667 | pass |  |
| no-match | 390x844 | pass |  |
| no-match | 430x932 | pass |  |
| offline | 375x667 | pass |  |
| offline | 390x844 | pass |  |
| offline | 430x932 | pass |  |
| scan-error | 375x667 | pass |  |
| scan-error | 390x844 | pass |  |
| scan-error | 430x932 | pass |  |
| camera-recovery | 375x667 | pass |  |
| camera-recovery | 390x844 | pass |  |
| camera-recovery | 430x932 | pass |  |
| ocr-capture-failure | 375x667 | pass |  |
| ocr-capture-failure | 390x844 | pass |  |
| ocr-capture-failure | 430x932 | pass |  |

## Recovery scenarios

| Scenario | Viewport | Verdict | Error |
| --- | --- | --- | --- |
| search-matched | 375x667 | pass |  |
| scan-matched | 375x667 | pass |  |
| scan-wrong-match-recovery | 375x667 | pass |  |
| search-matched | 390x844 | pass |  |
| scan-matched | 390x844 | pass |  |
| scan-wrong-match-recovery | 390x844 | pass |  |
| search-matched | 430x932 | pass |  |
| scan-matched | 430x932 | pass |  |
| scan-wrong-match-recovery | 430x932 | pass |  |
| search-no-match | 375x667 | pass |  |
| scan-no-match | 375x667 | pass |  |
| search-no-match | 390x844 | pass |  |
| scan-no-match | 390x844 | pass |  |
| search-no-match | 430x932 | pass |  |
| scan-no-match | 430x932 | pass |  |
| search-offline | 375x667 | pass |  |
| scan-offline | 375x667 | pass |  |
| search-offline | 390x844 | pass |  |
| scan-offline | 390x844 | pass |  |
| search-offline | 430x932 | pass |  |
| scan-offline | 430x932 | pass |  |
| search-wrong-match-recovery | 375x667 | pass |  |
| scan-error | 375x667 | pass |  |
| search-wrong-match-recovery | 390x844 | pass |  |
| scan-error | 390x844 | pass |  |
| search-wrong-match-recovery | 430x932 | pass |  |
| scan-error | 430x932 | pass |  |
| scan-camera-denied-settings-failure | 375x667 | pass |  |
| ocr-camera-denied-settings-failure | 375x667 | pass |  |
| scan-camera-denied-settings-failure | 390x844 | pass |  |
| ocr-camera-denied-settings-failure | 390x844 | pass |  |
| scan-camera-denied-settings-failure | 430x932 | pass |  |
| ocr-camera-denied-settings-failure | 430x932 | pass |  |
| ocr-capture-failure | 375x667 | pass |  |
| no-match-missing-barcode | 375x667 | pass |  |
| catalog-recovery-malformed | 375x667 | pass |  |
| manual-barcode-validation | 375x667 | pass |  |
| ocr-capture-failure | 390x844 | pass |  |
| no-match-missing-barcode | 390x844 | pass |  |
| catalog-recovery-malformed | 390x844 | pass |  |
| manual-barcode-validation | 390x844 | pass |  |
| ocr-capture-failure | 430x932 | pass |  |
| no-match-missing-barcode | 430x932 | pass |  |
| catalog-recovery-malformed | 430x932 | pass |  |
| manual-barcode-validation | 430x932 | pass |  |

Machine-readable result: `summary.json`
