export const SHARE_CARD_EXPORT_SIZE = { width: 1080, height: 1920 } as const;

/**
 * CORE-07A ships no capture, temporary-file, network, or native-share side
 * effect. A future implementation must first verify separate publication
 * authority and exact-payload confirmation outside this closed helper.
 */
export async function shareConflictCard(_request?: unknown): Promise<false> {
  return false;
}
