import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTINE_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('useProgress local-first contract', () => {
  it('does not require Supabase before showing local streak progress', () => {
    const source = readFileSync(`${ROUTINE_DIR}/useProgress.ts`, 'utf8');

    expect(source).toContain("import { isSupabaseConfigured } from '@/lib/env'");
    expect(source).toContain('if (!isSupabaseConfigured) return []');
    expect(source).toContain('catch {');
    expect(source).toContain('const [localSummary, completions] = await Promise.all([');
    expect(source).toContain('getCompletionSummary()');
    expect(source).toContain(".is('step_id', null)");
    expect(source).toContain('for (const d of localSummary.completedDates)');
    expect(source).toContain('for (const [d, n] of localSummary.countByDate)');
    expect(source).not.toContain('getCompletedDates()');
    expect(source).not.toContain('getCountByDate()');
    expect(source).toContain(
      'const longest = Math.max(bestStreak(completed, undefined, todayISO), s.current)',
    );
    expect(source).toContain('if (!completedDate || completedDate > todayISO) continue');
    expect(source).toContain('completedDate && completedDate <= todayISO');
    expect(source).not.toContain('const { data: completions } = await supabase');
    expect(source).not.toContain("select('longest_streak')");
  });
});
