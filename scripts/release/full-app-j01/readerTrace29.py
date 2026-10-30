"""Bounded, sanitized execution of the exact PR32 reader-control main functions.

The original test bytes and assertions are unchanged. Only their import loader
is directed to authenticated frozen reader bytes for the separate baseline.
An observed reproduction is not recovery of the suppressed historical exception.
"""
import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch


BASE29 = 'bace116586d58ed955f0a024ca96ae9f4ad9286d'
TREE29 = '6951590547b79a869464df987d16da6552907846'
PINS29 = {
    27: ('344c6aea46306943ced4e3afdaa9c7b206b1a2d99d861a8fc1204736ffe97e18',
         'db148996257c296497c1bf2f4aceb9ce24305d18ce30138efef79aa84b8c1ee0'),
    28: ('256b07a2378dd1cf2dbb3eb43073667bf286b1f7bed88e23d586e5c1498bc0d2',
         '27437e535115cc68f072c826c47f2944c043442b29782d8cc7cf36b151168b50'),
}


def require29(value):
    if not value:
        raise ValueError('R29_TRACE_SOURCE_IDENTITY')


def git29(root, *args):
    process = subprocess.run(['git', '--no-replace-objects', *args], cwd=root,
                             capture_output=True, timeout=30)
    require29(process.returncode == 0 and len(process.stdout) <= 1024*1024)
    return process.stdout


def trace29(root, release, frozen=True):
    require29(not sys.flags.optimize and release in PINS29)
    require29(git29(root, 'rev-parse', BASE29+'^{tree}').decode().strip() == TREE29)
    area = root/'scripts/release/full-app-j01'
    reader_path = area/('replay'+str(release)+'.py')
    test_path = area/('replay'+str(release)+'.test.py')
    prefix = 'scripts/release/full-app-j01/'
    reader = git29(root, 'show', BASE29+':'+prefix+reader_path.name)
    test = git29(root, 'show', BASE29+':'+prefix+test_path.name)
    require29(hashlib.sha256(reader).hexdigest() == PINS29[release][0] and
              hashlib.sha256(test).hexdigest() == PINS29[release][1] and
              test_path.read_bytes() == test)
    if not frozen:
        reader = reader_path.read_bytes()
    original_spec = importlib.util.spec_from_file_location
    observations = []

    class FrozenLoader:
        def create_module(self, spec):
            return None

        def exec_module(self, module):
            module.__file__ = str(reader_path)
            exec(compile(reader, '<authenticated-reader>', 'exec'), module.__dict__)
            read = getattr(module, 'bytes'+str(release))
            same = getattr(module, 'same'+str(release))

            def observed(path, *args, **kwargs):
                # This is synthetic fixture data only. Never export raw paths,
                # bytes, arbitrary exception text or source-derived identifiers.
                before = Path(path).lstat() if Path(path).exists() else None
                try:
                    result = read(path, *args, **kwargs)
                except BaseException:
                    raise
                if before is not None and Path(path).is_file():
                    after = Path(path).lstat()
                    backing = Path(path).read_bytes()
                    if result != backing:
                        observations.append(dict(returnedBytesEqualBacking=False,
                            sameSize=len(result) == len(backing),
                            pathnameMetadataUnchanged=same(before, after),
                            returnedFirstByteChanged=bool(result and backing and result[0] != backing[0])))
                return result

            setattr(module, 'bytes'+str(release), observed)

    def load(name, location, *args, **kwargs):
        if name == 'replay'+str(release) and Path(location) == reader_path:
            return importlib.util.spec_from_loader(name, FrozenLoader())
        return original_spec(name, location, *args, **kwargs)

    namespace = {'__name__': 'reader29_diagnostic', '__file__': str(test_path)}
    output = io.StringIO()
    error_type = label = None
    frames = []
    with contextlib.redirect_stdout(output), patch.object(importlib.util, 'spec_from_file_location', load):
        exec(compile(test, '<authenticated-original-reader-test>', 'exec'), namespace)
        try:
            namespace['main']()
        except Exception as error:
            error_type = type(error).__name__
            # Original AssertionError labels are public fixed test-case names.
            if type(error) is AssertionError and len(error.args) == 1 and error.args[0] in (
                    'real-midread-same-size', 'real-midread-truncate', 'real-midread-grow',
                    'real-midread-substitute'):
                label = error.args[0]
            cursor = error.__traceback__
            while cursor:
                frame = cursor.tb_frame
                if frame.f_code.co_filename == '<authenticated-original-reader-test>':
                    frames.append(dict(function=frame.f_code.co_name, line=cursor.tb_lineno))
                cursor = cursor.tb_next
    raw = output.getvalue()
    require29(len(raw.encode()) <= 1024*1024 and len(observations) <= 16)
    rows = [json.loads(line) for line in raw.splitlines()]
    last_case = next((row.get('case') for row in reversed(rows) if 'case' in row), None)
    baseline_status = ('BASELINE_RED_REPRODUCED' if label == 'real-midread-same-size' else
                       'BASELINE_OTHER_FAILURE') if error_type else 'BASELINE_NOT_REPRODUCED'
    return dict(status=baseline_status if frozen else
        ('CURRENT_READER_CONTROLS_FAIL' if error_type else 'CURRENT_READER_CONTROLS_PASS'),
        observedExit=1 if error_type else 0, releaseNumber=release,
        readerSource='FROZEN_PR32' if frozen else 'CURRENT29',
        readerSHA256=hashlib.sha256(reader).hexdigest(), testSHA256=PINS29[release][1],
        originalTestBytesUnchanged=True, originalAssertionsUnchanged=True,
        observedPython=list(sys.version_info[:3]), platform=sys.platform,
        exceptionType=error_type, failedCase=label, testFrames=frames, lastCompletedCase=last_case,
        mismatchedReadObservations=observations, originalRows=rows,
        historicalSuppressedException='UNKNOWN',
        qualification='BOUNDED_LOCAL_REPRODUCTION_NOT_RECOVERY_OF_HISTORICAL_EXCEPTION',
        acceptanceGranted=False, release='NO_GO')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--baseline', action='store_true', help='default: trace exact frozen PR32 sources')
    mode.add_argument('--current', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    results = [trace29(root, number, not args.current) for number in PINS29]
    for result in results:
        print(json.dumps(result, sort_keys=True), flush=True)
    return int(args.current and any(row['observedExit'] for row in results))


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        print(json.dumps(dict(status='FAIL', code='R29_TRACE_INCOMPLETE',
                              acceptanceGranted=False, release='NO_GO')))
        raise SystemExit(1) from None
