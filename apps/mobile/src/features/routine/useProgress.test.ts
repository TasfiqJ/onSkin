import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTINE_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('useProgress local-first contract', () => {
  it('does not require Supabase before showing local streak progress', () => {
    const source = readFileSync(`${ROUTINE_DIR}/useProgress.ts`, 'utf8');

    expect(source).toContain("import { isSupabaseConfigured } from '@/lib/env'");
    expect(source).toContain('let completions: ServerCompletion[] = []');
    expect(source).toContain('let serverLongest = 0');
    expect(source).toContain('if (isSupabaseConfigured)');
    expect(source).toContain('catch {');
    expect(source).toContain('const localDates = await getCompletedDates()');
    expect(source).toContain(
      'const longest = Math.max(serverLongest, bestStreak(completed), s.current)',
    );
    expect(source).not.toContain('const { data: completions } = await supabase');
  });
});
