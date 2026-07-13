# Founder Enrollment and External Gates Packet

Date researched: 2026-07-13 (America/Toronto)

Status: prepared; no account, agreement, payment, identity check, reservation,
or submission is claimed complete.

This packet narrows `H-01` through `H-06` and `ACCT-01` through `ACCT-04` to
the actions that genuinely require the founder. Passwords, MFA codes, banking
details, tax identifiers, private keys, recovery codes, and identity documents
must never be pasted into the repository, an issue, a screenshot, or a Codex
message.

## 1. Decisions Required Before Enrollment

### 1.1 Apple seller type

Choose one truthful seller form before creating production identifiers:

| Choice                       | Public seller name               | Requirements                                                                                              | Recommendation                                                                                 |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Individual / sole proprietor | Founder's personal legal name    | Apple Account with 2FA; legal age of majority; founder's own payment method may be required               | Use only if publishing under the personal legal name is intentional                            |
| Organization                 | Exact verified legal-entity name | Legal entity, D-U-N-S number, binding authority, domain-matched work email, and functional public website | Preferred when a real operating entity is ready and the organization name should be the seller |

Apple does not accept a DBA, trade name, branch, or fictitious business as an
organization's legal entity. A brand recommendation such as `RoutineKind` is
not automatically an eligible seller name. Apple states that an organization
enrollment may require notarized business records and a reference who can
confirm binding authority. See [Apple program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
and [Apple D-U-N-S guidance](https://developer.apple.com/help/account/membership/D-U-N-S/).

Decision record required:

- `sellerType`: `individual` or `organization`.
- Exact public legal seller name.
- Launch legal entity and jurisdiction, if applicable.
- Confirmation from qualified legal/tax advisers where needed; Codex does not
  select or certify the entity or tax form.

### 1.2 Final brand and domain ordering (`H-06`)

Do not reserve the App Store name, buy the final domain, or freeze the bundle ID
solely from the provisional naming recommendation. The order is:

1. Founder confirms launch countries and product description.
2. Counsel completes clearance for the winner and backups.
3. Founder approves the cleared name and spending ceiling.
4. Founder authorizes domain/App Store/handle reservations.
5. Codex records the final identity registry and migrates every identifier.

## 2. Apple Developer and App Store Connect (`H-01` to `H-03`, `ACCT-01`)

### Founder-only actions

1. Create or choose the founder-controlled Apple Account and enable two-factor
   authentication.
2. Enroll using the truthful seller type above. For an organization, provide
   the exact legal entity, D-U-N-S number, domain-matched work email, functional
   website, and evidence of binding authority.
3. Review and personally accept the Apple Developer Program agreement.
4. Pay the membership fee through Apple's presented flow. Apple currently
   states USD 99 per membership year, or local currency where available; the
   checkout is authoritative.
5. After enrollment, the Account Holder reviews and accepts the Paid Apps
   Agreement. Apple says this is required to sell subscriptions or other IAP and
   that acceptance cannot be undone.
6. Submit truthful banking and tax details in App Store Connect. Apple requires
   a US tax form for all developers and may require additional forms based on
   account country. A qualified tax adviser must resolve uncertain answers.
7. Invite a least-privilege implementation user instead of sharing the Apple
   Account. Start with Admin only if certificates/identifiers require it; use App
   Manager/Developer/Finance/Customer Support roles for narrower ongoing work.

Only the Account Holder can sign legal agreements, renew membership, request
App Store Connect API access, and perform certain subscription-sale actions.
Role boundaries are documented in [Apple role permissions](https://developer.apple.com/help/app-store-connect/reference/account-management/role-permissions/).

### Codex actions after invitation

- Verify team ID and role without recording private login material.
- Create the final explicit App ID and iOS-only App Store record after identity
  freeze.
- Configure capabilities, App Group, Sign in with Apple, APNs, subscriptions,
  TestFlight groups, App Store Connect API access, and EAS credentials using
  least privilege.
- Prepare every non-attestation field and stop at any agreement, identity,
  payment, tax, banking, or irreversible submission control.

### Evidence to retain

- Redacted membership-active screen with legal seller name and team ID.
- Redacted role roster showing Account Holder and implementation role.
- Agreement status only (`active`/date/version), never agreement credentials.
- Banking/tax status only (`complete`/`pending`), never values or forms.
- Identifier/App/App Group/subscription IDs after creation.
- Membership renewal owner and reminder date.

Primary references:

- [Apple program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow)
- [Sign and update agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/)
- [Provide tax information](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/)
- [Receiving payments](https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments)

## 3. Expo/EAS (`H-05`, `ACCT-02`)

### Founder-only actions

1. Create or confirm the founder-controlled Expo account/organization.
2. Complete email, MFA, terms, and any paid-plan checkout presented by Expo.
3. Invite the implementation user with the minimum role that can create/link
   the project and run iOS builds.

### Codex actions after invitation

- Run the current EAS CLI via a pinned or explicitly latest invocation.
- Create or link the EAS project with `eas project:init` and record only the
  public project ID.
- Configure iOS-only build/submit profiles, environment separation, credential
  ownership, build provenance, and non-interactive CI.
- Start with the least paid capacity that meets build timeout/concurrency needs;
  the dashboard price at approval time is authoritative.

Expo states that an Expo account is required, the Free plan can run EAS builds,
and paid plans change capacity/priority rather than App Store authority. See
[Expo's current EAS build setup](https://docs.expo.dev/build/setup/),
[EAS CLI project commands](https://docs.expo.dev/eas/cli/), and
[build configuration](https://docs.expo.dev/build-reference/build-configuration/).

Evidence: redacted organization/project/role screens, public EAS project ID,
credential owner, build-profile hash, build URL/ID, renewal owner, and no token
values.

## 4. Supabase (`H-04`, `H-05`, `ACCT-03`)

### Founder-only actions

1. Create or confirm the founder-controlled Supabase organization.
2. Accept terms and approve the recommended plan/budget ceiling.
3. Supply billing/tax information directly to Supabase when requested.
4. Invite the implementation user; do not share the owner password or MFA.

### Codex actions after invitation

- Create distinct staging and production projects.
- Recommend final regions from launch-country, latency, residency, backup, and
  legal requirements before creation; Supabase states a project has one primary
  region. Canada Central is available, but a Canada region is not automatically
  the correct legal or commercial choice.
- Configure Auth, Storage, Edge Functions, database migrations, RLS, secrets,
  network controls, backups/PITR as approved, cost alerts, log retention, and
  deletion/export paths.
- Record public project references and redacted configuration proof, never
  service-role/secret keys.

Supabase bills at the organization level, with each project being a dedicated
instance; add-ons can be project-specific. If staging and production require
different plans, separate organizations may be necessary. See
[Supabase platform](https://supabase.com/docs/guides/platform),
[regions](https://supabase.com/docs/guides/platform/regions), and
[billing model](https://supabase.com/docs/guides/platform/billing-on-supabase).

Evidence: organization/project IDs, region, plan, role roster, migration SHA,
deployed-function list, redacted auth/redirect/secret-name inventory, backup and
cost-control settings, DPA/subprocessor location, and renewal owner.

## 5. RevenueCat (`H-04`, `H-05`, `ACCT-04`)

### Founder-only actions

1. Create or confirm the founder-controlled RevenueCat organization/project.
2. Accept terms and approve the plan/budget ceiling.
3. Invite the implementation user as project Admin only where configuration or
   secret-key management requires it.
4. Authorize linking to the final App Store Connect app after the Paid Apps
   Agreement and subscription identifiers exist.

### Codex actions after invitation

- Create the iOS app, `pro` entitlement, current offering, final monthly/annual
  products/packages, webhook, Apple credentials, restore behavior, and sandbox
  tests.
- Put only the platform public SDK key in client/EAS public configuration.
- Keep RevenueCat secret keys and webhook authentication server-side, scoped,
  rotated, and redacted. RevenueCat explicitly warns that secret `sk_` keys can
  grant entitlements and delete subscribers and must never be embedded in the
  app or public repository.
- Verify identity continuity, duplicate/reordered webhook behavior, refunds,
  cancellation/grace/expiry, restore, deletion, and reconciliation.

Primary references:

- [RevenueCat project setup](https://www.revenuecat.com/docs/projects/overview)
- [RevenueCat API keys and authentication](https://www.revenuecat.com/docs/projects/authentication)

Evidence: project/app/entitlement/offering/product IDs, collaborator roles,
redacted Apple credential status, webhook URL/auth-mode status, public key name
and storage location, secret-key storage/rotation record without values, and
sandbox transaction/reconciliation IDs.

## 6. Safe Handoff Format

For each console, return only:

```text
Provider:
Account/organization display name:
Public organization/project/team ID:
Founder-controlled owner confirmed: yes/no
Implementation invite sent to: [email address may be shared privately, not committed]
Role granted:
Terms status: accepted/pending (no screenshots of agreement signatures)
Billing status: complete/pending (no financial values)
MFA/identity gate: complete/pending
Redacted evidence path:
Open blocker:
```

Do not return passwords, one-time codes, recovery codes, session cookies,
private keys, API secret values, tax forms, banking details, identity documents,
or full console exports.

## 7. Stop Conditions

Codex must stop before:

- choosing the legal seller/entity on the founder's behalf;
- accepting an agreement or attesting that information is true;
- entering identity, tax, banking, or payment data;
- buying a domain, membership, plan, or professional service without a spending
  authorization;
- sharing owner credentials or weakening MFA;
- submitting to App Review or releasing publicly without explicit authorization.

These stops do not block independent code, documentation, local testing,
research, or preparation of non-binding console fields.
