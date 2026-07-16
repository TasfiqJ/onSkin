#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  IOS_PRIVACY_AUDIT_JSON_PATH,
  IOS_PRIVACY_AUDIT_MARKDOWN_PATH,
  auditIosPrivacySource,
  canonicalAuditJson,
  renderIosPrivacySourceAuditMarkdown,
} from './ios-privacy-contract.mjs';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_GENERATED_OUTPUT_BYTES = 64 * 1024 * 1024;

function usage() {
  return [
    'Usage: node scripts/phase9/ios-privacy-source-audit.mjs [options]',
    '',
    'Options:',
    '  --root <absolute-or-relative-directory>  Audit root (default: repository containing this script)',
    `  --json <repo-relative-path>              JSON output (default: ${IOS_PRIVACY_AUDIT_JSON_PATH})`,
    `  --markdown <repo-relative-path>          Markdown output (default: ${IOS_PRIVACY_AUDIT_MARKDOWN_PATH})`,
    '  --write                                  Deterministically write both generated outputs',
    '  --check                                  Read-only byte check of both generated outputs',
    '  --strict                                 Exit nonzero when source evidence is invalid',
    '  --help                                   Show this help',
  ].join('\n');
}

function parseArgs(argv) {
  const result = {
    root: SCRIPT_ROOT,
    jsonPath: IOS_PRIVACY_AUDIT_JSON_PATH,
    markdownPath: IOS_PRIVACY_AUDIT_MARKDOWN_PATH,
    write: false,
    check: false,
    strict: false,
    help: false,
  };
  const seen = new Set();
  const valueFlags = new Map([
    ['--root', 'root'],
    ['--json', 'jsonPath'],
    ['--markdown', 'markdownPath'],
  ]);
  const booleanFlags = new Map([
    ['--write', 'write'],
    ['--check', 'check'],
    ['--strict', 'strict'],
    ['--help', 'help'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (seen.has(argument)) throw new Error(`Duplicate argument: ${argument}`);
    if (valueFlags.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      seen.add(argument);
      result[valueFlags.get(argument)] = value;
      index += 1;
      continue;
    }
    if (booleanFlags.has(argument)) {
      seen.add(argument);
      result[booleanFlags.get(argument)] = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.write && result.check) throw new Error('--write and --check are mutually exclusive.');
  result.root = resolve(result.root);
  return Object.freeze(result);
}

function normalizedOutputPath(root, value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.includes('\\') ||
    value.includes('\0') ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`Output path must be normalized and repository-relative: ${String(value)}`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Output path contains an unsafe segment: ${value}`);
  }
  const absolute = resolve(root, ...segments);
  const fromRoot = relative(root, absolute);
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`Output path escapes the audit root: ${value}`);
  }
  return { absolute, relative: value };
}

function assertNoSymlinkComponents(root, absolute, allowMissing, finalKind = 'file') {
  const fromRoot = relative(root, absolute);
  const segments = fromRoot.split(sep);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index]);
    if (!existsSync(current)) {
      if (allowMissing) return;
      throw new Error(`Generated output is missing: ${fromRoot.split(sep).join('/')}`);
    }
    const stat = lstatSync(current);
    if (stat.isSymbolicLink())
      throw new Error(`Generated output path contains a symlink: ${fromRoot}`);
    const final = index === segments.length - 1;
    if (
      (!final && !stat.isDirectory()) ||
      (final && finalKind === 'file' && !stat.isFile()) ||
      (final && finalKind === 'directory' && !stat.isDirectory())
    ) {
      throw new Error(`Generated output path has the wrong filesystem type: ${fromRoot}`);
    }
  }
}

function readCheckedOutput(root, output) {
  assertNoSymlinkComponents(root, output.absolute, false);
  const before = lstatSync(output.absolute, { bigint: true });
  if (before.nlink !== 1n) {
    throw new Error(`Generated output must not be a hardlink: ${output.relative}`);
  }
  if (before.size > BigInt(MAX_GENERATED_OUTPUT_BYTES)) {
    throw new Error(
      `Generated output exceeds ${MAX_GENERATED_OUTPUT_BYTES} bytes: ${output.relative}`,
    );
  }
  let descriptor;
  try {
    descriptor = openSync(output.absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      before.dev !== opened.dev ||
      before.ino !== opened.ino ||
      before.size !== opened.size ||
      before.mtimeNs !== opened.mtimeNs
    ) {
      throw new Error(`Generated output identity changed before it was read: ${output.relative}`);
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== after.dev ||
      opened.ino !== after.ino ||
      opened.size !== after.size ||
      opened.mtimeNs !== after.mtimeNs ||
      BigInt(bytes.length) !== after.size
    ) {
      throw new Error(`Generated output changed while it was read: ${output.relative}`);
    }
    return bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writeCheckedOutput(root, output, contents) {
  const bytes = Buffer.from(contents, 'utf8');
  if (bytes.length > MAX_GENERATED_OUTPUT_BYTES) {
    throw new Error(
      `Generated output exceeds ${MAX_GENERATED_OUTPUT_BYTES} bytes: ${output.relative}`,
    );
  }
  assertNoSymlinkComponents(root, output.absolute, true);
  mkdirSync(dirname(output.absolute), { recursive: true });
  assertNoSymlinkComponents(root, dirname(output.absolute), false, 'directory');
  if (existsSync(output.absolute)) {
    const stat = lstatSync(output.absolute, { bigint: true });
    if (stat.nlink !== 1n) {
      throw new Error(`Generated output must not be a hardlink: ${output.relative}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Generated output is not a regular file: ${output.relative}`);
    }
  }
  const temporary = resolve(
    dirname(output.absolute),
    `.${basename(output.absolute)}.routinekind-${process.pid}-${randomBytes(12).toString('hex')}.tmp`,
  );
  let descriptor;
  try {
    descriptor = openSync(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    const stat = fstatSync(descriptor, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n) {
      throw new Error(
        `Generated temporary output is not a single-link regular file: ${output.relative}`,
      );
    }
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (count <= 0)
        throw new Error(`Generated output write made no progress: ${output.relative}`);
      offset += count;
    }
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    assertNoSymlinkComponents(root, output.absolute, true);
    renameSync(temporary, output.absolute);
    compareOutput(root, output, contents);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function compareOutput(root, output, expected) {
  const actual = readCheckedOutput(root, output);
  const wanted = Buffer.from(expected, 'utf8');
  if (!actual.equals(wanted))
    throw new Error(`Generated output has deterministic drift: ${output.relative}`);
}

function outputPathsCollide(left, right) {
  if (left.absolute === right.absolute) return true;
  if (
    (process.platform === 'win32' || process.platform === 'darwin') &&
    left.absolute.toLowerCase() === right.absolute.toLowerCase()
  ) {
    return true;
  }
  if (existsSync(left.absolute) && existsSync(right.absolute)) {
    const leftStat = lstatSync(left.absolute, { bigint: true });
    const rightStat = lstatSync(right.absolute, { bigint: true });
    return (
      (leftStat.nlink > 1n || rightStat.nlink > 1n) &&
      leftStat.dev === rightStat.dev &&
      leftStat.ino === rightStat.ino
    );
  }
  return false;
}

export function runIosPrivacySourceAudit(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.help) {
    io.log(usage());
    return 0;
  }
  const jsonOutput = normalizedOutputPath(options.root, options.jsonPath);
  const markdownOutput = normalizedOutputPath(options.root, options.markdownPath);
  if (outputPathsCollide(jsonOutput, markdownOutput)) {
    throw new Error('--json and --markdown must name different files.');
  }
  const report = auditIosPrivacySource({ root: options.root });
  const json = canonicalAuditJson(report);
  const markdown = renderIosPrivacySourceAuditMarkdown(report);
  if (options.strict && report.status === 'source_invalid') {
    for (const error of report.errors)
      io.error(`${error.code}: ${error.path ?? '-'}: ${error.message}`);
    io.error('iOS privacy source audit failed strict validation.');
    return 1;
  }
  if (options.check) {
    compareOutput(options.root, jsonOutput, json);
    compareOutput(options.root, markdownOutput, markdown);
    io.log(`iOS privacy source audit outputs are current (${report.status}).`);
  } else if (options.write) {
    writeCheckedOutput(options.root, jsonOutput, json);
    writeCheckedOutput(options.root, markdownOutput, markdown);
    io.log(`Wrote deterministic iOS privacy source audit outputs (${report.status}).`);
  } else {
    io.log(json);
  }
  if (report.status === 'archive_required') {
    io.warn(
      'Archive follow-up is required; this source audit makes no archive or App Store acceptance claim.',
    );
  }
  return 0;
}

function main() {
  try {
    process.exitCode = runIosPrivacySourceAudit();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
