"""Two preparation-only probes; no identity/admission decision or active ACK changes.

Records static operation names, timing and output lengths, never command arguments
or output contents. A failed probe raises; this module never retries or grants READY.
The 15-second cap is a proposed C16 preparation policy, not a native-qualified fix.
"""
import math
import hashlib
import subprocess
import threading
import time
import uuid

PREPARATION_CAP_SECONDS = 15.0
MAX_OUTPUT_BYTES = 1024 * 1024
MAX_RECORDS = 8
RUNNER_BUNDLE = 'internal.c47.native-ui.xctrunner'


def _bounded_run(argv, *, capture_output, env, timeout):
    """Drain both pipes with a shared byte ceiling; kill/reap our child on refusal.

    Unlike run(capture_output=True), the ceiling applies during collection.
    Fixed preparation commands do not execute through a shell. An overflow
    retains only the bounded prefix and explicitly marks it incomplete.
    """
    end = time.monotonic() + timeout
    parts = [bytearray(), bytearray()]
    lock = threading.Lock()
    overflow = threading.Event()
    read_errors = []

    def drain(stream, index):
        try:
            while True:
                chunk = stream.read1(4096)
                if not chunk:
                    return
                with lock:
                    remaining = MAX_OUTPUT_BYTES - sum(map(len, parts))
                    parts[index].extend(chunk[:remaining])
                    if len(chunk) > remaining:
                        overflow.set()
                        return
        except BaseException as error:
            with lock:
                read_errors.append(error)
            overflow.set()

    process = subprocess.Popen(list(argv), stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    threads = [threading.Thread(target=drain, args=(stream, index), daemon=True)
               for index, stream in enumerate((process.stdout, process.stderr))]
    failure = None
    try:
        for thread in threads:
            thread.start()
        while True:
            if overflow.is_set():
                failure = ValueError('C47_PREPARATION16_OUTPUT_READ' if read_errors
                                     else 'C47_PREPARATION16_OUTPUT_BOUND')
                break
            remaining = end - time.monotonic()
            if remaining <= 0:
                failure = subprocess.TimeoutExpired(list(argv), timeout)
                break
            if process.poll() is not None and not any(t.is_alive() for t in threads):
                break
            overflow.wait(min(.01, remaining))
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=1)
        for thread in threads:
            if thread.ident is not None:
                thread.join(timeout=1)
        for stream in (process.stdout, process.stderr):
            stream.close()
    stdout, stderr = map(bytes, parts)
    if failure is not None:
        failure.output, failure.stderr = stdout, stderr
        failure.capture_truncated = overflow.is_set()
        raise failure
    _require(not any(t.is_alive() for t in threads), 'PIPE_CLEANUP')
    return subprocess.CompletedProcess(list(argv), process.returncode, stdout, stderr)


def _require(value, code):
    if not value:
        raise ValueError('C47_PREPARATION16_' + code)


def _command_allowed(operation, argv):
    if type(argv) not in (list, tuple) or not all(type(x) is str for x in argv):
        return False
    if operation == 'RUNNER_PROCESS_DISCOVERY':
        return list(argv) == ['/bin/ps', '-axo', 'pid=,lstart=,comm=']
    if operation != 'RUNNER_DATA_CONTAINER' or len(argv) != 6:
        return False
    if list(argv[:3]) != ['xcrun', 'simctl', 'get_app_container']:
        return False
    if list(argv[4:]) != [RUNNER_BUNDLE, 'data']:
        return False
    try:
        return len(argv[3]) == 36 and str(uuid.UUID(argv[3])) == argv[3].lower()
    except ValueError:
        return False


def run_preparation_probe16(state, operation, argv, env, deadline_ns, retain_failure=None):
    """Run one probe inside the ORIGINAL absolute UI deadline and a local cap.

    Caller owns state and must pass its existing phase/invalidation fields. The
    result still requires the caller's original PID/path/inventory validation.
    This function is forbidden after arming or after any checkpoint/failure.
    """
    _require(type(state) is dict and state.get('phase') == 'PREPARATION'
             and state.get('invalid', True) is None
             and state.get('armed') is False and state.get('checkpoints') == []
             and 'first_preparation_failure16' not in state,
             'WRONG_PHASE_OR_TERMINAL')
    _require(_command_allowed(operation, argv), 'COMMAND_SHAPE')
    _require(type(deadline_ns) is int and deadline_ns > 0, 'DEADLINE_TYPE')
    now = time.monotonic_ns()
    end = min(deadline_ns, now + int(PREPARATION_CAP_SECONDS * 1e9))
    _require(end > now, 'DEADLINE')
    timeout = (end - now) / 1e9
    _require(math.isfinite(timeout) and 0 < timeout <= PREPARATION_CAP_SECONDS,
             'DEADLINE')
    record = {'operation': operation, 'phase': 'PREPARATION', 'started_ns': now,
              'deadline_ns': end, 'ui_deadline_ns': deadline_ns,
              'timeout_seconds': timeout, 'status': 'STARTED'}
    records = state.setdefault('preparation_probes16', [])
    _require(type(records) is list and len(records) <= MAX_RECORDS, 'RECORD_BOUND')
    probe_lock = state.setdefault('_preparation_probe16_lock', threading.Lock())
    _require(probe_lock.acquire(blocking=False), 'CONCURRENT_PROBE')
    if len(records) == MAX_RECORDS:
        del records[0]
        state['preparation_probes16_evicted'] = state.get('preparation_probes16_evicted', 0) + 1
    records.append(record)
    state['preparation_operation16'] = operation
    stdout, stderr = b'', b''
    try:
        _require(state.get('invalid') is None and state.get('phase') == 'PREPARATION'
                 and state.get('armed') is False and state.get('checkpoints') == []
                 and 'first_preparation_failure16' not in state, 'TERMINAL_DURING_PROBE')
        result = _bounded_run(list(argv), capture_output=True, env=env, timeout=timeout)
        _require(type(result.stdout) is bytes and type(result.stderr) is bytes, 'OUTPUT_TYPE')
        stdout, stderr = result.stdout, result.stderr
        record.update(returncode=result.returncode, stdout_bytes=len(result.stdout),
                      stderr_bytes=len(result.stderr))
        _require(len(result.stdout) + len(result.stderr) <= MAX_OUTPUT_BYTES, 'OUTPUT_BOUND')
        _require(time.monotonic_ns() < end, 'DEADLINE')
        _require(result.returncode == 0, 'EXIT')
        _require(state.get('invalid') is None and state.get('phase') == 'PREPARATION'
                 and state.get('armed') is False and state.get('checkpoints') == [],
                 'TERMINAL_DURING_PROBE')
        record['status'] = 'COMPLETED_NOT_IDENTITY_ACCEPTED'
        return result
    except BaseException as error:
        record['status'] = 'TIMEOUT' if isinstance(error, subprocess.TimeoutExpired) else 'FAILED'
        record['error_type'] = ('TimeoutExpired' if isinstance(error, subprocess.TimeoutExpired)
                                else 'OSError' if isinstance(error, OSError) else 'OTHER')
        if isinstance(error, ValueError) and str(error).startswith('C47_PREPARATION16_'):
            record['code'] = str(error)
        for key in ('errno', 'winerror'):
            if type(getattr(error, key, None)) is int:
                record[key] = getattr(error, key)
        if type(getattr(error, 'output', None)) is bytes:
            stdout = error.output
        if type(getattr(error, 'stderr', None)) is bytes:
            stderr = error.stderr
        record['capture_truncated'] = bool(getattr(error, 'capture_truncated', False))
        record['stdout_bytes'], record['stderr_bytes'] = len(stdout), len(stderr)
        if 'first_preparation_failure16' not in state:
            state['first_preparation_failure16'] = record
        raise
    finally:
        record['finished_ns'] = time.monotonic_ns()
        record['elapsed_ns'] = record['finished_ns'] - now
        record['stdout_sha256'] = hashlib.sha256(stdout).hexdigest()
        record['stderr_sha256'] = hashlib.sha256(stderr).hexdigest()
        try:
            if record['status'] != 'COMPLETED_NOT_IDENTITY_ACCEPTED' and retain_failure:
                try:
                    record['retention'] = retain_failure(dict(record), stdout, stderr)
                except BaseException as error:
                    record['retention'] = {'status': 'FAILED', 'error_type': type(error).__name__}
                    raise
        finally:
            probe_lock.release()
