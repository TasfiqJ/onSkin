function normalizeRepoPath(value) {
  return String(value ?? '')
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '');
}

function markdownTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, index) =>
    Math.max(...allRows.map((row) => String(row[index] ?? '').length), 3),
  );
  const render = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [
    render(headers),
    render(widths.map((width) => '-'.repeat(width))),
    ...rows.map(render),
  ].join('\n');
}

export function renderHumanE2eManifestMarkdown(packet) {
  const gateResults = Array.isArray(packet?.gateResults) ? packet.gateResults : [];
  const warnings = Array.isArray(packet?.warnings) ? packet.warnings : [];
  const blockers = Array.isArray(packet?.blockers) ? packet.blockers : [];
  const chain = packet?.governedEvidenceChain ?? {};
  const gateRows = gateResults.map((gate) => [
    gate?.title,
    gate?.supportClass,
    gate?.status,
    gate?.detail,
    gate?.fileCount,
    normalizeRepoPath(gate?.folder),
  ]);

  return [
    '# Human E2E Manifest',
    '',
    `Generated: ${packet?.generatedAt}`,
    `Git SHA: ${packet?.gitSha || 'unknown'}`,
    `Evidence date: ${packet?.evidenceDate}`,
    `Baseline suite date: ${packet?.baselineEvidenceDate}`,
    `Status: ${packet?.status}`,
    '',
    '## Governed Evidence Chain',
    '',
    `- Status: ${chain.status ?? 'blocked'}`,
    `- Source S: ${chain.sourceGitSha ?? 'BLOCKED'}`,
    `- Evidence E: ${chain.evidenceCommitSha ?? 'BLOCKED'}`,
    `- Current R/F HEAD: ${chain.currentGitSha ?? 'BLOCKED'}`,
    `- Selected RC: ${chain.releaseCandidateDir ?? 'BLOCKED'}`,
    `- Ledger: ${chain.ledgerPath ?? 'BLOCKED'}`,
    `- Ledger SHA-256: ${chain.ledgerSha256 ?? 'BLOCKED'}`,
    `- Ledger entries: ${chain.ledgerEntryCount ?? 0}`,
    `- Downstream generated commits: ${chain.downstreamCommitCount ?? 0}`,
    '',
    'This generated packet is created by `npm run e2e:human:manifest`. It turns',
    'the committed Expo web-compatible human-simulated E2E evidence into a',
    'repeatable local gate without adding a Playwright, Detox, Maestro, or Appium',
    'dependency to the repo.',
    '',
    '## Gates',
    '',
    markdownTable(['Gate', 'Class', 'Status', 'Detail', 'Files', 'Folder'], gateRows),
    '',
    '## Warnings',
    '',
    ...warnings.map((warning) => `- ${warning}`),
    '',
    '## Blockers',
    '',
    ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
    '',
  ].join('\n');
}
