"""Run unchanged discovered tests with authentic frozen predecessor fixture inputs."""
import pathlib
import subprocess
import sys
import unittest

CURRENT = pathlib.Path('/root/onskin-quality-recovery03-source')
FROZEN = pathlib.Path('/root/onskin-quality-recovery02-source')
sys.path.insert(0, str(CURRENT / 'scripts/brain'))
import brain

assert subprocess.check_output(['git', '-C', str(FROZEN), 'rev-parse', 'HEAD']).decode().strip() == '3dcaf50633024ec652fe7b14a5c9072eac92642e'
assert subprocess.check_output(['git', '-C', str(FROZEN), 'rev-parse', 'HEAD^{tree}']).decode().strip() == 'fd98eedb0cef6644d8e1538047aacbe44f10d837'
assert not subprocess.check_output(['git', '-C', str(FROZEN), 'status', '--porcelain=v1'])
for path in (CURRENT / 'scripts/brain').glob('test_*.py'):
    if path.name != 'test_m103_quality_recovery03_profile.py':
        assert path.read_bytes() == subprocess.check_output(['git', '-C', str(FROZEN), 'show', 'HEAD:scripts/brain/' + path.name])

class FrozenFixtureInputs(unittest.TestSuite):
    def run(self, result, debug=False):
        tests = list(self)
        def first(suite):
            return first(list(suite)[0]) if isinstance(suite, unittest.TestSuite) else suite
        module = first(tests[0]).__class__.__module__
        brain.ROOT = CURRENT if module == 'test_m103_quality_recovery03_profile' else FROZEN
        print('FIXTURE_ENDPOINT', module, brain.ROOT, flush=True)
        try:
            return super().run(result, debug)
        finally:
            brain.ROOT = CURRENT

pattern = sys.argv[1] if len(sys.argv) > 1 else 'test_*.py'
discovered = unittest.defaultTestLoader.discover(str(CURRENT / 'scripts/brain'), pattern=pattern)
suite = unittest.TestSuite(FrozenFixtureInputs([module]) for module in discovered)
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
