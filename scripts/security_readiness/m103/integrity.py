"""Fail closed filesystem measurements and Linux mutation witnesses.

The kernel, this verifier and the independently retained manifest digest are trust
inputs. This is private diagnostic isolation, never scanner admission.
"""
import ctypes, hashlib, os, pathlib, stat, struct


def require(ok, reason):
    if not ok: raise ValueError(reason)


def regular(path):
    path=pathlib.Path(path)
    fd=os.open(path,os.O_RDONLY | getattr(os,'O_NOFOLLOW',0) | getattr(os,'O_NONBLOCK',0))
    try:
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink==1,'NONREGULAR_OR_MULTILINK_INPUT')
        with os.fdopen(os.dup(fd),'rb') as stream:raw=stream.read()
        after=os.fstat(fd); current=path.lstat()
        identity=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mode,s.st_nlink,s.st_mtime_ns,s.st_ctime_ns)
        require(identity(before)==identity(after)==identity(current),'INPUT_CHANGED_DURING_READ')
        return raw
    finally:os.close(fd)


def tree(root, venv=False, system=False):
    root=pathlib.Path(root)
    require(stat.S_ISDIR(root.lstat().st_mode),'LINK_OR_NONDIR_ROOT')
    rows=[]
    def visit(directory):
        for p in sorted(directory.iterdir()):
            name=p.relative_to(root).as_posix(); info=p.lstat()
            if stat.S_ISLNK(info.st_mode):
                require(system or venv and (name=='lib64' and os.readlink(p)=='lib' or
                    name in {'bin/python','bin/python3','bin/python3.12'}),'UNEXPECTED_LINK')
                target=p.resolve(strict=True)
                require(name=='lib64' or target.is_file(),'BROKEN_INTERPRETER_LINK')
                rows.append(dict(path=name,link=os.readlink(p),resolved=str(target) if name!='lib64' else None,
                    target_sha256=hashlib.sha256(regular(target)).hexdigest() if name!='lib64' else None))
            elif stat.S_ISDIR(info.st_mode):
                rows.append(dict(path=name,directory=True,mode=stat.S_IMODE(info.st_mode)))
                visit(p)
            else:
                raw=regular(p)
                rows.append(dict(path=name,bytes=len(raw),mode=stat.S_IMODE(info.st_mode),sha256=hashlib.sha256(raw).hexdigest()))
    visit(root)
    return rows


class MutationGuard:
    """Observe even change-and-restore; queue overflow, rename and new links refuse.

    Watches are armed before measurement. No polling interval can miss a write.
    A readonly private mount copy additionally prevents substitution at execution.
    """
    def __init__(self, roots):
        require(os.name=='posix','LINUX_MUTATION_GUARD_REQUIRED')
        self.lib=ctypes.CDLL(None,use_errno=True)
        self.lib.inotify_init1.argtypes=[ctypes.c_int];self.lib.inotify_init1.restype=ctypes.c_int
        self.lib.inotify_add_watch.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_uint32]
        self.lib.inotify_add_watch.restype=ctypes.c_int
        self.fd=self.lib.inotify_init1(os.O_NONBLOCK|os.O_CLOEXEC)
        require(self.fd>=0,'INOTIFY_UNAVAILABLE')
        try:
            seen=set()
            for root in roots:
                root=pathlib.Path(root)
                require(not root.is_symlink(),'GUARD_LINK_ROOT')
                paths=[root,*[p for p in root.rglob('*') if p.is_dir() and not p.is_symlink()]] if root.is_dir() else [root.parent]
                for p in paths:
                    if str(p) in seen:continue
                    seen.add(str(p))
                    # modify, attrib, close_write, moves, create/delete, self move/delete
                    require(self.lib.inotify_add_watch(self.fd,os.fsencode(p),0x00000fce)>=0,'INOTIFY_WATCH_FAILED')
            self.check()
        except BaseException:self.close();raise
    def check(self):
        try:events=os.read(self.fd,1024*1024)
        except BlockingIOError:return
        require(not events,'INPUT_MUTATION_OBSERVED_OR_WATCH_OVERFLOW')
    def close(self):
        if self.fd>=0:os.close(self.fd);self.fd=-1
    def __enter__(self):return self
    def __exit__(self,*args):self.close()
