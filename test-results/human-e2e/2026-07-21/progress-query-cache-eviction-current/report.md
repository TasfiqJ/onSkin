# Progress Sensitive Query Cache Eviction E2E

Date: 2026-07-21 (America/Toronto)

Surface: Expo web through headless system Chrome/Edge at 390 x 844

Result: Pass

## Flow

- Opened Progress with 10 deterministic development photos and switched to Timeline.
- Switched Progress -> Today -> Progress twice through the visible bottom tab bar.
- Query executions advanced exactly once per remount: 1 -> 2 -> 3.
- Timeline mode and visible photo actions returned after both encrypted-store-equivalent rereads, with no storage-unavailable state.
- Horizontal overflow: 0 px. JavaScript dialogs: 0. Unexpected warn/error logs: 0.

## Evidence Boundary

The global diagnostic contains one development-only integer execution count and no query key, photo, note, URI, account, storage, or provider content. Coupled with the real QueryObserver tests, this run proves focus teardown triggers a fresh query execution and the user-facing timeline recovers cleanly. The fixture uses deterministic unencrypted web photos, so native SecureStore/filesystem, production-Hermes memory, process-kill, and signed-device lifecycle evidence remain open.
