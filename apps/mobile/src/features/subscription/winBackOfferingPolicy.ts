export type WinBackOfferingDecision = 'loading' | 'purchase' | 'fallback';

type WinBackOfferingInput =
  | Readonly<{
      status: string;
      winBack?: Readonly<{ canPurchase: boolean }> | null;
    }>
  | undefined;

/** Do not abandon a potentially eligible offer before store metadata resolves. */
export function winBackOfferingDecision(offering: WinBackOfferingInput): WinBackOfferingDecision {
  if (!offering) return 'loading';
  return offering.status === 'available' && offering.winBack?.canPurchase === true
    ? 'purchase'
    : 'fallback';
}
