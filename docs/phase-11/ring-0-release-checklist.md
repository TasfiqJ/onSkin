# Phase 11 Ring 0 Release Checklist

Status: BLOCKED until store approval and production smoke evidence exist.

Ring 0 means the app is approved and controllable, but not promoted. The goal is to verify production release mechanics before public traffic.

## Entry

- Phase 10 exit decision is go or limited launch.
- Store approval state is known.
- Manual release owner is online.
- Selected countries are approved.
- Production environment smoke passes.
- RevenueCat production verification passes.
- Monitoring dashboards are open.
- Support lead is online.
- Rollback drill is complete.

## Tasks

- Release iOS manually only when command center is active.
- Start Google production only for selected countries; do not assume a first-release percentage rollout exists.
- Install from public store listing after propagation.
- Complete fresh-user smoke on iOS and Android.
- Confirm public policy URLs and account deletion paths.
- Confirm analytics, crash, payment, support, and store dashboards update.
- Confirm no launch comms, creators, or paid campaigns are live.

## Exit

Ring 0 exits only when:

- both stores are available as intended or platform-specific decision is documented
- no P0/P1 smoke issue exists
- support receives and handles a test ticket
- purchase/restore/manage subscription passes
- deletion/export path is visible and functional
- command center approves Ring 1
