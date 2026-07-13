import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTINE_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('useProgress local-first contract', () => {
  it('does not require Supabase before showing local streak progress', () => {
    const source = readFileSync(`${ROUTINE_DIR}/useProgress.ts`, 'utf8');

    expect(source).toContain("import { isSupabaseConfigured } from '@/lib/env'");
    expect(source).toContain('if (!isSupabaseConfigured) return []');
    expect(source).toContain('if (!isSupabaseConfigured) return 0');
    expect(source).toContain('catch {');
    expect(source).toContain('const [localSummary, completions, serverLongest] = await Promise.all([');
    expect(source).toContain('getCompletionSummary()');
    expect(source).toContain('for (const d of localSummary.completedDates)');
    expect(source).toContain('for (const [d, n] of localSummary.countByDate)');
    expect(source).not.toContain('getCompletedDates()');
    expect(source).not.toContain('getCountByDate()');
    expect(source).toContain(
      'const longest = Math.max(serverLongest, bestStreak(completed), s.current)',
    );
    expect(source).not.toContain('const { data: completions } = await supabase');
  });
});
