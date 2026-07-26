import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const PLAN_PATH = `${REPO_ROOT}/docs/MAXIMUM_REACT_NATIVE_OPTIMIZATION_PLAN.md`;
const STATUS_PATH = `${REPO_ROOT}/docs/optimization/IMPLEMENTATION_STATUS.md`;
const FINAL_STATUSES = new Set(['verified', 'blocked-external', 'not-applicable']);
const EMPTY_EVIDENCE = /^(?:—|-)?$/;
const EXTERNAL_BLOCKER_LANGUAGE =
  /\b(?:approved|artifact|authoritative|budget|counsel|credential|decision|device|external|hardware|hosted|native|operations|owner|physical|production|provider|review|signed|staging|threshold)\b/i;

type LedgerRow = Readonly<{
  id: string;
  status: string;
  implementation: string;
  evidence: string;
  commands: string;
  blocker: string;
}>;

function planIdOccurrences(source: string): string[] {
  return [
    ...source.matchAll(/^###\s+(PERF-P0-\d{3})\b/gm),
    ...source.matchAll(/^\|\s*(OPT-\d{3})\s*\|/gm),
  ].map((match) => match[1]!);
}

function ledgerRows(source: string): LedgerRow[] {
  return source
    .split(/\r?\n/)
    .filter((line) => /^\|\s*(?:PERF-P0|OPT)-\d{3}\s*\|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      expect(cells).toHaveLength(6);
      return {
        id: cells[0]!,
        status: cells[1]!,
        implementation: cells[2]!,
        evidence: cells[3]!,
        commands: cells[4]!,
        blocker: cells[5]!,
      };
    });
}

describe('maximum optimization implementation ledger finality', () => {
  const plan = readFileSync(PLAN_PATH, 'utf8');
  const status = readFileSync(STATUS_PATH, 'utf8');
  const rows = ledgerRows(status);

  it('contains exactly one row for every plan task and performance gate', () => {
    const planOccurrences = planIdOccurrences(plan);
    const expected = [...planOccurrences].sort();
    const actual = rows.map((row) => row.id).sort();

    expect(planOccurrences).toHaveLength(61);
    expect(new Set(planOccurrences).size).toBe(planOccurrences.length);
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
  });

  it('uses only terminal statuses at the final local closure checkpoint', () => {
    const provisional = rows
      .filter((row) => !FINAL_STATUSES.has(row.status))
      .map((row) => `${row.id}:${row.status}`);

    expect(provisional).toEqual([]);
  });

  it('keeps every terminal classification evidence-backed and explicit', () => {
    for (const row of rows) {
      if (!FINAL_STATUSES.has(row.status)) continue;
      expect(row.blocker.length, `${row.id} needs an explicit terminal rationale`).toBeGreaterThan(
        39,
      );

      if (row.status === 'blocked-external') {
        expect(row.implementation, `${row.id} needs implementation scope`).not.toMatch(
          EMPTY_EVIDENCE,
        );
        expect(row.evidence, `${row.id} needs test/evidence scope`).not.toMatch(EMPTY_EVIDENCE);
        expect(row.commands, `${row.id} needs command/evidence results`).not.toMatch(
          EMPTY_EVIDENCE,
        );
        expect(
          EXTERNAL_BLOCKER_LANGUAGE.test(row.blocker),
          `${row.id} must name its external dependency`,
        ).toBe(true);
      } else if (row.status === 'verified') {
        expect(row.implementation, `${row.id} needs implementation evidence`).not.toMatch(
          EMPTY_EVIDENCE,
        );
        expect(row.evidence, `${row.id} needs test/evidence files`).not.toMatch(EMPTY_EVIDENCE);
        expect(row.commands, `${row.id} needs command/evidence results`).not.toMatch(
          EMPTY_EVIDENCE,
        );
      } else {
        expect(row.blocker, `${row.id} needs a not-applicable rationale`).toMatch(
          /\b(?:not applicable|reactivate|release|precondition|scope)\b/i,
        );
      }
    }
  });
});
