# Post-fix UI snapshot and console transcript

Capture time: 2026-07-26 after the final notification-source hardening
Surface: clean Codex in-app browser tab at
`http://127.0.0.1:8290/settings/notifications`

## Interaction

1. Opened Notification Settings directly.
2. Queried all six switches: every switch returned
   `aria-checked="false"`.
3. Activated the `Morning routine` switch while the web authorization state was
   unavailable.
4. Queried it again: it returned `aria-checked="false"`.
5. Queried every browser log entry in the newly created final tab: zero entries
   had level `error`.

## Post-fix semantic snapshot

```text
Notifications
Notification permission is unavailable in this browser preview.
UTILITY · YOUR ROUTINE
Morning routine — 7:30 AM — switch off
Evening · tonight’s step — 9:30 PM — switch off
OPTIONAL REMINDERS
Routine pacing suggestions — switch off
Replenishment — switch off
Progress-photo nudge — switch off
PROMOTIONAL
Tips & announcements — off by default — switch off
On this device, routine pacing and replenishment suggestions are limited to
3 scheduling attempts in 7 days; tips and announcements to 1.
Progress-photo reminders are weekly.
```

## Expected development warnings

The clean tab logged only:

- placeholder `EXPO_PUBLIC_SUPABASE_URL`;
- missing placeholder `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- Expo web push-token listener support limitation;
- React Native web `props.pointerEvents` deprecation; and
- normal development React/entry startup information.

This is a manually retained transcript of the browser automation result, not a
Playwright trace or production log. It proves no current-tab runtime error for
the one bounded web interaction, not absence of errors in native or other flows.
