#!/usr/bin/env python3
"""Standalone M0 planning controls. Python 3.9+, standard library, no network/writes to runtime."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
INPUT = 'docs/v2/source-inputs'
STATE = 'docs/brain/state'
GENERATED = 'docs/v2/mirrors'
MANIFEST_HASH = 'fd04a4fe643949b994ab01697cf48fb2894da805951f7389c76aa770b0972957'
CLASSES = ['SOURCE_REPORTED', 'INDEPENDENTLY_OBSERVED', 'INDEPENDENTLY_REPRODUCED', 'DECIDED', 'UNKNOWN']
AXES = ['source', 'integration', 'physical_device_surface', 'qualified_review', 'live_provider',
        'public_release', 'research', 'commercial']
DENIED = {'.git', '.env', '__pycache__', 'node_modules', '99_restricted_personal_references',
          'original_archives', 'source_research', 'history', 'private', 'patient', 'patients',
          'credentials', 'secrets', 'datasets', 'weights', 'photos', 'clinical_data'}
TEXT = {'.md', '.txt', '.json', '.csv'}
CODE = {'.py', '.mjs', '.js', '.ts', '.tsx', '.sql', '.yml', '.yaml', '.toml'}
HARD_BYTES = 1048576
HARD_FILES = 128


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def decode(data):
    def nonfinite(value):
        raise ValueError('Nonfinite JSON value: ' + value)
    return json.loads(data.decode('utf-8'), object_pairs_hook=unique_object, parse_constant=nonfinite)


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


def read(root, name):
    return safe_file(root, name).read_bytes()


def load(root, name):
    return decode(read(root, name))


def snapshot(root, name):
    return load(root, INPUT + '/' + name)


def rows_csv(data):
    reader = csv.DictReader(io.StringIO(data.decode('utf-8'), newline=''))
    fields = reader.fieldnames
    require(fields and len(set(fields)) == len(fields), 'Duplicate/missing CSV columns')
    rows = list(reader)
    require(all(None not in r and all(v is not None for v in r.values()) for r in rows), 'Malformed CSV row')
    return fields, rows


def csv_bytes(fields, rows):
    buf = io.StringIO(newline='')
    writer = csv.DictWriter(buf, fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode('utf-8')


def identities(rows, expected, key='id', ordered=False):
    actual = [r[key] for r in rows]
    require(len(actual) == len(set(actual)), 'Duplicate identity: ' + key)
    require(set(actual) == set(expected), 'Missing/unexpected identities: ' + key)
    if ordered:
        require(actual == expected, 'Approved order changed: ' + key)


def graph(rows, key='id', dependencies='depends_on'):
    nodes = {r[key]: r[dependencies] for r in rows}
    require(len(nodes) == len(rows), 'Duplicate graph identity')
    visiting, done = set(), set()

    def visit(node):
        require(node in nodes, 'Unknown dependency: ' + str(node))
        require(node not in visiting, 'Dependency cycle: ' + node)
        if node in done:
            return
        visiting.add(node)
        require(len(nodes[node]) == len(set(nodes[node])), 'Duplicate dependency: ' + node)
        for parent in nodes[node]:
            visit(parent)
        visiting.remove(node)
        done.add(node)
    for node in nodes:
        visit(node)


def verify_inputs(root):
    raw = read(root, INPUT + '/TASK_MANIFEST.json')
    require(digest(raw) == MANIFEST_HASH, 'Issued manifest hash changed')
    manifest = decode(raw)
    records = manifest['files']
    identities(records, [r['path'] for r in records], 'path')
    total = 0
    for row in records:
        data = read(root, INPUT + '/' + row['path'])
        require(len(data) == row['bytes'] and digest(data) == row['sha256'], 'Input hash/length changed: ' + row['path'])
        total += len(data)
    require(total == manifest['actual_input_bytes'] <= manifest['max_input_bytes'] <= HARD_BYTES, 'Input budget mismatch')
    expected = {r['path'] for r in records} | {'TASK_MANIFEST.json'}
    actual = {p.relative_to(root / INPUT).as_posix() for p in (root / INPUT).rglob('*') if p.is_file()}
    require(actual == expected, 'Unexpected/missing snapshot files')
    sources = snapshot(root, 'SOURCE_INPUTS_MANIFEST.json')
    require(sources['original_archive_sha256'] == manifest['source_pack_sha256'], 'Archive provenance differs')
    for row in sources['files']:
        data = read(root, INPUT + '/' + row['context_path'])
        require(digest(data) == row['sha256'] and len(data) == row['bytes'], 'Source hash changed')
    for row in records:
        if row['path'].startswith('BRAIN_STATE/'):
            name = row['path'].split('/', 1)[1]
            require(read(root, STATE + '/' + name) == read(root, INPUT + '/' + row['path']), 'Approved Brain snapshot changed: ' + name)
    for name in ['AUDIT_M0-01.md', 'REVIEW_OBSERVATIONS.json']:
        require(read(root, 'docs/brain/checkpoints/M0-01/BRAIN_' + name) == read(root, STATE + '/' + name), 'Brain audit changed')
    return manifest


def validate_data(root):
    contract = snapshot(root, 'IDENTITY_PRESERVATION_CONTRACT.json')
    features = snapshot(root, 'source_pack/02_Current_State/legacy_feature_crosswalk.json')
    for collection, expected in contract['legacy_feature_ids_by_original_collection'].items():
        identities([r for r in features['records'] if r['source_collection'] == collection], expected)
    require(features['counts'] == contract['legacy_feature_counts'] and len(features['records']) == 408, 'Feature counts differ')
    families = set(contract['legacy_feature_ids_by_original_collection']['features'])
    for row in features['records']:
        require(set(row['unified_parent_features']) <= families, 'Unknown feature parent')
        require(set(row.get('featureIds', [])) <= families, 'Unknown original feature parent')
    legacy = snapshot(root, 'source_pack/02_Current_State/legacy_task_crosswalk.json')['items']
    identities(legacy, contract['legacy_task_ids'])
    gates = snapshot(root, 'reference_legacy/ACTIVE_EXECUTION_STATUS_RAW.json')['items']
    identities(gates, contract['active_gate_ids'])
    active_graph = snapshot(root, 'reference_legacy/ACTIVE_TASK_GRAPH_RAW.json')['nodes']
    identities(active_graph, contract['active_gate_ids'])
    graph(active_graph, dependencies='prerequisites')
    require({s: sum(r['status'] == s for r in gates) for s in set(r['status'] for r in gates)} == contract['active_gate_status_histogram'], 'Historical gate upgraded')
    for row in gates:
        require(set(row['blockedBy']) <= set(contract['active_gate_ids']), 'Unknown blocking gate')
    original = snapshot(root, 'source_pack/05_Execution/roadmap.json')
    current = load(root, STATE + '/roadmap.json')
    for roadmap in [original, current]:
        identities(roadmap['tasks'], contract['roadmap_task_ids'], ordered=True)
        graph(roadmap['tasks'])
        graph([dict(r, priority_parents=[r['sequencing_predecessor']] if r.get('sequencing_predecessor') else []) for r in roadmap['tasks']], dependencies='priority_parents')
        require([roadmap[k] for k in ['first_internal_testflight', 'first_external_usability_testflight', 'first_quantitative_claim', 'first_quantitative_change']] == ['M2-04', 'M3-04', 'M5-01', 'M5-02'], 'Milestone identity changed')
    for before, after in zip(original['tasks'], current['tasks']):
        require(before['depends_on'] == after['depends_on'] and before.get('sequencing_predecessor') == after.get('sequencing_predecessor'), 'Roadmap dependencies changed')
    modules = snapshot(root, 'source_pack/04_Clinical/module_registry.json')['modules']
    identities(modules, contract['module_execution_order'], ordered=True)
    graph(modules, dependencies='dependencies')
    require([r['execution_order'] for r in modules] == list(range(1, 28)), 'Module order changed')
    require(all(r['publication_admitted'] is False for r in modules), 'Module admission upgrade')
    fields, mirror = rows_csv(read(root, INPUT + '/source_pack/04_Clinical/module_registry.csv'))
    def scalar(v):
        return ';'.join(v) if isinstance(v, list) else '' if v is None else str(v)
    require(mirror == [{k: scalar(row[k]) for k in fields} for row in modules], 'Supplied module JSON/CSV disagree')
    fields, crosswalk = rows_csv(read(root, INPUT + '/source_pack/02_Current_State/v2_feature_crosswalk.csv'))
    require(len(crosswalk) == contract['v2_crosswalk_rows'] and fields == contract['v2_crosswalk_fieldnames'], 'V2 feature columns/count changed')
    identities(crosswalk, [r['feature_id'] for r in crosswalk], 'feature_id')
    return features, legacy, gates, active_graph, current, modules, crosswalk


def generated_views(root):
    features, legacy, gates, active_graph, roadmap, modules, crosswalk = validate_data(root)
    inventory = load(root, 'docs/hugeToDo/feature-inventory.json')
    legacy_live = load(root, 'docs/hugeToDo/legacy-task-disposition.json')
    observed = []
    feature_rows = []
    for row in features['records']:
        collection = row['source_collection']
        matches = [x for x in inventory[collection] if x['id'] == row['id']]
        require(len(matches) == 1, 'Live inventory identity missing/duplicate')
        live = matches[0]
        delta = {k: {'supplied': row.get(k), 'observed': v} for k, v in live.items() if k not in row or row[k] != v}
        if delta:
            observed.append({'namespace': collection, 'id': row['id'], 'fields': delta})
        # Candidate phases are explicitly unresolved, never a fabricated exact-task mapping.
        phases = re.findall(r'P[0-9]+', row.get('unified_phase', ''))
        feature_rows.append({'identity': collection + ':' + row['id'], 'supplied_row': row,
                             'observed_repository_row': live, 'observed_delta': delta,
                             'candidate_v2_tasks': [t['id'] for t in roadmap['tasks'] if t['phase'] in phases],
                             'exact_v2_task': None, 'mapping_state': 'UNRESOLVED_EXACT_TASK; SUPPLIED_PHASE_DISPOSITION_ONLY'})
    task_rows = []
    for row in legacy:
        matches = [x for x in legacy_live['items'] if x['id'] == row['id']]
        require(len(matches) == 1, 'Live legacy identity missing/duplicate')
        live = matches[0]
        delta = {k: {'supplied': row.get(k), 'observed': v} for k, v in live.items() if k not in row or row[k] != v}
        if delta:
            observed.append({'namespace': 'legacy_disposition', 'id': row['id'], 'fields': delta})
        task_rows.append({'identity': 'legacy_disposition:' + row['id'], 'supplied_row': row,
                          'observed_repository_row': live, 'observed_delta': delta,
                          'exact_v2_task': None, 'mapping_state': 'UNRESOLVED_EXACT_TASK; PRESERVE_SUPPLIED_HANDLING'})
    gate_rows = []
    live_gates = load(root, 'docs/hugeToDo/execution-status.json')['items']
    for row, node in zip(gates, active_graph):
        require(row['id'] == node['id'], 'Gate graph order differs')
        live = [x for x in live_gates if x['id'] == row['id']]
        require(len(live) == 1, 'Live gate identity missing/duplicate')
        if live[0] != row:
            observed.append({'namespace': 'active_gate', 'id': row['id'], 'supplied': row, 'observed': live[0]})
        gate_rows.append({'identity': 'active_gate:' + row['id'], 'supplied_status': row, 'supplied_graph': node,
                          'observed_repository_row': live[0], 'evidence_class': 'SOURCE_REPORTED',
                          'exact_v2_task': None, 'mapping_state': 'UNRESOLVED_EXACT_TASK; EXTERNAL_GATE_RETAINED'})
    fields, module_csv = rows_csv(read(root, INPUT + '/source_pack/04_Clinical/module_registry.csv'))
    summary = ['# Generated compatibility view', '', 'Planning only. Original rows and evidence are retained in compatibility.json.', '',
               '376 granular items + 20 families + 12 surfaces = 408; 202 legacy dispositions; 25 active gates; 38 V1/V2 rows.',
               'Exact task mappings not supplied by the Brain stay unresolved. Candidate tasks express supplied phases only.', '',
               '| Identity | Supplied disposition | Supplied phase | Exact V2 task |', '| --- | --- | --- | --- |']
    for row in features['records']:
        summary.append('| ' + ' | '.join(str(v).replace('|', '\\|') for v in [row['id'], row['migration_disposition'], row.get('unified_phase', ''), 'Unresolved']) + ' |')
    source_rows = []
    integrity = read(root, INPUT + '/reference_legacy/README_SOURCE_INTEGRITY.txt').decode('utf-8')
    for path, expected_hash, size in re.findall(r'<= ([^\n|]+) \| SHA256 ([0-9a-f]{64}) \| bytes ([0-9]+)', integrity):
        blob = read(root, path.strip())
        source_rows.append({'path': path.strip(), 'supplied_sha256': expected_hash, 'supplied_bytes': int(size),
                            'observed_sha256': digest(blob), 'observed_bytes': len(blob),
                            'state': 'MATCH' if digest(blob) == expected_hash else 'OBSERVED_DELTA_NO_STATUS_UPGRADE'})
    return {
        'compatibility.json': encoded({'schema_version': 1, 'admission': 'NONE', 'features': feature_rows,
                                       'legacy_dispositions': task_rows, 'active_gates': gate_rows, 'v1_v2_features': crosswalk}),
        'compatibility.md': ('\n'.join(summary) + '\n').encode('utf-8'),
        'observed-deltas.json': encoded({'evidence_class': 'INDEPENDENTLY_OBSERVED', 'scope': 'Current repository JSON vs immutable supplied rows; no status substitution', 'deltas': observed}),
        'roadmap.json': encoded(roadmap),
        'modules.json': encoded({'modules': modules, 'all_outputs_default_unavailable': True}),
        'modules.csv': csv_bytes(fields, module_csv),
        'v1-v2-features.json': encoded(crosswalk),
        'v1-v2-features.csv': csv_bytes(list(crosswalk[0]), crosswalk),
        'source-reconciliation.json': encoded({'evidence_class': 'INDEPENDENTLY_OBSERVED',
                                               'source_commit': 'bbc28dc3d1f945191a81be56945b8bda7bb6ef73',
                                               'note': 'PROGRESS already differs after M0-01; hashes show freshness, not approval. No archives copied.',
                                               'sources': source_rows,
                                               'original_inventory_metadata': {k: v for k, v in inventory.items() if k not in ['features', 'gatedSurfaces', 'items']}}),
    }


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


def validate_state(root):
    approved = load(root, STATE + '/brain_state.json')
    current = load(root, 'docs/brain/current.json')
    require(set(current) == {'schema_version', 'task_id', 'submission_status', 'approved_state_version',
                            'accepted_tasks', 'accepted_scope', 'protected_source_go', 'main_promotion_authorized',
                            'incremental_spend_usd', 'active_writers', 'next_task', 'research_requests',
                            'open_blocker_ids', 'proposal_expires_utc', 'axes', 'observations'}, 'Unknown/missing current-state field')
    require(current['schema_version'] == 2 and current['task_id'] == approved['in_flight_task'] == 'M0-02', 'Unissued current task')
    require(current['submission_status'] in ['IN_PROGRESS', 'SUBMITTED_REVIEW_REQUIRED', 'PARTIAL', 'BLOCKED'], 'Codex cannot accept task')
    require(current['accepted_tasks'] == approved['accepted_tasks'] == ['M0-01'], 'False task acceptance')
    require(current['accepted_scope'] == approved['accepted_task_scopes'], 'Diagnostic scope changed')
    require(current['approved_state_version'] == approved['state_version'], 'State version differs')
    require(current['protected_source_go'] is False and current['main_promotion_authorized'] is False and type(current['incremental_spend_usd']) is int and current['incremental_spend_usd'] == 0, 'Protected/spend upgrade')
    require(type(current['active_writers']) is int and current['active_writers'] == 1 and current['next_task'] is None and current['research_requests'] == [], 'Extra task/writer/research request')
    ledger = load(root, STATE + '/ACCEPTANCE_LEDGER.json')
    expected = dict(ledger['axes'])
    expected['physical_device_surface'] = expected.pop('physical_device')
    expected['research'] = {'single_scan': expected.pop('clinical_single_scan'), 'change': expected.pop('clinical_change')}
    require(current['axes'] == expected and set(current['axes']) == set(AXES), 'Evidence axes upgraded/conflated')
    require(current['open_blocker_ids'] == approved['open_blocker_ids'], 'Blocker silently closed')
    require(current['proposal_expires_utc'] == '2026-10-21T00:00:00Z', 'Expiry changed')
    require(read(root, 'docs/hugeToDo/launch-contract.json') == read(root, INPUT + '/reference_legacy/LAUNCH_CONTRACT_RAW.json'), 'Runtime launch contract changed')
    identities(current['observations'], [x['id'] for x in current['observations']])
    for entry in current['observations']:
        require(entry['evidence_class'] in CLASSES and entry['axis'] in AXES, 'Unknown evidence class/axis')
        require(entry['status'] in ['OBSERVED', 'PASS', 'FAIL', 'NOT_RUN', 'BLOCKED', 'UNKNOWN'], 'Unknown observation outcome')
        require(entry.get('admission') == 'NONE', 'Observation cannot grant admission')
        if entry['status'] == 'PASS':
            require(entry['exit_code'] == 0 and entry['evidence_class'] == 'INDEPENDENTLY_REPRODUCED', 'Unrun check labeled PASS')
        if entry.get('artifact'):
            require(digest(read(root, entry['artifact'])) == entry['sha256'], 'Observation artifact hash differs')
    return current


def schema_check(value, schema, at='$'):
    """Strict interpreter for the deliberately small schema vocabulary used by report v2.

    Unsupported keywords fail closed; this is not a general JSON Schema implementation.
    """
    supported = {'$schema', 'title', 'description', 'type', 'required', 'properties', 'additionalProperties',
                 'items', 'enum', 'const', 'pattern', 'minimum', 'minItems', 'minLength'}
    require(set(schema) <= supported, 'Unsupported schema keyword at ' + at)
    kinds = {'object': dict, 'array': list, 'string': str, 'integer': int, 'boolean': bool, 'null': type(None)}
    if 'type' in schema:
        allowed = schema['type'] if isinstance(schema['type'], list) else [schema['type']]
        require(any(type(value) is kinds[t] for t in allowed), 'Schema type at ' + at)
    if 'const' in schema:
        require(type(value) is type(schema['const']) and value == schema['const'], 'Schema const at ' + at)
    if 'enum' in schema:
        require(value in schema['enum'], 'Schema enum at ' + at)
    if isinstance(value, dict):
        require(set(schema.get('required', [])) <= set(value), 'Schema required at ' + at)
        props = schema.get('properties', {})
        if schema.get('additionalProperties') is False:
            require(set(value) <= set(props), 'Schema extra field at ' + at)
        for key in value.keys() & props.keys():
            schema_check(value[key], props[key], at + '.' + key)
    if isinstance(value, list):
        require(len(value) >= schema.get('minItems', 0), 'Schema minItems at ' + at)
        for item in value:
            schema_check(item, schema.get('items', {}), at + '[]')
    if isinstance(value, str):
        require(len(value) >= schema.get('minLength', 0), 'Schema minLength at ' + at)
        if 'pattern' in schema:
            require(re.search(schema['pattern'], value), 'Schema pattern at ' + at)
    if 'minimum' in schema and value is not None:
        require(value >= schema['minimum'], 'Schema minimum at ' + at)


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True, encoding='utf-8').strip()


def validate_report(root, name):
    verify_inputs(root)
    validate_state(root)
    mirrors(root)
    report = load(root, name)
    schema_check(report, load(root, 'docs/brain/contracts/completion-report.v2.schema.json'))
    require(report['task_id'] == 'M0-02' and report['base_commit'] == snapshot(root, 'TASK_MANIFEST.json')['base_commit'], 'Report task/base mismatch')
    require(report['accepted_by_brain'] is False and report['admission'] == 'NONE', 'Self acceptance')
    artifacts = {a['path']: a for a in report['evidence_artifacts']}
    require(len(artifacts) == len(report['evidence_artifacts']), 'Duplicate report artifact')
    require(name not in artifacts and 'ONSKIN_BRAIN_HANDOFF.txt' not in artifacts, 'Self-referential report/handoff artifact')
    for path, entry in artifacts.items():
        require(digest(read(root, path)) == entry['sha256'], 'Report artifact hash differs: ' + path)
    for test in report['tests']:
        if test['status'] == 'PASS':
            require(test['exit_code'] == 0 and test['evidence_class'] == 'INDEPENDENTLY_REPRODUCED', 'False PASS')
        if test['status'] in ['NOT_RUN', 'BLOCKED']:
            require(test['exit_code'] is None, 'Unrun check has exit')
        if test['status'] == 'FAIL':
            require(type(test['exit_code']) is int and test['exit_code'] != 0, 'FAIL missing nonzero exit')
        require(test['artifact'] in artifacts or (test['status'] in ['NOT_RUN', 'BLOCKED'] and test['artifact'] is None), 'Unbound test artifact')
    for test in report['tests']:
        if test['status'] in ['PASS', 'FAIL']:
            require(git(root, 'rev-parse', test['snapshot_commit'] + '^{tree}') == test['snapshot_tree'], 'Test commit/tree mismatch')
    measured = report['implementation_snapshot']
    require(git(root, 'rev-parse', measured['commit'] + '^{tree}') == measured['tree'], 'Implementation commit/tree mismatch')
    # New report commits may add evidence/docs; they cannot silently replace the tested implementation.
    changed = git(root, 'diff', '--name-only', measured['commit'], '--', 'scripts/brain', 'docs/v2', STATE, 'docs/brain/contracts', 'docs/brain/task-specs')
    require(not changed, 'Implementation differs from measured snapshot: ' + changed)
    require(not git(root, 'status', '--porcelain', '--untracked-files=all', '--', 'scripts/brain', 'docs/v2', STATE,
                    'docs/brain/contracts', 'docs/brain/task-specs'), 'Uncommitted implementation files')
    pushed = report['delivery']['last_observed_pushed_snapshot']
    require(git(root, 'rev-parse', pushed['commit'] + '^{tree}') == pushed['tree'], 'Pushed snapshot tree differs')
    return report


def pack_spec(root, task):
    require(re.fullmatch(r'[A-Z0-9]+-[A-Z0-9]+', task), 'Invalid task ID')
    spec = load(root, 'docs/brain/task-specs/' + task + '.json')
    require(spec['task_id'] == task and spec['issued'] is True and spec['issued_by'] == 'onSkin Brain', 'Unissued task')
    current = load(root, 'docs/brain/current.json')
    require(current['task_id'] == task and current['active_writers'] == 1 and current['next_task'] is None, 'Task/writer conflict')
    approval = spec['approval']
    raw = read(root, approval['path'])
    require(digest(raw) == approval['sha256'], 'Approval hash differs')
    issued = decode(raw)
    require(issued['task_id'] == task and issued['issued_by'] == spec['issued_by'], 'Task approval differs')
    # Files are derived from the reviewed issued manifest; arbitrary additions cannot become approved.
    approved_rows = issued['files'] + [{'path': 'TASK_MANIFEST.json', 'bytes': len(raw), 'sha256': digest(raw)}]
    expected = [{'source': spec['input_prefix'] + '/' + r['path'], 'archive': r['path'],
                 'bytes': r['bytes'], 'sha256': r['sha256'],
                 'code_reviewed': r.get('code_reviewed', task == 'M0-02' and r['path'] == 'source_pack/tools/build_codex_context.py')}
                for r in approved_rows]
    require(spec['files'] == expected, 'Allowlist differs from reviewed issue manifest')
    require(0 < spec['max_input_bytes'] <= issued['max_input_bytes'] <= HARD_BYTES, 'Invalid context bound')
    require(0 < len(spec['files']) <= spec['max_files'] <= HARD_FILES, 'Invalid file bound')
    return spec


def allowed_text(name, data, code_reviewed):
    rel = relative_name(name)
    require(not any(part.lower() in DENIED or part.lower().startswith('.env') or
                    re.search(r'(?i)(?:^|[_.-])(private|patient|patients|credentials|secrets|photos|raw_clinical)(?:$|[_.-])', part)
                    for part in rel.parts), 'Private/restricted path: ' + name)
    suffix = rel.suffix.lower()
    require(suffix in TEXT or (suffix in CODE and code_reviewed is True), 'Unreviewed code/binary/archive: ' + name)
    require(not data.startswith((b'PK\x03\x04', b'%PDF-', b'\x89PNG', b'\xff\xd8', b'MZ')), 'Binary signature: ' + name)
    text = data.decode('utf-8')
    require(not any(ord(c) < 32 and c not in '\n\r\t' for c in text), 'Binary/control input: ' + name)
    require(not re.search(r'-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----|(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}', text), 'Credential material forbidden')


def package_data(root, task):
    spec = pack_spec(root, task)
    data, records, names = {}, [], set()
    total = 0
    for row in spec['files']:
        relative_name(row['archive'])
        require(row['archive'].casefold() not in names | {'context_manifest.json'}, 'Archive path collision')
        require(not any(row['archive'].casefold().startswith(n + '/') or n.startswith(row['archive'].casefold() + '/')
                        for n in names), 'Archive file/directory collision')
        names.add(row['archive'].casefold())
        path = safe_file(root, row['source'])
        require(path.stat().st_size == row['bytes'] and row['bytes'] <= spec['max_input_bytes'], 'Input size differs')
        blob = path.read_bytes()
        require(len(blob) == row['bytes'] and digest(blob) == row['sha256'], 'Approved input hash differs')
        allowed_text(row['source'], blob, row['code_reviewed'])
        allowed_text(row['archive'], blob, row['code_reviewed'])
        total += len(blob)
        require(total <= spec['max_input_bytes'], 'Context budget exceeded')
        data[row['archive']] = blob
        records.append({'path': row['archive'], 'bytes': len(blob), 'sha256': digest(blob)})
    manifest = {'schema_version': 2, 'task_id': task, 'approval_sha256': spec['approval']['sha256'],
                'scope': 'CONTEXT_ONLY_NO_ADMISSION', 'total_input_bytes': total,
                'files': sorted(records, key=lambda x: x['path'])}
    data['CONTEXT_MANIFEST.json'] = encoded(manifest)
    require(sum(map(len, data.values())) <= HARD_BYTES, 'Manifest exceeds hard context bound')
    return data, manifest


def verify_pack(root, task, output):
    expected, manifest = package_data(root, task)
    require(output.stat().st_size <= HARD_BYTES + 65536, 'Archive size exceeded')
    with zipfile.ZipFile(output) as z:
        infos = z.infolist()
        require(len(infos) == len(expected), 'Archive file count differs')
        require([i.filename for i in infos] == sorted(expected), 'Archive order/names differ')
        for item in infos:
            require(item.file_size == len(expected[item.filename]) and item.compress_type == zipfile.ZIP_STORED and item.date_time == (1980, 1, 1, 0, 0, 0), 'Noncanonical archive metadata')
            require(item.external_attr == (0o100644 << 16) and item.create_system == 3 and not item.extra and not item.comment and not item.flag_bits & 1, 'Noncanonical archive attributes')
        require(not z.comment and z.testzip() is None, 'ZIP CRC/comment invalid')
        for item in infos:
            require(z.read(item) == expected[item.filename], 'ZIP hash/content differs')
    require(output.read_bytes() == archive_bytes(expected), 'Noncanonical ZIP bytes/trailing content')
    return {'task_id': task, 'files': len(expected), 'input_bytes': manifest['total_input_bytes'],
            'archive_bytes': output.stat().st_size, 'sha256': digest(output.read_bytes())}


def archive_bytes(data):
    # Stored entries avoid zlib/runtime variability; fixed ordering, dates, Unix mode and no ZIP64.
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_STORED, allowZip64=False) as z:
        for name in sorted(data):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            z.writestr(info, data[name])
    return stream.getvalue()


def build_pack(root, task, output):
    data, _ = package_data(root, task)
    output = Path(output).absolute()
    require(output.suffix.lower() == '.zip', 'Output must be ZIP')
    require(root.resolve() not in output.resolve().parents and output.resolve() != root.resolve(), 'Output inside input root')
    require(not output.exists(), 'Refuse output overwrite')
    no_link_parents(output.parent)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Reject linked output ancestors, including Windows junctions.
    for p in [output.parent, *output.parent.parents]:
        info = p.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not (getattr(info, 'st_file_attributes', 0) & 0x400), 'Linked output directory')
    blob = archive_bytes(data)
    require(len(blob) <= HARD_BYTES + 65536, 'ZIP budget exceeded')
    # Exclusive output creation prevents accidental replacement of other work.
    with output.open('xb') as handle:
        handle.write(blob)
    return verify_pack(root, task, output)


def ready(root):
    verify_inputs(root)
    current = validate_state(root)
    tasks = load(root, STATE + '/roadmap.json')['tasks']
    return {'active_task': current['task_id'], 'execution_status': current['submission_status'],
            'next_issued_task': None, 'automatic_issue': False, 'active_writers': 1,
            'blockers': current['open_blocker_ids'],
            'candidates': [{'id': t['id'], 'unaccepted_dependencies': [p for p in t['depends_on'] if p not in current['accepted_tasks']],
                            'priority_predecessor': t.get('sequencing_predecessor'), 'external_gates': t['external_gates'],
                            'authorized_to_execute': t['id'] == current['task_id'],
                            'reason': 'Only M0-02 is issued; diagnostic M0-01 acceptance does not clear baseline/protected gates'}
                           for t in tasks if t['id'] not in current['accepted_tasks']]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('validate')
    mirror = commands.add_parser('mirrors')
    mirror.add_argument('--check', action='store_true')
    report = commands.add_parser('report')
    report.add_argument('path')
    commands.add_parser('ready')
    for name in ['pack', 'verify-pack']:
        p = commands.add_parser(name)
        p.add_argument('--task', required=True)
        p.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.root.absolute()
    try:
        if args.command == 'validate':
            verify_inputs(root)
            validate_state(root)
            mirrors(root)
            print('PASS: immutable inputs, identities, dependencies, closed state and generated mirrors')
        elif args.command == 'mirrors':
            mirrors(root, check=args.check)
            print('PASS: mirrors ' + ('unchanged' if args.check else 'generated'))
        elif args.command == 'report':
            validate_report(root, args.path)
            print('PASS: report v2; measured tests are separate from live delivery ref')
        elif args.command == 'ready':
            print(encoded(ready(root)).decode('utf-8'), end='')
        else:
            verify_inputs(root)
            validate_state(root)
            result = build_pack(root, args.task, args.output) if args.command == 'pack' else verify_pack(root, args.task, args.output)
            print(encoded(result).decode('utf-8'), end='')
    except (ValueError, OSError, KeyError, TypeError, UnicodeError, zipfile.BadZipFile, subprocess.CalledProcessError) as exc:
        print('REJECTED: ' + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
