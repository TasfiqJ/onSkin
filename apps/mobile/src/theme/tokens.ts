// JS access to the "paper · greige · clay · ink · night" palette (mirrors
// tailwind.config.js) for contexts that can't use className: StatusBar, native
// navigation, SVG, gradients, Skia. Keep in sync with the Tailwind theme.
export const colors = {
  paper: '#F5F1EA',
  paperRaised: '#FBF8F2',
  greige: '#E7E1D5',
  greigeDeep: '#D9D2C4',
  greigeLine: '#E0D9CC',
  clay: '#B0613F',
  claySoft: '#C98A6A',
  clayBright: '#D9A07E',
  ink: '#221C18',
  inkSoft: '#4A433C',
  muted: '#8A8278',
  mutedDark: '#A79E91',
  night: '#1C1815',
  nightSurface: '#272019',
  nightElevated: '#2F2820',
  nightLine: '#3A322A',
} as const;

export type ColorToken = keyof typeof colors;
