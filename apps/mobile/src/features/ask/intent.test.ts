import { describe, expect, it } from 'vitest';

import { classifyIntent } from './intent';

// The deterministic intent router (docs/13 §4). Medical FIRST, then the on-device
// intents, then the corpus-grounded concern bucket, then out-of-scope. A false
// "escalate" is safe; a false "answer" on a medical question is not.

describe('medical / severe / dosing / diagnosis always routes to medical (escalate)', () => {
  for (const q of [
    'what antibiotic should I take',
    'I have a painful cystic breakout',
    'do I have rosacea',
    'how much tretinoin should I use',
    'is this mole changing shape',
    'should I see a dermatologist about this',
    'can I use my retinol with a prescription antibiotic', // medical wins over conflict
  ]) {
    it(`"${q}" → medical`, () => {
      expect(classifyIntent(q)).toBe('medical');
    });
  }
});

describe('the deterministic on-device intents route correctly', () => {
  it('conflict questions → conflict_q', () => {
    expect(classifyIntent('can I use my retinol with my glycolic toner')).toBe('conflict_q');
    expect(classifyIntent('is there a conflict on my shelf')).toBe('conflict_q');
    expect(classifyIntent('can I layer these two')).toBe('conflict_q');
  });
  it('routine questions → routine_q', () => {
    expect(classifyIntent('what should I do tonight')).toBe('routine_q');
    expect(classifyIntent("what's my evening routine")).toBe('routine_q');
  });
  it('replenishment questions → replenish_q', () => {
    expect(classifyIntent('what is running low')).toBe('replenish_q');
    expect(classifyIntent('do I need to repurchase anything')).toBe('replenish_q');
  });
  it('product-fit questions → product_fit_q', () => {
    expect(classifyIntent('is this product a fit for me')).toBe('product_fit_q');
    expect(classifyIntent('should I buy this serum')).toBe('product_fit_q');
  });
});

describe('corpus-grounded concern questions and the out-of-scope floor', () => {
  it('general ingredient/concern questions → concern_q', () => {
    expect(classifyIntent('what is niacinamide')).toBe('concern_q');
    expect(classifyIntent('tell me about vitamin C')).toBe('concern_q');
  });
  it('empty and off-topic input → out_of_scope', () => {
    expect(classifyIntent('')).toBe('out_of_scope');
    expect(classifyIntent('   ')).toBe('out_of_scope');
    expect(classifyIntent('qwerty asdf zxcv')).toBe('out_of_scope');
  });
});
