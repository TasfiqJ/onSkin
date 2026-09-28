const ANSI_ESCAPE = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/gu;

function normalizedLines(value) {
  return String(value ?? '')
    .replace(ANSI_ESCAPE, '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function reportsPinnedEmptySchemaDiff({ stdout, stderr }) {
  const expected = 'No schema changes found';
  const stderrMatches = normalizedLines(stderr).filter((line) => line === expected).length;
  const stdoutMatches = normalizedLines(stdout).filter((line) => line === expected).length;
  return stderrMatches === 1 && stdoutMatches === 0;
}
