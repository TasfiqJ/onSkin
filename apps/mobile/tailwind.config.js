/**
 * OnSkin design tokens — the "paper · greige · clay · ink · night" palette and
 * Instrument Serif / Hanken Grotesk type from the design spec cover page.
 * Editorial-clinical hybrid: warm clinical neutrals + one restrained clay accent.
 * Light mode first; `night` is the dark surface used on the PM/capture screens.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm off-white page background (light mode).
        paper: {
          DEFAULT: '#F5F1EA',
          raised: '#FBF8F2',
        },
        // Warm greige — secondary surfaces, hairlines, muted UI.
        greige: {
          DEFAULT: '#E7E1D5',
          deep: '#D9D2C4',
          line: '#E0D9CC',
        },
        // The single restrained clay accent.
        clay: {
          DEFAULT: '#B0613F',
          soft: '#C98A6A',
          bright: '#D9A07E', // lighter peach-clay used on dark surfaces
        },
        // Warm near-black for text and primary (light-mode) buttons.
        ink: {
          DEFAULT: '#221C18',
          soft: '#4A433C',
        },
        // Muted warm grey text.
        muted: {
          DEFAULT: '#8A8278',
          dark: '#A79E91',
        },
        // Dark-mode "night" surfaces (PM routine, capture).
        night: {
          DEFAULT: '#1C1815',
          surface: '#272019',
          elevated: '#2F2820',
          line: '#3A322A',
        },
      },
      fontFamily: {
        serif: ['InstrumentSerif_400Regular'],
        'serif-italic': ['InstrumentSerif_400Regular_Italic'],
        sans: ['HankenGrotesk_400Regular'],
        'sans-medium': ['HankenGrotesk_500Medium'],
        'sans-semibold': ['HankenGrotesk_600SemiBold'],
        'sans-bold': ['HankenGrotesk_700Bold'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        pill: '999px',
        card: '20px',
      },
    },
  },
  plugins: [],
};
