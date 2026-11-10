"""C10: ONE hard-pinned historical diagnostic replay; never an ordinary producer."""
from pathlib import Path
from contextlib import contextmanager
import argparse,hashlib,importlib.util,io,json,os,re,stat,subprocess,sys,threading,time,uuid,zipfile

AUTH='BRAIN-C47-PINNED-APP70-PRIVACY-REPLAY10'
START='f4fb6fb488d119d536fe189bf872512b27bfc719'
PRODUCER={'head':'9c69cd2149de6d9ca24b5fe11afcd4bde96e3fe6','tree':'26fb8ba3ac12a26bd2328e9cb7401ebd1b5e5aa7',
 'run_id':42829248702,'job_id':129874632437,'run_attempt':1,'artifact_id':13777292240,
 'artifact_name':'campaign47-native-build-9c69cd2149de6d9ca24b5fe11afcd4bde96e3fe6-42829248702-1'}
RAW={'bytes':82274463,'sha256':'041cacb6d9e3ee988ae79673c6e27f1ad6ec9fb580807beb91954e17814280fa'}
APP={'bytes':44075035,'sha256':'fd234db21e05a9b5115fded12d38b2dd1b8123882a9e6b43fbc64e457d61c2ae'}
MACHO={'bytes':70555760,'sha256':'4e42f50160c01f87f65c8a0c0032aa19c7f773490706ab6c544691a18352b5a3'}
JS={'bytes':9563236,'sha256':'2de722e4bfb22d6c3f06ea5ea194c4ae691015aadf49b26454926d33493a45c1'}
INVENTORY='20005d1355738b7908d4f27c39bde86f1c98acd65e935063a1b98abbdaa976f8'
BUNDLE='com.layerwell.app.staging'
DOMAIN='PINNED_APP70_DIAGNOSTIC_REPLAY10'
JOB='C47 pinned app70 replay72'
RECORDED={
 'storage-origin05/TRANSFORM.json':'eadfa78a1a35e5063d5403b2e754e57375980afd75d049801d4fa42804e7007c',
 'storage-origin05/PRIVACY08_TRANSFORM.json':'732834a0d6cbbaeb811063c6415f4cf7970ec7a10c398059fff423881f58a2d4',
 'storage-origin05/TRANSFORMED_SOURCES.json':'632db03614fa80c8d9026061c355791ded19e2c17a56481f951ea6cde2f3ab3c',
 'current-generated47-source.json':'c317d2eb91b00b5bec322c2e55b56699dc0adf1795dc920ac2770669a65e59b7',
 'current-generated47.json':'b9cab149edeb680949e4b4e72b220e5e62aeac043aa6b8b48350f0a7950f0f49',
 'current-generated47-resolved.json':'29cefea26d6f98a8894b7df6ec5f78ea1c70018148546a9210a6a600f1d5c528',
 'generated-native/native-configuration-inventory.json':'ad5998f38517edfaeb19766651f0b1eb487fab075d74a36c3a7fbf952ab9a1f1'}
APP_MEMBER='storage-origin05/signed-storage-origin05-app.tar.gz'
FORBIDDEN={'resolved-expo-config','prebuild','pods','storage-origin05-build'}

def need(value,code):
    if not value:raise ValueError('C47_REPLAY10_'+code)
def identity(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def module(root,name):
    path=root/'scripts/release/full-app-j01'/name
    spec=importlib.util.spec_from_file_location('c47_replay10_'+path.stem,path)
    value=importlib.util.module_from_spec(spec);sys.modules[spec.name]=value;spec.loader.exec_module(value);return value

def producer_metadata(run,job,artifact):
    need(run['id']==PRODUCER['run_id'] and run['head_sha']==PRODUCER['head'] and type(run['run_attempt'])is int and run['run_attempt']==1 and
        run['status']=='completed' and run['conclusion']=='cancelled','EXACT_CANCELLED_PRODUCER')
    need(job['id']==PRODUCER['job_id'] and job['run_id']==PRODUCER['run_id'] and
        job['head_sha']==PRODUCER['head'] and job['conclusion']=='cancelled','PRODUCER_JOB')
    need(artifact['id']==PRODUCER['artifact_id'] and artifact['name']==PRODUCER['artifact_name'] and
        artifact['workflow_run']['id']==PRODUCER['run_id'] and artifact['workflow_run']['head_sha']==PRODUCER['head'] and
        artifact['size_in_bytes']==RAW['bytes'] and artifact['digest']=='sha256:'+RAW['sha256'] and
        artifact['expired']is False,'PINNED_ARTIFACT')

def raw70(n,path,root):
    need(n.stage_file_digest(path,128*1024**2)==RAW,'RAW_PIN')
    with zipfile.ZipFile(path)as z:
        rows=z.infolist();need(len(rows)==352 and len({q.filename.casefold()for q in rows})==352 and
            sum(q.file_size for q in rows)==82206007 and z.testzip()is None,'RAW_CLOSED_INVENTORY')
        for q in rows:
            need(not q.is_dir() and stat.S_ISREG(q.external_attr>>16) and
                re.fullmatch('[A-Za-z0-9_./+ -]+',q.filename)and not q.filename.startswith('/')and
                all(v not in ('','.','..')for v in q.filename.split('/'))and q.file_size<=128*1024**2,'RAW_MEMBER')
        payload={q.filename:z.read(q)for q in rows}
    need('stage-provenance.json'not in payload,'MISSING_PRODUCER_SEAL_MUST_REMAIN_MISSING')
    e=n.stage_json(payload['execution.json'])
    need(e['source']['head']==PRODUCER['head']and e['source']['tree']==PRODUCER['tree']and
        e['status']=='PARTIAL_BLOCKED'and e['stage_complete']is False and e['ordinary_admitted']is False and
        e['internal_supported_owner']=='NOT_RUN'and
        e['failure']=={'detail':'C47_COMMAND_FAILED:simulator-bootstatus','type':'ValueError'},'PARTIAL_DOMAIN_ONLY')
    streams=[]
    for row in e['commands']:
        for label in ['stdout','stderr']:
            need(identity(payload[row[label]])=={'bytes':row[label+'_bytes'],'sha256':row[label+'_sha256']},'RECORDED_STREAM')
            streams.append({'path':row[label],**identity(payload[row[label]]),'capture_complete':row['capture_complete']})
    boot=next(i for i,q in enumerate(e['commands'])if q['name']=='simulator-bootstatus')
    need(boot==55 and all(q['state']=='PASS'and q['exit_code']==0 and q['capture_complete']is True for q in e['commands'][:boot]),'EARLY_BUILD_DOMAIN')
    need(e['commands'][boot]['timeout_seconds']==600 and e['commands'][boot]['timed_out']is True and
        e['commands'][boot]['capture_complete']is False,'ORIGINAL_BOOT_FAILURE')
    for name,sha in RECORDED.items():need(identity(payload[name])['sha256']==sha,'RECORDED_PROOF_PIN')
    inventory=n.stage_json(payload['storage-origin05/app-inventory.json'])
    need(identity(payload['storage-origin05/app-inventory.json'])['sha256']==INVENTORY and
        inventory['source']==e['source']and inventory['configuration']=='Release'and
        inventory['lane']=='SEPARATE_RELEASE_STORAGE_ORIGIN_DIAGNOSTIC_05','APP_INVENTORY')
    need(identity(payload[APP_MEMBER])==APP,'APP_TAR_PIN')
    artifact=n.stage_json(payload['storage-origin05/app-artifact.json'])
    need(artifact['source_head']==PRODUCER['head']and artifact['source_tree']==PRODUCER['tree']and
        artifact['sha256']==APP['sha256']and artifact['inventory_sha256']==INVENTORY and
        artifact['not_an_ordinary_or_internal_producer']is True,'APP_ARTIFACT')
    n._produced_app_tar_pass(io.BytesIO(payload[APP_MEMBER]),inventory['files'])
    for name,wanted in [('LayerwellStaging',MACHO),('main.jsbundle',JS)]:
        row=next(q for q in inventory['files']if q['path']==name)
        need({k:row[k]for k in ['bytes','sha256']}==wanted,'APP_CONTENT')
    descriptor=n.stage_json(subprocess.check_output(['git','--no-replace-objects','show',
        PRODUCER['head']+':docs/phase-9/ios-generated-input-succession47.v1.json'],cwd=root))
    need(len(descriptor['sourcePins'])==53,'PRODUCER53_COUNT')
    for pin in descriptor['sourcePins']:
        b=subprocess.check_output(['git','--no-replace-objects','show',PRODUCER['head']+':'+pin['path']],cwd=root)
        need(identity(b)=={k:pin[k]for k in ['bytes','sha256']},'PRODUCER53_SOURCE')
    composite=n.stage_json(payload['storage-origin05/PRIVACY08_TRANSFORM.json'])
    need(composite['source_head']==PRODUCER['head']and len(composite['files'])==9,'NINE_TRANSFORMS')
    return payload,inventory,{'domain':DOMAIN,'producer':dict(PRODUCER),'raw':dict(RAW),'app':dict(APP),
        'inventory_sha256':INVENTORY,'members':352,'payload_bytes':82206007,'streams':streams,
        'producer_sealed':False,'ordinary_admitted':False,'internal_admitted':False,
        'pre_sign_archive_role':'ISOLATED_XCTEST_GENERATOR_INPUT_ONLY','release':'NO_GO'}

def binding(r,device=None,pid=None):
    source=r.receipt['source'];ctx=r.receipt['replay_execution10']
    need(source['head']==ctx['runner_head']and source['tree']==ctx['runner_tree']and
        source['head']!=PRODUCER['head']and type(ctx['run_attempt'])is int and ctx['run_attempt']==1 and type(ctx['native_attempt'])is int and ctx['native_attempt']==72 and
        type(ctx['job_id'])is int and ctx['job_id']>0,'RUNNER_EXECUTION_BINDING')
    if device is not None:need(r.receipt['simulator']['udid']==device and str(uuid.UUID(device)).lower()==device.lower(),'OWN_DEVICE')
    if pid is not None:need(type(pid)is int and 0<pid<=2147483647,'PID')
    return {'domain':DOMAIN,'producer':dict(PRODUCER),'runner_source':{'head':source['head'],'tree':source['tree']},
        'execution':{**ctx,'device':device,'app_pid':pid},'app':dict(APP),'diagnostic_transform_sha256':RECORDED['storage-origin05/PRIVACY08_TRANSFORM.json'],'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}

def validate_binding(b):
    need(set(b)=={'domain','producer','runner_source','execution','app','diagnostic_transform_sha256','ordinary_admitted','internal_admitted','release'} and
        b['domain']==DOMAIN and b['producer']==PRODUCER and b['app']==APP and
        b['diagnostic_transform_sha256']==RECORDED['storage-origin05/PRIVACY08_TRANSFORM.json'] and
        b['ordinary_admitted']is False and b['internal_admitted']is False and b['release']=='NO_GO','TRACE_DOMAIN')
    ctx=b['execution'];source=b['runner_source']
    need(source=={'head':ctx['runner_head'],'tree':ctx['runner_tree']} and source['head']!=PRODUCER['head'] and
        all(re.fullmatch('[a-f0-9]{40}',v)for v in source.values()) and ctx['native_attempt']==72 and
        type(ctx['run_attempt'])is int and ctx['run_attempt']==1 and ctx['repository']=='TasfiqJ/onSkin' and ctx['job_name']==JOB and
        type(ctx['run_id'])is int and ctx['run_id']>0 and type(ctx['job_id'])is int and ctx['job_id']>0,
        'TRACE_RUNNER_EXECUTION')
    need(str(uuid.UUID(ctx['device'])).lower()==ctx['device'].lower() and
        type(ctx['app_pid'])is int and 0<ctx['app_pid']<=2147483647,'TRACE_DEVICE_PID')
    return ctx['app_pid']

def trace_binding(d,raw,identity_value,receipt_binding):
    pid=validate_binding(receipt_binding)
    need(type(identity_value.get('schema'))is int and type(identity_value.get('pid'))is int and identity_value=={'schema':1,'pid':pid,'sourceHead':PRODUCER['head'],'bundle':BUNDLE},'APP_SOURCE_PID')
    value=d.validate_privacy08(raw,PRODUCER['head'],pid)
    need(value['dropped']==0 and value['flushFailures']==0 and
        [q['sequence']for q in value['events']]==list(range(1,value['sequence']+1)),'COMPLETE_TRACE')
    return value

def installed10(r,n,installed,app,inventory,device,label):
    import plistlib
    target=r.output/('installed-'+label+'10');target.mkdir()
    rows={name:n.bundle_inventory(Path(path))for name,path in [('source',app),('installed',installed)]}
    proofs={name:n.installed_app_inventory_proof(inventory['files'],values,'LayerwellStaging')for name,values in rows.items()}
    for name,values in rows.items():n.write_json(target/(name+'-inventory.json'),values)
    info=plistlib.loads(n.read_native_file(Path(installed)/'Info.plist'))
    need(info['CFBundleIdentifier']==BUNDLE and info['CFBundleExecutable']=='LayerwellStaging','INSTALLED_BUNDLE')
    product=n.simulator_signing().inspect_product(r,n,Path(installed),BUNDLE,'replay70-'+label+'-signed-product')
    need(product==inventory['product'] and n.stage_file_digest(Path(installed)/'LayerwellStaging')==MACHO and
        n.stage_file_digest(Path(installed)/'main.jsbundle')==JS,'INSTALLED_PINNED_BYTES_SIGNATURE')
    proof={'binding':binding(r,device),'full_inventory':proofs,'inventory_sha256':INVENTORY,'product':product}
    n.write_json(target/'VERIFIED.json',proof);r.passed('replay10-installed-'+label,proof)

def prefix(before):
    need(len(before)==19552 and hashlib.sha256(before).hexdigest()=='7687fb14aeb9091ce91b4a9d0d4065b81abbe7c9eaf4418bb9fe2b8e1e7ebacc','FROZEN_UI_SOURCE')
    start=before.index(b'    func testV04ExplicitWithdrawalReviewCancelAndFreshReconsent() throws {')
    first=before.index(b'        requireFreshGoals(app)\n',start)+len(b'        requireFreshGoals(app)\n')
    end=before.index(b'\n    }\n}\n',first)
    return before[:first]+b'        // C10 pinned149 diagnostic prefix; never ordinary qualification.\n'+before[end:]

def observer(r,n,d,device,installed,inventory,stop,observations):
    target=r.output/'replay-capture10';target.mkdir()
    while not stop.wait(1)and time.monotonic()<r.deadline:
        try:
            data=r._storage05_first_data_container
            raw_id=n.read_native_file(data/'Documents/C47StorageOrigin05Identity.json')
            need(len(raw_id)<=4096,'IDENTITY_SIZE');v=n.stage_json(raw_id);pid=v['pid']
            envelope=binding(r,device,pid)
            trace=n.read_native_file(data/('Documents/C47PrivacyOrigin08-'+str(pid)+'.json'))
            value=trace_binding(d,trace,v,envelope)
            p=subprocess.run(['/bin/ps','-p',str(pid),'-o','comm='],capture_output=True,env=r.env,timeout=3)
            need(p.returncode==0 and len(p.stdout)<=4096 and p.stdout.decode().strip()==str(Path(installed)/'LayerwellStaging'),'LIVE_PID')
            # Only allowlisted diagnostic bytes; never a private-store read or data dump.
            n.write_json(target/'latest-binding.json',envelope);(target/'latest-identity.json').write_bytes(raw_id);(target/'latest-trace.json').write_bytes(trace)
            origin=d.privacy_origin08(value)
            if origin is not None:
                need(d._native05_observed_pid62(r,n,device,BUNDLE,PRODUCER['head'],installed,inventory)==pid,'ORIGIN_PID_BEFORE')
                # Re-read after full executable/PID validation; immutable first candidate survives teardown.
                trace=n.read_native_file(data/('Documents/C47PrivacyOrigin08-'+str(pid)+'.json'))
                value=trace_binding(d,trace,v,envelope);origin=d.privacy_origin08(value);need(origin is not None,'ORIGIN_RETIRED')
                need(d._native05_observed_pid62(r,n,device,BUNDLE,PRODUCER['head'],installed,inventory)==pid,'ORIGIN_PID_AFTER')
                (target/'origin-trace.json').open('xb').write(trace);(target/'origin-identity.json').open('xb').write(raw_id)
                n.write_json(target/'ORIGIN_CANDIDATE.json',{'binding':envelope,'trace':identity(trace),'origin':origin,
                    'live_executable_PID_before_after_verified':True,'first_source_causality_review_required':True,'ordinary_admitted':False})
                observations.append({'state':'SOURCE_PID_BOUND_ORIGIN_CANDIDATE','pid':pid});return
        except Exception as e:
            if len(observations)<8:observations.append({'state':'OBSERVER_UNAVAILABLE','error_type':type(e).__name__})

def context(r,n,token):
    env=r.env;need(sys.platform=='darwin'and env.get('GITHUB_REPOSITORY')=='TasfiqJ/onSkin'and
        env.get('GITHUB_EVENT_NAME')=='pull_request'and env.get('GITHUB_JOB')=='native-build'and
        env.get('GITHUB_RUN_ATTEMPT')=='1','ONE_HOSTED72')
    head=env.get('C47_EXPECTED_HEAD','');need(re.fullmatch('[a-f0-9]{40}',head),'EXPECTED_RUNNER_HEAD')
    g=lambda *a:subprocess.check_output(['git','--no-replace-objects',*a],cwd=r.root,env=env).decode().strip()
    need(g('rev-parse','HEAD')==head and g('rev-list','--count',n.BASE+'..HEAD')=='155'and g('rev-parse','HEAD~2')==START,'EXACT155_WITH153_PREFIX')
    run_id=int(env['GITHUB_RUN_ID']);jobs,_=n._stage_api('/actions/runs/'+str(run_id)+'/jobs?per_page=100',token)
    selected=[q for q in jobs['jobs']if q['name']==JOB]
    need(len(selected)==1,'EXECUTION_JOB_UNIQUE');job=selected[0]
    need(job['head_sha']==head and job['run_id']==run_id and type(job['run_attempt'])is int and job['run_attempt']==1 and job['status']=='in_progress'and
        type(job['runner_id'])is int and job['runner_id']>0 and job['labels']==['macos-26-intel'],'ACTUAL_STANDARD_JOB')
    ctx={'repository':'TasfiqJ/onSkin','runner_head':head,'runner_tree':g('rev-parse','HEAD^{tree}'),
        'run_id':run_id,'job_id':job['id'],'run_attempt':1,'native_attempt':72,'job_name':JOB,
        'runner_id':job['runner_id'],'configured_labels':job['labels']}
    r.receipt['replay_execution10']=ctx;r.persist();return ctx

def execute(r,n,d,payload,inventory):
    device=None;observations=[];result=None
    head,tools,source=n.prepare(r)
    for name,script,bound in [('privacy08-source-observer-tests','storage_trace47.test.py',120),
        ('privacy08-current-runtime-controls','native_runtime47.test.py',300),
        ('privacy08-simulator-signing-controls','simulator_signing47.test.py',120)]:
        r.run(name,['python3','-I','-B','scripts/release/full-app-j01/'+script],timeout=bound)
    r.passed('replay10-current-source-controls',d._native05_full_source_controls53(r,n))
    need(r.deadline-time.monotonic()>=2400,'MEASURED_RUNTIME_HEADROOM')
    temporary=Path(r.env['RUNNER_TEMP']).resolve(strict=True);extracted=temporary/'c47-pinned-app70'
    need(not extracted.exists(),'NEW_APP_EXTRACTION');extracted.mkdir()
    n._produced_app_tar_pass(io.BytesIO(payload[APP_MEMBER]),inventory['files'],extracted)
    app=extracted/'LayerwellStaging.app';need(n.bundle_inventory(app)==inventory['files'],'EXTRACTED_EXACT_INVENTORY')
    product=n.simulator_signing().inspect_product(r,n,app,BUNDLE,'replay70-extracted-signed-product')
    need(product==inventory['product']and n.stage_file_digest(app/'LayerwellStaging')==MACHO and
        n.stage_file_digest(app/'main.jsbundle')==JS,'EXTRACTED_EXACT_SIGNED_PRODUCT')
    # Ruby uses only existence of one .xcodeproj in this directory. Its actual bytes
    # are the genuine pre-sign archive; no application target is added or built.
    project_input=temporary/'c47-app70-presign-ui-input';need(not project_input.exists(),'NEW_PRESIGN_INPUT');project_input.mkdir()
    cfg=payload['generated-native/native-configuration.tar.gz']
    import tarfile
    with tarfile.open(fileobj=io.BytesIO(cfg),mode='r:gz')as tar:
        members=tar.getmembers()
        for q in members:
            need(not q.name.startswith('/')and all(p not in ('','.','..')for p in q.name.split('/'))and
                not q.issym()and not q.islnk()and (q.isfile()or q.isdir()),'PRESIGN_ARCHIVE_SHAPE')
        # Only create the source project directory that the immutable Ruby reads;
        # no Pods/workspace/prebuild/application compile is invoked.
        projects={q.name.split('/')[0]for q in members if q.name.split('/')[0].endswith('.xcodeproj')}
        need(projects=={'LayerwellStaging.xcodeproj'},'PRESIGN_PROJECT_INPUT')
        (project_input/'LayerwellStaging.xcodeproj').mkdir()
        project_bytes=tar.extractfile(next(q for q in members if q.name=='LayerwellStaging.xcodeproj/project.pbxproj')).read()
        need(project_bytes==payload['simulator-signing/project.before.pbxproj'],'GENUINE_PRE_SIGN_PROJECT')
        (project_input/'LayerwellStaging.xcodeproj/project.pbxproj').write_bytes(project_bytes)
    n.write_json(r.output/'PRESIGN_RUNNER_INPUT.json',{'archive':identity(cfg),'project':identity(project_bytes),
        'role':'AUTHENTIC_PRE_SIGN_DIRECTORY_FOR_ISOLATED_UI_GENERATOR_ONLY','application_build':False,'producer':PRODUCER})
    products=temporary/'c47-replay72-products';need(not products.exists(),'NEW_TEST_PRODUCTS');products.mkdir();r.receipt['products_directory']=str(products);r.persist()
    try:
        device=n.prepare_simulator(r,'normal');installed=n.install_simulator_app(r,device,app,BUNDLE)
        installed10(r,n,installed,app,inventory,device,'before')
        n.write_json(r.output/'INSTALLED_REPLAY_BINDING.json',binding(r,device))
        n.platform_bootstrap36(r,device);first_pid=n.launch_and_verify(r,device,BUNDLE)
        data=Path(r.text('replay-data-container',['xcrun','simctl','get_app_container',device,BUNDLE,'data'],timeout=300)).resolve(strict=True)
        expected=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'
        need(data.parent==expected and str(uuid.UUID(data.name)).lower()==data.name.lower(),'OWN_DATA_CONTAINER');r._storage05_first_data_container=data
        need(d._native05_observed_pid62(r,n,device,BUNDLE,PRODUCER['head'],installed,inventory)==first_pid,'FIRST_APP_PID')
        n.write_json(r.output/'FIRST_LAUNCH_BINDING.json',binding(r,device,first_pid))
        ui=r.output/'ui';ui.mkdir();env={**r.env,'C47_BUNDLE_ID':BUNDLE,'C47_RUNTIME_LANE':'normal-staging','C47_UI_PHASE':'normal-staging','C47_SOURCE_HEAD':head}
        r.run('generate-native-ui-runner',['ruby',r.root/'scripts/release/full-app-j01/native_ui47.rb',project_input,ui],env=env,timeout=120)
        runner=n.normal_runner04(r);path=ui/'runner/native_ui47.swift';before=n.read_native_file(path);after=prefix(before);path.write_bytes(after)
        n.write_json(r.output/'DIAGNOSTIC_PREFIX10.json',{'binding':binding(r,device),'runner':runner,'before':identity(before),'compiled_prefix':identity(after),
            'same_frozen_case03_initial_sequence':True,'ends_after':'first requireFreshGoals','ordinary_admitted':False,'not_full_case03':True})
        (r.output/'DIAGNOSTIC_PREFIX10.swift').write_bytes(after)
        stop=threading.Event();thread=threading.Thread(target=observer,args=(r,n,d,device,installed,inventory,stop,observations),daemon=True);thread.start()
        try:result=n.normal_case_execution04(r,Path(runner['project']),products,n.NORMAL_UI_CASES04[2],device,env)
        finally:
            stop.set();thread.join(timeout=5);need(not thread.is_alive(),'OBSERVER_JOINED')
            need(path.read_bytes()==after,'FROZEN_PREFIX_UNCHANGED');path.write_bytes(before)
            n.write_json(r.output/'OBSERVER10.json',{'binding':binding(r,device),'observations':observations,'thread_joined':True,'ordinary_admitted':False})
            need(n.bundle_inventory(app)==inventory['files'],'EXTRACTED_APP_NOT_ALTERED')
            installed10(r,n,installed,app,inventory,device,'after')
        candidate=r.output/'replay-capture10/ORIGIN_CANDIDATE.json'
        return {'binding':binding(r,device),'diagnostic_prefix':result,'origin_candidate':n.stage_json(n.read_native_file(candidate))if candidate.exists()else None,
            'classification':'SOURCE_PID_BOUND_ORIGIN_CANDIDATE'if candidate.exists()else'DIAGNOSTIC_NOT_REPRODUCED'if result['outcome']=='PASS'else'NO_ORIGIN_CAPTURED',
            'ordinary_admitted':False,'internal_admitted':False}
    finally:
        # The helper persists its uniquely owned UUID before boot can raise.
        device=device or r.receipt.get('simulator',{}).get('udid')
        if device:need(str(uuid.UUID(device)).lower()==device.lower(),'CLEANUP_OWNED_UUID')
        if device:n._simulator_optional(r,'replay-final-screenshot',['xcrun','simctl','io',device,'screenshot',r.output/'final-simulator.png'],timeout=30,diagnostic=True)
        if device:n._simulator_optional(r,'replay-owned-shutdown',['xcrun','simctl','shutdown',device],timeout=30,diagnostic=True)
        n.retain_result_bundles(r)

def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    token=os.environ.pop('C47_ARTIFACT_READ_TOKEN','');need(bool(token),'EPHEMERAL_READ_TOKEN')
    root=Path(__file__).resolve().parents[3];n=module(root,'native_runtime47.py');d=module(root,'storage_trace47.py')
    output=args.output.absolute();need(not output.exists()and not output.resolve().is_relative_to(root),'NEW_OUTSIDE_EVIDENCE')
    output.mkdir(parents=True)
    import signal
    def coordinator_timeout(*_):raise ValueError('C47_REPLAY10_COORDINATOR_MAX84')
    signal.signal(signal.SIGALRM,coordinator_timeout);signal.alarm(84*60)
    r=n.Runner(root,output,seconds=78*60);coordinator_deadline=r.deadline+6*60
    r.receipt.update(stage='diagnostic-replay10',lane=DOMAIN,diagnostic_only=True,ordinary_admitted=False,producer_sealed=False,
        application_build_performed=False,internal_supported_owner='NOT_RUN',authorization=AUTH);r.persist();code=1
    try:
        ctx=context(r,n,token)
        run,_=n._stage_api('/actions/runs/'+str(PRODUCER['run_id']),token)
        job,_=n._stage_api('/actions/jobs/'+str(PRODUCER['job_id']),token)
        artifact,_=n._stage_api('/actions/artifacts/'+str(PRODUCER['artifact_id']),token)
        producer_metadata(run,job,artifact)
        raw_path=Path(r.env['RUNNER_TEMP'])/'c47-pinned-raw70.zip';need(not raw_path.exists(),'NEW_RAW_INPUT')
        n._stage_download({'artifact_id':PRODUCER['artifact_id'],'digest':RAW['sha256']},
            {'wire_bytes':RAW['bytes'],'service_digest':'sha256:'+RAW['sha256']},token,raw_path);token=None
        payload,inventory,proof=raw70(n,raw_path,root);r.receipt['upstream_payload_bytes']=proof['payload_bytes']
        n.write_json(output/'PINNED_PRODUCER149_INPUT.json',proof)
        result=execute(r,n,d,payload,inventory);n.write_json(output/'REPLAY72_RESULT.json',result)
        code=0 if result['origin_candidate']is not None else 1
        r.receipt.update(status=result['classification'],replay_result=result,stage_complete=code==0)
    except Exception as e:
        detail=str(e);safe=detail if re.fullmatch(r'C47_[A-Z0-9_:-]+',detail)else None
        r.receipt.update(status='PARTIAL_BLOCKED',stage_complete=False,failure={'type':type(e).__name__,'allowlisted_code':safe})
    finally:
        # Six minutes are reserved inside the unchanged84-minute coordinator cap.
        r.deadline=coordinator_deadline
        if r.receipt.get('source'):
            try:r.source_proof('source-after-replay10',r.receipt['source']['head'])
            except Exception as e:code=1;r.receipt['source_final_error_type']=type(e).__name__
        need(not any(q['name']in FORBIDDEN for q in r.receipt['commands']),'NO_APPLICATION_BUILD_STAGES')
        policy={'maximum_bytes':n.MAX_EVIDENCE,'observed_bytes':n.evidence_total(r),'upload_within_limit':n.evidence_total(r)<n.MAX_EVIDENCE-9*1024**2}
        r.receipt.update(artifact_policy=policy,finished_utc=n.utc());r.persist()
        files=[{'path':p.relative_to(output).as_posix(),**n.stage_file_digest(p)}for p in sorted(output.rglob('*'))if p.is_file()]
        n.write_json(output/'replay-provenance10.json',{'schema':1,'domain':DOMAIN,'producer':PRODUCER,
            'runner_source':r.receipt.get('source'),'execution':r.receipt.get('replay_execution10'),'files':files,
            'ordinary_admitted':False,'internal_admitted':False,'producer70_sealed':False,'release':'NO_GO'})
        if not policy['upload_within_limit']:code=1
    print(json.dumps({'status':r.receipt['status'],'domain':DOMAIN,'native_attempt':72,'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}))
    return code
if __name__=='__main__':raise SystemExit(main())
