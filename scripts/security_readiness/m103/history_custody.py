"""Isolated real Git history for disposable governance fixtures; no authority."""
import atexit
import io
import pathlib
import shutil
import subprocess
import tarfile
import tempfile

_pool = None


def fixture_history(root, source, endpoint):
    """Copy real objects once, then materialize only the measured historical docs.

    The disposable object pool has no alternates or hardlinks back to the source.
    An unavailable object fails Git's import/read, never becomes a made-up blob.
    """
    global _pool
    if _pool is None:
        _pool = tempfile.TemporaryDirectory(prefix='onskin-immutable-git-')
        atexit.register(_pool.cleanup)
        subprocess.run(['git', 'clone', '--bare', '--no-hardlinks', '--quiet',
                        str(source), str(pathlib.Path(_pool.name) / 'history.git')], check=True)
    objects = pathlib.Path(_pool.name) / 'history.git/objects'
    assert objects.is_dir() and not (objects / 'info/alternates').exists()
    # Binary LF is intentional: text-mode Windows CRLF becomes a literal '?' in
    # Git's alternate path. This references the independent copy, not live source.
    alternate = root / '.git/objects/info/alternates'
    alternate.parent.mkdir(parents=True, exist_ok=True)
    alternate.write_bytes((objects.as_posix() + '\n').encode('utf-8'))
    raw = subprocess.check_output(['git', '-C', str(objects.parent), 'archive',
                                   '--format=tar', endpoint, 'docs/brain', 'docs/v2'])
    for name in ['docs/brain', 'docs/v2']:
        folder = root / name
        assert folder.resolve().is_relative_to(root.resolve())
        shutil.rmtree(folder)
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        for member in archive:
            name = pathlib.PurePosixPath(member.name)
            assert not name.is_absolute() and '..' not in name.parts
            assert member.isdir() or member.isfile(), 'Historical fixture must be regular'
            target = root.joinpath(*name.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())
    subprocess.run(['git', '-C', str(root), 'update-ref', 'HEAD', endpoint], check=True)
    subprocess.run(['git', '-C', str(root), 'read-tree', endpoint], check=True)
    return objects
