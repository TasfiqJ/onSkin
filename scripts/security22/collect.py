"""Bounded child lifetime/output. Raw child data never enters public diagnostics."""
import os
import json
import shutil
import signal
import subprocess
import threading
import time
import sys

from redact import Refusal


def windows_job(child):
    """A gated launcher cannot create descendants until assigned to this job."""
    import ctypes
    from ctypes import wintypes
    class BASIC(ctypes.Structure):
        _fields_ = [('processTime', ctypes.c_int64), ('jobTime', ctypes.c_int64),
                    ('flags', wintypes.DWORD), ('minWorking', ctypes.c_size_t),
                    ('maxWorking', ctypes.c_size_t), ('active', wintypes.DWORD),
                    ('affinity', ctypes.c_size_t), ('priority', wintypes.DWORD), ('scheduling', wintypes.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(key, ctypes.c_uint64) for key in ('readOps', 'writeOps', 'otherOps', 'readBytes', 'writeBytes', 'otherBytes')]
    class EXTENDED(ctypes.Structure):
        _fields_ = [('basic', BASIC), ('io', IO), ('processMemory', ctypes.c_size_t),
                    ('jobMemory', ctypes.c_size_t), ('peakProcess', ctypes.c_size_t), ('peakJob', ctypes.c_size_t)]
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.SetInformationJobObject.restype = wintypes.BOOL
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    job = kernel.CreateJobObjectW(None, None)
    if not job:
        raise Refusal('CHILD_CONTAINMENT_UNAVAILABLE')
    limits = EXTENDED(); limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(job, wintypes.HANDLE(int(child._handle))):
        kernel.CloseHandle(job)
        raise Refusal('CHILD_CONTAINMENT_UNAVAILABLE')
    return lambda: kernel.CloseHandle(job)


def stop(child):
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
    else:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def execute(argv, root, seconds=120, limit=8 * 1024 * 1024, input_data=None):
    env = {key: value for key, value in os.environ.items()
           if key.upper() not in ('NODE_OPTIONS', 'NODE_PATH', 'NODE_AUTH_TOKEN', 'PYTHONPATH', 'PYTHONSTARTUP') and
           not key.upper().startswith(('GIT_', 'NPM_'))}
    env.update(PYTHONDONTWRITEBYTECODE='1', GIT_TERMINAL_PROMPT='0', NO_COLOR='1')
    options = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
    if os.name == 'nt':
        executable = shutil.which(argv[0])
        if executable is None:
            raise Refusal('EXECUTABLE_UNAVAILABLE')
        gate = 'import os,sys,subprocess; os.read(0,1); sys.exit(subprocess.call(sys.argv[1:]))'
        command = [sys.executable, '-I', '-B', '-c', gate, executable, *argv[1:]]
        stdin_data = b'\n' + (input_data or b'')
    else:
        command = argv; stdin_data = input_data
    child = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.PIPE if stdin_data is not None else subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, **options)
    close_job = None
    try:
        if os.name == 'nt':
            close_job = windows_job(child)
    except BaseException:
        child.kill(); child.wait(timeout=10)
        for stream in (child.stdin, child.stdout, child.stderr):
            if stream:
                stream.close()
        raise
    output = [bytearray(), bytearray()]
    overflow = threading.Event()
    failed = threading.Event()
    lock = threading.Lock()

    def drain(pipe, index):
        try:
            while True:
                block = pipe.read(65536)
                if not block:
                    break
                with lock:
                    if sum(map(len, output)) + len(block) > limit:
                        overflow.set()
                        break
                    output[index].extend(block)
        except BaseException:
            failed.set()
        finally:
            try:
                pipe.close()
            except BaseException:
                failed.set()

    readers = [threading.Thread(target=drain, args=(pipe, index), daemon=True)
               for index, pipe in enumerate((child.stdout, child.stderr))]
    if stdin_data is not None:
        def feed():
            try:
                child.stdin.write(stdin_data)
            except BaseException:
                failed.set()
            finally:
                try:
                    child.stdin.close()
                except BaseException:
                    failed.set()
        readers.append(threading.Thread(target=feed, daemon=True))
    for reader in readers:
        reader.start()
    deadline = time.monotonic() + seconds
    try:
        while child.poll() is None or any(reader.is_alive() for reader in readers):
            if overflow.is_set() or time.monotonic() >= deadline:
                raise Refusal('OUTPUT_LIMIT' if overflow.is_set() else 'CHILD_TIMEOUT')
            if failed.is_set():
                raise Refusal('CHILD_STREAM_FAILURE')
            time.sleep(.01)
        child.wait(timeout=5)
        if overflow.is_set():
            raise Refusal('OUTPUT_LIMIT')
        if failed.is_set():
            raise Refusal('CHILD_STREAM_FAILURE')
        return child.returncode, bytes(output[0]), bytes(output[1])
    finally:
        if close_job:
            close_job()
        if os.name != 'nt':
            # Also retire detached-stdio descendants after a successful parent exit.
            stop(child)
        for reader in readers:
            reader.join(timeout=5)
        if child.poll() is None:
            child.kill()
        child.wait(timeout=10)
