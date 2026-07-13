'use strict';

// Each face stays a separately named family. That preserves the app's existing
// "one token = one exact face" typography on Android while using the font's
// real PostScript name on iOS. Android registers every alias as normal/400 so
// React Native does not synthesize a second weight on top of the selected file;
// `weight` and `style` describe the face embedded in that file.
const FONT_ASSETS = Object.freeze([
  {
    id: 'instrumentSerifRegular',
    tailwindToken: 'serif',
    postScriptName: 'InstrumentSerif-Regular',
    source: '@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf',
    weight: 400,
    style: 'normal',
  },
  {
    id: 'instrumentSerifItalic',
    tailwindToken: 'serif-italic',
    postScriptName: 'InstrumentSerif-Italic',
    source:
      '@expo-google-fonts/instrument-serif/400Regular_Italic/InstrumentSerif_400Regular_Italic.ttf',
    weight: 400,
    style: 'italic',
  },
  {
    id: 'hankenGroteskRegular',
    tailwindToken: 'sans',
    postScriptName: 'HankenGrotesk-Regular',
    source: '@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf',
    weight: 400,
    style: 'normal',
  },
  {
    id: 'hankenGroteskMedium',
    tailwindToken: 'sans-medium',
    postScriptName: 'HankenGrotesk-Medium',
    source: '@expo-google-fonts/hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf',
    weight: 500,
    style: 'normal',
  },
  {
    id: 'hankenGroteskSemiBold',
    tailwindToken: 'sans-semibold',
    postScriptName: 'HankenGrotesk-SemiBold',
    source: '@expo-google-fonts/hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf',
    weight: 600,
    style: 'normal',
  },
  {
    id: 'hankenGroteskBold',
    tailwindToken: 'sans-bold',
    postScriptName: 'HankenGrotesk-Bold',
    source: '@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf',
    weight: 700,
    style: 'normal',
  },
  {
    id: 'ibmPlexMonoRegular',
    tailwindToken: 'mono',
    postScriptName: 'IBMPlexMono-Regular',
    source: '@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf',
    weight: 400,
    style: 'normal',
  },
  {
    id: 'ibmPlexMonoMedium',
    tailwindToken: 'mono-medium',
    postScriptName: 'IBMPlexMono-Medium',
    source: '@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf',
    weight: 500,
    style: 'normal',
  },
]);

const FONT_FAMILY_TOKENS = Object.freeze(
  Object.fromEntries(FONT_ASSETS.map((font) => [font.tailwindToken, font.postScriptName])),
);

function createExpoFontPluginOptions() {
  return {
    ios: {
      fonts: FONT_ASSETS.map((font) => font.source),
    },
    android: {
      fonts: FONT_ASSETS.map((font) => ({
        fontFamily: font.postScriptName,
        fontDefinitions: [
          {
            path: font.source,
            weight: 400,
            style: 'normal',
          },
        ],
      })),
    },
  };
}

module.exports = {
  FONT_ASSETS,
  FONT_FAMILY_TOKENS,
  createExpoFontPluginOptions,
};
