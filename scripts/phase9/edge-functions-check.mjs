#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { block, printResult, root } from './lib.mjs';

const errors = [];
const warnings = [];
const functionsDir = 'supabase/functions';
const lockPath = 'supabase/functions/deno.lock';
const entrypoints = readdirSync(join(root, functionsDir), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(functionsDir, entry.name, 'index.ts').replace(/\\/g, '/'))
  .filter((entrypoint) => existsSync(join(root, entrypoint)))
  .sort();

block(errors, entrypoints.length > 0, 'No Supabase Edge Function entrypoints found.');
block(errors, existsSync(join(root, lockPath)), `${lockPath} is missing.`);

function resolveDenoBin() {
  if (process.platform !== 'win32') return 'deno';
  try {
    const candidates = execFileSync('where.exe', ['deno'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const candidate of candidates) {
      if (candidate.toLowerCase().endsWith('.exe') && existsSync(candidate)) return candidate;
      const npmInstalledDeno = join(dirname(candidate), 'node_modules', 'deno', 'deno.exe');
      if (existsSync(npmInstalledDeno)) return npmInstalledDeno;
    }
  } catch {
    return 'deno.exe';
  }
  return 'deno.exe';
}

if (errors.length === 0) {
  try {
    const denoBin = resolveDenoBin();
    execFileSync(
      denoBin,
      ['check', '--no-config', '--node-modules-dir=auto', `--lock=${lockPath}`, '--frozen=true', ...entrypoints],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (error) {
    if (error && typeof error === 'object') {
      const message = 'message' in error ? String(error.message ?? '').trim() : '';
      const stderr = 'stderr' in error ? String(error.stderr ?? '').trim() : '';
      const stdout = 'stdout' in error ? String(error.stdout ?? '').trim() : '';
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      if (!stdout && !stderr && message) console.error(message);
    }
    errors.push('Deno Edge Function type check failed.');
  }
}

printResult('Phase 9 Edge Function Deno check', errors, warnings);
