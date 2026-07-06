/**
 * App design tokens — EXACT values from the Claude Design handoff
 * (Core Flow / Ingredient Intelligence / Routine Builder .dc.html).
 * Editorial-clinical: Instrument Serif (display) + Hanken Grotesk (UI) + IBM Plex
 * Mono (labels/eyebrows/counters). Warm clinical neutrals + one clay accent;
 * a sage/green positive accent for synergy/myth; "night" dark surfaces for
 * PM/capture/reveal where the accent shifts clay → warm-clay (#D9A183).
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light-mode page background + white card surface.
        paper: { DEFAULT: '#FAF7F2', raised: '#FFFFFF', warm: '#F4F0E9' },
        // Warm greige neutrals.
        greige: { DEFAULT: '#EFEAE1', chip: '#F1ECE3', deep: '#E3D8C9' },
        // The single restrained clay accent + its family.
        clay: {
          DEFAULT: '#A5694B',
          deep: '#8A5239', // text on clay-tint
          tint: '#F3E7DF', // peach surface
          bright: '#D9A183', // warm-clay accent on dark/night surfaces
        },
        // Warm near-black text + softer body greys.
        ink: { DEFAULT: '#201B15', soft: '#4A443B' },
        muted: { DEFAULT: '#8A8071', strong: '#6F6759', light: '#A39A8B', faint: '#C0B7A6' },
        // Dark "night" surfaces.
        night: { DEFAULT: '#1B1813', surface: '#27221B', elevated: '#2A211C' },
        cream: '#F4EFE7', // primary text on night surfaces
        // Sage/green positive accent (synergy + refuted myth).
        sage: {
          DEFAULT: '#4F7A4A',
          deep: '#3F6A3A',
          tint: '#E6ECE0',
          body: '#456040',
          eyebrow: '#5C7A52',
          muted: '#9DB18A',
        },
        // Severity ramp (docs/02 §4.2) + expiry amber.
        severity: { none: '#C9C1B2', mild: '#D9A183', moderate: '#A5694B', high: '#8A4A33' },
        amber: '#B07A3C',
        // Hairline border colors (RN has no inset box-shadow).
        hairline: {
          DEFAULT: 'rgba(32,27,21,0.08)',
          strong: 'rgba(32,27,21,0.12)',
          dark: 'rgba(244,239,231,0.08)',
        },
      },
      fontFamily: {
        serif: ['InstrumentSerif_400Regular'],
        'serif-italic': ['InstrumentSerif_400Regular_Italic'],
        sans: ['HankenGrotesk_400Regular'],
        'sans-medium': ['HankenGrotesk_500Medium'],
        'sans-semibold': ['HankenGrotesk_600SemiBold'],
        'sans-bold': ['HankenGrotesk_700Bold'],
        mono: ['IBMPlexMono_400Regular'],
        'mono-medium': ['IBMPlexMono_500Medium'],
      },
      borderRadius: {
        pill: '999px',
        card: '24px',
        sheet: '32px',
      },
    },
  },
  plugins: [],
};
