import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  baselinePaths,
  buildExecutionStatus,
  buildFeatureInventory,
  buildTaskGraph,
  root,
  stableJson,
} from './execution-baseline.mjs';

const outputs = [
  [baselinePaths.featureInventory, buildFeatureInventory()],
  [baselinePaths.taskGraph, buildTaskGraph()],
];

if (
  process.argv.includes('--reset-status') ||
  !existsSync(resolve(root, baselinePaths.executionStatus))
) {
  outputs.push([baselinePaths.executionStatus, buildExecutionStatus()]);
}

for (const [path, value] of outputs) {
  const absolute = resolve(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, await stableJson(value));
  console.log(`Wrote ${path}`);
}
