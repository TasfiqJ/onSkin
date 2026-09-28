#!/usr/bin/env node
import {
  completeCatalogDatabaseReceiptsFromFiles,
  parseCatalogReceiptCompletionArgs,
  writeCatalogDatabaseReceiptCompletion,
} from './catalog-promotion-contract.mjs';

const args = parseCatalogReceiptCompletionArgs(process.argv.slice(2));
const completion = completeCatalogDatabaseReceiptsFromFiles(args);
const outputPath = writeCatalogDatabaseReceiptCompletion(args.outputPath, completion);

console.log(`Wrote ${outputPath}`);
console.log(`Completion digest ${completion.completionDigestSha256}`);
console.log(`Verification evidence ${completion.verificationEvidenceSha256}`);
console.log(`Materialized ${completion.reviewDecisions.length} receipt-bound review decisions.`);
