// JS access to the OnSkin palette (mirrors tailwind.config.js — EXACT values from
// the Claude Design handoff) for contexts that can't use className: StatusBar,
// native navigation, tab bar, SVG, gradients, Skia.
export const colors = {
  paper: '#FAF7F2',
  paperRaised: '#FFFFFF',
  canvas: '#E8E4DD',
  greige: '#EFEAE1',
  greigeChip: '#F1ECE3',
  greigeDeep: '#E3D8C9',
  clay: '#A5694B',
  clayDeep: '#8A5239',
  clayTint: '#F3E7DF',
  clayBright: '#D9A183', // warm-clay accent on night surfaces
  ink: '#201B15',
  inkSoft: '#4A443B',
  muted: '#8A8071',
  mutedStrong: '#6F6759',
  mutedLight: '#A39A8B',
  night: '#1B1813',
  nightSurface: '#27221B',
  nightElevated: '#2A211C',
  cream: '#F4EFE7',
  sage: '#4F7A4A',
  sageDeep: '#3F6A3A',
  sageTint: '#E6ECE0',
  sageBody: '#456040',
  sageEyebrow: '#5C7A52',
  severityNone: '#C9C1B2',
  severityMild: '#D9A183',
  severityModerate: '#A5694B',
  severityHigh: '#8A4A33',
  amber: '#B07A3C',
  // Hairline borders (RN has no inset box-shadow). Mirrors tailwind hairline.*.
  hairline: 'rgba(32,27,21,0.08)',
  hairlineStrong: 'rgba(32,27,21,0.12)',
  hairlineDark: 'rgba(244,239,231,0.08)',
} as const;

export type ColorToken = keyof typeof colors;
