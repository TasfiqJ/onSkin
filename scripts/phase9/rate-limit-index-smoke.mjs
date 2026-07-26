#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const base = readFileSync('supabase/migrations/20260705000029_phase9_edge_rate_limits.sql', 'utf8');
const alignment = readFileSync(
  'supabase/migrations/20260712000040_edge_rate_limit_cleanup_index.sql',
  'utf8',
);
const concurrentReplacement = readFileSync(
  'supabase/migrations/20260726000059_edge_rate_limit_cleanup_concurrent_index.sql',
  'utf8',
);
const errors = [];

if (!/delete\s+from\s+public\.edge_rate_limits[\s\S]*?where\s+window_start\s*</i.test(base)) {
  errors.push('The existing rate-limit cleanup predicate no longer filters window_start.');
}
if (
  !/create\s+index\s+if\s+not\s+exists\s+edge_rate_limits_window_start_idx[\s\S]*?on\s+public\.edge_rate_limits\s*\(\s*window_start\s*\)/i.test(
    alignment,
  )
) {
  errors.push('The alignment migration does not index edge_rate_limits(window_start).');
}
if (/cron\.schedule|delete\s+from|make_interval/i.test(alignment)) {
  errors.push('The alignment migration must not invent a retention schedule or period.');
}
if (
  !/create\s+index\s+concurrently\s+if\s+not\s+exists\s+edge_rate_limits_window_start_concurrent_idx[\s\S]*?on\s+public\.edge_rate_limits\s+using\s+btree\s*\(\s*window_start\s*\)/i.test(
    concurrentReplacement,
  )
) {
  errors.push(
    'The replacement cleanup index is not created concurrently as a window_start B-tree.',
  );
}
if (
  !/drop\s+index\s+concurrently\s+if\s+exists\s+public\.edge_rate_limits_window_start_idx/i.test(
    concurrentReplacement,
  )
) {
  errors.push('The historical blocking-built cleanup index is not dropped concurrently.');
}
const validationOffset = concurrentReplacement.search(/indexes\.indisvalid/i);
const legacyDropOffset = concurrentReplacement.search(
  /drop\s+index\s+concurrently\s+if\s+exists\s+public\.edge_rate_limits_window_start_idx/i,
);
if (validationOffset < 0 || legacyDropOffset < 0 || validationOffset > legacyDropOffset) {
  errors.push('The replacement index must be validated before the historical index is dropped.');
}
const invalidPreflightOffset = concurrentReplacement.indexOf(
  'edge_rate_limits_cleanup_index_invalid_or_unready',
);
const concurrentCreateOffset = concurrentReplacement.search(
  /create\s+index\s+concurrently\s+if\s+not\s+exists\s+edge_rate_limits_window_start_concurrent_idx/i,
);
if (
  invalidPreflightOffset < 0 ||
  concurrentCreateOffset < 0 ||
  invalidPreflightOffset > concurrentCreateOffset
) {
  errors.push('Invalid or unready replacement indexes must fail before concurrent creation.');
}
if (
  (concurrentReplacement.match(/errcode\s*=\s*'55000'/gi) ?? []).length !== 2 ||
  !/message\s*=\s*'edge_rate_limits_cleanup_index_invalid_or_unready'/i.test(
    concurrentReplacement,
  ) ||
  !/message\s*=\s*'edge_rate_limits_cleanup_index_definition_mismatch'/i.test(
    concurrentReplacement,
  ) ||
  (
    concurrentReplacement.match(
      /hint\s*=\s*'Run DROP INDEX CONCURRENTLY IF EXISTS public\.edge_rate_limits_window_start_concurrent_idx; then retry migration 20260726000059\.'/g,
    ) ?? []
  ).length !== 2
) {
  errors.push('The replacement migration lacks stable SQLSTATE/message/HINT failure contracts.');
}
for (const requiredContract of [
  /indexes\.indisready/i,
  /not\s+indexes\.indisunique/i,
  /access_method\.amname\s*=\s*'btree'/i,
  /indexes\.indnkeyatts\s*=\s*1/i,
  /indexes\.indnatts\s*=\s*1/i,
  /indexes\.indpred\s+is\s+null/i,
  /indexes\.indexprs\s+is\s+null/i,
  /indexes\.indkey\[0\]\s*=\s*window_start\.attnum/i,
  /raise\s+exception/i,
]) {
  if (!requiredContract.test(concurrentReplacement)) {
    errors.push(`The replacement migration is missing contract check ${requiredContract}.`);
  }
}
if (
  /(?:^|;)\s*create\s+index\s+(?!concurrently)/im.test(concurrentReplacement) ||
  /(?:^|;)\s*drop\s+index\s+(?!concurrently)/im.test(concurrentReplacement)
) {
  errors.push('The replacement migration contains a blocking index create or drop.');
}
if (/cron\.schedule|delete\s+from|make_interval/i.test(concurrentReplacement)) {
  errors.push('The replacement migration must not invent a retention schedule or period.');
}

if (errors.length > 0) {
  console.error('FAIL rate-limit cleanup index smoke');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('PASS rate-limit cleanup index smoke');
}
