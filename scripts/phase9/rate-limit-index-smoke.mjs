#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const base = readFileSync('supabase/migrations/20260705000029_phase9_edge_rate_limits.sql', 'utf8');
const alignment = readFileSync(
  'supabase/migrations/20260712000040_edge_rate_limit_cleanup_index.sql',
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

if (errors.length > 0) {
  console.error('FAIL rate-limit cleanup index smoke');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('PASS rate-limit cleanup index smoke');
}
