import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

const consentWorkflowTails = new Map<number, Promise<void>>();

/**
 * Serialize complete consent workflows for one account generation.
 *
 * Local state and the remote immutable-ledger/withdrawal call must share the
 * same queue. Serializing only storage writes would still allow an earlier,
 * slower grant response to land after a later withdrawal completed.
 */
export async function runSerializedConsentWorkflow<T>(
  lease: AccountGenerationLease,
  workflow: () => Promise<T>,
): Promise<T> {
  lease.assertCurrent();
  const previous = consentWorkflowTails.get(lease.generation) ?? Promise.resolve();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => pending);
  consentWorkflowTails.set(lease.generation, tail);

  try {
    await awaitAccountGenerationLease(lease, () => previous.catch(() => undefined));
    lease.assertCurrent();
    return await workflow();
  } finally {
    release();
    if (consentWorkflowTails.get(lease.generation) === tail) {
      consentWorkflowTails.delete(lease.generation);
    }
  }
}
