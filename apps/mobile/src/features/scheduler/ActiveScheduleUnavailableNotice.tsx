import { Button, StateNotice } from '@/components/ui';

export function ActiveScheduleUnavailableNotice({
  className,
  onRetry,
  retrying,
  tone = 'paper',
}: {
  className?: string;
  onRetry: () => void;
  retrying: boolean;
  tone?: 'paper' | 'night';
}) {
  return (
    <StateNotice
      kind="unavailable"
      tone={tone}
      className={className}
      title="Active schedule unavailable"
      body="Your saved cadence wasn't reset. Active-night guidance is paused until Layerwell can read it safely. Your daily basics are still available."
    >
      <Button
        accessibilityLabel="Retry loading active schedule"
        className="mt-4 min-h-[48px] py-3"
        disabled={retrying}
        label={retrying ? 'Trying...' : 'Try again'}
        onPress={onRetry}
        variant={tone === 'night' ? 'inverse' : 'primary'}
      />
    </StateNotice>
  );
}
