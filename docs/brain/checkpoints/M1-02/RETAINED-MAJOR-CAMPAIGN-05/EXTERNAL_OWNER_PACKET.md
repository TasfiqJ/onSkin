# Unapplied external owner packet — canonical DB image acquisition

Disposition: blocked external registry availability; no protected patch applied.

At measured source 74c08a37a761d3bb44601c2d6b4b52a8f9e9c6b7, original Quality run 40068215649 canonical DB job 120795820768 stopped before database rehearsal because the registry returned “Data limit exceeded.” First candidate job 120792463643 has the same acquisition refusal. Full original job logs and their hashes are in receipts/measured-canonical-db-failure.log and receipts/first-push-canonical-db-failure.log.

Owner action: the existing registry/service custodian must restore authorized acquisition of the unchanged canonical image, then rerun the original canonical job with the original workflow, image, SQL and drift checks. Success must bind that actual new run/head; the two passing PostgreSQL deletion rehearsals cannot substitute. No alternative image, dependency/workflow/SQL patch, expiry extension, credential search or paid capacity purchase is proposed or applied by this campaign.

Security/G97 and its original source/scanner/secret/advisory/expiry obligations remain separate and open. This packet grants no acceptance or release authority and asks the founder to make no engineering choice.
