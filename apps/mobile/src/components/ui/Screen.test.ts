import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./Screen.tsx', import.meta.url)), 'utf8');

describe('Screen background', () => {
  it('sets an explicit full-screen color in addition to utility classes', () => {
    expect(source).toContain("tone === 'night' ? colors.night : colors.paper");
    expect(source).toContain("tone === 'night' ? 'bg-night' : 'bg-paper'");
  });

  it('records only content-free first-content and route-interaction milestones', () => {
    expect(source).toContain("markStartupPhase('first_meaningful_content')");
    expect(source).toContain("markStartupPhase('first_route_interaction_observed')");
    expect(source).toContain('onPointerDown=');
    expect(source).toContain('onTouchStart=');
    expect(source).not.toMatch(/markStartupPhase\([^)]*(children|className|tone)/);
  });
});
