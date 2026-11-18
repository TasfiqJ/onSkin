# Manual intake browser regression verification

The original failure remains in `../manual-browser-r3/E2E_BUG_REPORT.md` with its original screenshots and terminal receipt. This new run passed all assertions at 375 x 667, 390 x 844 and 430 x 932.

- Immediately after explicit Save, the unchanged original inputs report `Saved draft revision 1.` and no `Unsaved changes` message.
- A later edit reports unsaved changes. After reload and explicit resume, the exact original raw name, brand, barcode and multiline ingredients return; the later unsaved edit does not.
- The selected EAN-8 radio exposes `aria-checked=true` after resume.
- The opening date, accepted 17-month PAO and custom PAO text survive a separate explicit save and reload.
- Enter activates visible Save, Add and confirmed Discard controls. Checked Save and Discard targets have a 56px height and remain within each viewport.
- Explicit Add returns to canonical Shelf; reload shows one matching product. The exact saved intake draft is absent only after completion.
- Incomplete draft save, discard cancel/confirm, unavailable storage, unsupported storage, exact source preservation, explicit retry and denied second-tab private reads pass.

Evidence: `summary.json`, `steps.json`, viewport PNG/JSON pairs, network and console receipts; command receipt `../manual-browser-r4.json` and log `../manual-browser-r4.log`. The run exited 0 in 153.86 seconds. Both owned helper processes were absent after completion.

Screenshots inspected directly: 375 saved status, 375 restored opening choices, 375 Shelf readback, 390 unavailable storage and 430 saved inventory. No horizontal overflow was observed by the driver at any captured state. Scrollable portions outside a screenshot remain represented by UI snapshots and interactions.

Scope: synthetic local Expo web and isolated Edge storage. This does not qualify native devices, screen-reader applications or release acceptance. Browser request receipts establish only the observed browser traffic; they do not prove process-wide network isolation. The earlier CLI debugger artifact fetch warning remains recorded separately; the headless launch flag suppresses that background helper in this run.
