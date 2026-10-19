"""Prepare exact Linux scanners from official releases and reviewed source bytes.

The custom engine archive is part of the INACTIVE source candidate. Every wheel,
original installation, engine member and final tool tree is checked before use.
No signing key, approval or hosted artifact is created by this installer.
"""
import argparse, hashlib, io, json, os, pathlib, platform, shutil, subprocess, sys, tarfile, urllib.request
sys.dont_write_bytecode = True
from contract import HERE, SHA, load, require, safe, tool_tree

ASSETS = {
 'gitleaks': ('https://github.com/gitleaks/gitleaks/releases/download/v8.24.3/gitleaks_8.24.3_linux_x64.tar.gz', 'gitleaks', '9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c'),
 'trufflehog': ('https://github.com/trufflesecurity/trufflehog/releases/download/v3.99.2/trufflehog_3.99.2_linux_amd64.tar.gz', 'trufflehog', '3c7b0d1dc4278294269bfdd7594bca8bb28c78da0a4a06ad202ded37b48deca4'),
 'osv': ('https://github.com/google/osv-scanner/releases/download/v2.3.8/osv-scanner_linux_amd64', None, 'bc98e15319ed0d515e3f9235287ba53cdc5535d576d24fd573978ecfe9ab92dc'),
}
ENGINE_ARCHIVE = 'semgrep-engine-linux-x86_64.tar.gz'
REQUIREMENTS = 'semgrep-requirements-linux-py312.txt'

def file_sha(path):
 h = hashlib.sha256()
 with pathlib.Path(path).open('rb') as stream:
  for block in iter(lambda: stream.read(1024**2), b''): h.update(block)
 return h.hexdigest()

def engine_members(archive, expected, destination):
 """Extract only exact reviewed regular members; no generic tar extraction."""
 seen = set(); total = 0
 with tarfile.open(fileobj=io.BytesIO(archive), mode='r|gz') as tar:
  for item in tar:
   name = item.name
   require(item.isfile() and name in expected and name not in seen, 'ENGINE_MEMBER_DRIFT')
   require(not any(x in ('', '.', '..') for x in name.split('/'))
           and not any(x in name for x in ('\\', ':', '\0')) and not name.startswith('/'), 'ENGINE_UNSAFE_PATH')
   entry = expected[name]
   require(type(item.size) is int and item.size == entry['bytes'] and 0 < item.size <= 384*1024**2,
           'ENGINE_MEMBER_SIZE_DRIFT')
   total += item.size; require(total <= 512*1024**2, 'ENGINE_TOTAL_LIMIT')
   target = pathlib.Path(destination) / name; target.parent.mkdir(parents=True, exist_ok=True)
   with tar.extractfile(item) as source, target.open('xb') as output:
    digest = hashlib.sha256(); count = 0
    for block in iter(lambda: source.read(1024**2), b''):
     count += len(block); require(count <= item.size, 'ENGINE_MEMBER_SIZE_DRIFT'); digest.update(block); output.write(block)
   require(count == item.size and digest.hexdigest() == entry['sha256'], 'ENGINE_MEMBER_BYTES_DRIFT')
   target.chmod(0o755 if name == 'semgrep-core' else 0o644); seen.add(name)
 require(seen == set(expected), 'ENGINE_MEMBER_OMISSION')

def install_engine(site, archive, profile, preserved):
 site = pathlib.Path(site); archive = pathlib.Path(archive); preserved = pathlib.Path(preserved)
 require(tool_tree(site, python_site=True) == profile['originalPackageTree'], 'UPSTREAM_SEMGREP_TREE_DRIFT')
 raw = safe(archive.parent, archive.name)
 require(SHA(raw) == profile['archiveSha256'], 'ENGINE_ARCHIVE_DRIFT')
 core = site / 'semgrep/bin/semgrep-core'; libs = site / 'semgrep/bin/libs'
 require(file_sha(core) == profile['originalCoreSha256'], 'UPSTREAM_SEMGREP_CORE_DRIFT')
 require(not preserved.exists() and not preserved.is_symlink(), 'NEW_PRESERVED_DIRECTORY_REQUIRED'); preserved.mkdir()
 # Only this fresh target installation is moved. Original wheel bytes remain
 # recoverable beside it; retained installations and application source are untouched.
 core.rename(preserved / 'semgrep-core.official-upstream'); libs.rename(preserved / 'official-upstream-libs')
 engine_members(raw, profile['members'], site / 'semgrep/bin')
 require(file_sha(core) == profile['portableCoreSha256'], 'ENGINE_CORE_DRIFT')
 return {'originalCoreSha256': profile['originalCoreSha256'], 'portableCoreSha256': file_sha(core),
         'archiveSha256': SHA(raw), 'originalPreserved': str(preserved)}

def download(url, target, expected):
 require(url.startswith('https://'), 'SCANNER_HTTPS_REQUIRED')
 with urllib.request.urlopen(url, timeout=90) as response, target.open('xb') as output:
  require(response.geturl().startswith('https://'), 'SCANNER_HTTPS_REQUIRED'); total = 0
  for block in iter(lambda: response.read(1024**2), b''):
   total += len(block); require(total <= 128*1024**2, 'SCANNER_DOWNLOAD_LIMIT'); output.write(block)
 require(file_sha(target) == expected, 'SCANNER_RELEASE_DOWNLOAD_DRIFT')

def main():
 p = argparse.ArgumentParser(); p.add_argument('new_directory'); a = p.parse_args()
 require(sys.platform == 'linux' and platform.machine().lower() in ('x86_64', 'amd64')
         and sys.version_info[:2] == (3, 12), 'REVIEWED_LINUX_X86_64_PY312_REQUIRED')
 libc = platform.libc_ver()
 require(libc[0] == 'glibc' and tuple(map(int, libc[1].split('.')[:2])) >= (2, 39),
         'REVIEWED_GLIBC_239_OR_LATER_REQUIRED')
 raw_root = pathlib.Path(a.new_directory).absolute(); require(not os.path.lexists(raw_root), 'NEW_TOOL_DIRECTORY_REQUIRED')
 root = raw_root.resolve(); root.mkdir(parents=True)
 policy = load(HERE, 'proposal.json'); rows = []
 require(SHA(safe(HERE, REQUIREMENTS)) == policy['semgrepBuild']['requirementsSha256'], 'REQUIREMENTS_DRIFT')
 npm_root = root / 'npm'; site = root / 'semgrep'
 subprocess.run(['npm', 'install', '--prefix', 'npm', 'npm@11.20.0', '--ignore-scripts',
                 '--bin-links=false', '--no-audit', '--no-fund', '--cache', 'cache/npm'], cwd=root, check=True)
 subprocess.run([sys.executable, '-B', '-m', 'pip', '--isolated', 'install', '--index-url', 'https://pypi.org/simple',
                 '--no-input', '--require-hashes', '--only-binary=:all:', '--no-compile', '--no-deps',
                 '--target', 'semgrep', '--requirement', str(HERE / REQUIREMENTS),
                 '--report', 'official-wheel-install.json', '--cache-dir', 'cache/pip'], cwd=root, check=True)
 rows.append(install_engine(site, HERE / ENGINE_ARCHIVE, policy['semgrepBuild'], root / 'preserved-upstream'))
 scanners = root / 'scanners'; scanners.mkdir()
 for name, (url, member, digest) in ASSETS.items():
  original = root / (name + '.download'); download(url, original, digest); target = scanners / name
  if member:
   with tarfile.open(original, mode='r|gz') as tar:
    found = False
    for item in tar:
     require(item.isfile() or item.isdir(), 'SCANNER_RELEASE_LINK')
     require(not item.name.startswith('/') and '..' not in item.name.split('/'), 'SCANNER_RELEASE_PATH')
     if item.name == member:
      require(item.isfile() and not found and item.size <= 128*1024**2, 'SCANNER_RELEASE_MEMBER')
      with tar.extractfile(item) as source, target.open('xb') as output: shutil.copyfileobj(source, output, 1024**2)
      found = True
    require(found, 'SCANNER_RELEASE_MEMBER_MISSING')
  else: shutil.copyfile(original, target)
  target.chmod(0o755); require(file_sha(target) in policy['toolBytes'][name], 'SCANNER_RELEASE_IDENTITY_DRIFT:' + name)
  rows.append({'tool': name, 'url': url, 'downloadSha256': digest, 'binarySha256': file_sha(target)})
 tools = {'npm': str(npm_root / 'node_modules/npm/bin/npm-cli.js'), 'semgrep': str(site),
          **{name: str(scanners / name) for name in ASSETS}}
 from collect import verify_tool_sources
 verify_tool_sources(tools, policy)
 launchers = root / 'cli-bin'; launchers.mkdir()
 for name in ('npm', 'npx'):
  target = npm_root / ('node_modules/npm/bin/' + name + '-cli.js'); target.chmod(0o755)
  (launchers / name).symlink_to(pathlib.Path('../npm/node_modules/npm/bin') / (name + '-cli.js'))
 (root / 'tools.json').write_text(json.dumps(tools, indent=2) + '\n')
 (root / 'release-receipts.json').write_text(json.dumps(rows, indent=2) + '\n')
 print(json.dumps({'verifiedTools': 5, 'directory': str(root), 'ownerAcceptance': False}))

if __name__ == '__main__': main()
