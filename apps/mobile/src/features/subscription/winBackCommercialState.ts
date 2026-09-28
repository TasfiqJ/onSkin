export type IosWinBackCommercialState = 'no_offer' | 'native_offer_enabled';

/**
 * Source-reviewed launch authority for Apple win-back offers.
 *
 * A remote RevenueCat/App Store configuration and a public build variable are
 * both insufficient to change the commercial launch decision. Moving this to
 * `native_offer_enabled` requires the separately reviewed PAY-08 source change
 * and its native purchase evidence.
 */
export const IOS_WIN_BACK_COMMERCIAL_STATE: IosWinBackCommercialState = 'no_offer';

export function resolveIosWinBackEnabled(
  publicFlag: boolean,
  commercialState: IosWinBackCommercialState = IOS_WIN_BACK_COMMERCIAL_STATE,
): boolean {
  return publicFlag === true && commercialState === 'native_offer_enabled';
}
