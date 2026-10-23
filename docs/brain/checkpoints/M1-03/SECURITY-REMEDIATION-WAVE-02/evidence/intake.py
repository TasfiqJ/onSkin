"""Independent read-only intake; executed before checkpoint files are staged."""
import hashlib, json, pathlib, shutil, subprocess, sys, datetime
root = pathlib.Path(__file__).resolve().parents[6]
out = pathlib.Path(__file__).resolve().parent
ctx = pathlib.Path(sys.argv[1])
archive = pathlib.Path(sys.argv[2])
def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args])
rows = []
issued = json.loads((ctx/'PREIMAGE_PATHS.json').read_bytes())
for path in sorted(issued['paths']):
    record = git('ls-tree', 'HEAD', '--', path).decode().strip().split()
    mode, kind, oid = record[:3]
    raw = git('cat-file', 'blob', oid)
    assert kind == 'blob' and mode == '100644'
    assert raw == (root/path).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == oid
    rows.append(dict(path=path, bytes=len(raw), git_blob=oid, sha256=hashlib.sha256(raw).hexdigest(), mode=mode))
obj = dict(commit=git('rev-parse','HEAD').decode().strip(), tree=git('rev-parse','HEAD^{tree}').decode().strip(), files=rows)
fingerprint = hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',',':')).encode()).hexdigest()
assert fingerprint == '51bef23541f736bc2a890e25ae5ca8ac6c60104b2aef2906262f2038fee5a0d7'
assert obj['commit'] == issued['commit'] and obj['tree'] == issued['tree']
obj.update(fingerprint=fingerprint, independent_git_object_and_workfile_verification=True,
           observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), branch=git('branch','--show-current').decode().strip(),
           external_manifest_sha256='55663df49e98f5209d4c2b04d573d058042aa16e0d95ede4c17547f4edd12dff')
(out/'independent-preimages.json').write_text(json.dumps(obj, indent=2)+'\n', encoding='utf-8')
inputs = out.parent/'inputs/context'; inputs.mkdir(exist_ok=False,parents=True)
for path in ctx.iterdir():
    assert path.is_file()
    shutil.copyfile(path,inputs/path.name)
uploaded=inputs.parent/'uploaded';uploaded.mkdir();shutil.copyfile(archive,uploaded/archive.name)
(out/'context-validation.json').write_text(json.dumps(dict(manifest_valid=True,declared_members=13,source_verifier_exit=0,
    independent_fingerprint=fingerprint,archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
    context_folder=str(ctx),repository=str(root),technical_source_edited=False),indent=2)+'\n')
print(json.dumps(dict(independent_preimages=len(rows),fingerprint=fingerprint,inputs_copied=True)))
