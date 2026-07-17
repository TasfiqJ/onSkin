import type { ReactNode } from 'react';

export type PseudoLocalizationMode = 'off' | 'expanded';

const EXPANDED_CHARACTERS: Record<string, string> = {
  A: 'ÅÄ',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Đ',
  E: 'ÉË',
  F: 'Ƒ',
  G: 'Ğ',
  H: 'Ħ',
  I: 'ÏÍ',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'ØÖ',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ŧ',
  U: 'ÜÚ',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẍ',
  Y: 'ÝŸ',
  Z: 'Ž',
  a: 'åä',
  b: 'ɓ',
  c: 'ç',
  d: 'đ',
  e: 'éë',
  f: 'ƒ',
  g: 'ğ',
  h: 'ħ',
  i: 'ïí',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ṁ',
  n: 'ñ',
  o: 'øó',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ŧ',
  u: 'üú',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẍ',
  y: 'ýÿ',
  z: 'ž',
};

export function resolvePseudoLocalizationMode(
  value: string | undefined,
  development: boolean,
): PseudoLocalizationMode {
  return development && value === 'expanded' ? 'expanded' : 'off';
}

export function pseudoLocalizeExpanded(value: string): string {
  if (!/[A-Za-z]/.test(value)) return value;

  const leadingWhitespace = value.match(/^\s*/u)?.[0] ?? '';
  const trailingWhitespace = value.match(/\s*$/u)?.[0] ?? '';
  const content = value.slice(leadingWhitespace.length, value.length - trailingWhitespace.length);
  if (content.startsWith('⟦') && content.endsWith('⟧')) return value;

  const expanded = Array.from(content, (character) => EXPANDED_CHARACTERS[character] ?? character).join(
    '',
  );
  return `${leadingWhitespace}⟦${expanded}⟧${trailingWhitespace}`;
}

const runtimeMode = resolvePseudoLocalizationMode(
  process.env.EXPO_PUBLIC_E2E_PSEUDO_LOCALE,
  typeof __DEV__ !== 'undefined' && __DEV__,
);

export function pseudoLocalizeString(value: string): string {
  return runtimeMode === 'expanded' ? pseudoLocalizeExpanded(value) : value;
}

export function pseudoLocalizeNode(node: ReactNode): ReactNode {
  if (runtimeMode !== 'expanded') return node;
  if (typeof node === 'string') return pseudoLocalizeExpanded(node);
  if (Array.isArray(node)) return node.map(pseudoLocalizeNode);
  return node;
}
