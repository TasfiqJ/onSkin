import { useFonts } from 'expo-font';

import { webFontMap } from './fonts.web';

export function useFontDecision(): boolean {
  const [loaded, error] = useFonts(webFontMap);

  // A font failure must fall back to system text instead of holding the app.
  return loaded || error !== null;
}
