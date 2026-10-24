# Reproduced defects and repairs

## A — Today and daily progress

`buildWeek` always marked the current date `today`, even after its scheduled
routine completed. `weeklyDone` counts `done`, so today's completion stayed out
of the weekly total until the next day. Fresh Monday, Saturday and Sunday
vectors each reproduced 0 instead of 1 before the repair.

The current date now becomes `done` when its completion fact exists. An
unfinished current day remains neutral; future rows remain excluded. No
completion bytes, append-only behavior, remote operation identity, backfill
window, streak forgiveness or server protocol changed. Existing tests cover
duplicate taps, interrupted writes, offline replay, response loss, terminal
server results, account/health generations, foreground, midnight and DST.

Actual browser runs exercise the real AM/PM checklist, duplicate taps, rejected
write/read recovery, offline persistence, stable identities after reload and one
PM day marker. The paid weekly display is not admitted by the free fixture;
its denial is observed and its positive UI proof remains NOT_RUN.

## B — Private photo save and recovery

The photo store awaited `persist` successfully, then updated the publication
journal inside the same failure block. A failed `metadata_committed` journal
acknowledgement therefore rejected the entire save despite durable metadata.
This gave a false unsaved result and an unnecessary retry opportunity.

Journal acknowledgement now belongs to the existing post-commit cleanup block.
A storage failure there returns the canonical committed photo with
`sourceCleanupPending=true`. It retains the journal and raw source for existing
recovery; it does not pretend cleanup completed. An ambiguous metadata write
still rejects, and lost owner/health/capture authority still rejects success.

Regressions prove the failure before the repair, capture-session deduplication,
and same-owner health regrant refusal. An additional integration case uses real
private-KV encryption, photo encryption, publication journal, store and health
leases with a synthetic one-pixel PNG and mocked platform ports. After the
injected stage-write failure, a new store read returns the same photo, decrypts
its synthetic note, removes the raw source and settles the journal. Ciphertext
does not contain the synthetic note/image. Existing deletion, sign-out,
withdrawal, account-switch, late-read, cache and retry tests still pass.

Positive native photo UI remains NOT_RUN: Windows supplies no supported iOS
simulator/device, web has no native file backend, and no paid grant was forged.

## C — Local notification permission admission

Delivery had a permissive permission decoder separate from the existing strict
classifier. Unknown iOS enums, contradictory grant flags, missing request
authority and malformed iOS state could fall back to `authorized`. A malformed
post-request result could also be reported as an authorization.

Delivery now first uses `classifyNotificationPermission`. Unavailable reads do
not request permission or schedule health reminders; malformed request results
return the explicit error outcome. A later valid read recovers normally. Valid
iOS authorized/provisional/ephemeral classifications and genuine denial remain
unchanged. One integration mock now supplies the complete real response shape.

Tests prove malformed reads/request results, no prompt/native schedule on
unproven permission, recovery after a valid read, denied permission, schedule
compensation, owner transitions, offline settings and durable retry. Web E2E
proves local timing persistence/recovery and truthful native-unavailable copy;
it does not establish OS delivery. No push, permission, analytics or provider
scope was added.
