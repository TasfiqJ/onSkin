import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTINE_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('useProgress local-first contract', () => {
  it('does not require Supabase before showing local streak progress', () => {
    const source = readFileSync(`${ROUTINE_DIR}/useProgress.ts`, 'utf8');

    expect(source).toContain("import { isSupabaseConfigured } from '@/lib/env'");
    expect(source).toContain("status: 'not_configured'");
    expect(source).toContain("status: 'unavailable'");
    expect(source).toContain("status: 'verified'");
    expect(source).toContain('catch {');
    expect(source).toContain('const [localSummary, server] = await Promise.all([');
    expect(source).toContain('getCompletionSummary()');
    expect(source).toContain("'set_routine_adherence_timezone'");
    expect(source).toContain('decodeServerAdherenceProjection');
    expect(source).toContain("throw new Error('PROGRESS_SERVER_READ_FAILED')");
    expect(source).toContain(".is('step_id', null)");
    expect(source).toContain('for (const d of localSummary.completedDates)');
    expect(source).toContain('for (const [d, n] of localSummary.countByDate)');
    expect(source).not.toContain('getCompletedDates()');
    expect(source).not.toContain('getCountByDate()');
    expect(source).toContain('server.projection?.longestStreak ?? 0');
    expect(source).toContain('serverStatus: server.status');
    expect(source).toContain('if (!completedDate || completedDate > todayISO) continue');
    expect(source).toContain('completedDate && completedDate <= todayISO');
    expect(source).not.toContain('const { data: completions } = await supabase');
  });
});
