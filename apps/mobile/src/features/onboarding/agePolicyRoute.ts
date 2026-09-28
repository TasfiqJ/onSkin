let consentActivationPending = false;
export type AgePolicyReverificationHandoff =
  | 'none'
  | 'reverification_required'
  | 'reverification_write_failed';

let reverificationHandoff: AgePolicyReverificationHandoff = 'none';
let reverificationGeneration = 0;
let reverificationRequiredInSession = false;
const reverificationListeners = new Set<() => void>();

function publishReverificationHandoff(next: AgePolicyReverificationHandoff): void {
  reverificationHandoff = next;
  for (const listener of reverificationListeners) listener();
}

export function agePolicyRouteMayMountWithoutReceipt(segments: readonly string[]): boolean {
  if (segments.length === 0) return true;
  return segments[0] === 'onboarding' && segments[1] === 'age';
}

/**
 * The age route and protected routes live under different provider trees.
 * Publishing the current receipt replaces the bootstrap navigator, so the
 * gate owns the single post-activation navigation after the protected
 * navigator has mounted.
 */
export function stagePostAgeConsentRoute(): void {
  consentActivationPending = true;
}

export function consumePostAgeConsentRoute(): boolean {
  if (!consentActivationPending) return false;
  consentActivationPending = false;
  return true;
}

/**
 * Carries only the calm re-verification UI state across the one root navigator
 * swap caused by closing protected providers. It never retains DOB fields,
 * birth year, computed age, threshold, or an evaluation reason.
 */
export function stageAgePolicyReverificationHandoff(): number {
  reverificationGeneration += 1;
  reverificationRequiredInSession = true;
  publishReverificationHandoff('reverification_required');
  return reverificationGeneration;
}

export function markAgePolicyReverificationHandoffFailed(generation: number): void {
  if (generation !== reverificationGeneration) return;
  publishReverificationHandoff('reverification_write_failed');
}

export function clearAgePolicyReverificationHandoff(): void {
  reverificationGeneration += 1;
  reverificationRequiredInSession = false;
  publishReverificationHandoff('none');
}

/** Hide a consumed message without reopening the in-process privacy boundary. */
export function dismissAgePolicyReverificationHandoff(): void {
  reverificationGeneration += 1;
  publishReverificationHandoff('none');
}

export function getAgePolicyReverificationHandoff(): AgePolicyReverificationHandoff {
  return reverificationHandoff;
}

export function isAgePolicyReverificationRequiredInSession(): boolean {
  return reverificationRequiredInSession;
}

export function subscribeAgePolicyReverificationHandoff(listener: () => void): () => void {
  reverificationListeners.add(listener);
  return () => reverificationListeners.delete(listener);
}
