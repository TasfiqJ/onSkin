import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('cycle week route scheduler notes', () => {
  it('opens the why-this-night sheet for every projected cycle row', () => {
    const source = readAppRoute('cycle/week.tsx');
    const whyTonight = readAppRoute('cycle/why-tonight.tsx');
    const useCycle = readFileSync(`${APP_DIR}/../features/scheduler/useCycle.ts`, 'utf8');
    const projection = readFileSync(`${APP_DIR}/../features/scheduler/projection.ts`, 'utf8');

    expect(source).toContain("pathname: '/cycle/why-tonight'");
    expect(source).toContain('params: { date: p.dateISO }');
    expect(source).toContain('const cycleNightNumber = p.night.index + 1;');
    expect(source).toContain('const cycleNightLabel = `N${cycleNightNumber}`;');
    expect(source).toContain('cycle night ${cycleNightNumber} of ${cycle.lengthNights}');
    expect(source).toContain('{cycleNightLabel}');
    expect(source).not.toContain('N{i + 1}');
    expect(source).not.toContain('${p.weekday}: ${slotLabel(p.night.slot)} night${tonight');
    expect(source).not.toContain("if (tonight) router.push('/cycle/why-tonight');");
    expect(useCycle).toContain('const week = cycle ? weekAhead(cycle, anchor, today) : [];');
    expect(useCycle).not.toContain('weekAhead(cycle, anchor, today, 4)');
    expect(projection).toContain('days = 6');

    expect(whyTonight).toContain('useLocalSearchParams');
    expect(whyTonight).toContain('DATE_PARAM_RE');
    expect(whyTonight).toContain('const selectedDate = params.date');
    expect(whyTonight).toContain('data.weekAhead.find((p) => p.dateISO === selectedDate)');
    expect(whyTonight).toContain("isTonight ? 'WHY THIS, TONIGHT?' : 'WHY THIS NIGHT?'");
    expect(whyTonight).toContain(
      'slotTitle(selectedNight.night.slot, isTonight, selectedNight.weekday)',
    );
  });

  it('only exposes phased-introduction scheduler notes as tappable controls', () => {
    const source = readAppRoute('cycle/week.tsx');

    expect(source).toContain('function SchedulerNote');
    expect(source).toContain('const opensPhasedIntro = /add your/i.test(note);');
    expect(source).toContain('if (opensPhasedIntro)');
    expect(source).toContain('accessibilityLabel="Review phased introduction"');
    expect(source).toContain("router.push('/cycle/phased-intro')");
    expect(source).toContain(
      'mt-4 min-h-[48px] flex-row items-center gap-3 rounded-[18px] px-4 py-3',
    );
    expect(source).not.toContain(
      'mt-4 min-h-[44px] flex-row items-center gap-3 rounded-[18px] px-4 py-3',
    );
    expect(source).toContain('<View className="mt-4 flex-row items-start');
    expect(source).not.toContain('if (/add your/i.test(data!.notes[0]!))');
    expect(source).not.toContain('{data!.notes[0]}');
  });

  it('keeps cycle week text actions buffered above sub-pixel phone targets', () => {
    const source = readAppRoute('cycle/week.tsx');

    expect(source).toContain(
      'className="min-h-[48px] min-w-[48px] items-center justify-center px-2"',
    );
    expect(source).toContain('className="mt-6 min-h-[48px] items-center justify-center py-2"');
    expect(source).not.toContain(
      'className="min-h-[44px] min-w-[44px] items-center justify-center px-2"',
    );
    expect(source).not.toContain('className="mt-6 min-h-[44px] items-center justify-center py-2"');
  });

  it('keeps cycle settings free of deferred drag affordances', () => {
    const source = readAppRoute('cycle/settings.tsx');

    expect(source).toContain('Scheduled');
    expect(source).toContain('Variant changes recalculate your active nights');
    expect(source).toContain('balanced rest');
    expect(source).toContain('`${cycle.lengthNights} nights generated`');
    expect(source).toContain('accessibilityLabel={`${v.label}. ${sub}`}');
    expect(source).not.toContain("{ id: 'classic', label: 'Classic', sub: '4 nights' }");
    expect(source).not.toContain('Drag-to-reassign');
    expect(source).not.toContain('arrives with the reorder gesture');
    expect(source).not.toContain('B-DRAG-DND');
    expect(source).not.toContain('gap-[3px]');
  });

  it('keeps cycle settings night labels one-based like the week overview', () => {
    const source = readAppRoute('cycle/settings.tsx');

    expect(source).toContain('const cycleNightNumber = n.index + 1;');
    expect(source).toContain('N{cycleNightNumber}');
    expect(source).not.toContain('N{n.index}');
  });

  it('keeps scheduler safety notes visible when no cycle is formed', () => {
    const source = readAppRoute('cycle/week.tsx');
    const noteRenderCount = source.match(/<SchedulerNote note=\{schedulerNote\} \/>/g) ?? [];

    expect(source).toContain('const schedulerNote = data?.notes[0] ?? null;');
    expect(noteRenderCount).toHaveLength(2);
    expect(source.indexOf('No actives to cycle yet.')).toBeLessThan(
      source.lastIndexOf('<SchedulerNote note={schedulerNote} />'),
    );
  });
});
