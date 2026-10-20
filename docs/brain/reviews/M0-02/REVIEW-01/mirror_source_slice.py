from pathlib import Path, PurePosixPath
import re
import stat

GENERATED = 'docs/v2/mirrors'

def require(ok, message):
    if not ok:
        raise ValueError(message)

def relative_name(name):
    require(isinstance(name, str) and 0 < len(name) <= 240, 'Invalid path length/type')
    require(name.isascii() and not re.search(r'[\\:\x00-\x1f\x7f]', name), 'Forbidden path: ' + name)
    parts = name.split('/')
    require(not name.startswith('/') and all(p and p not in {'.', '..'} for p in parts), 'Path escape: ' + name)
    require(all(not p.endswith((' ', '.')) and not re.match(r'(?i)^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)', p)
                for p in parts), 'Windows path alias: ' + name)
    return PurePosixPath(name)

def safe_file(root, name):
    rel = relative_name(name)
    root = Path(root).absolute()
    # lstat every ancestor: Windows junctions/reparse points must fail even if they resolve inside root.
    path = root.joinpath(*rel.parts)
    for item in [root, *reversed(root.parents), *[root.joinpath(*rel.parts[:i]) for i in range(1, len(rel.parts) + 1)]]:
        info = item.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not (getattr(info, 'st_file_attributes', 0) & 0x400),
                'Link/reparse point forbidden: ' + name)
    require(root.resolve() in path.resolve().parents and path.is_file(), 'Missing/outside root: ' + name)
    require(path.stat().st_nlink == 1, 'Hard-linked input forbidden: ' + name)
    return path

def no_link_parents(path):
    for p in [path, *path.parents]:
        if p.exists() or p.is_symlink():
            info = p.lstat()
            require(not stat.S_ISLNK(info.st_mode) and not (getattr(info, 'st_file_attributes', 0) & 0x400),
                    'Linked destination directory')

def mirrors(root, check=True):
    verify_inputs(root)
    for name, data in generated_views(root).items():
        target = root / GENERATED / name
        if check:
            require(read(root, GENERATED + '/' + name) == data, 'Stale/altered generated mirror: ' + name)
        else:
            require(not target.exists() or not target.is_symlink(), 'Generated destination link')
            no_link_parents(target.parent)
            target.parent.mkdir(parents=True, exist_ok=True)
            # Validate parents through the same filesystem guard before replacing existing bytes.
            if not target.exists():
                target.touch()
            safe_file(root, GENERATED + '/' + name).write_bytes(data)
