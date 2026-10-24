# Actual synthetic Expo web observations

The unchanged repository CDP driver launched headless Chrome and the actual
development Expo app. `retained03-web.mjs` is an additive checkpoint wrapper:
it adds a bounded screenshot selection, touch trace and one reminder race flow.
`driver-binding.json` binds original and executed driver hashes for each run.
The existing launcher removes credential-named environment values, uses blocked
Supabase placeholders, and starts a fresh synthetic browser profile. No native
permission, provider, production account or paid authority is granted.

| User flow | 375x667 | 390x844 |
| --- | --- | --- |
| Adult/consent onboarding, quiz, three products and free continuation | PASS | PASS |
| Today offline write refusal, retry, duplicate action and reload | PASS | PASS |
| Local reminder time storage failure and explicit retry offline | PASS | PASS |
| Real browser authorization unavailable keeps delivery off | PASS | PASS |
| Controlled bridge status/refusal, delayed actual preference read, touch opt-in, saved-unconfirmed state survives late read | PASS | PASS |
| Focused keyboard Enter retry offline, truthful browser-only success | PASS | PASS |
| Restore actual bridge, reload; unavailable delivery stays off | PASS | PASS |
| Free Progress/diary, cycle and reorder paid denial remains closed | PASS | PASS |
| Underage re-verification, direct protected route and reload denial | PASS | PASS |
| A-to-B delayed work, cleanup refusal/retry, own B consent/data and reload | separate source regressions | PASS |

The preference race patches only loaded development bridge/store exports in
the synthetic browser, retaining actual encrypted local preferences, real
QueryClient and rendered controls. It does not change repository source or
claim OS scheduling. Normal unavailable permission is checked before injection
and again after restore/reload. Focus and click traces, durable boolean/time
readback and screenshots are retained. I visually inspected the 375 saved and
keyboard-recovery screens and 390 unavailable-after-reload screen: text is
readable, the recovery control is reachable and no horizontal overflow appears.
The successful harness route snapshots also report their geometry.

Cross-owner observation sampled the rendered boundary 5,749 times with zero
A-content leaks. Durable/cache checks report exact B, B health owner, no A in
Shelf/queue/cache, retained B edit and ciphertext-only persistence. This is a
synthetic development transport, not live Auth/native process-death evidence.

The positive diary repair is tested through real hooks/QueryClient/health
leases with controlled synthetic storage. Actual browser diary access remains
paid-denied; no fake entitlement is created to open it. Positive paid/native
diary capture, native OS scheduling, device accessibility/VoiceOver, physical
encryption storage, signing, TestFlight and provider proof remain NOT_RUN.

The failed 375 keyboard attempt is preserved under `ui/web375-run2`; successful
rerun evidence is under `ui/web375-final`. The failed attempt's fragment is
preserved separately. `ui/web390-final` and `ui/cross-owner390` contain the other
successful runs. All image assets are synthetic UI; no patient image is used.
