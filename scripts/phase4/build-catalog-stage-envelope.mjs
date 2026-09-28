#!/usr/bin/env node
import {
  buildCatalogStageEnvelope,
  parseCatalogStageArgs,
  writeCatalogStageEnvelope,
} from './catalog-promotion-contract.mjs';

const args = parseCatalogStageArgs(process.argv.slice(2));
const envelope = buildCatalogStageEnvelope(args);
const outputPath = writeCatalogStageEnvelope(args.outputPath, envelope);

console.log(`Wrote ${outputPath}`);
console.log(`Stage digest ${envelope.stageDigestSha256}`);
console.log(
  `Reviewed ${envelope.counts.transformedRecords}: ${envelope.counts.accepted} accepted, ${envelope.counts.rejected} rejected, ${envelope.counts.duplicate} duplicate.`,
);
