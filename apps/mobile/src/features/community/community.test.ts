import { afterEach, describe, expect, it } from 'vitest';

import { buildAnonHandle, formatAnonHandle, HANDLE_RE } from './anonHandle';
import { scanClaimSafety } from './claimSafetyScan';
import {
  evidencePill,
  noteById,
  notesByTopic,
  NOTES_REVIEWED,
  shippableNotes,
  SKIN_NOTES,
} from './notes';

// Community-engine fixtures (docs/11). The B-DERM-REVIEW launch gate on expert notes,
// the claim-safety pre-moderation FLAG, and the anonymous handle. The strategic verdict
// (community is a multiplier, not a 7-figure pillar) is settled by the spec; these
// lock the architecture-level guarantees that keep it on-thesis.

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

describe('expert notes are launch-gated under B-DERM-REVIEW', () => {
  it('NOTES_REVIEWED is false (parity with the conflict-matrix / rec-type / stack gates)', () => {
    expect(NOTES_REVIEWED).toBe(false);
  });
  it('in production no unreviewed note ships', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    expect(shippableNotes()).toEqual([]);
  });
  it('in dev the seeded corpus is available and every note passed the claim-safety guard', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const notes = shippableNotes();
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.claimSafetyOk)).toBe(true);
    expect(notes.every((n) => n.reviewedBy === null)).toBe(true); // B-DERM-REVIEW
  });
  it('a note that fails the claim-safety guard never ships, even in dev', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const bad = [{ ...SKIN_NOTES[0]!, id: 'bad', claimSafetyOk: false }];
    expect(shippableNotes(bad)).toEqual([]);
  });
});

describe('the hub groups notes by topic and uses the docs/02 evidence vocab', () => {
  it('groups shippable notes under their topic (dev)', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const groups = notesByTopic();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((g) => g.topic.slug === 'ingredient-myths')).toBe(true);
    expect(noteById('note-niacinamide-vitc')?.evidenceLabel).toBe('refuted');
  });
  it('maps the evidence label to the calm pill (refuted = sage "good news", text not colour alone)', () => {
    expect(evidencePill('refuted').text).toBe('Refuted');
    expect(evidencePill('contested').text).toBe('Contested');
    expect(evidencePill('established').text).toBe('Established');
    expect(evidencePill('plausible').text).toBe('Plausible');
  });
});

describe('the claim-safety scan FLAGS peer content (a first pass, not the decision)', () => {
  it('passes a calm, claim-safe question (the design example)', () => {
    const r = scanClaimSafety(
      'My retinol and glycolic are on alternate nights. Is that enough recovery for sensitive skin?',
    );
    expect(r.flagged).toBe(false);
  });
  it('flags drug/disease claims, dosage, and alarm', () => {
    expect(scanClaimSafety('this cured my eczema').flagged).toBe(true);
    expect(scanClaimSafety('use 2% twice a day').flagged).toBe(true);
    expect(scanClaimSafety('retinol is toxic!').flagged).toBe(true);
  });
});

describe('the anonymous handle is a calm random pseudonym', () => {
  it('formats adjective-noun-NN', () => {
    expect(formatAnonHandle('quiet', 'fern', 42)).toBe('quiet-fern-42');
  });
  it('builds a handle matching the pattern (deterministic with an injected rng)', () => {
    expect(buildAnonHandle(() => 0.5)).toMatch(HANDLE_RE);
    expect(buildAnonHandle(() => 0)).toMatch(HANDLE_RE);
    expect(buildAnonHandle(() => 0.999)).toMatch(HANDLE_RE);
  });
});
