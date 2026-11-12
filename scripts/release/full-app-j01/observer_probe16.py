"""Two preparation-only probes; no identity/admission decision or active ACK changes.

Records static operation names, timing and output lengths, never command arguments
or output contents. A failed probe raises; this module never retries or grants READY.
The 15-second cap is a proposed C16 preparation policy, not a native-qualified fix.
"""
import math
import subprocess
import time
import uuid

PREPARATION_CAP_SECONDS = 15.0
MAX_OUTPUT_BYTES = 1024 * 1024
MAX_RECORDS = 8
RUNNER_BUNDLE = 'internal.c47.native-ui.xctrunner'


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


def run_preparation_probe16(state, operation, argv, env, deadline_ns):
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
    if len(records) == MAX_RECORDS:
        del records[0]
        state['preparation_probes16_evicted'] = state.get('preparation_probes16_evicted', 0) + 1
    records.append(record)
    state['preparation_operation16'] = operation
    try:
        result = subprocess.run(list(argv), capture_output=True, env=env, timeout=timeout)
        _require(type(result.stdout) is bytes and type(result.stderr) is bytes, 'OUTPUT_TYPE')
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
        if isinstance(error, subprocess.TimeoutExpired):
            # Only lengths; neither partial output nor error.cmd enters the record.
            record['stdout_bytes'] = len(error.output) if type(error.output) is bytes else None
            record['stderr_bytes'] = len(error.stderr) if type(error.stderr) is bytes else None
        if 'first_preparation_failure16' not in state:
            state['first_preparation_failure16'] = record
        raise
    finally:
        record['finished_ns'] = time.monotonic_ns()
        record['elapsed_ns'] = record['finished_ns'] - now
