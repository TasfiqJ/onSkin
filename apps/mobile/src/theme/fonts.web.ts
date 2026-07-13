import { HankenGrotesk_400Regular as hankenGroteskRegular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium as hankenGroteskMedium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold as hankenGroteskSemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold as hankenGroteskBold } from '@expo-google-fonts/hanken-grotesk/700Bold';
import { IBMPlexMono_400Regular as ibmPlexMonoRegular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium as ibmPlexMonoMedium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { InstrumentSerif_400Regular as instrumentSerifRegular } from '@expo-google-fonts/instrument-serif/400Regular';
import { InstrumentSerif_400Regular_Italic as instrumentSerifItalic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';

import { FONT_FAMILY_TOKENS } from '../../font-assets';

// Native builds embed these same files through the expo-font config plugin.
// Only web needs JavaScript-time loading, and every import resolves one face.
export const webFontMap = {
  [FONT_FAMILY_TOKENS.serif]: instrumentSerifRegular,
  [FONT_FAMILY_TOKENS['serif-italic']]: instrumentSerifItalic,
  [FONT_FAMILY_TOKENS.sans]: hankenGroteskRegular,
  [FONT_FAMILY_TOKENS['sans-medium']]: hankenGroteskMedium,
  [FONT_FAMILY_TOKENS['sans-semibold']]: hankenGroteskSemiBold,
  [FONT_FAMILY_TOKENS['sans-bold']]: hankenGroteskBold,
  [FONT_FAMILY_TOKENS.mono]: ibmPlexMonoRegular,
  [FONT_FAMILY_TOKENS['mono-medium']]: ibmPlexMonoMedium,
};
