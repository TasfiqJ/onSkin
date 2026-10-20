#!/usr/bin/env python3
"""Create an allowlisted Codex task pack; never include private patient inputs."""
from pathlib import Path
import argparse, hashlib, json, zipfile

ROOT=Path(__file__).resolve().parents[1]
DENY_PARTS={'99_Restricted_Personal_References','original_archives','source_research','__pycache__','.git'}
ALLOWED_SUFFIX={'.md','.txt','.json','.csv'}

def safe_source(root: Path, relative: str) -> Path:
    rel=Path(relative)
    if rel.is_absolute() or '..' in rel.parts or any(x in DENY_PARTS for x in rel.parts):
        raise ValueError('Forbidden input path: '+relative)
    path=root/rel
    if any(p.is_symlink() for p in [path,*list(path.parents)[:len(rel.parts)]]):
        raise ValueError('Symlink input forbidden')
    resolved=path.resolve()
    if root.resolve() not in resolved.parents or not path.is_file():
        raise ValueError('Missing/outside-root input: '+relative)
    if path.suffix.lower() not in ALLOWED_SUFFIX:
        raise ValueError('Non-text task input forbidden: '+relative)
    return path

def build(task: str, output: Path) -> dict:
    config=json.loads((ROOT/'08_Bootstrap/task_pack_allowlists.json').read_text())
    if task not in config: raise ValueError('No audited allowlist for task '+task)
    spec=config[task]
    data={n:safe_source(ROOT,n).read_bytes() for n in spec['files']}
    if sum(map(len,data.values()))>spec['max_input_bytes']:
        raise ValueError('Context budget exceeded; minimize the task rather than silently truncating')
    if output.resolve().is_relative_to(ROOT):
        raise ValueError('Write task ZIP outside source root to avoid recursive packaging')
    records=[{'path':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in data.items()]
    manifest={'task_id':task,'source_pack_version':'2.1-bootstrap-2026-10-20','base_observed':'bbc28dc3d1f945191a81be56945b8bda7bb6ef73','fresh_fetch_required':True,'input_files':records,'restricted_data_included':False,'task_scope':'M0-01 only; historical documents are evidence not execution authority'}
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        for n,b in data.items(): z.writestr(n,b)
        z.writestr('TASK.md',data[spec['task_source']])
        z.writestr('EXECUTION_PROMPT.txt',data[spec['prompt_source']])
        z.writestr('completion_report.schema.json',data['06_Operations/completion_report.schema.json'])
        z.writestr('TASK_MANIFEST.json',json.dumps(manifest,indent=2))
        z.writestr('README.md','Read TASK.md first. The root execution prompt and report schema are convenience copies. No clinical data or research images are included. Read-only evidence does not waive protected repository authority.\n')
    with zipfile.ZipFile(output) as z:
        if z.testzip() is not None: raise ValueError('ZIP CRC failed')
    return {'path':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'source_text_bytes':sum(map(len,data.values())),'source_files':len(data)}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--task',required=True);p.add_argument('--output',required=True,type=Path)
    a=p.parse_args()
    try: print(json.dumps(build(a.task,a.output),indent=2))
    except (ValueError,OSError,KeyError,json.JSONDecodeError) as e: raise SystemExit('Context build failed: '+str(e))
