"""Linux child launcher: clean environment plus inherited syscall network denial."""
import ctypes, ctypes.util, errno, os, pathlib, socket, sys


def deny_network():
    lib=ctypes.CDLL(ctypes.util.find_library('seccomp'), use_errno=True)
    lib.seccomp_init.argtypes=[ctypes.c_uint32];lib.seccomp_init.restype=ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes=[ctypes.c_char_p];lib.seccomp_syscall_resolve_name.restype=ctypes.c_int
    lib.seccomp_load.argtypes=[ctypes.c_void_p];lib.seccomp_load.restype=ctypes.c_int
    lib.seccomp_release.argtypes=[ctypes.c_void_p]
    class Compare(ctypes.Structure):
        _fields_=[('arg',ctypes.c_uint),('op',ctypes.c_uint),('a',ctypes.c_uint64),('b',ctypes.c_uint64)]
    lib.seccomp_rule_add.argtypes=[ctypes.c_void_p,ctypes.c_uint32,ctypes.c_int,ctypes.c_uint]
    lib.seccomp_rule_add.restype=ctypes.c_int
    ctx=lib.seccomp_init(0x7fff0000)
    if not ctx: raise RuntimeError('SECCOMP_UNAVAILABLE')
    try:
        action=0x00050000 | errno.EPERM
        for name in [b'connect',b'bind',b'listen']:
            if lib.seccomp_rule_add(ctx,action,lib.seccomp_syscall_resolve_name(name),0)!=0:raise RuntimeError('SECCOMP_RULE')
        for family in [socket.AF_INET,socket.AF_INET6]:
            if lib.seccomp_rule_add(ctx,action,lib.seccomp_syscall_resolve_name(b'socket'),1,Compare(0,4,family,0))!=0:raise RuntimeError('SECCOMP_SOCKET_RULE')
        if lib.seccomp_load(ctx)!=0:raise RuntimeError('SECCOMP_LOAD')
    finally:lib.seccomp_release(ctx)


def clean_env(home, bin_dir):
    return dict(PATH=str(bin_dir)+':/usr/local/bin:/usr/bin:/bin',HOME=str(home),
        LANG='C.UTF-8',PYTHONDONTWRITEBYTECODE='1',SEMGREP_SEND_METRICS='off',
        SEMGREP_ENABLE_VERSION_CHECK='0',SEMGREP_APP_TOKEN='',OTEL_SDK_DISABLED='true',
        SEMGREP_SETTINGS_FILE=str(home/'settings.yml'),NO_COLOR='1')


if __name__=='__main__':
    # Callers supply only public source paths and local commands. Clear inherited
    # credentials/proxy/instrumentation variables before a child can inspect them.
    home=pathlib.Path(sys.argv[1]);home.mkdir(exist_ok=True,mode=0o700)
    command=sys.argv[2:];os.environ.clear();os.environ.update(clean_env(home,pathlib.Path(command[0]).parent))
    deny_network();os.execvpe(command[0],command,dict(os.environ))
