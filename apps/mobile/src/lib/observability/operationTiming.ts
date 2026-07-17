export const OPERATION_TIMING_NAMES = [
  'private_kv_read',
  'private_kv_batch_read',
  'private_kv_write',
  'private_kv_remove',
  'photo_decrypt',
  'photo_encrypt',
  'network_request',
] as const;

export const STARTUP_PHASE_NAMES = [
  'javascript_started',
  'root_render_started',
  'font_decision_complete',
  'authentication_hydration_complete',
  'account_generation_complete',
  'vault_decision_complete',
  'app_lock_decision_complete',
  'navigation_ready',
  'first_meaningful_content',
  'first_interaction_accepted',
  'first_critical_data_ready',
  'startup_reconciliation_complete',
] as const;

export type OperationTimingName = (typeof OPERATION_TIMING_NAMES)[number];
export type StartupPhaseName = (typeof STARTUP_PHASE_NAMES)[number];
export type OperationTimingOutcome = 'ok' | 'error' | 'cancelled';

export type OperationTimingSample = Readonly<{
  name: OperationTimingName;
  durationMs: number;
  outcome: OperationTimingOutcome;
}>;

export type StartupPhaseSample = Readonly<{
  phase: StartupPhaseName;
  elapsedMs: number;
}>;

export type OperationTimingAggregate = Readonly<{
  name: OperationTimingName;
  count: number;
  errorCount: number;
  p50Ms: number;
  p95Ms: number;
}>;

const MAX_OPERATION_SAMPLES = 200;
const operationSamples: OperationTimingSample[] = [];
const startupSamples = new Map<StartupPhaseName, StartupPhaseSample>();
let lastClockValue = 0;
let startupStartedAt = 0;

function monotonicNow(): number {
  const candidate =
    typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
  lastClockValue = Math.max(lastClockValue, candidate);
  return lastClockValue;
}

startupStartedAt = monotonicNow();

function roundedDuration(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function appendOperationSample(sample: OperationTimingSample): void {
  operationSamples.push(sample);
  if (operationSamples.length > MAX_OPERATION_SAMPLES) {
    operationSamples.splice(0, operationSamples.length - MAX_OPERATION_SAMPLES);
  }
}

export function startOperationTiming(
  name: OperationTimingName,
  now: () => number = monotonicNow,
): (outcome?: OperationTimingOutcome) => void {
  const startedAt = now();
  let finished = false;
  return (outcome = 'ok') => {
    if (finished) return;
    finished = true;
    appendOperationSample({
      name,
      durationMs: roundedDuration(now() - startedAt),
      outcome,
    });
  };
}

export async function withOperationTiming<T>(
  name: OperationTimingName,
  operation: () => Promise<T>,
): Promise<T> {
  const finish = startOperationTiming(name);
  try {
    const result = await operation();
    finish('ok');
    return result;
  } catch (error) {
    finish('error');
    throw error;
  }
}

export function markStartupPhase(phase: StartupPhaseName, now: () => number = monotonicNow): void {
  if (startupSamples.has(phase)) return;
  startupSamples.set(phase, {
    phase,
    elapsedMs: roundedDuration(now() - startupStartedAt),
  });
}

export function readOperationTimingSamples(): readonly OperationTimingSample[] {
  return operationSamples.map((sample) => ({ ...sample }));
}

function percentile(sorted: readonly number[], quantile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(Math.ceil(sorted.length * quantile) - 1, sorted.length - 1);
  return sorted[Math.max(index, 0)] ?? 0;
}

export function readOperationTimingAggregates(): readonly OperationTimingAggregate[] {
  return OPERATION_TIMING_NAMES.flatMap((name) => {
    const samples = operationSamples.filter((sample) => sample.name === name);
    if (samples.length === 0) return [];
    const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
    return [
      {
        name,
        count: samples.length,
        errorCount: samples.filter((sample) => sample.outcome === 'error').length,
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
      },
    ];
  });
}

export function readStartupPhaseSamples(): readonly StartupPhaseSample[] {
  return STARTUP_PHASE_NAMES.flatMap((phase) => {
    const sample = startupSamples.get(phase);
    return sample ? [{ ...sample }] : [];
  });
}

export function resetOperationTimingForTests(now = 0): void {
  operationSamples.splice(0, operationSamples.length);
  startupSamples.clear();
  lastClockValue = now;
  startupStartedAt = now;
}
