"""Make Turbo workspace children use the same byte-verified reviewed npm CLI."""
import json, pathlib, shutil, subprocess, sys
sys.path.insert(0,'/work/repo/scripts/phase9/security_acceptance');import contract as c
source=pathlib.Path('/work/npm-runtime/node_modules/npm'); target=pathlib.Path('/opt/wave-reviewed-npm')
policy=c.load(c.HERE,'proposal.json');assert c.tool_tree(source)==policy['npmToolTree']
shutil.copytree(source,target,symlinks=True);assert c.tool_tree(target)==policy['npmToolTree']
for name in ('npm','npx'):
    entry=target/'bin'/(name+'-cli.js');entry.chmod(0o755);link=pathlib.Path('/usr/local/bin')/name
    assert link.is_symlink();link.unlink();link.symlink_to(entry)
version=subprocess.check_output(['npm','--version']).decode().strip();assert version=='11.20.0'
pathlib.Path('/evidence/docker-reviewed-npm-path.json').write_text(json.dumps({'prior_observation':'Outer CLI was verified11.20.0, but Turbo workspace child notices identified ambient npm11.17.0; earlier overlay tests are not borrowed as reviewed-tool results.',
    'source':str(source),'installed_cli':str(target),'tool_tree':c.tool_tree(target),'expected':policy['npmToolTree'],'ambient_and_child_npm_version':version,'source_repository_changed':False,'decision':'Repeat fresh ci and forced root checks with reviewed npm on child PATH.'},indent=2)+'\n')
print(version,c.tool_tree(target))
