"""Validate actual-process envelopes. There is no receipt-to-acceptance shortcut."""
import hashlib
import json
import re
import unicodedata

from redact import require

STATES = {'PASS', 'FINDINGS', 'INCOMPLETE', 'NOT_RUN', 'BLOCKED_EXTERNAL_CUSTODY'}
HASH = re.compile('[0-9a-f]{64}')
PACKAGE = re.compile(r'(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*')
ADVISORY = re.compile(r'(?:GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}|CVE-\d{4}-\d{4,}|(?:PYSEC|GO|RUSTSEC|OSV)-[0-9A-Za-z-]+)')


def count(value):
    require(type(value) is int and 0 <= value <= 2**53-1, 'COUNT_SCHEMA')
    return value


def ids(values):
    require(type(values) is list and
            all(type(value) is str and len(value) <= 80 and ADVISORY.fullmatch(value) for value in values) and
            len(values) == len(set(values)), 'ADVISORY_SCHEMA')
    return sorted(values)


def fields(value, keys, code):
    require(type(value) is dict and set(value) == set(keys), code)
    return value


def digest(value, code):
    require(type(value) is str and HASH.fullmatch(value), code)
    return value


VERSION = re.compile(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?')
SEVERITIES = ('info', 'low', 'moderate', 'high', 'critical')


def lock_inventory(lock):
    require(type(lock) is dict and type(lock.get('lockfileVersion')) is int and
            lock['lockfileVersion'] == 3 and type(lock.get('packages')) is dict and
            1 < len(lock['packages']) <= 10000, 'TRUSTED_LOCK_SCHEMA')
    result, aliases = {}, {}
    for path, entry in lock['packages'].items():
        require(type(path) is str and type(entry) is dict and (path == '' or
                len(path) <= 512 and re.fullmatch(r'[A-Za-z0-9@._/-]+', path) and
                all(p and p not in ('.', '..') and not p.endswith(('.', ' ')) for p in path.split('/'))),
                'TRUSTED_LOCK_PATH')
        parts = path.split('/') if path else []
        for length in range(1, len(parts)+1):
            parent = '/'.join(parts[:length])
            alias = unicodedata.normalize('NFKC', parent).casefold()
            require(alias not in aliases or aliases[alias] == parent, 'TRUSTED_LOCK_ALIAS')
            aliases[alias] = parent
        if entry.get('link') is True:
            target = entry.get('resolved')
            require(type(target) is str and target in lock['packages'] and type(lock['packages'][target]) is dict and
                    not lock['packages'][target].get('link') and not entry.get('version'), 'TRUSTED_LOCK_LINK')
            result[path] = dict(kind='workspace-link', target=target, entry=entry)
        else:
            kind = 'registry' if 'node_modules/' in path else 'workspace'
            name = path.rsplit('node_modules/', 1)[-1] if kind == 'registry' else entry.get('name')
            version = entry.get('version')
            require(type(name) is str and PACKAGE.fullmatch(name) and type(version) is str and
                    VERSION.fullmatch(version), 'TRUSTED_LOCK_IDENTITY')
            if kind == 'registry':
                require(entry.get('resolved') == 'https://registry.npmjs.org/'+name+'/-/'+name.split('/')[-1]+'-'+version+'.tgz' and
                        type(entry.get('integrity')) is str and re.fullmatch(r'sha512-[A-Za-z0-9+/]+={0,2}', entry['integrity']),
                        'TRUSTED_LOCK_REGISTRY')
            result[path] = dict(kind=kind, name=name, version=version, entry=entry)
    require('' in result and result['']['kind'] == 'workspace', 'TRUSTED_LOCK_ROOT')
    for value in result.values():
        if value['kind'] == 'workspace-link':
            require(result[value['target']]['kind'] == 'workspace', 'TRUSTED_LOCK_LINK')
    return result


def dependency(value, exit_code, lock, *, lock_document, npm_cli_sha256, node_version):
    require(type(value) is dict and type(value.get('schema')) is int and value['schema'] == 1 and
            value.get('component') == 'dependency22' and value.get('qualification') == 'PUBLIC_DEPENDENCY_TECHNICAL_ONLY' and
            value.get('admission') == 'NOT_GRANTED' and value.get('state') in ('PASS', 'FINDINGS', 'INCOMPLETE'), 'DEPENDENCY_SCHEMA')
    state = value['state']
    require(type(exit_code) is int and exit_code == {'PASS': 0, 'FINDINGS': 1, 'INCOMPLETE': 2}[state], 'ACTUAL_EXIT_MISMATCH')
    if 'lockSHA256' not in value:
        fields(value, ('schema', 'component', 'qualification', 'state', 'reason', 'admission'), 'DEPENDENCY_SCHEMA')
        require(state == 'INCOMPLETE' and value['reason'] == 'DEPENDENCY_REFUSED', 'DEPENDENCY_MISSING')
        return dict(state='INCOMPLETE', exit=exit_code, reason='DEPENDENCY_REFUSED')
    fields(value, ('schema', 'component', 'qualification', 'lockSHA256', 'installedSourceSHA256',
                  'nodeVersion', 'npmVersion', 'npmCliSHA256', 'coverage', 'installed', 'npm', 'osv',
                  'disagreements', 'state', 'admission'), 'DEPENDENCY_SCHEMA')
    digest(lock, 'TRUSTED_LOCK_HASH')
    require(value['lockSHA256'] == lock, 'DEPENDENCY_SOURCE')
    digest(value['installedSourceSHA256'], 'DEPENDENCY_SOURCE')
    digest(npm_cli_sha256, 'TRUSTED_NPM_HASH')
    require(type(node_version) is str and re.fullmatch(r'v22\.\d+\.\d+', node_version) and
            value['nodeVersion'] == node_version, 'DEPENDENCY_NODE_VERSION')
    if value['npmCliSHA256'] is None:
        require(state == 'INCOMPLETE' and value['npmVersion'] is None, 'DEPENDENCY_NPM_IDENTITY')
    else:
        require(digest(value['npmCliSHA256'], 'DEPENDENCY_NPM_IDENTITY') == npm_cli_sha256 and
                value['npmVersion'] == '11.20.0', 'DEPENDENCY_NPM_IDENTITY')
    expected = lock_inventory(lock_document)
    registry = {path: item for path, item in expected.items() if item['kind'] == 'registry'}
    coordinates = {(item['name'], item['version']) for item in registry.values()}
    package_paths = {}
    for path, item in registry.items():
        package_paths.setdefault(item['name'], set()).add(path)
    direct_names = {name for item in expected.values() if item['kind'] == 'workspace'
                    for field in ('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies')
                    for name in item['entry'].get(field, {})}
    coverage = value['coverage']
    fields(coverage, ('lockEntries', 'registryEntries', 'workspaceEntries', 'workspaceLinks', 'uniqueNpmCoordinates'), 'COVERAGE_SCHEMA')
    coverage = {name: count(number) for name, number in coverage.items()}
    require(coverage == dict(lockEntries=len(expected), registryEntries=len(registry),
                            workspaceEntries=sum(item['kind'] == 'workspace' for item in expected.values()),
                            workspaceLinks=sum(item['kind'] == 'workspace-link' for item in expected.values()),
                            uniqueNpmCoordinates=len(coordinates)) and coordinates, 'COVERAGE_DENOMINATOR')
    installed = value['installed']
    names = ('expected', 'accounted', 'installed', 'platformOptionalAbsent', 'otherOptionalAbsent', 'workspaceLinks', 'files', 'bytes')
    fields(installed, (*names, 'state', 'records', 'generated', 'errors'), 'INSTALLED_SCHEMA')
    require(type(installed['records']) is list and type(installed['errors']) is list and
            type(installed['generated']) is list, 'INSTALLED_SCHEMA')
    records, record_paths = installed['records'], set()
    observed = dict(installed=0, platformOptionalAbsent=0, otherOptionalAbsent=0, workspaceLinks=0)
    files, byte_count = 0, 0
    for record in records:
        require(type(record) is dict and type(record.get('path')) is str and record['path'] in expected and
                record['path'] not in record_paths, 'INSTALLED_RECORD_PATH')
        path = record['path']; record_paths.add(path); item = expected[path]
        require(record.get('kind') == item['kind'], 'INSTALLED_RECORD_KIND')
        if item['kind'] == 'workspace-link':
            fields(record, ('path', 'kind', 'state', 'target'), 'INSTALLED_LINK_SCHEMA')
            require(record['state'] == 'LINK_VERIFIED' and record['target'] == item['target'], 'INSTALLED_LINK_SCHEMA')
            observed['workspaceLinks'] += 1
        else:
            require(record.get('name') == item['name'] and record.get('version') == item['version'], 'INSTALLED_RECORD_IDENTITY')
            if record.get('state') == 'INSTALLED_VERIFIED':
                fields(record, ('path', 'kind', 'name', 'version', 'state', 'packageJSONSHA256', 'files', 'bytes', 'sourceSHA256'), 'INSTALLED_RECORD_SCHEMA')
                digest(record['packageJSONSHA256'], 'INSTALLED_HASH'); digest(record['sourceSHA256'], 'INSTALLED_HASH')
                require(count(record['files']) > 0 and count(record['bytes']) > 0, 'INSTALLED_RECORD_COUNTS')
                if item['kind'] == 'workspace':
                    require(record['files'] == 1 and record['sourceSHA256'] == record['packageJSONSHA256'], 'INSTALLED_WORKSPACE_HASH')
                else:
                    files += record['files']; byte_count += record['bytes']
                observed['installed'] += 1
            else:
                fields(record, ('path', 'kind', 'name', 'version', 'state'), 'INSTALLED_ABSENCE_SCHEMA')
                require(item['kind'] == 'registry' and item['entry'].get('optional') is True and
                        record['state'] in ('OPTIONAL_PLATFORM_NOT_INSTALLED', 'OPTIONAL_NOT_INSTALLED'), 'INSTALLED_ABSENCE_SCHEMA')
                if record['state'] == 'OPTIONAL_PLATFORM_NOT_INSTALLED':
                    require('os' in item['entry'] or 'cpu' in item['entry'], 'INSTALLED_ABSENCE_PLATFORM')
                observed['platformOptionalAbsent' if record['state'] == 'OPTIONAL_PLATFORM_NOT_INSTALLED' else 'otherOptionalAbsent'] += 1
    directory_paths = {(path+'/' if path else '')+'node_modules' for path, item in expected.items() if item['kind'] != 'workspace-link'}
    error_keys = set()
    for error in installed['errors']:
        fields(error, ('path', 'reason'), 'INSTALLED_ERROR_SCHEMA')
        require(type(error['path']) is str and type(error['reason']) is str and
                (error['reason'] == 'INSTALLED_SOURCE_INCOMPLETE' and error['path'] in expected or
                 error['reason'] == 'INSTALLED_DIRECTORY_INCOMPLETE' and error['path'] in directory_paths), 'INSTALLED_ERROR_SCHEMA')
        key = (error['path'], error['reason'])
        require(key not in error_keys, 'INSTALLED_ERROR_DUPLICATE'); error_keys.add(key)
    cache_paths, cache_files, cache_bytes = set(), 0, 0
    for entry in installed['generated']:
        require(type(entry) is dict and entry.get('kind') in ('npm-install-lock', 'npm-bin-shims', 'npm-tool-cache'), 'INSTALLED_GENERATED_SCHEMA')
        if entry['kind'] == 'npm-tool-cache':
            fields(entry, ('kind', 'moduleRoot', 'path', 'files', 'bytes', 'sha256'), 'INSTALLED_GENERATED_SCHEMA')
            require(type(entry['moduleRoot']) is str and entry['moduleRoot'] in directory_paths and
                    type(entry['path']) is str and entry['path'] in (entry['moduleRoot']+'/.vite', entry['moduleRoot']+'/.vite-temp') and
                    entry['path'] not in cache_paths, 'INSTALLED_CACHE_PATH')
            cache_paths.add(entry['path']); cache_files += count(entry['files']); cache_bytes += count(entry['bytes'])
            require(entry['files'] <= 10000 and entry['bytes'] <= 64*1024*1024 and
                    cache_files <= 20000 and cache_bytes <= 256*1024*1024, 'INSTALLED_CACHE_BOUND')
        else:
            number = 'bytes' if entry['kind'] == 'npm-install-lock' else 'files'
            fields(entry, ('kind', number, 'sha256'), 'INSTALLED_GENERATED_SCHEMA')
            count(entry[number])
        digest(entry['sha256'], 'INSTALLED_GENERATED_HASH')
    # JSON.stringify's ordered compact JSON is the producer's exact hash domain.
    source = json.dumps([records, installed['generated']], ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    require(hashlib.sha256(source).hexdigest() == value['installedSourceSHA256'], 'INSTALLED_SOURCE_HASH')
    installed_public = {name: count(installed[name]) for name in names}
    require(installed['state'] in ('PASS', 'INCOMPLETE') and installed_public['expected'] == coverage['lockEntries'] and
            installed_public['accounted'] == len(records) and all(installed_public[k] == v for k, v in observed.items()) and
            installed_public['accounted'] == sum(observed.values()) and
            installed_public['files'] >= files and installed_public['bytes'] >= byte_count and
            bool(installed['errors']) == (installed['state'] == 'INCOMPLETE'), 'INSTALLED_DENOMINATOR')
    installed_public.update(state=installed['state'], incompleteEntries=len(installed['errors']),
                            generatedToolCaches=len(cache_paths), generatedCacheFiles=cache_files, generatedCacheBytes=cache_bytes)
    if installed['state'] == 'PASS':
        require(record_paths == set(expected) and installed_public['files'] == files and
                installed_public['bytes'] == byte_count and not installed['errors'], 'INSTALLED_OMISSION')
    scanners = {}
    for name in ('npm', 'osv'):
        scanner = value[name]
        require(type(scanner) is dict and scanner.get('state') in ('PASS', 'FINDINGS', 'INCOMPLETE'), 'SCANNER_SCHEMA')
        if name == 'npm' and scanner['state'] == 'INCOMPLETE':
            fields(scanner, ('state', 'exit', 'reason'), 'NPM_INCOMPLETE_SCHEMA')
            require(scanner['reason'] in ('NPM_NOT_EXECUTED', 'NPM_EXECUTION_INCOMPLETE', 'NPM_OUTPUT_INCOMPLETE',
                    'DEPENDENCY_JSON_INVALID', 'DEPENDENCY_NPM_UNAVAILABLE', 'DEPENDENCY_AUDIT_INCOMPLETE',
                    'DEPENDENCY_AUDIT_COUNTS', 'DEPENDENCY_AUDIT_SCHEMA', 'DEPENDENCY_AUDIT_ADVISORY') and
                    (scanner['exit'] is None or type(scanner['exit']) is int and 0 <= scanner['exit'] <= 255), 'NPM_INCOMPLETE_SCHEMA')
            scanners[name] = dict(state='INCOMPLETE', exit=scanner['exit'], reason=scanner['reason'], findings=[])
            continue
        required = ('state', 'exit', 'counts', 'findings') if name == 'npm' else ('state', 'expected', 'queried', 'batches', 'findings')
        fields(scanner, (*required, 'reason') if scanner['state'] == 'INCOMPLETE' else required, 'SCANNER_SCHEMA')
        require(type(scanner['findings']) is list, 'SCANNER_FINDINGS_SCHEMA')
        if name == 'osv' and scanner['state'] == 'INCOMPLETE':
            require(scanner['reason'] in ('OSV_QUERY_INCOMPLETE', 'DEPENDENCY_OSV_HTTP', 'DEPENDENCY_OSV_BOUND',
                    'DEPENDENCY_OSV_SCHEMA', 'DEPENDENCY_OSV_ADVISORY', 'DEPENDENCY_JSON_INVALID'), 'OSV_INCOMPLETE_SCHEMA')
        findings = []
        finding_keys = set()
        for finding in scanner['findings']:
            fields(finding, ('name', 'severity', 'direct', 'installedPaths', 'ids', 'propagatesFrom') if name == 'npm' else
                   ('name', 'version', 'ids'), 'FINDING_SCHEMA')
            require(type(finding['name']) is str and finding['name'] in package_paths, 'PACKAGE_SCHEMA')
            row = dict(name=finding['name'], ids=ids(finding['ids']))
            if name == 'npm':
                require(finding['severity'] in SEVERITIES and
                        type(finding['direct']) is bool and finding['direct'] == (finding['name'] in direct_names), 'NPM_FINDING_SCHEMA')
                row.update(severity=finding['severity'], direct=finding['direct'], installedPaths=count(finding['installedPaths']))
                require(0 < row['installedPaths'] <= len(package_paths[row['name']]) and
                        type(finding['propagatesFrom']) is list and all(type(item) is str and item in package_paths for item in finding['propagatesFrom']) and
                        len(finding['propagatesFrom']) == len(set(finding['propagatesFrom'])) and
                        (row['ids'] or finding['propagatesFrom']), 'NPM_PROPAGATION')
                row['propagatesFrom'] = sorted(finding['propagatesFrom'])
                key = row['name']
            else:
                require(type(finding['version']) is str and (finding['name'], finding['version']) in coordinates and row['ids'], 'PACKAGE_VERSION')
                row['version'] = finding['version']
                key = (row['name'], row['version'])
            require(key not in finding_keys, 'DUPLICATE_FINDING'); finding_keys.add(key)
            findings.append(row)
        result = dict(state=scanner['state'], findings=findings)
        if name == 'npm':
            require(scanner.get('exit') is None or type(scanner['exit']) is int, 'NPM_EXIT')
            result['exit'] = scanner.get('exit')
            if scanner['state'] != 'INCOMPLETE':
                fields(scanner['counts'], (*SEVERITIES, 'total'), 'NPM_COUNTS_SCHEMA')
                result['counts'] = {key: count(scanner['counts'][key]) for key in (*SEVERITIES, 'total')}
                require(result['counts']['total'] == len(findings) == sum(result['counts'][key] for key in ('info', 'low', 'moderate', 'high', 'critical')),
                        'NPM_COUNTS')
                require(all(result['counts'][severity] == sum(row['severity'] == severity for row in findings) for severity in SEVERITIES), 'NPM_SEVERITY_COUNTS')
                require(scanner['exit'] == (1 if findings else 0), 'NPM_EXIT')
                require(value['npmCliSHA256'] is not None, 'DEPENDENCY_NPM_IDENTITY')
                require(all(parent in finding_keys for row in findings for parent in row['propagatesFrom']), 'NPM_PROPAGATION_OMISSION')
        else:
            result.update(expected=count(scanner['expected']), queried=count(scanner['queried']), batches=count(scanner['batches']))
            require(result['expected'] == coverage['uniqueNpmCoordinates'] and result['queried'] <= result['expected'], 'OSV_DENOMINATOR')
            require(result['batches'] == (result['queried']+99)//100 and len(findings) <= min(result['expected'], result['queried']+(100 if scanner['state'] == 'INCOMPLETE' else 0)), 'OSV_BATCH_COUNTS')
            if scanner['state'] != 'INCOMPLETE':
                require(result['queried'] == result['expected'], 'OSV_OMISSION')
            else:
                require(result['queried'] < result['expected'] and result['queried'] % 100 == 0, 'OSV_INCOMPLETE_COUNTS')
                result['reason'] = scanner['reason']
        if scanner['state'] == 'PASS':
            require(not findings, 'FALSE_CLEAN_RESULT')
        if scanner['state'] == 'FINDINGS':
            require(bool(findings), 'MISSING_FINDINGS')
        scanners[name] = result
    inferred = 'INCOMPLETE' if any(x['state'] == 'INCOMPLETE' for x in (installed_public, *scanners.values())) else 'FINDINGS' if any(x['findings'] for x in scanners.values()) else 'PASS'
    require(state == inferred, 'FALSE_AGGREGATE_RESULT')
    fields(value['disagreements'], ('npmOnly', 'osvOnly'), 'DISAGREEMENT_SCHEMA')
    disagreements = {name: ids(value['disagreements'][name]) for name in ('npmOnly', 'osvOnly')}
    npm_ids = {item for row in scanners['npm']['findings'] for item in row['ids']}
    osv_ids = {item for row in scanners['osv']['findings'] for item in row['ids']}
    require(disagreements == dict(npmOnly=sorted(npm_ids-osv_ids), osvOnly=sorted(osv_ids-npm_ids)), 'SCANNER_DISAGREEMENT')
    return dict(state=state, exit=exit_code, lockSHA256=lock, installedSourceSHA256=value['installedSourceSHA256'],
                nodeVersion=node_version, npmVersion=value['npmVersion'], npmCliSHA256=value['npmCliSHA256'], coverage=coverage, installed=installed_public,
                **scanners, disagreements=disagreements)


def summary(components):
    require(type(components) is dict and bool(components) and all(value.get('state') in STATES for value in components.values()), 'COMPONENT_SCHEMA')
    unresolved = sorted(name for name, value in components.items() if value['state'] != 'PASS')
    # Even a technical pass cannot grant original Security or qualified custody.
    require('qualified_custody' in components and components['qualified_custody']['state'] == 'BLOCKED_EXTERNAL_CUSTODY', 'CUSTODY_REQUIRED')
    return dict(candidateReady=False, unresolvedRequired=unresolved, acceptance='SUBMITTED_REVIEW_REQUIRED',
                acceptanceGranted=False, G97='FAIL/NO_GO', DB='NOT_ACCEPTED', M103='BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED',
                M2='NOT_AUTHORIZED', J01='CLOSED', release='NO_GO')
