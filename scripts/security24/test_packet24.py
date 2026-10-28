"""Bounded adversarial checks for the separate Campaign24 return verifier."""
import argparse
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import struct
import subprocess
import sys
import tempfile
import warnings
import zipfile
import zlib


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verifier', required=True)
    args = parser.parse_args()
    path = Path(args.verifier).resolve()
    spec = importlib.util.spec_from_file_location('packet24_test_target', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    results = []
    not_run = []

    def test(name, function):
        try:
            function()
            results.append({'case': name, 'status': 'PASS'})
        except Exception as error:
            results.append({'case': name, 'status': 'FAIL', 'errorType': type(error).__name__})

    def refuse(function):
        try:
            function()
        except module.Refusal:
            return
        raise AssertionError('expected fixed-code refusal')

    def archive(entries, compression=zipfile.ZIP_DEFLATED):
        stream = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as output:
                for record in entries:
                    name, data, mode = record[:3]
                    info = zipfile.ZipInfo(name)
                    info.create_system = 3
                    info.external_attr = mode << 16
                    info.compress_type = compression
                    if len(record) > 3:
                        info.extra = record[3]
                    output.writestr(info, data)
        return stream.getvalue()

    regular = stat.S_IFREG | 0o644
    for index, name in enumerate(('/absolute', 'C:/drive', '../escape', 'a/../escape', 'a\\escape', 'a//b',
                                  'NUL', 'a/COM1.txt', 'a.', 'a ', '\uff0fabsolute', 'a/\uff0e\uff0e/escape',
                                  'a\uff3cb', 'a\uff1ab', 'a/\x00b', 'a\uff0fb', '\uff23\uff2f\uff2e')):
        test('unsafe-path-%02d' % index, lambda n=name: refuse(lambda: module.safe_path(n)))
    for index, names in enumerate((['A/x', 'a/y'], ['\uff21/x', 'A/y'], ['a', 'a/b'], ['a/b', 'a'], ['a','a\uff0fb'])):
        test('implicit-parent-alias-%02d' % index, lambda n=names: refuse(lambda: module.paths(n)))
    test('valid-regular-archive', lambda: module.Archive(archive([('a/b.txt', b'public fixture', regular)])).exact({'a/b.txt'}))
    for name, entries in (
        ('duplicate-file', [('a', b'a', regular), ('a', b'b', regular)]),
        ('case-collision', [('A', b'a', regular), ('a', b'b', regular)]),
        ('unicode-collision', [('\uff21', b'a', regular), ('A', b'b', regular)]),
        ('implicit-alias', [('A/x', b'a', regular), ('a/y', b'b', regular)]),
        ('file-directory-collision', [('a', b'a', regular), ('a/b', b'b', regular)]),
        ('symlink-mode', [('link', b'target', stat.S_IFLNK | 0o777)]),
        ('fifo-mode', [('fifo', b'', stat.S_IFIFO | 0o644)]),
        ('setuid-mode', [('special', b'', regular | stat.S_ISUID)]),
        ('setgid-mode', [('special', b'', regular | stat.S_ISGID)]),
        ('sticky-mode', [('special', b'', regular | stat.S_ISVTX)]),
        ('extra-record', [('extra', b'', regular, b'\x55\x54\x00\x00')]),
    ):
        test(name, lambda e=entries: refuse(lambda: module.Archive(archive(e))))
    good = archive([('file', b'a public fixture', regular)])
    test('trailing-bytes', lambda: refuse(lambda: module.Archive(good+b'x')))
    test('truncated-eocd', lambda: refuse(lambda: module.Archive(good[:-1])))
    altered = bytearray(good)
    altered[0] = 0
    test('malformed-local-record', lambda: refuse(lambda: module.Archive(bytes(altered))))
    altered_name = bytearray(good)
    altered_name[30] = ord('x')
    test('local-central-name-disagreement', lambda: refuse(lambda: module.Archive(bytes(altered_name))))
    for offset, name in ((4, 'version'), (10, 'time'), (12, 'date')):
        malformed = bytearray(good)
        malformed[offset] ^= 1
        test('local-central-'+name+'-disagreement', lambda data=bytes(malformed): refuse(lambda: module.Archive(data)))
    test('omitted-member', lambda: refuse(lambda: module.Archive(good).exact({'missing'})))
    test('undeclared-member', lambda: refuse(lambda: module.Archive(good).exact(set())))
    def resize_stream(raw, delta):
        eocd = len(raw)-22
        central = struct.unpack_from('<I', raw, eocd+16)[0]
        compressed = struct.unpack_from('<I', raw, 18)[0]
        changed = bytearray(raw[:central] + b'X' + raw[central:]) if delta == 1 else bytearray(raw[:central-1]+raw[central:])
        struct.pack_into('<I', changed, 18, compressed+delta)
        struct.pack_into('<I', changed, central+delta+20, compressed+delta)
        struct.pack_into('<I', changed, len(changed)-22+16, central+delta)
        return bytes(changed)
    test('trailing-deflate-byte', lambda: refuse(lambda: module.Archive(resize_stream(good,1)).read('file')))
    test('truncated-deflate-byte', lambda: refuse(lambda: module.Archive(resize_stream(good,-1)).read('file')))
    stored = archive([('file',b'public fixture',regular)],compression=zipfile.ZIP_STORED)
    test('stored-positive', lambda: module.Archive(stored).read('file'))
    test('trailing-stored-byte', lambda: refuse(lambda: module.Archive(resize_stream(stored,1)).read('file')))
    corrupted = bytearray(good)
    payload_start = 30+struct.unpack_from('<H', good,26)[0]
    corrupted[payload_start] ^= 0xff
    test('corrupt-deflate-stream', lambda: refuse(lambda: module.Archive(bytes(corrupted)).read('file')))
    def total_expansion():
        previous = module.MAX_TOTAL
        try:
            module.MAX_TOTAL = 7
            refuse(lambda: module.Archive(archive([('a',b'1234',regular),('b',b'5678',regular)])))
        finally:
            module.MAX_TOTAL = previous
    test('declared-total-expansion-preflight',total_expansion)
    test('duplicate-json-key', lambda: refuse(lambda: module.loads(b'{"a":1,"a":2}')))
    test('nonfinite-json', lambda: refuse(lambda: module.loads(b'{"a":NaN}')))
    test('float-schema', lambda: refuse(lambda: module.loads(b'{"a":1.0}')))
    test('boolean-byte-count', lambda: refuse(lambda: module.inventory({'a': {'bytes': True, 'sha256': '0'*64}})))
    test('expansion-bound', lambda: refuse(lambda: module.Archive(archive([('bomb', b'0'*(2*1024*1024), regular)]))))

    receipt = b'public synthetic receipt'
    payload = archive([('receipt.txt', receipt, regular)])
    checkpoint_files = {'README.md': b'Synthetic control only', 'FINAL_REPORT.md': b'NO_GO',
                        'payload.zip': payload, 'verify24.py': b'Synthetic control, never executed'}
    witness = lambda data: {'bytes': len(data), 'sha256': module.sha(data)}
    checkpoint_manifest = dict(schema=1, authority=module.AUTHORITY, status='SUBMITTED_REVIEW_REQUIRED',
        acceptanceGranted=False, release='NO_GO', inputManifestSHA256=module.INPUT,
        source=dict(base=module.BASE, baseTree=module.BASE_TREE, runtimeHead='1'*40, runtimeTree='2'*40,
                    sourceHead='3'*40, sourceTree='4'*40),
        files={name: witness(data) for name, data in checkpoint_files.items()},
        payload=dict(schema=1, files={'receipt.txt': witness(receipt)},
                     qualification='SANITIZED_TECHNICAL_EVIDENCE_NOT_ACCEPTANCE'))

    def check_checkpoint(manifest, files=None):
        encoded = json.dumps(manifest, sort_keys=True).encode()
        records = list((name, data, regular) for name, data in (files or checkpoint_files).items())
        records.append(('manifest.json', encoded, regular))
        return module.checkpoint(module.Archive(archive(records)), module.sha(encoded))

    test('synthetic-checkpoint-positive', lambda: check_checkpoint(checkpoint_manifest))
    for key, value in [('schema', True), ('schema', 2), ('authority', 'UNISSUED'),
                       ('status', 'ACCEPTED'), ('acceptanceGranted', True), ('acceptanceGranted', 0),
                       ('release', 'GO'), ('inputManifestSHA256', '0'*64)]:
        mutant = copy.deepcopy(checkpoint_manifest)
        mutant[key] = value
        test('forged-rehashed-manifest-'+key+'-'+str(value), lambda v=mutant: refuse(lambda: check_checkpoint(v)))
    for key in ('base', 'baseTree'):
        mutant = copy.deepcopy(checkpoint_manifest)
        mutant['source'][key] = '0'*40
        test('wrong-pinned-'+key, lambda v=mutant: refuse(lambda: check_checkpoint(v)))
    mutant = copy.deepcopy(checkpoint_manifest)
    del mutant['files']['verify24.py']
    test('omitted-verifier', lambda: refuse(lambda: check_checkpoint(mutant)))
    omitted = dict(checkpoint_files)
    del omitted['README.md']
    test('omitted-source-member', lambda: refuse(lambda: check_checkpoint(checkpoint_manifest, omitted)))
    changed = dict(checkpoint_files)
    changed['FINAL_REPORT.md'] = b'Changed report'
    test('changed-report-disclosure', lambda: refuse(lambda: check_checkpoint(checkpoint_manifest, changed)))
    corrupt = copy.deepcopy(checkpoint_manifest)
    corrupt['payload']['files']['receipt.txt']['sha256'] = '0'*64
    test('inner-receipt-corruption', lambda: refuse(lambda: check_checkpoint(corrupt)))

    encoded_checkpoint = json.dumps(checkpoint_manifest, sort_keys=True).encode()
    outer_files = {'checkpoint/'+name: data for name, data in checkpoint_files.items()}
    outer_files['checkpoint/manifest.json'] = encoded_checkpoint
    outer_files['FINAL_REPORT.md'] = b'Synthetic return control; NO_GO'
    outer_files['verify_return24.py'] = b'Synthetic control, never executed'
    pack = b'PACK'+struct.pack('>II', 2, 1)+b'\x30'+zlib.compress(b'')
    pack += hashlib.sha1(pack).digest()
    bundle = (b'# v2 git bundle\n-'+module.BASE.encode()+b' Synthetic prerequisite\n'+
              b'5'*40+b' refs/heads/stage/m1-security-dependency-db24\n\n'+pack)
    outer_files['source.delta.bundle'] = bundle
    outer_manifest = {key: copy.deepcopy(value) for key, value in checkpoint_manifest.items() if key != 'payload'}
    outer_manifest['source'].update(candidateHead='5'*40, candidateTree='6'*40)
    outer_manifest.update(files={name:witness(data) for name,data in outer_files.items()},
        qualification='SANITIZED_REVIEW_RETURN_NOT_ACCEPTANCE',
        checkpoint=dict(path='checkpoint',manifestSHA256=module.sha(encoded_checkpoint)),
        gitDelta=dict(path='source.delta.bundle',base=module.BASE,baseTree=module.BASE_TREE,head='5'*40,tree='6'*40))

    def check_return():
        encoded = json.dumps(outer_manifest, sort_keys=True).encode()
        records = [(name,data,regular) for name,data in outer_files.items()]
        records.append(('manifest.json',encoded,regular))
        result = module.return_packet(module.Archive(archive(records)),module.sha(encoded))
        assert result['status']=='VERIFIED' and result['acceptanceGranted'] is False
        assert result['gitDeltaSemantics']=='NOT_CHECKED_WITHOUT_GIT_ROOT'
    test('synthetic-return-positive-without-git-qualification',check_return)

    with tempfile.TemporaryDirectory(prefix='packet24-tests-') as directory:
        root = Path(directory)
        original = b'public fixture'
        (root/'file').write_bytes(original)
        (root/'manifest.json').write_bytes(b'{}')
        witness = {'file': {'bytes': len(original), 'sha256': module.sha(original)}}
        test('directory-positive', lambda: module.check_files(module.Directory(root), witness))
        (root/'file').write_bytes(b'changed fixture')
        test('changed-input', lambda: refuse(lambda: module.check_files(module.Directory(root), witness)))
        (root/'file').write_bytes(original)
        (root/'extra').write_bytes(b'undeclared')
        test('directory-overwrite-inventory', lambda: refuse(lambda: module.check_files(module.Directory(root), witness)))
        (root/'extra').unlink()
        hard = root/'hardlink'
        try:
            os.link(root/'file', hard)
        except OSError:
            not_run.append('filesystem-hardlink-control-unavailable')
        else:
            test('filesystem-hardlink', lambda: refuse(lambda: module.read_regular(root/'file')))
            hard.unlink()
        link = root/'symlink'
        try:
            os.symlink(root/'file', link)
        except OSError:
            not_run.append('filesystem-symlink-control-unavailable')
        else:
            test('filesystem-symlink', lambda: refuse(lambda: module.read_regular(link)))
            link.unlink()
        if os.name == 'nt':
            target = root/'junction-target'
            target.mkdir()
            junction = root/'junction'
            created = subprocess.run(['cmd.exe', '/d', '/c', 'mklink', '/J', str(junction), str(target)],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
            if created.returncode:
                not_run.append('filesystem-junction-control-unavailable')
            else:
                try:
                    test('filesystem-junction', lambda: refuse(lambda: module.Directory(junction)))
                finally:
                    os.rmdir(junction)

    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    # The fixed-code CLI must not disclose arbitrary argument or filename text.
    sentinel = 'SYNTHETIC_DISCLOSURE_MARKER_24'
    command = [sys.executable, '-B', str(path), '--archive', sentinel,
               '--expected-manifest-sha256', '0'*64, '--expected-verifier-sha256', digest]
    child = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    def disclosure():
        assert child.returncode == 1 and not child.stderr and sentinel.encode() not in child.stdout
        value = json.loads(child.stdout)
        assert value['status'] == 'CONTEXT_INVALID' and value['acceptanceGranted'] is False and value['release'] == 'NO_GO'
    test('fixed-code-disclosure', disclosure)
    test('required-external-anchor', lambda: refuse(lambda: module.manifest(module.Archive(good), 'bad')))
    result = {'qualification': 'SYNTHETIC_ARTIFACT_CONTROLS_NOT_FULL_CHECKOUT_OR_ACCEPTANCE',
              'verifierSHA256': digest, 'passed': sum(r['status']=='PASS' for r in results),
              'failed': sum(r['status']=='FAIL' for r in results), 'notRun': not_run,
              'cases': results, 'release': 'NO_GO', 'acceptanceGranted': False}
    print(json.dumps(result, sort_keys=True))
    return 1 if result['failed'] else 0


if __name__ == '__main__':
    sys.exit(main())
