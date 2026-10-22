"""Run required source checks once, retaining every raw exit including failures."""
import os
from pathlib import Path
import subprocess
import sys

root = Path.cwd()
prefix = 'docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-01/evidence/'
os.environ.update(PATH='/root/onskin-quality-recovery01-tools/bin:/usr/local/bin:/usr/bin:/bin',
    npm_config_cache='/root/onskin-quality-recovery01-final-cache', CI='true', EXPO_NO_TELEMETRY='1',
    GIT_NO_LAZY_FETCH='1')
checks = [
    ('fresh-ci', '.', ['npm', 'ci', '--no-audit', '--no-fund']),
    ('environment', '.', ['python3', '-B', prefix + 'inspect_environment.py']),
    ('registry-expo', '.', ['npm', 'view', 'expo@57.0.31', 'version', 'dist', 'dependencies', '--json']),
    ('registry-network', '.', ['npm', 'view', 'expo-network@57.0.3', 'version', 'dist', '--json']),
    ('expo-compatibility', 'apps/mobile', ['npx', 'expo', 'install', '--check']),
    ('expo-doctor', 'apps/mobile', ['npx', '--yes', 'expo-doctor@1.21.5']),
    ('forced-test', '.', ['npm', 'test', '--', '--force']),
    ('forced-typecheck', '.', ['npm', 'run', 'typecheck', '--', '--force']),
    ('forced-lint', '.', ['npm', 'run', 'lint', '--', '--force']),
    ('installed-native', '.', ['npm', 'run', 'postinstall:check']),
    ('widgets-contract', '.', ['npm', 'run', 'phase5:expo-widgets-lifecycle:test']),
    ('ios-workflow-contract', '.', ['npm', 'run', 'phase5:ios-simulator-compile-workflow:test']),
    ('tooling-fixtures', '.', ['npm', 'run', 'phase9:tooling-security:test']),
    ('view-shot-fixtures', '.', ['npm', 'run', 'phase9:view-shot-privacy:test']),
    ('ios-privacy-fixtures', '.', ['npm', 'run', 'phase9:ios-privacy-source-audit:test']),
    ('ios-privacy-check', '.', ['npm', 'run', 'phase9:ios-privacy-source-audit:check']),
    ('archive-privacy-fixtures', '.', ['npm', 'run', 'phase9:ios-archive-privacy-evidence:test']),
    ('release-git-fixtures', '.', ['npm', 'run', 'phase9:release-candidate-git-contract:test']),
    ('wiring-fixtures', '.', ['npm', 'run', 'phase9:verification-wiring:test']),
    ('store-source-contract', '.', ['npm', 'run', 'phase9:store-build-inspect:check']),
    ('historical-custody', '.', ['python3', '-B', prefix + 'verify_history.py']),
    ('governance', '.', ['python3', '-B', '-m', 'unittest', 'discover', '-s', 'scripts/brain', '-p', 'test_*.py', '-v']),
    ('original-secret-fixtures', '.', ['python3', '-B', '-m', 'unittest', 'discover', '-s',
       'scripts/phase9/security_acceptance', '-p', 'test_secret_scan.py', '-v']),
    ('original-security-contracts', '.', ['python3', '-B', '-m', 'unittest', 'discover', '-s',
       'scripts/phase9/security_acceptance', '-p', 'test_*.py', '-v']),
    ('worklist-check', '.', ['npm', 'run', 'phase4:source-worklist:check']),
    ('strict-source-profile', '.', ['python3', '-B', 'scripts/brain/brain.py', '--profile', 'M1-03', 'validate']),
]
failures = []
for name, cwd, argv in checks:
    print('START', name, flush=True)
    result = subprocess.run([sys.executable, '-B', prefix + 'run_command.py', '--cwd', cwd, name, '--', *argv])
    if result.returncode:
        failures.append((name, result.returncode))
        if name == 'fresh-ci':
            break
print('RAW_NONZERO_RESULTS', failures, flush=True)
sys.exit(bool(failures))
