# Security Review

| Boundary | Test                                     | Expected                                           | Result | Evidence | Owner |
| -------- | ---------------------------------------- | -------------------------------------------------- | ------ | -------- | ----- |
| RLS      | User B reads User A shelf/profile/photos | Denied/empty                                       | TBD    | TBD      | TBD   |
| Storage  | User B reads `photos/{userA}/...`        | Denied                                             | TBD    | TBD      | TBD   |
| Edge     | Missing auth on user function            | 401                                                | TBD    | TBD      | TBD   |
| Webhook  | Stale RevenueCat HMAC                    | 401                                                | TBD    | TBD      | TBD   |
| Logs     | Sensitive flow payload review            | No sensitive data                                  | TBD    | TBD      | TBD   |
| Build    | Release build config                     | Not debuggable, no cleartext, permissions reviewed | TBD    | TBD      | TBD   |
