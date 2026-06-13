import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';

// The three families from the design handoff: Instrument Serif (display),
// Hanken Grotesk (UI), IBM Plex Mono (labels/eyebrows/counters). Keys MUST match
// tailwind.config.js fontFamily entries.
export const fontMap = {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};
