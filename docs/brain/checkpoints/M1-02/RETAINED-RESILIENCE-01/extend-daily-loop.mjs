// Extend the existing browser harness in memory; repository E2E sources stay unchanged.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = pathToFileURL(resolve('scripts/e2e/retained-daily-loop.mjs')).href;
let binding;
process.once('exit', () => {
  if (!binding) return;
  mkdirSync(process.env.ONBOARDING_E2E_EVIDENCE_DIR, { recursive: true });
  writeFileSync(resolve(process.env.ONBOARDING_E2E_EVIDENCE_DIR, 'harness-binding.json'), JSON.stringify(binding, null, 2));
});
const needle = "  await capture('06-pm');";
const extension = `${needle}
  await paidBoundary('/routine/streak', '06b-streak-paid-boundary');
  writeJson('same-day-weekly.json', {
    positiveWeeklyDisplay: 'NOT_RUN: authentic paid authority unavailable; no grant fabricated',
    negativePaidBoundary: 'PASS', localDate: target.date,
    surface: 'actual Expo web; synthetic fresh owner' });`;

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url !== target) return result;
    const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
    if (source.split(needle).length !== 2) throw new Error('Unexpected maintained daily-loop harness');
    const extended = source.replace(needle, extension);
    binding = {
      original: target,
      originalSha256: createHash('sha256').update(source).digest('hex'),
      executedSha256: createHash('sha256').update(extended).digest('hex'),
      change: 'After the real PM routine, verify the current paid boundary for streak; positive paid display remains NOT_RUN.',
    };
    return { ...result, source: extended };
  },
});
