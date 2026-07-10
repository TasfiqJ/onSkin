// Anonymous handle generation (docs/11 §4). A random, calm pseudonym ("quiet-fern-42")
// assigned for posting. NEVER a real name, NEVER profiles.display_name, no social graph.
// Pure + tested; the word lists are deliberately gentle/neutral (the "calm" register).

const ADJECTIVES = [
  'quiet',
  'calm',
  'gentle',
  'soft',
  'still',
  'warm',
  'clear',
  'kind',
  'steady',
  'plain',
  'open',
  'bright',
];
const NOUNS = [
  'fern',
  'willow',
  'river',
  'meadow',
  'cedar',
  'dawn',
  'pebble',
  'heron',
  'clover',
  'birch',
  'reed',
  'moss',
];

/** The handle format pattern: adjective-noun-NN (two-digit). */
export const HANDLE_RE = /^[a-z]+-[a-z]+-\d{2}$/;

export function formatAnonHandle(adjective: string, noun: string, n: number): string {
  return `${adjective}-${noun}-${n}`;
}

/** Build a random handle. `rand` is injectable for deterministic tests. */
export function buildAnonHandle(rand: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(rand() * NOUNS.length)]!;
  const n = 10 + Math.floor(rand() * 90); // 10-99
  return formatAnonHandle(adjective, noun, n);
}
