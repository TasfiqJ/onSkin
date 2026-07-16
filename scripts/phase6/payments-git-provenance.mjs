function deepFreezeResult(result) {
  Object.freeze(result.blockers);
  Object.freeze(result.warnings);
  return Object.freeze(result);
}

export function auditPhase6GitProvenance(input) {
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(',') !== 'captured,sha,status' ||
    typeof input.captured !== 'boolean'
  ) {
    throw new TypeError('Phase 6 Git provenance input is malformed.');
  }

  if (
    !input.captured ||
    typeof input.sha !== 'string' ||
    !/^[0-9a-f]{40}$/.test(input.sha) ||
    typeof input.status !== 'string'
  ) {
    return deepFreezeResult({
      valid: false,
      captured: false,
      gitSha: 'unknown',
      gitStatus: 'unknown',
      blockers: ['Phase 6 Git provenance is unavailable or noncanonical.'],
      warnings: [],
    });
  }

  if (input.status.length > 0) {
    return deepFreezeResult({
      valid: false,
      captured: true,
      gitSha: input.sha,
      gitStatus: input.status,
      blockers: ['Phase 6 final payments evidence requires a clean Git worktree.'],
      warnings: [
        'Phase 6 payments QA packet generated with a dirty Git worktree; do not use it as final payments evidence.',
      ],
    });
  }

  return deepFreezeResult({
    valid: true,
    captured: true,
    gitSha: input.sha,
    gitStatus: '',
    blockers: [],
    warnings: [],
  });
}
