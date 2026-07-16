import { StateNotice } from '@/components/ui';
import { cn } from '@/lib/cn';

export function CycleMutationError({ className }: { className?: string }) {
  return (
    <StateNotice
      kind="error"
      compact
      className={cn('mt-3', className)}
      title="Change not saved"
      body="Your previous cycle is still in place. Try again when private storage is available."
    />
  );
}
