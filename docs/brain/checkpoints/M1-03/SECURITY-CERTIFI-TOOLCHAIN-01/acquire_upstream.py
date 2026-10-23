import base64, datetime, email.parser, hashlib, io, json, pathlib, re, urllib.request, zipfile

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / 'upstream'
OUT.mkdir(exist_ok=False)
receipts = []

def fetch(url, name):
    with urllib.request.urlopen(url, timeout=45) as response:
        data = response.read(16 * 1024 * 1024 + 1)
        assert len(data) <= 16 * 1024 * 1024
        assert response.geturl().startswith('https://')
        receipts.append({'url': url, 'final_url': response.geturl(), 'status': response.status,
                         'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                         'date': response.headers.get('Date'), 'bytes': len(data),
                         'sha256': hashlib.sha256(data).hexdigest(), 'file': name})
    (OUT / name).write_bytes(data)
    return data

def wheel(version, expected):
    release = json.loads(fetch('https://pypi.org/pypi/certifi/' + version + '/json', 'pypi-certifi-' + version + '.json'))
    entry, = [u for u in release['urls'] if u['filename'] == 'certifi-' + version + '-py3-none-any.whl']
    assert entry['digests']['sha256'] == expected
    raw = fetch(entry['url'], entry['filename'])
    assert hashlib.sha256(raw).hexdigest() == expected and len(raw) == entry['size']
    if version == '2026.10.19':
        assert len(raw) == 136464
        witness = json.loads((ROOT / 'UPSTREAM_CERTIFI_WITNESS.json').read_bytes())
        assert entry['url'] == witness['wheel_url']
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert z.testzip() is None
        names = z.namelist()
        assert len(names) == len(set(names))
        assert all(not n.startswith('/') and '..' not in n.split('/') and '\\' not in n for n in names)
        meta = email.parser.BytesParser().parsebytes(z.read('certifi-' + version + '.dist-info/METADATA'))
        assert meta['Name'] == 'certifi' and meta['Version'] == version and meta['Requires-Python'] == '>=3.7'
        for line in z.read('certifi-' + version + '.dist-info/RECORD').decode().splitlines():
            path, digest, size = line.rsplit(',', 2)
            if digest:
                payload = z.read(path)
                assert len(payload) == int(size)
                assert digest == 'sha256=' + base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).decode().rstrip('=')
        rows = [{'path': n, 'bytes': len(z.read(n)), 'sha256': hashlib.sha256(z.read(n)).hexdigest()} for n in names]
        return {'version': version, 'sha256': expected, 'bytes': len(raw), 'member_count': len(names),
                'metadata': {k: meta[k] for k in ('Name', 'Version', 'Requires-Python')},
                'zip_crc': 'PASS', 'record_hashes': 'PASS', 'members': rows}, {n:z.read(n) for n in names}

try:
    new, newfiles = wheel('2026.10.19', '42d35340cc5b9ba78e818ddbff0c5b1c2b779de448a340fd1b989f5fa8670e1b')
    old, oldfiles = wheel('2026.10.18', '73191c47aaa79da394e8fee2dbc2ec827432cab56311122c9e47abf79e390f62')
    def cas(data):
        return {hashlib.sha256(base64.b64decode(re.sub(rb'\s', b'', block))).hexdigest()
                for block in re.findall(rb'-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----', data, re.S)}
    oldca, newca = cas(oldfiles['certifi/cacert.pem']), cas(newfiles['certifi/cacert.pem'])
    delta = {'changed_common_paths': [n for n in sorted(oldfiles.keys() & newfiles.keys()) if oldfiles[n] != newfiles[n]],
             'ca_certificates_old': len(oldca), 'ca_certificates_new': len(newca),
             'ca_der_sha256_removed': sorted(oldca-newca), 'ca_der_sha256_added': sorted(newca-oldca)}
    advisories = []
    for alias in ('PYSEC-2026-4320', 'GHSA-6q48-6c7w-9gw2'):
        record = json.loads(fetch('https://api.osv.dev/v1/vulns/' + alias, alias + '.json'))
        affected = [a for a in record['affected'] if a['package']['name'].lower() == 'certifi' and a['package']['ecosystem'] == 'PyPI']
        fixed = sorted({event['fixed'] for a in affected for r in a.get('ranges', []) for event in r['events'] if 'fixed' in event})
        assert '2026.10.19' in fixed and not record.get('withdrawn')
        assert ({record['id']} | set(record.get('aliases', []))) >= {'PYSEC-2026-4320', 'GHSA-6q48-6c7w-9gw2'}
        advisories.append({'id': record['id'], 'aliases': record.get('aliases', []), 'modified': record['modified'],
                           'fixed': fixed, 'withdrawn': record.get('withdrawn')})
    report = {'status': 'PASS', 'old_wheel': old, 'new_wheel': new, 'wheel_delta': delta, 'advisories': advisories,
              'scope': 'Target aliases only; no full OSV or Security clearance.'}
    (OUT/'verification.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))
finally:
    (OUT/'fetch-receipts.json').write_text(json.dumps(receipts, indent=2)+'\n')
