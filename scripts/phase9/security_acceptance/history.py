"""Reproduce dispositions from exact Git objects and pinned detection regexes.
No matched credential-shaped value is printed or persisted.
"""
import base64, collections, hashlib, json, pathlib, re, subprocess
SHA = lambda b: hashlib.sha256(b).hexdigest()

def verify_history(root, fresh, witnesses, config_text, rule_hashes=None):
    key = lambda r: (r['Commit'], r['File'], r['RuleID'], r['StartLine'], r['EndLine'])
    prior = {(r['commit'], r['path'], r['rule'], r['start_line'], r['end_line']): r for r in witnesses}
    if not prior or len(fresh) != len(prior) or len(witnesses) != len(prior) or {key(r) for r in fresh} != set(prior):
        raise ValueError('HISTORY_SET_DRIFT')
    patterns = {}
    for section in config_text.split('[[rules]]')[1:]:
        name = re.search('^id = "([^"]+)"', section, re.M)
        p = re.search("^regex = '''(.*?)'''", section, re.M | re.S)
        if name and p and (name[1] in {r['RuleID'] for r in fresh}):
            patterns[name[1]] = re.compile(p[1].replace('\\z', '\\Z'))
    grouped = collections.defaultdict(list)
    for r in fresh:
        grouped[r['Commit'], r['File']].append(r)

    def gitblob(commit, path):
        return subprocess.run(['git', '-c', 'core.fsmonitor=false', 'cat-file', 'blob', commit + ':' + path], cwd=root, capture_output=True, check=True).stdout
    observations = []
    for ((commit, path), records) in grouped.items():
        data = gitblob(commit, path)
        text = data.decode('utf-8')
        lines = text.splitlines(keepends=True)
        for r in records:
            witness = prior[key(r)]
            if not r['Fingerprint'] == witness['id']:
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            if not (SHA(data) == witness['source_sha256'] and subprocess.run(['git', 'hash-object', '--stdin'], input=data, cwd=root, capture_output=True, check=True).stdout.decode().strip() == witness['source_blob']):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            start = max(0, r['StartLine'] - 2)
            context = ''.join(lines[start:r['EndLine'] + 1])
            matches = list(patterns[r['RuleID']].finditer(context))
            captures = [m.group(1) if m.lastindex else m[0] for m in matches]
            captures = [v for v in captures if SHA(v.encode()) == witness['opaque_value_sha256']]
            if not len(set(captures)) == 1:
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            raw = captures[0]
            line = lines[r['StartLine'] - 1]
            window = ''.join(lines[max(0, r['StartLine'] - 8):r['EndLine'] + 8])
            field = re.match('\\s*["\\\']([^"\\\']+)["\\\']\\s*:', line)
            observations.append({'finding': r, 'source_sha256': SHA(data), 'source_blob': witness['source_blob'], 'value_sha256': SHA(raw.encode()), 'value_length': len(raw), 'raw': raw, 'field': field[1] if field else None, 'line': line, 'window': window, 'body': text})
    nonce_anchors = {o['value_sha256'] for o in observations if 'Sec-WebSocket-Key' in o['line'] and len(base64.b64decode(o['raw'], validate=True)) == 16}
    storage_suffixes = ('localPrivateDataRegistry.ts', 'localDeviceExport.ts', 'cycleStore.ts', 'orderStore.ts', 'activationAnalytics.ts')
    storage_anchors = {o['value_sha256'] for o in observations if o['finding']['File'].endswith(storage_suffixes)}
    results = []
    unresolved = []
    for o in observations:
        r = o['finding']
        path = r['File']
        raw = o['raw']
        field = o['field']
        line = o['line']
        body = o['body']
        proof = {'source_object_rehashed': True, 'rule_match_reextracted_from_exact_Git_blob': True}
        kind = None
        if o['value_sha256'] in nonce_anchors and 'browser-events-' in path:
            if not len(base64.b64decode(raw, validate=True)) == 16:
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'PUBLIC_WEBSOCKET_HANDSHAKE_NONCE'
            proof.update(decoded_bytes=16, exact_Sec_WebSocket_Key_anchor=True, duplicate_header_or_headersText_linked_by_value_hash=True, standard='RFC6455 section4.1')
        elif path.endswith('release-engineering-qa-packet.json'):
            if not (field and re.fullmatch('[0-9a-f]{64}', raw) and (SHA(gitblob(r['Commit'], field)) == raw)):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'RECOMPUTED_SOURCE_FILE_DIGEST'
            proof.update(referenced_source_path=field, referenced_source_digest_recomputed=True)
        elif path == 'scripts/phase9/security_acceptance/proposal.json':
            document = json.loads(body)
            if not (field == 'secrets' and re.fullmatch('[0-9a-f]{64}', raw)
                    and rule_hashes and document.get('rules') == rule_hashes
                    and document['rules']['secrets'] == raw):
                raise ValueError('HISTORICAL_RULESET_DIGEST_PROOF_FAILED')
            kind = 'PINNED_SCANNER_RULESET_DIGEST'
            proof.update(exact_field='rules.secrets', matches_source_bound_rule_config_digest=True,
                         digest_not_authentication_material=True,
                         actual_rule_bytes_independently_rehashed_by_evidence_contract=True)
        elif field == 'contentKeySha256':
            if not re.fullmatch('[0-9a-f]{64}', raw):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'CONTENT_KEY_DIGEST_EVIDENCE'
            proof.update(exact_field=field, digest_not_key_bytes=True)
        elif re.fullmatch('[0-9a-f]{64}', raw) and ('.template.json' in path or 'checkpoint.md' in path):
            if not ('Sha256' in line or 'SHA-256' in line or 'sha256' in line.lower()):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'TEMPLATE_OR_DOCUMENTED_SYNTHETIC_INPUT_DIGEST'
            proof.update(explicit_SHA256_semantics=True, template_or_synthetic_evidence=True)
        elif path == 'scripts/phase2/staging-deployment-evidence-lib.mjs':
            if not (field == 'hostedSecretGroups' and re.fullmatch('[0-9a-f]{64}', raw) and ('REVIEWED_SOURCE' in body)):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'CLOSED_A_SOURCE_WITNESS_DIGEST'
            proof.update(immutable_source_witness_field=True, secret_group_names_not_provider_secret_values=True)
        elif path == 'scripts/phase2/staging-deployment-evidence.test.mjs':
            if not (re.fullmatch('[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)+', raw) and raw + ' = sha256(canonicalJson(s.deploymentInputs))' in line):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'CLOSED_A_JAVASCRIPT_MEMBER_EXPRESSION'
            proof.update(expression_not_string_literal=True, negative_test_assignment=True)
        elif r['RuleID'] == 'private-key':
            p = subprocess.run(['node', '-e', "let b='';process.stdin.on('data',c=>b+=c);process.stdin.on('end',()=>{try{require('node:crypto').createPrivateKey(b.replaceAll('\\\\n','\\n'));process.exit(1)}catch{console.log('INVALID_PRIVATE_KEY_PLACEHOLDER')}})"], input=raw.encode(), capture_output=True, check=True)
            if not (b'INVALID_PRIVATE_KEY_PLACEHOLDER' in p.stdout and 'Apple automatic revocation requires the explicit client identifier' in body):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'INVALID_TEST_PRIVATE_KEY_PLACEHOLDER'
            proof.update(Node_crypto_rejects_as_private_key=True, configuration_negative_test=True)
        elif o['value_sha256'] in storage_anchors:
            if not ('KEY' in line or 'storageKey' in line or 'key:' in line or ('StorageKey' in line) or ('storageKey' in o['window'])):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'LOCAL_STORAGE_NAMESPACE'
            proof.update(identical_hash_anchor_in_non_test_storage_source=True, local_registry_key_not_authentication_secret=True)
        elif path == 'apps/catalog-operator-console/src/auth.test.ts':
            if not ('publishableKey' in line and '127.0.0.1' in body):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'SYNTHETIC_PUBLIC_CLIENT_CONFIGURATION'
            proof.update(publishable_configuration_field=True, loopback_test_endpoint=True)
        elif path == 'scripts/e2e/catalog-operator-console-fixture-server.mjs':
            if not ('authSessionId' in line and '127.0.0.1' in body and ('example.test' in body) and re.fullmatch('[0-9a-f-]{36}', raw)):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'LOOPBACK_FIXTURE_SESSION_IDENTIFIER'
            proof.update(loopback_fixture_server=True, example_test_identity=True, session_identifier_not_external_service_credential=True)
        elif path == 'scripts/phase2/contained-command.test.mjs':
            if not ('secretApiKey' in line and 'redact' in body and ('const secretApiKey' in line)):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'EXPLICIT_REDACTION_TEST_INPUT'
            proof.update(source_declaration='secretApiKey', redaction_assertion_uses_identifier=True, local_contained_child_fixture=True)
        elif path == 'scripts/e2e/cat07-shelf-freshness-audit.test.mjs':
            if not ('sensitive' in body and 'redact' in body and ('127.0.0.1' in body)):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            if not r['RuleID'] in ('aws-access-token', 'stripe-access-token', 'slack-bot-token'):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'EXPLICIT_REDACTION_FIXTURE'
            proof.update(redaction_assertions=True, loopback_test_harness=True, deliberately_constructed_credential_shaped_test_input=True)
        elif path.endswith(('build-core-loop-qa-packet.mjs', 'core-loop-qa-packet.json')):
            if not ('envKey' in line and re.fullmatch('[A-Z][A-Z0-9_]+', raw)):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'BOOLEAN_EVIDENCE_ENVIRONMENT_VARIABLE_NAME'
            proof.update(declaration_field='envKey', name_not_environment_value=True)
        elif path.endswith('live-order-report-poll.mjs'):
            if not ('x-scheduler-secret' in line and 'fake provider and scheduler credentials' in body):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'EXPLICIT_INVALID_AUTHENTICATION_REHEARSAL'
            proof.update(closed_response_negative_test=True, declared_fake_credentials=True)
        elif path.endswith('live-consent-withdrawal.mjs'):
            if not 'narrative_key:' in line:
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'LOCALIZATION_MESSAGE_KEY'
            proof.update(field='narrative_key', literal_fixture_metadata=True)
        elif path.endswith('cat07-shelf-freshness-audit.mjs'):
            if not ('key ===' in line and 'step ===' in line):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'ROUTE_TEST_STEP_COMPARISON'
            proof.update(source_expression_comparison=True, not_credential_assignment=True)
        elif path.endswith('rls-adversarial.mjs'):
            if not 'Storage cleanup left a residual object' in o['window']:
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'ASSERTION_DESCRIPTION'
            proof.update(English_cleanup_assertion=True, not_credential_assignment=True)
        elif path.endswith('live-supabase-adversarial.mjs'):
            if not o['value_sha256'] == 'd0f93c1bbd3b6597cd18dad6a9a3ad8ec0aac16257c806c8ba037dfcc9fcd387':
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            if not (raw == '-'.join(['phase9', 'live', 'adversarial', 'redacted']) and 'push_token:' in line):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            if not 'notification, streak, recommendation, and trend isolation' in body:
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            if not ('@example.invalid' in body and 'users.push(userA, userB)' in body and ('admin.auth.admin.deleteUser' in body)):
                raise ValueError('HISTORICAL_SOURCE_PROOF_FAILED')
            kind = 'PROVEN_SYNTHETIC_REHEARSAL_SEED'
            proof.update(literal_reproduced_from_public_rehearsal_components=True, contains_explicit_redaction_marker=True, no_environment_network_random_or_provider_credential_input=True, user_creation_uses_example_invalid_identity=True, cleanup_code_present_not_a_live_cleanup_receipt=True, isolated_payload_execution_evidence='evidence/commands/seed-payload-isolation-confirmed')
        if kind is None:
            unresolved.append({'commit': r['Commit'], 'path': path, 'line': r['StartLine'], 'opaque_value_sha256': o['value_sha256']})
        results.append({'id': r['Fingerprint'], 'rule': r['RuleID'], 'commit': r['Commit'], 'path': path, 'start_line': r['StartLine'], 'end_line': r['EndLine'], 'source_blob': o['source_blob'], 'source_sha256': o['source_sha256'], 'opaque_value_sha256': o['value_sha256'], 'matched_length': o['value_length'], 'technical_disposition': kind or 'UNRESOLVED', 'proof': proof, 'independent_BRAIN_acceptance': False, 'sensitive_value_disclosed': False})
    if unresolved:
        raise ValueError('UNVERIFIED_HISTORY_FINDING')
    for r in results:
        if r['technical_disposition'] != prior[r['commit'], r['path'], r['rule'], r['start_line'], r['end_line']]['technical_disposition']:
            raise ValueError('DISPOSITION_DRIFT')
    return {'records': len(results), 'groups': len({(r['rule'], r['opaque_value_sha256']) for r in results}), 'all_Git_sources_rehashed': True, 'unverified': 0, 'independent_owner_acceptance': False}


# Current-source classification reuses exact Git objects and typed proofs.
# Retained QA digest references and the byte-identical synthetic literal payload
# remain historical material; neither refreshes QA nor claims hosted execution.
def verify_current(root, fresh, prefix, commit, prior, config_text, rule_hashes):
    prefix = pathlib.Path(prefix)
    if not prefix.is_absolute() or prefix.name != 'current-source' or (not re.fullmatch('[0-9a-f]{40}', commit)):
        raise ValueError('CURRENT_SOURCE_SCOPE_INVALID')
    for item in fresh:
        if not isinstance(item, dict) or item.get('Secret') != 'REDACTED' or item.get('Commit') != '' or (not isinstance(item.get('File'), str)) or (type(item.get('StartLine')) is not int) or (type(item.get('EndLine')) is not int) or (not 0 < item['StartLine'] <= item['EndLine']) or (item.get('Fingerprint') != f'{item['File']}:{item['RuleID']}:{item['StartLine']}'):
            raise ValueError('CURRENT_SOURCE_RECORD_INVALID')
        path = pathlib.Path(item['File']).relative_to(prefix).as_posix()
        if any((part in ('', '.', '..') for part in path.split('/'))) or any((char in path for char in ('\\', ':', '\x00'))):
            raise ValueError('CURRENT_SOURCE_PATH_INVALID')
    patterns = {}
    needed = {x['RuleID'] for x in fresh}
    for section in config_text.split('[[rules]]')[1:]:
        name = re.search('^id = "([^"]+)"', section, re.M)
        pattern = re.search("^regex = '''(.*?)'''", section, re.M | re.S)
        if name and pattern and (name[1] in needed):
            patterns[name[1]] = re.compile(pattern[1].replace('\\z', '\\Z'))

    def blob(revision, path):
        return subprocess.check_output(['git', 'cat-file', 'blob', revision + ':' + path], cwd=root)
    cache = {}
    normalized = []
    witnesses = []
    retained = []
    seen = set()
    for finding in fresh:
        path = pathlib.Path(finding['File']).relative_to(prefix).as_posix()
        if not finding['Fingerprint'] not in seen:
            raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
        seen.add(finding['Fingerprint'])
        if path not in cache:
            data = blob(commit, path)
            cache[path] = (data, data.decode().splitlines(keepends=True), SHA(data), subprocess.check_output(['git', 'hash-object', '--stdin'], input=data, cwd=root).decode().strip())
        data, lines, digest, source_blob = cache[path]
        span = ''.join(lines[finding['StartLine'] - 1:finding['EndLine']])
        context = ''.join(lines[max(0, finding['StartLine'] - 2):finding['EndLine'] + 1])
        captures = [m.group(1) if m.lastindex else m[0] for m in patterns[finding['RuleID']].finditer(context)]
        captures = [value for value in captures if value in span]
        hashes = {SHA(value.encode()) for value in captures}
        options = [w for w in prior if w['path'] == path and w['rule'] == finding['RuleID'] and (w['opaque_value_sha256'] in hashes)]
        unique = {(w['opaque_value_sha256'], w['technical_disposition']) for w in options}
        if not len(unique) == 1:
            raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
        value_hash, kind = next(iter(unique))
        values = {value for value in captures if SHA(value.encode()) == value_hash}
        if not len(values) == 1:
            raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
        value = next(iter(values))
        old = options[0]
        if kind == 'PROVEN_SYNTHETIC_REHEARSAL_SEED':
            pattern = "const preferences = await upsertOne\\(userA\\.client, 'notification_preferences', (\\{[\\s\\S]*?\\n\\s*\\})\\);"
            current = re.search(pattern, data.decode())
            historical = re.search(pattern, blob(old['commit'], path).decode())
            if not (current and historical and (current[1] == historical[1]) and (not re.search('[()]', current[1]))):
                raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
            retained.append({'currentFingerprint': finding['Fingerprint'], 'currentSourceSha256': digest, 'currentSourceBlob': source_blob, 'exactLiteralPayloadSha256': SHA(current[1].encode()), 'referenceCommit': old['commit'], 'referenceFinding': old['id'], 'payloadBytesExactlyEqual': True, 'liveCleanupReceiptClaimed': False, 'kind': 'EXACT_RETAINED_SYNTHETIC_PAYLOAD'})
            item = {**finding, 'File': path, 'Commit': old['commit'], 'StartLine': old['start_line'], 'EndLine': old['end_line'], 'Fingerprint': old['id']}
            normalized.append(item)
            witnesses.append(old)
            continue
        if kind == 'RECOMPUTED_SOURCE_FILE_DIGEST':
            line = lines[finding['StartLine'] - 1]
            field = re.match('\\s*["\\\']([^"\\\']+)["\\\']\\s*:', line)
            if not (field and re.fullmatch('[0-9a-f]{64}', value)):
                raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
            references = [w for w in options if w['proof']['referenced_source_path'] == field[1]]
            if not references:
                raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
            reference = references[0]
            if not SHA(blob(reference['commit'], field[1])) == value:
                raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
            retained.append({'currentFingerprint': finding['Fingerprint'], 'currentSourceSha256': digest, 'currentSourceBlob': source_blob, 'field': field[1], 'referenceCommit': reference['commit'], 'referenceFinding': reference['id'], 'referencedSourceSha256Recomputed': True, 'historicalQANotRefreshedOrApproved': True})
            continue
        item = {**finding, 'File': path, 'Commit': commit, 'Fingerprint': f'{commit}:{path}:{finding['RuleID']}:{finding['StartLine']}'}
        w = {**old, 'id': item['Fingerprint'], 'commit': commit, 'path': path, 'start_line': item['StartLine'], 'end_line': item['EndLine'], 'source_blob': source_blob, 'source_sha256': digest}
        normalized.append(item)
        witnesses.append(w)
    result = verify_history(root, normalized, witnesses, config_text, rule_hashes)
    if not result['records'] + sum((x.get('kind') != 'EXACT_RETAINED_SYNTHETIC_PAYLOAD' for x in retained)) == len(fresh):
        raise ValueError('CURRENT_SOURCE_PROOF_FAILED')
    return ({'records': len(fresh), 'typedSourceProof': result, 'retainedReferencedSourceDigests': sum((x.get('kind') != 'EXACT_RETAINED_SYNTHETIC_PAYLOAD' for x in retained)), 'exactRetainedSyntheticPayloads': sum((x.get('kind') == 'EXACT_RETAINED_SYNTHETIC_PAYLOAD' for x in retained)), 'allCurrentGitSourceObjectsRehashed': True, 'unverified': 0, 'historicalQARefreshed': False, 'independentAcceptance': False}, retained, witnesses)
