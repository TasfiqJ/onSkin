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

def installed10(r,n,installed,app,inventory,device,label,*,same_process11=False):
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
    proof={'binding':(binding11 if same_process11 else binding)(r,device),'full_inventory':proofs,'inventory_sha256':INVENTORY,'product':product}
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

AUTH11='BRAIN-C47-SAME-PROCESS-PRIVACY-ORIGIN11'
DOMAIN11='PINNED_APP70_SAME_PROCESS_DIAGNOSTIC11'
START11='a50628e009c69ee00bf532e1335fde6ed9d3f51e'
JOB11='C47 same-process app70 replay73'
SEAL_COUNT11=159
AUTH12='BRAIN-C47-HOST-FIRST-BOUNDED-RECOVERY12'
DOMAIN12='PINNED_APP70_HOST_FIRST_DIAGNOSTIC12'
START12='6b1e1b3adfd048e6a5e90a654721cf950fbafdf7'
SLOT12=74
SEAL_COUNT12=163
JOB12='C47 host-first app70 replay'+str(SLOT12)
AUTH13='BRAIN-C47-OBSERVER-LIFECYCLE-CAUSAL-REPLAY13'
DOMAIN13='PINNED_APP70_PREPARED_OBSERVER_DIAGNOSTIC13'
START13='6f6f9733a0551b26809057bae1d510c96349c371'
SEAL_COUNT13=167
JOB13='C47 prepared observer app70 replay75'
PHASES11=('PRE_ACTIVATE','POST_ACTIVATE','WELCOME_CHECK','WELCOME_READY','PRE_CONSENT','POST_CONSENT','GOALS_CHECK','GOALS_READY')
RUNNER_BUNDLE11='internal.c47.native-ui.xctrunner'

def need11(value,code):
    if not value:raise ValueError('C47_REPLAY11_'+code)

def execution_domain12(ctx):
    need11(type(ctx['native_attempt'])is int,'NATIVE_ATTEMPT_TYPE')
    if ctx['native_attempt']==75 and ctx['job_name']==JOB13 and ctx.get('authorization')==AUTH13:return DOMAIN13
    if ctx['native_attempt']==73 and ctx['job_name']==JOB11:return DOMAIN11
    need11(type(ctx['native_attempt'])is int and ctx['native_attempt']in (74,75) and
        ctx['job_name']=='C47 host-first app70 replay'+str(ctx['native_attempt'])and
        ctx.get('authorization')==AUTH12,'HOST_FIRST_EXECUTION')
    return DOMAIN12

def binding11(r,device=None,pid=None):
    source={k:r.receipt['source'][k]for k in ['head','tree']};ctx=r.receipt['replay_execution11'];warm=r.receipt.get('warm_process11')
    domain=execution_domain12(ctx)
    need11(source=={'head':ctx['runner_head'],'tree':ctx['runner_tree']}and type(ctx['run_attempt'])is int and ctx['run_attempt']==1 and source['head']!=PRODUCER['head'],'RUNNER_SOURCE')
    if device is not None:need11(r.receipt['simulator']['udid']==device and str(uuid.UUID(device)).lower()==device.lower(),'OWN_DEVICE')
    if pid is not None:need11(warm is not None and type(pid)is int and pid==warm['pid'],'FROZEN_WARM_PID')
    value={'domain':domain,'producer':dict(PRODUCER),'runner_source':dict(source),'execution':{**ctx,'device':device,
        'app_pid':warm['pid']if warm else None},'warm_process':warm,'app':dict(APP),'diagnostic_transform_sha256':RECORDED['storage-origin05/PRIVACY08_TRANSFORM.json'],
        'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}
    value['binding_id']=hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest();return value

def validate_binding11(value):
    need11(set(value)=={'domain','producer','runner_source','execution','warm_process','app','diagnostic_transform_sha256','ordinary_admitted','internal_admitted','release','binding_id'},'BINDING_SCHEMA')
    unsigned={k:v for k,v in value.items()if k!='binding_id'}
    need11(value['binding_id']==hashlib.sha256(json.dumps(unsigned,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'BINDING_DIGEST')
    need11(value['domain']==execution_domain12(value['execution'])and value['producer']==PRODUCER and value['app']==APP and
        value['diagnostic_transform_sha256']==RECORDED['storage-origin05/PRIVACY08_TRANSFORM.json']and value['ordinary_admitted']is False and
        value['internal_admitted']is False and value['release']=='NO_GO','BINDING_DOMAIN')
    ctx=value['execution'];source=value['runner_source'];warm=value['warm_process']
    need11(source=={'head':ctx['runner_head'],'tree':ctx['runner_tree']}and source['head']!=PRODUCER['head']and
        all(re.fullmatch('[a-f0-9]{40}',q)for q in source.values())and ctx['repository']=='TasfiqJ/onSkin'and
        type(ctx['run_attempt'])is int and ctx['run_attempt']==1 and
        all(type(ctx[k])is int and ctx[k]>0 for k in ['run_id','job_id','runner_id'])and ctx['configured_labels']==['macos-26-intel'],'EXECUTION')
    need11(str(uuid.UUID(ctx['device'])).lower()==ctx['device'].lower()and type(ctx['app_pid'])is int and 0<ctx['app_pid']<=2147483647 and
        type(warm)is dict and set(warm)=={'pid','executable','process_start_sha256'}and type(warm['pid'])is int and warm['pid']==ctx['app_pid']and
        warm['executable'].endswith('/LayerwellStaging.app/LayerwellStaging')and re.fullmatch('[a-f0-9]{64}',warm['process_start_sha256']),'WARM_PROCESS')
    return ctx['app_pid']

def process_record11(native,ps_bytes,pid,executable,warm=None):
    need11(type(pid)is int and 0<pid<=2147483647 and native=={'schema':1,'pid':pid,'sourceHead':PRODUCER['head'],'bundle':BUNDLE}and
        type(native.get('schema'))is int and type(native.get('pid'))is int,'PROCESS_SOURCE_PID')
    need11(type(ps_bytes)is bytes and 0<len(ps_bytes)<=4096,'PROCESS_ABSENT')
    text=ps_bytes.decode('utf8').strip();prefix=str(pid)+' ';need11(text.startswith(prefix)and text.endswith(' '+executable),'PROCESS_EXECUTABLE')
    start=' '.join(text[len(prefix):-len(executable)].split())
    need11(re.fullmatch(r'[A-Za-z]{3} [A-Za-z]{3} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}',start),'PROCESS_START')
    observed={'pid':pid,'executable':executable,'process_start_sha256':hashlib.sha256(start.encode()).hexdigest()}
    need11(warm is None or observed==warm,'PROCESS_REPLACED');return observed

def process11(r,n,installed,pid,warm=None):
    raw=n.read_native_file(r._storage05_first_data_container/'Documents/C47StorageOrigin05Identity.json');need11(len(raw)<=4096,'IDENTITY_SIZE')
    native=n.stage_json(raw);p=subprocess.run(['/bin/ps','-p',str(pid),'-o','pid=,lstart=,comm='],capture_output=True,env={**r.env,'LC_ALL':'C'},timeout=3)
    need11(p.returncode==0,'PROCESS_ABSENT');return process_record11(native,p.stdout,pid,str(Path(installed)/'LayerwellStaging'),warm)

def trace_binding11(d,raw,native,envelope):
    pid=validate_binding11(envelope)
    need11(type(native.get('schema'))is int and type(native.get('pid'))is int and native=={'schema':1,'pid':pid,'sourceHead':PRODUCER['head'],'bundle':BUNDLE},'TRACE_APP_SOURCE_PID')
    value=d.validate_privacy08(raw,PRODUCER['head'],pid)
    need11(value['dropped']==0 and value['flushFailures']==0 and[q['sequence']for q in value['events']]==list(range(1,value['sequence']+1)),'COMPLETE_TRACE')
    return value

def request11(value,envelope,checkpoints):
    pid=validate_binding11(envelope);seq=len(checkpoints)+1
    need11(type(value)is dict and set(value)=={'schema','binding','sequence','phase','pid','state'}and type(value['schema'])is int and value['schema']==1 and
        value['binding']==envelope['binding_id']and type(value['sequence'])is int and value['sequence']==seq and seq<=len(PHASES11)and
        value['phase']==PHASES11[seq-1]and type(value['pid'])is int and value['pid']==pid and type(value['state'])is int and
        value['state']in({2,3,4}if seq==1 else{4}),'REQUEST_BINDING_OR_ORDER')
    return {'schema':1,'binding':envelope['binding_id'],'sequence':seq,'phase':value['phase'],'pid':pid,'valid':True,'code':'CURRENT_SAME_PROCESS'}

def timeout_operation12(error):
    """Static source-operation only; never retain private command arguments."""
    cmd=error.cmd
    if type(cmd)not in(list,tuple)or len(cmd)>6 or not all(type(q)is str and len(q)<=512 for q in cmd):return 'UNKNOWN_OPERATION'
    if len(cmd)==5 and list(cmd[:2])==['/bin/ps','-p']and cmd[2].isdigit()and cmd[3]=='-o':
        if cmd[4]=='pid=,lstart=,comm=':return 'WARM_PROCESS_PS'
        if cmd[4]=='comm=':return 'BOUNDARY_EXECUTABLE_PS'
    if len(cmd)==6 and list(cmd[:3])==['xcrun','simctl','get_app_container']and list(cmd[4:])==[RUNNER_BUNDLE11,'data']:
        try:
            if str(uuid.UUID(cmd[3])).lower()==cmd[3].lower():return 'RUNNER_DATA_CONTAINER'
        except ValueError:pass
    return 'UNKNOWN_OPERATION'

def invalidate11(state,error):
    code=str(error);safe=code if re.fullmatch('C47_REPLAY11_[A-Z0-9_]+',code)else'C47_REPLAY11_OBSERVER_UNAVAILABLE'
    if state['invalid']is None:
        state['invalid']={'code':safe,'error_type':type(error).__name__}
        if isinstance(error,subprocess.TimeoutExpired):
            try:operation=timeout_operation12(error)
            except Exception:operation='UNKNOWN_OPERATION'
            state['invalid'].update(timeout_operation=operation,timeout_seconds=3 if error.timeout==3 else None)

def explicit_tap11(raw):
    text=raw.decode('utf8')
    begins=list(re.finditer(r'^\s*t =\s*[0-9.]+s\s+Tap "Begin" Button\s*$',text,re.M))
    grants=list(re.finditer(r'^\s*t =\s*[0-9.]+s\s+Tap "I agree\. Continue" Button\s*$',text,re.M))
    return len(begins)==len(grants)==1 and begins[0].start()<grants[0].start()

def origin_eligible11(state,candidate):
    return(bool(candidate)and state['invalid']is None and state.get('explicit_consent_native_tap')is True and
        len(state['checkpoints'])>=7 and [q['phase']for q in state['checkpoints']]==list(PHASES11[:len(state['checkpoints'])]))

def observer11(r,n,d,device,installed,inventory,stop,observations,state):
    target=r.output/'replay-capture11';target.mkdir();envelope=binding11(r,device);pid=validate_binding11(envelope);warm=envelope['warm_process'];ipc=None;last_request=None
    while not stop.wait(1)and time.monotonic()<r.deadline:
        try:
            process11(r,n,installed,pid,warm);state['process_checks']+=1
            if ipc is None:
                query=subprocess.run(['xcrun','simctl','get_app_container',device,RUNNER_BUNDLE11,'data'],capture_output=True,env=r.env,timeout=3)
                if query.returncode==0:
                    need11(0<len(query.stdout)<=4096,'RUNNER_CONTAINER_SIZE');data=Path(query.stdout.decode().strip())
                    expected=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'
                    need11(data.is_absolute()and data==data.resolve(strict=True)and data.parent==expected and
                        str(uuid.UUID(data.name)).lower()==data.name.lower()and not data.is_symlink(),'OWN_RUNNER_DATA')
                    ipc=data/'Documents/C47Replay11'/envelope['binding_id']
                else:state['runner_data_unavailable']+=1
            if ipc is not None and(ipc/'request.json').exists():
                need11(ipc==ipc.resolve(strict=True)and not ipc.is_symlink(),'OWN_IPC_DIRECTORY')
                raw=n.read_native_file(ipc/'request.json');need11(len(raw)<=4096,'REQUEST_SIZE');request=n.stage_json(raw)
                if last_request is None or raw!=last_request:
                    reply=request11(request,envelope,state['checkpoints'])
                    need11(d._native05_observed_pid62(r,n,device,BUNDLE,PRODUCER['head'],installed,inventory)==pid,'BOUNDARY_PID')
                    process11(r,n,installed,pid,warm)
                    checkpoint={**reply,'UTC':n.utc(),'monotonic':time.monotonic(),'request':identity(raw),'source_executable_PID_start_before_after':True}
                    n.write_json(target/('checkpoint-'+str(reply['sequence'])+'.json'),checkpoint);state['checkpoints'].append(checkpoint);last_request=raw
                    ack=ipc/('ack-'+str(reply['sequence'])+'.json');temporary=ipc/('ack-'+str(reply['sequence'])+'.tmp')
                    need11(not ack.exists()and not temporary.exists(),'ACK_ALREADY_EXISTS')
                    with temporary.open('xb')as output:output.write((json.dumps(reply)+'\n').encode());output.flush();os.fsync(output.fileno())
                    temporary.rename(ack)
        except Exception as error:
            # An identity/process/protocol failure cannot become a replacement process.
            invalidate11(state,error)
            if len(observations)<8:observations.append({'state':'SAME_PROCESS_INVALIDATED','code':state['invalid']['code'],'error_type':type(error).__name__})
            return
        try:
            raw_id=n.read_native_file(r._storage05_first_data_container/'Documents/C47StorageOrigin05Identity.json');native=n.stage_json(raw_id)
            trace=n.read_native_file(r._storage05_first_data_container/('Documents/C47PrivacyOrigin08-'+str(pid)+'.json'))
            header=n.stage_json(trace)
            need11(header.get('sourceHead')==PRODUCER['head']and type(header.get('pid'))is int and header['pid']==pid and header.get('bundle')==BUNDLE,'TRACE_SOURCE_PID_MISMATCH')
            value=trace_binding11(d,trace,native,envelope)
            n.write_json(target/'latest-binding.json',envelope);(target/'latest-identity.json').write_bytes(raw_id);(target/'latest-trace.json').write_bytes(trace)
            candidate=target/'ORIGIN_CANDIDATE.json'
            if len(state['checkpoints'])>=6 and not candidate.exists():
                origin=d.privacy_origin08(value)
                if origin is not None:
                    process11(r,n,installed,pid,warm)
                    trace=n.read_native_file(r._storage05_first_data_container/('Documents/C47PrivacyOrigin08-'+str(pid)+'.json'))
                    value=trace_binding11(d,trace,native,envelope);origin=d.privacy_origin08(value);need11(origin is not None,'ORIGIN_RETIRED')
                    process11(r,n,installed,pid,warm)
                    with(target/'origin-trace.json').open('xb')as stream:stream.write(trace)
                    with(target/'origin-identity.json').open('xb')as stream:stream.write(raw_id)
                    n.write_json(candidate,{'binding':envelope,'trace':identity(trace),'origin':origin,'checkpoint_sequence':len(state['checkpoints']),
                        'same_frozen_PID_before_after':True,'first_source_causality_review_required':True,'ordinary_admitted':False})
        except Exception as error:
            code=str(error)
            if code in('C47_REPLAY11_TRACE_SOURCE_PID_MISMATCH','C47_REPLAY11_COMPLETE_TRACE'):
                invalidate11(state,error);return
            # The JS diagnostic may not have flushed while the original process warms.
            # This is no app admission or origin; final trace validation is mandatory.
            if len(observations)<8:observations.append({'state':'TRACE_UNAVAILABLE','error_type':type(error).__name__})

ATTACH_SWIFT11=r'''
    // C11 diagnostic-only; the ordinary source and launch helper remain frozen.
    private let c11ExpectedPID = @PID@
    private let c11BindingID = "@BINDING@"
    private var c11Sequence = 0
    private let c11Phases = ["PRE_ACTIVATE", "POST_ACTIVATE", "WELCOME_CHECK", "WELCOME_READY", "PRE_CONSENT", "POST_CONSENT", "GOALS_CHECK", "GOALS_READY"]

    private func sameProcess11(_ phase: String, _ app: XCUIApplication) -> Bool {
        let running = app.state == .runningForeground || app.state == .runningBackground || app.state == .runningBackgroundSuspended
        guard running else { capture("c11-process-absent", app); XCTFail("C47_WARM11_PROCESS_NOT_RUNNING"); return false }
        // Before activation the host validates the frozen live executable/source/PID.
        // After activation, also bind the actual XCUI application hierarchy to it.
        if phase != "PRE_ACTIVATE" {
            let description = app.debugDescription
            let expression = try! NSRegularExpression(pattern: "(?m)^(?:Attributes: | →)?Application, 0x[0-9a-fA-F]+, pid: ([0-9]+),")
            let range = NSRange(description.startIndex..<description.endIndex, in: description)
            let pids = Set(expression.matches(in: description, range: range).compactMap { match -> Int? in
                guard let value = Range(match.range(at: 1), in: description) else { return nil }
                return Int(description[value])
            })
            guard pids == Set([c11ExpectedPID]) else {
                capture("c11-process-mismatch", app); XCTFail("C47_WARM11_PID_MISMATCH"); return false
            }
        }
        guard c11Sequence < c11Phases.count, c11Phases[c11Sequence] == phase,
              phase == "PRE_ACTIVATE" || app.state == .runningForeground else {
            capture("c11-process-or-phase-mismatch", app); XCTFail("C47_WARM11_PID_OR_PHASE_MISMATCH"); return false
        }
        c11Sequence += 1
        guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            XCTFail("C47_WARM11_RUNNER_DOCUMENTS"); return false
        }
        let directory = documents.appendingPathComponent("C47Replay11").appendingPathComponent(c11BindingID)
        let request: [String: Any] = ["schema": 1, "binding": c11BindingID, "sequence": c11Sequence,
            "phase": phase, "pid": c11ExpectedPID, "state": Int(app.state.rawValue)]
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try JSONSerialization.data(withJSONObject: request).write(to: directory.appendingPathComponent("request.json"), options: .atomic)
        } catch { capture("c11-request-unavailable", app); XCTFail("C47_WARM11_REQUEST_UNAVAILABLE"); return false }
        let ack = directory.appendingPathComponent("ack-\(c11Sequence).json")
        let acknowledged = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in FileManager.default.fileExists(atPath: ack.path) }, object: nil)
        // Event-driven diagnostic binding, not a readiness sleep or a longer UI wait.
        let received = XCTWaiter.wait(for: [acknowledged], timeout: 5) == .completed
        guard received,
              let attributes = try? FileManager.default.attributesOfItem(atPath: ack.path),
              let kind = attributes[.type] as? FileAttributeType, kind == .typeRegular,
              let size = attributes[.size] as? NSNumber, size.intValue > 0, size.intValue <= 4096,
              let bytes = try? Data(contentsOf: ack), bytes.count <= 4096,
              let reply = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any],
              Set(reply.keys) == Set(["schema", "binding", "sequence", "phase", "pid", "valid", "code"]),
              reply["schema"] as? Int == 1, reply["binding"] as? String == c11BindingID,
              reply["sequence"] as? Int == c11Sequence, reply["phase"] as? String == phase,
              reply["pid"] as? Int == c11ExpectedPID, reply["valid"] as? Bool == true,
              reply["code"] as? String == "CURRENT_SAME_PROCESS" else {
            capture("c11-binding-refused-" + phase, app); XCTFail("C47_WARM11_BINDING_REFUSED"); return false
        }
        return true
    }

    private func attachWarm11(_ app: XCUIApplication) -> Bool {
        guard sameProcess11("PRE_ACTIVATE", app) else { return false }
        app.activate()
        guard sameProcess11("POST_ACTIVATE", app), sameProcess11("WELCOME_CHECK", app) else { return false }
        capture("c11-initial-welcome-boundary", app)
        requireVisible(button("Begin", app), "Declared fresh ordinary staging Welcome")
        requireVisible(button("I already have an account", app), "Existing account entry")
        surviveInForeground(app)
        capture("v04-fresh-welcome", app)
        assertPrivateJourneysClosed(app)
        return sameProcess11("WELCOME_READY", app)
    }

'''

def prefix11(before,envelope):
    pid=validate_binding11(envelope);old=prefix(before)
    need11(identity(old)=={'bytes':15351,'sha256':'d12400bf6beff6b49d979e1215fbedb1c4c6d0d30bea6320b9f908bf6b3f3a54'},'FROZEN_C10_PREFIX')
    marker=b'    func testV04ExplicitWithdrawalReviewCancelAndFreshReconsent() throws {';start=old.index(marker)
    head=old[:start];case=old[start:]
    need11(case.count(b'        launchFreshOrdinary(app)\n')==1 and case.count(b'        tap("I agree. Continue", app)\n')==1,'EXACT_CASE03')
    case=case.replace(b'        launchFreshOrdinary(app)\n',b'        guard attachWarm11(app) else { return }\n')
    case=case.replace(b'        tap("I agree. Continue", app)\n',b'        guard sameProcess11("PRE_CONSENT", app) else { return }\n        capture("c11-before-explicit-consent", app)\n        tap("I agree. Continue", app)\n        guard sameProcess11("POST_CONSENT", app) else { return }\n        capture("c11-after-explicit-consent", app)\n        guard sameProcess11("GOALS_CHECK", app) else { return }\n')
    case=case.replace(b'        requireFreshGoals(app)\n',b'        requireFreshGoals(app)\n        guard sameProcess11("GOALS_READY", app) else { return }\n')
    helper=ATTACH_SWIFT11.replace('@PID@',str(pid)).replace('@BINDING@',envelope['binding_id']).encode()
    after=head+helper+case
    observed=b'        XCTAssertTrue(element.waitForExistence(timeout: deadline), description)'
    need11(after.count(observed)==1,'VISIBLE_ASSERTION')
    after=after.replace(observed,b'        let c11Exists = element.waitForExistence(timeout: deadline)\n        if !c11Exists, let app = application { capture("c11-at-visible-refusal", app) }\n        XCTAssertTrue(c11Exists, description)')
    goals=b'        XCTAssertTrue(text("What brings you here?", app).waitForExistence(timeout: deadline))'
    need11(after.count(goals)==1,'GOALS_ASSERTION')
    after=after.replace(goals,b'        let c11Goals = text("What brings you here?", app).waitForExistence(timeout: deadline)\n        capture("c11-initial-goals-decision", app)\n        XCTAssertTrue(c11Goals)')
    after=after.replace(b'C10 pinned149 diagnostic prefix',b'C11 same-process pinned149 diagnostic prefix')
    validate_prefix11(after,envelope);return after

def validate_prefix11(after,envelope):
    pid=validate_binding11(envelope)
    start=after.index(b'    func testV04ExplicitWithdrawalReviewCancelAndFreshReconsent() throws {');case=after[start:]
    need11(b'launchFreshOrdinary(app)'not in case and b'app.launch('not in case and b'guard attachWarm11(app)'in case,'DIAGNOSTIC_PREFIX_RESTART')
    need11(after.count(b'app.activate()')==1 and('private let c11ExpectedPID = '+str(pid)).encode()in after and envelope['binding_id'].encode()in after,'PREFIX_FROZEN_BINDING')
    need11(b'private let deadline: TimeInterval = 30'in after and b'continueAfterFailure = false'in after and
        b'executionTimeAllowance = 600'in after and b'timeout: 5'in after and b'Thread.sleep'not in after,'UNCHANGED_UI_BOUNDS')

def context11(r,n,token):
    env=r.env;need11(sys.platform=='darwin'and env.get('GITHUB_REPOSITORY')=='TasfiqJ/onSkin'and env.get('GITHUB_EVENT_NAME')=='pull_request'and
        env.get('GITHUB_JOB')=='native-build'and env.get('GITHUB_RUN_ATTEMPT')=='1','ONE_HOSTED73')
    head=env.get('C47_EXPECTED_HEAD','');need11(re.fullmatch('[a-f0-9]{40}',head),'EXPECTED_RUNNER_HEAD')
    g=lambda *a:subprocess.check_output(['git','--no-replace-objects',*a],cwd=r.root,env=env).decode().strip()
    need11(g('rev-parse','HEAD')==head and g('rev-list','--count',n.BASE+'..HEAD')==str(SEAL_COUNT11)and g('rev-parse','HEAD~2')==START11,'EXACT159_WITH157_PREFIX')
    run_id=int(env['GITHUB_RUN_ID']);jobs,_=n._stage_api('/actions/runs/'+str(run_id)+'/jobs?per_page=100',token);selected=[q for q in jobs['jobs']if q['name']==JOB11];need11(len(selected)==1,'EXECUTION_JOB_UNIQUE');job=selected[0]
    need11(job['head_sha']==head and job['run_id']==run_id and type(job['run_attempt'])is int and job['run_attempt']==1 and job['status']=='in_progress'and
        type(job['runner_id'])is int and job['runner_id']>0 and job['labels']==['macos-26-intel'],'ACTUAL_STANDARD_JOB')
    ctx={'repository':'TasfiqJ/onSkin','runner_head':head,'runner_tree':g('rev-parse','HEAD^{tree}'),'run_id':run_id,'job_id':job['id'],
        'run_attempt':1,'native_attempt':73,'job_name':JOB11,'runner_id':job['runner_id'],'configured_labels':job['labels']}
    r.receipt['replay_execution11']=ctx;r.persist();return ctx

def context12(r,n,token):
    env=r.env;need11(sys.platform=='darwin'and env.get('GITHUB_REPOSITORY')=='TasfiqJ/onSkin'and env.get('GITHUB_EVENT_NAME')=='pull_request'and
        env.get('GITHUB_JOB')=='native-build'and env.get('GITHUB_RUN_ATTEMPT')=='1','ONE_HOSTED12')
    head=env.get('C47_EXPECTED_HEAD','');need11(re.fullmatch('[a-f0-9]{40}',head),'EXPECTED_RUNNER_HEAD')
    g=lambda *a:subprocess.check_output(['git','--no-replace-objects',*a],cwd=r.root,env=env,timeout=30).decode().strip()
    need11(g('rev-parse','HEAD')==head and g('rev-list','--count',n.BASE+'..HEAD')==str(SEAL_COUNT12)and
        g('rev-parse','HEAD~'+str(SEAL_COUNT12-161))==START12 and not g('status','--porcelain'),'EXACT_C12_161_PREFIX')
    run_id=int(env['GITHUB_RUN_ID']);jobs,_=n._stage_api('/actions/runs/'+str(run_id)+'/jobs?per_page=100',token)
    selected=[q for q in jobs['jobs']if q['name']==JOB12];need11(len(selected)==1,'EXECUTION_JOB_UNIQUE');job=selected[0]
    need11(job['head_sha']==head and job['run_id']==run_id and type(job['run_attempt'])is int and job['run_attempt']==1 and job['status']=='in_progress'and
        type(job['runner_id'])is int and job['runner_id']>0 and job['labels']==['macos-26-intel'],'ACTUAL_STANDARD_JOB')
    ctx={'repository':'TasfiqJ/onSkin','runner_head':head,'runner_tree':g('rev-parse','HEAD^{tree}'),'run_id':run_id,'job_id':job['id'],
        'run_attempt':1,'native_attempt':SLOT12,'job_name':JOB12,'runner_id':job['runner_id'],'configured_labels':job['labels'],'authorization':AUTH12}
    r.receipt['replay_execution11']=ctx;r.receipt['host_first12']=True;r.persist();return ctx

def context13(r,n,token):
    env=r.env;need11(sys.platform=='darwin'and env.get('GITHUB_REPOSITORY')=='TasfiqJ/onSkin'and env.get('GITHUB_EVENT_NAME')=='pull_request'and
        env.get('GITHUB_JOB')=='native-build'and env.get('GITHUB_RUN_ATTEMPT')=='1','ONE_HOSTED13')
    head=env.get('C47_EXPECTED_HEAD','');need11(re.fullmatch('[a-f0-9]{40}',head),'EXPECTED_RUNNER_HEAD')
    g=lambda *a:subprocess.check_output(['git','--no-replace-objects',*a],cwd=r.root,env=env,timeout=30).decode().strip()
    need11(g('rev-parse','HEAD')==head and g('rev-list','--count',n.BASE+'..HEAD')==str(SEAL_COUNT13)and
        g('rev-parse','HEAD~2')==START13 and not g('status','--porcelain'),'EXACT_C13_165_PREFIX')
    run_id=int(env['GITHUB_RUN_ID']);jobs,_=n._stage_api('/actions/runs/'+str(run_id)+'/jobs?per_page=100',token)
    selected=[q for q in jobs['jobs']if q['name']==JOB13];need11(len(selected)==1,'EXECUTION_JOB_UNIQUE');job=selected[0]
    need11(job['head_sha']==head and job['run_id']==run_id and type(job['run_attempt'])is int and job['run_attempt']==1 and job['status']=='in_progress'and
        type(job['runner_id'])is int and job['runner_id']>0 and job['labels']==['macos-26-intel'],'ACTUAL_STANDARD_JOB')
    ctx={'repository':'TasfiqJ/onSkin','runner_head':head,'runner_tree':g('rev-parse','HEAD^{tree}'),'run_id':run_id,'job_id':job['id'],
        'run_attempt':1,'native_attempt':75,'job_name':JOB13,'runner_id':job['runner_id'],'configured_labels':job['labels'],'authorization':AUTH13}
    r.receipt.update(replay_execution11=ctx,host_first12=True,prepared_observer13=True);r.persist();return ctx

def early_host12(r,n):
    """One real inventory before install/source suites; never a cached readiness pass."""
    need11(r.receipt.get('host_first12')is True,'HOST_FIRST_CONTEXT')
    for key,value in n.ENVIRONMENT.items():need11(r.env.get(key)==value,'HOST_ENVIRONMENT')
    need11(Path(r.env['DEVELOPER_DIR']).is_dir(),'PINNED_XCODE_UNAVAILABLE')
    ctx=r.receipt['replay_execution11'];r.receipt['source']={'head':ctx['runner_head'],'tree':ctx['runner_tree']};r.persist()
    tools={}
    for name,argv in [('os',['sw_vers']),('architecture',['uname','-m']),('xcode',['xcodebuild','-version']),
        ('sdks',['xcodebuild','-showsdks']),('simulator-sdk',['xcrun','--sdk','iphonesimulator','--show-sdk-version'])]:
        tools[name]=r.text('early12-'+name,argv,timeout=60)
    need11(tools['xcode'].startswith('Xcode 26.4'),'XCODE_VERSION');n.require_simulator_host(tools['architecture'])
    tools['runner_image']={key:r.env.get(key)for key in ('ImageOS','ImageVersion','RUNNER_OS','RUNNER_ARCH')}
    n.write_json(r.output/'EARLY_HOST12.json',tools);n.simulator_resources(r,'early12-before-inventory')
    try:
        raw=r.text('early12-simulator-inventory',['xcrun','simctl','list','--json'],timeout=300)
        document=n.stage_json(raw.encode());runtime,template=n.available_iphone(document,tools['simulator-sdk'],tools['architecture'])
        n.write_json(r.output/'EARLY_INVENTORY12.json',{'identity':identity(raw.encode()),'runtime':runtime,'template':template,
            'not_indefinite_readiness':True,'source':r.receipt['source'],'execution':ctx})
        r.receipt['early_inventory12']='PASS';r.persist()
    except Exception:
        r.receipt['early_inventory12']='FAIL';r.persist();n.simulator_install_diagnostics(r,None,phase='startup');raise

def execute(r,n,d,payload,inventory,*,same_process11=False):
    device=None;observations=[];result=None
    bind=binding11 if same_process11 else binding
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
    slot=r.receipt['replay_execution11']['native_attempt']if same_process11 else 72
    products=temporary/('c47-replay'+str(slot)+'-products');need(not products.exists(),'NEW_TEST_PRODUCTS');products.mkdir();r.receipt['products_directory']=str(products);r.persist()
    try:
        device=n.prepare_simulator(r,'normal');installed=n.install_simulator_app(r,device,app,BUNDLE)
        installed10(r,n,installed,app,inventory,device,'before',same_process11=same_process11)
        n.write_json(r.output/'INSTALLED_REPLAY_BINDING.json',bind(r,device))
        n.platform_bootstrap36(r,device);first_pid=n.launch_and_verify(r,device,BUNDLE)
        data=Path(r.text('replay-data-container',['xcrun','simctl','get_app_container',device,BUNDLE,'data'],timeout=300)).resolve(strict=True)
        expected=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'
        need(data.parent==expected and str(uuid.UUID(data.name)).lower()==data.name.lower(),'OWN_DATA_CONTAINER');r._storage05_first_data_container=data
        need(d._native05_observed_pid62(r,n,device,BUNDLE,PRODUCER['head'],installed,inventory)==first_pid,'FIRST_APP_PID')
        if same_process11:
            r.receipt['warm_process11']=process11(r,n,installed,first_pid);r.persist()
        n.write_json(r.output/'FIRST_LAUNCH_BINDING.json',bind(r,device,first_pid))
        ui=r.output/'ui';ui.mkdir();env={**r.env,'C47_BUNDLE_ID':BUNDLE,'C47_RUNTIME_LANE':'normal-staging','C47_UI_PHASE':'normal-staging','C47_SOURCE_HEAD':head}
        r.run('generate-native-ui-runner',['ruby',r.root/'scripts/release/full-app-j01/native_ui47.rb',project_input,ui],env=env,timeout=120)
        runner=n.normal_runner04(r);path=ui/'runner/native_ui47.swift';before=n.read_native_file(path)
        prepared13=r.receipt.get('prepared_observer13')is True
        if prepared13:
            started_ns=time.monotonic_ns();r.receipt['ui_operation13']={'started_ns':started_ns,'deadline_ns':min(started_ns+900_000_000_000,int(r.deadline*1e9))};r.persist()
            after=prefix13(before,bind(r,device,first_pid),r.receipt['ui_operation13']['deadline_ns'])
        else:after=prefix11(before,bind(r,device,first_pid))if same_process11 else prefix(before)
        path.write_bytes(after)
        suffix='11'if same_process11 else'10'
        n.write_json(r.output/('DIAGNOSTIC_PREFIX'+suffix+'.json'),{'binding':bind(r,device),'runner':runner,'before':identity(before),'compiled_prefix':identity(after),
            'same_frozen_case03_initial_sequence':True,'ends_after':'first requireFreshGoals','ordinary_admitted':False,'not_full_case03':True})
        (r.output/('DIAGNOSTIC_PREFIX'+suffix+'.swift')).write_bytes(after)
        state={'invalid':None,'checkpoints':[],'process_checks':0,'runner_data_unavailable':0}
        stop=threading.Event();thread=threading.Thread(target=observer11 if same_process11 else observer,
            args=(r,n,d,device,installed,inventory,stop,observations,*([state]if same_process11 else[])),daemon=True);started=False
        try:
            if prepared13:
                result,state=lifecycle13(r,n,d,Path(runner['project']),products,device,installed,inventory,bind(r,device,first_pid),env,after)
            else:
                thread.start();started=True
                result=n.normal_case_execution04(r,Path(runner['project']),products,n.NORMAL_UI_CASES04[2],device,env)
        finally:
            stop.set()
            if started:thread.join(timeout=5)
            need(not thread.is_alive(),'OBSERVER_JOINED')
            need(path.read_bytes()==after,'FROZEN_PREFIX_UNCHANGED');path.write_bytes(before)
            if same_process11:
                try:
                    process11(r,n,installed,first_pid,r.receipt['warm_process11'])
                    native=n.stage_json(n.read_native_file(data/'Documents/C47StorageOrigin05Identity.json'))
                    trace_binding11(d,n.read_native_file(data/('Documents/C47PrivacyOrigin08-'+str(first_pid)+'.json')),native,bind(r,device,first_pid))
                    commands=[q for q in r.receipt['commands']if q['name']==('native-diagnostic13-ui'if prepared13 else'native-normal-staging-ui')];need11(len(commands)==1 and commands[0]['capture_complete']is True,'UI_COMPLETE_STREAM')
                    ui_log=n.read_native_file(r.output/commands[0]['stdout'])
                    need11(re.search(rb'(?m)^.*error:.*failed - C47_(?:WARM11_|OBSERVER13_)',ui_log)is None,'UI_BINDING_REFUSED')
                    state['explicit_consent_native_tap']=explicit_tap11(ui_log)
                except Exception as error:invalidate11(state,error)
            n.write_json(r.output/('OBSERVER'+suffix+'.json'),{'binding':bind(r,device),'observations':observations,
                'same_process_state':{k:v for k,v in state.items()if not k.startswith('_')}if same_process11 else None,'thread_joined':True,'ordinary_admitted':False})
            need(n.bundle_inventory(app)==inventory['files'],'EXTRACTED_APP_NOT_ALTERED')
            installed10(r,n,installed,app,inventory,device,'after',same_process11=same_process11)
        candidate=r.output/('replay-capture11'if same_process11 else'replay-capture10')/'ORIGIN_CANDIDATE.json'
        eligible=origin_eligible11(state,candidate.exists())if same_process11 else candidate.exists()
        if prepared13:eligible=eligible and result.get('parsed',{}).get('classification')=='GOALS_ASSERTION'and state.get('armed')is True
        return {'binding':bind(r,device),'diagnostic_prefix':result,'origin_candidate':n.stage_json(n.read_native_file(candidate))if eligible else None,
            'classification':'PROCESS_BINDING_INVALIDATED'if same_process11 and state['invalid']is not None else
                'SOURCE_PID_BOUND_ORIGIN_CANDIDATE'if eligible else'DIAGNOSTIC_NOT_REPRODUCED'if result['outcome']=='PASS'else'NO_ORIGIN_CAPTURED',
            'ordinary_admitted':False,'internal_admitted':False}
    finally:
        # The helper persists its uniquely owned UUID before boot can raise.
        device=device or r.receipt.get('simulator',{}).get('udid')
        if device:need(str(uuid.UUID(device)).lower()==device.lower(),'CLEANUP_OWNED_UUID')
        if device:n._simulator_optional(r,'replay-final-screenshot',['xcrun','simctl','io',device,'screenshot',r.output/'final-simulator.png'],timeout=30,diagnostic=True)
        if device:n._simulator_optional(r,'replay-owned-shutdown',['xcrun','simctl','shutdown',device],timeout=30,diagnostic=True)
        n.retain_result_bundles(r)

def remaining13(deadline,maximum=3):
    seconds=(deadline-time.monotonic_ns())/1e9
    need11(seconds>0,'PROTOCOL13_DEADLINE')
    return min(maximum,seconds)

def stat13(value):
    return tuple(getattr(value,k,None)for k in ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_size','st_mtime_ns','st_ctime_ns'))

def directory13(path,pin=None):
    path=Path(path);need11(path.is_absolute()and path==path.resolve(strict=True),'PROTOCOL13_NAMESPACE')
    identities=[]
    for part in [path,*path.parents]:
        value=part.lstat();need11(stat.S_ISDIR(value.st_mode)and not getattr(value,'st_file_attributes',0)&0x400,'PROTOCOL13_DIRECTORY_LINK')
        identities.append((value.st_dev,value.st_ino,value.st_mode,getattr(value,'st_uid',None)))
    value=path.lstat();need11(not hasattr(os,'getuid')or value.st_uid==os.getuid(),'PROTOCOL13_DIRECTORY_OWNER')
    current=tuple(identities)
    need11(pin is None or pin==current,'PROTOCOL13_NAMESPACE_REPLACED');return current

def read13(path,maximum=4096):
    path=Path(path);parents=directory13(path.parent);before=path.lstat()
    need11(stat.S_ISREG(before.st_mode)and before.st_nlink==1 and not getattr(before,'st_file_attributes',0)&0x400 and 0<before.st_size<=maximum,'PROTOCOL13_FILE')
    need11(not hasattr(os,'getuid')or before.st_uid==os.getuid(),'PROTOCOL13_FILE_OWNER')
    fd=os.open(path,os.O_RDONLY|getattr(os,'O_BINARY',0)|getattr(os,'O_NOFOLLOW',0))
    with os.fdopen(fd,'rb')as stream:
        need11(stat13(before)==stat13(os.fstat(stream.fileno())),'PROTOCOL13_FILE_RACE')
        raw=stream.read(maximum+1)
        need11(stat13(before)==stat13(os.fstat(stream.fileno()))==stat13(path.lstat())and len(raw)==before.st_size,'PROTOCOL13_FILE_RACE')
    directory13(path.parent,parents);return raw,stat13(before)

def atomic13(directory,name,value):
    need11(re.fullmatch(r'(?:invitation|ready-ack|ack-[1-8]|failure|abort)\.json',name)is not None,'PROTOCOL13_WRITE_NAME')
    pin=directory13(directory);target=directory/name;temporary=directory/(name+'.tmp')
    need11(not os.path.lexists(target)and not os.path.lexists(temporary),'PROTOCOL13_OUTPUT_EXISTS')
    with temporary.open('xb')as stream:stream.write((json.dumps(value,separators=(',',':'))+'\n').encode());stream.flush();os.fsync(stream.fileno())
    # link is an exclusive atomic publication: unlike POSIX rename it cannot replace a raced-in ACK.
    os.link(temporary,target,follow_symlinks=False);temporary.unlink();directory13(directory,pin)

def invalidate13(state,error,operation,deadline):
    need11(operation in {'PREPARATION','RUNNER_DISCOVERY','RUNNER_NAMESPACE','READY','REQUEST','PROCESS_PAIR','APP_IDENTITY','BINARY_IDENTITY','TRACE','TEST_COMMAND','FINAL_BINDING'},'PROTOCOL13_OPERATION_ENUM')
    with state['_lock']:
        if state['invalid']is not None:return
        invalidate11(state,error)
        state['invalid'].update(phase=state['phase'],operation=operation,UTC=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
            monotonic_ns=time.monotonic_ns(),deadline_ns=deadline,completed=False)
        if isinstance(error,subprocess.TimeoutExpired):state['invalid']['timeout_seconds']=error.timeout
        state['_failed'].set()
    # Only a bound owned namespace can receive a terminal failure. Never write a positive ACK here.
    try:
        if state.get('_ipc')is not None:
            directory13(state['_ipc'],state['_ipc_pin']);atomic13(state['_ipc'],'failure.json',{'schema':1,'binding':state['binding'],
                'code':'OBSERVER_TERMINAL','operation':operation})
    except Exception:pass
    try:atomic13(state['_control'],'abort.json',{'schema':1,'binding':state['binding'],'code':'OBSERVER_TERMINAL'})
    except Exception:pass

def accept13(state,envelope,value,observe):
    """Actual host wire rules; observation receives the SAME absolute five-second deadline."""
    pid=validate_binding11(envelope);need11(state['invalid']is None,'PROTOCOL13_TERMINAL')
    common={'schema','binding','kind','pid','runner_pid','runner_source','nonce','issued_ns','deadline_ns'}
    ready=type(value)is dict and value.get('kind')=='READY'
    need11(type(value)is dict and set(value)==(common if ready else common|{'sequence','phase','state'}),'PROTOCOL13_SCHEMA')
    need11(type(value['schema'])is int and value['schema']==1 and value['binding']==envelope['binding_id']and type(value['pid'])is int and value['pid']==pid and
        type(value['runner_pid'])is int and value['runner_pid']==state['runner']['pid']and value['runner_source']==envelope['runner_source']['head']and
        type(value['nonce'])is str and re.fullmatch('[a-f0-9]{32}',value['nonce'])is not None,'PROTOCOL13_BINDING')
    issued=value['issued_ns'];deadline=value['deadline_ns'];now=time.monotonic_ns()
    need11(type(issued)is int and type(deadline)is int and 0<issued<=now<deadline and deadline-issued==5_000_000_000 and issued>=state['prepared_ns'],'PROTOCOL13_EXPIRED')
    if ready:
        need11(not state['armed']and not state['checkpoints']and state['phase']=='PREPARATION'and
            state.get('invited_nonce')==value['nonce'],'PROTOCOL13_READY_REPLAY')
    else:
        need11(state['armed']and value['kind']=='CHECKPOINT'and value['nonce']==state['nonce']and issued>=state['armed_ns'],'PROTOCOL13_NOT_ARMED')
        request11({k:value[k]for k in ['schema','binding','sequence','phase','pid','state']},envelope,state['checkpoints'])
    observe(deadline);observe(deadline);remaining13(deadline)
    reply={k:value[k]for k in common};reply.update(valid=True,code='OBSERVER_ARMED'if ready else'CURRENT_SAME_PROCESS',completed_ns=time.monotonic_ns())
    if ready:state.update(nonce=value['nonce'],armed=True,armed_ns=reply['completed_ns'])
    else:reply.update(sequence=value['sequence'],phase=value['phase'])
    return reply

def ack13(reply,request):
    extra={'valid','code','completed_ns'}|({'sequence','phase'}if request['kind']=='CHECKPOINT'else set())
    shared={k:request[k]for k in ['schema','binding','kind','pid','runner_pid','runner_source','nonce','issued_ns','deadline_ns']}
    need11(type(reply)is dict and set(reply)==set(shared)|extra and all(type(reply[k])is type(v)and reply[k]==v for k,v in shared.items())and
        reply['valid']is True and reply['code']==('OBSERVER_ARMED'if request['kind']=='READY'else'CURRENT_SAME_PROCESS')and
        type(reply['completed_ns'])is int and request['issued_ns']<=reply['completed_ns']<=time.monotonic_ns()<request['deadline_ns'],'PROTOCOL13_ACK')
    if request['kind']=='CHECKPOINT':need11(reply['sequence']==request['sequence']and reply['phase']==request['phase'],'PROTOCOL13_ACK_ORDER')
    return True

def pin_binary13(path,expected):
    path=Path(path);directory13(path.parent);before=path.lstat();need11(stat.S_ISREG(before.st_mode)and before.st_nlink==1,'PROTOCOL13_BINARY_FILE')
    fd=os.open(path,os.O_RDONLY|getattr(os,'O_BINARY',0)|getattr(os,'O_NOFOLLOW',0));stream=os.fdopen(fd,'rb');digest=hashlib.sha256();size=0
    try:
        need11(stat13(before)==stat13(os.fstat(stream.fileno())),'PROTOCOL13_BINARY_RACE')
        for part in iter(lambda:stream.read(1024*1024),b''):digest.update(part);size+=len(part)
        need11({'bytes':size,'sha256':digest.hexdigest()}==expected and stat13(before)==stat13(os.fstat(stream.fileno()))==stat13(path.lstat()),'PROTOCOL13_BINARY_BYTES')
        return stream,path,stat13(before)
    except Exception:stream.close();raise

def check_binary13(pin):
    stream,path,expected=pin;directory13(path.parent)
    need11(stat13(os.fstat(stream.fileno()))==stat13(path.lstat())==expected,'PROTOCOL13_BINARY_REPLACED')

def pair13(r,n,state,envelope,deadline):
    need11('_stop'not in state or not state['_stop'].is_set(),'PROTOCOL13_OBSERVER_STOPPED')
    state['operation']='BINARY_IDENTITY'
    for pin in state['_binaries']:check_binary13(pin)
    state['operation']='APP_IDENTITY';raw,_=read13(r._storage05_first_data_container/'Documents/C47StorageOrigin05Identity.json');native=n.stage_json(raw)
    need11(native=={'schema':1,'pid':envelope['warm_process']['pid'],'sourceHead':PRODUCER['head'],'bundle':BUNDLE}and type(native.get('pid'))is int and type(native.get('schema'))is int,'PROTOCOL13_APP_SOURCE')
    state['operation']='PROCESS_PAIR';ids=[envelope['warm_process']['pid'],state['runner']['pid']]
    p=subprocess.run(['/bin/ps','-p',','.join(map(str,ids)),'-o','pid=,lstart=,comm='],capture_output=True,env={**r.env,'LC_ALL':'C'},timeout=remaining13(deadline))
    need11(p.returncode==0 and 0<len(p.stdout)<=8192,'PROTOCOL13_PROCESS_ABSENT');lines=p.stdout.splitlines();need11(len(lines)==2,'PROTOCOL13_PROCESS_PAIR')
    for expected in [envelope['warm_process'],state['runner']]:
        rows=[line for line in lines if line.lstrip().startswith(str(expected['pid']).encode()+b' ')];need11(len(rows)==1,'PROTOCOL13_PROCESS_ABSENT')
        record={'schema':1,'pid':expected['pid'],'sourceHead':PRODUCER['head'],'bundle':BUNDLE}
        process_record11(record,rows[0],expected['pid'],expected['executable'],expected)
    for pin in state['_binaries']:check_binary13(pin)
    remaining13(deadline);state['process_checks']+=1

def serve13(state,envelope,ipc,observe):
    """One actual atomic request/ack exchange; both native and local cross-process tests use it."""
    state['operation']='REQUEST'if state['armed']else'READY';directory13(ipc,state['_ipc_pin']);sequence=len(state['checkpoints'])+1
    for old,stamp in state.get('_requests',[]):need11(stat13(old.lstat())==stamp,'PROTOCOL13_PRIOR_REQUEST_CHANGED')
    if state['armed']:
        need11(not any(os.path.lexists(ipc/('request-'+str(i)+'.json'))for i in range(sequence+1,9)),'PROTOCOL13_REQUEST_ORDER')
    filename='request-'+str(sequence)+'.json'if state['armed']else'ready.json';path=ipc/filename
    if not os.path.lexists(path):return False
    raw,stamp=read13(path)
    if state.get('_last')==(raw,stamp):return False
    value=json.loads(raw);end=value.get('deadline_ns')if type(value)is dict else None
    if type(end)is int and 0<end<=time.monotonic_ns()+5_000_000_000:state['_operation_deadline']=end
    reply=accept13(state,envelope,value,observe);deadline=value['deadline_ns'];remaining13(deadline)
    directory13(ipc,state['_ipc_pin']);need11(read13(path)==(raw,stamp),'PROTOCOL13_REQUEST_RACE')
    atomic13(ipc,'ready-ack.json'if value['kind']=='READY'else'ack-'+str(value['sequence'])+'.json',reply)
    remaining13(deadline);state['_last']=(raw,stamp);state.setdefault('_requests',[]).append((path,stamp))
    event={**reply,'phase':'OBSERVER_ARMED'if value['kind']=='READY'else value['phase'],'issued_ns':value['issued_ns'],'completed_ns':reply['completed_ns'],
        'deadline_ns':deadline,'published_ns':time.monotonic_ns(),'remaining_ns':deadline-time.monotonic_ns(),'request':identity(raw),'same_source_executable_PID_start_before_after':True}
    if value['kind']=='READY':state['ready']=event;state['phase']='ACTIVE'
    else:state['checkpoints'].append(event)
    return True

def state13(envelope,control,prepared_ns):
    validate_binding11(envelope);directory13(control)
    return {'invalid':None,'phase':'PREPARATION','operation':'PREPARATION','binding':envelope['binding_id'],'prepared_ns':prepared_ns,
        'armed':False,'checkpoints':[],'process_checks':0,'runner_discovery_queries':0,'_lock':threading.Lock(),
        '_failed':threading.Event(),'_control':control,'_ipc':None,'_binaries':[]}

def prepare_wire13(state,envelope,ipc,observe,deadline):
    """Authenticate the executing peer and fresh observations, before starting any five-second challenge."""
    need11(state['invalid']is None and not state['armed']and 'invited_nonce'not in state,'PROTOCOL13_PREPARATION_STATE')
    directory13(ipc,state['_ipc_pin']);path=ipc/'hello.json'
    if not os.path.lexists(path):return False
    raw,stamp=read13(path);value=json.loads(raw)
    keys={'schema','binding','kind','pid','runner_pid','runner_source','runner_bundle','nonce'}
    need11(type(value)is dict and set(value)==keys and type(value['schema'])is int and value['schema']==1 and value['kind']=='HELLO'and
        value['binding']==envelope['binding_id']and type(value['pid'])is int and value['pid']==validate_binding11(envelope)and
        type(value['runner_pid'])is int and value['runner_pid']==state['runner']['pid']and value['runner_source']==envelope['runner_source']['head']and
        value['runner_bundle']==RUNNER_BUNDLE11 and type(value['nonce'])is str and re.fullmatch('[a-f0-9]{32}',value['nonce'])is not None,'PROTOCOL13_EXECUTING_HELLO')
    observe(deadline);observe(deadline);remaining13(deadline,900)
    directory13(ipc,state['_ipc_pin']);need11(read13(path)==(raw,stamp),'PROTOCOL13_HELLO_RACE')
    reply={**value,'kind':'PREPARED','prepared_ns':time.monotonic_ns(),'deadline_ns':deadline}
    atomic13(ipc,'invitation.json',reply);remaining13(deadline,900)
    state['invited_nonce']=value['nonce'];state.setdefault('_requests',[]).append((path,stamp));state['preparation_invitation']=reply
    return True

SWIFT13=r'''
    // Separate C13 diagnostic wire; never included in the ordinary application/runner source.
    private let c13RunnerSource = "@SOURCE@"
    private let c13Nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
    private let c13AcknowledgmentNanoseconds: UInt64 = 5_000_000_000
    private let c13PreparationDeadline: UInt64 = @UI_DEADLINE@
    private func c13Integer(_ value: Any?) -> UInt64? {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
              !["d", "f"].contains(String(cString: number.objCType)) else { return nil }
        return UInt64(number.stringValue)
    }
    private func c13Exchange(_ kind: String, phase: String, sequence: Int, state: Int, _ app: XCUIApplication) -> Bool {
        let issued = DispatchTime.now().uptimeNanoseconds
        let absoluteDeadline = issued + c13AcknowledgmentNanoseconds
        guard Bundle.main.bundleIdentifier == "internal.c47.native-ui.xctrunner",
              let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            XCTFail("C47_OBSERVER13_RUNNER_IDENTITY"); return false
        }
        let directory = documents.appendingPathComponent("C47Replay13").appendingPathComponent(c11BindingID)
        let requestName = kind == "READY" ? "ready.json" : "request-\(sequence).json"
        let ackName = kind == "READY" ? "ready-ack.json" : "ack-\(sequence).json"
        let requestPath = directory.appendingPathComponent(requestName)
        let ack = directory.appendingPathComponent(ackName)
        let failure = directory.appendingPathComponent("failure.json")
        var request: [String: Any] = ["schema": 1, "binding": c11BindingID, "kind": kind, "pid": c11ExpectedPID,
            "runner_pid": Int(ProcessInfo.processInfo.processIdentifier), "runner_source": c13RunnerSource, "nonce": c13Nonce,
            "issued_ns": issued, "deadline_ns": absoluteDeadline]
        if kind == "CHECKPOINT" { request["sequence"] = sequence; request["phase"] = phase; request["state"] = state }
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            guard directory.standardizedFileURL.path == directory.resolvingSymlinksInPath().path else {
                XCTFail("C47_OBSERVER13_NAMESPACE_LINK"); return false
            }
            var ancestor = directory
            while ancestor.path != "/" {
                let attrs = try FileManager.default.attributesOfItem(atPath: ancestor.path)
                guard attrs[.type] as? FileAttributeType == .typeDirectory else {
                    XCTFail("C47_OBSERVER13_NAMESPACE_TYPE"); return false
                }
                ancestor.deleteLastPathComponent()
            }
            guard !FileManager.default.fileExists(atPath: requestPath.path), !FileManager.default.fileExists(atPath: ack.path) else {
                XCTFail("C47_OBSERVER13_REPLAY"); return false
            }
            try JSONSerialization.data(withJSONObject: request).write(to: requestPath, options: .atomic)
        } catch { capture("c13-request-unavailable", app); XCTFail("C47_OBSERVER13_REQUEST_UNAVAILABLE"); return false }
        let now = DispatchTime.now().uptimeNanoseconds
        guard now < absoluteDeadline else { XCTFail("C47_OBSERVER13_DEADLINE"); return false }
        let available = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            if FileManager.default.fileExists(atPath: failure.path) { return true }
            guard let attrs = try? FileManager.default.attributesOfItem(atPath: ack.path),
                  (attrs[.referenceCount] as? NSNumber)?.intValue == 1 else { return false }
            return true
        }, object: nil)
        // The original FIVE seconds includes publication, polling, reads and all validation.
        let received = XCTWaiter.wait(for: [available], timeout: Double(absoluteDeadline - now) / 1_000_000_000) == .completed
        guard !FileManager.default.fileExists(atPath: failure.path) else {
            capture("c13-observer-terminal", app); XCTFail("C47_OBSERVER13_TERMINAL"); return false
        }
        guard received, directory.standardizedFileURL.path == directory.resolvingSymlinksInPath().path,
              let attributes = try? FileManager.default.attributesOfItem(atPath: ack.path),
              attributes[.type] as? FileAttributeType == .typeRegular,
              (attributes[.referenceCount] as? NSNumber)?.intValue == 1,
              let size = attributes[.size] as? NSNumber, size.intValue > 0, size.intValue <= 4096,
              let bytes = try? Data(contentsOf: ack), bytes.count <= 4096,
              let reply = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any] else {
            capture("c13-ack-unavailable", app); XCTFail("C47_OBSERVER13_ACK_UNAVAILABLE"); return false
        }
        let common: Set<String> = ["schema", "binding", "kind", "pid", "runner_pid", "runner_source", "nonce", "issued_ns", "deadline_ns", "valid", "code", "completed_ns"]
        let keys = kind == "READY" ? common : common.union(["sequence", "phase"])
        let completed = c13Integer(reply["completed_ns"])
        guard Set(reply.keys) == keys, c13Integer(reply["schema"]) == 1,
              reply["binding"] as? String == c11BindingID, reply["kind"] as? String == kind,
              c13Integer(reply["pid"]) == UInt64(c11ExpectedPID),
              c13Integer(reply["runner_pid"]) == UInt64(ProcessInfo.processInfo.processIdentifier),
              reply["runner_source"] as? String == c13RunnerSource, reply["nonce"] as? String == c13Nonce,
              c13Integer(reply["issued_ns"]) == issued, c13Integer(reply["deadline_ns"]) == absoluteDeadline,
              let valid = reply["valid"] as? NSNumber, CFGetTypeID(valid) == CFBooleanGetTypeID(), valid.boolValue,
              reply["code"] as? String == (kind == "READY" ? "OBSERVER_ARMED" : "CURRENT_SAME_PROCESS"),
              let completed, issued <= completed, completed <= DispatchTime.now().uptimeNanoseconds,
              DispatchTime.now().uptimeNanoseconds < absoluteDeadline,
              kind == "READY" || (c13Integer(reply["sequence"]) == UInt64(sequence) && reply["phase"] as? String == phase) else {
            capture("c13-binding-refused", app); XCTFail("C47_OBSERVER13_BINDING_REFUSED"); return false
        }
        return true
    }

    private func c13Prepare(_ app: XCUIApplication) -> Bool {
        guard Bundle.main.bundleIdentifier == "internal.c47.native-ui.xctrunner",
              let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            XCTFail("C47_OBSERVER13_PREPARATION_IDENTITY"); return false
        }
        let directory = documents.appendingPathComponent("C47Replay13").appendingPathComponent(c11BindingID)
        let hello = directory.appendingPathComponent("hello.json")
        let invitation = directory.appendingPathComponent("invitation.json")
        let failure = directory.appendingPathComponent("failure.json")
        let message: [String: Any] = ["schema": 1, "binding": c11BindingID, "kind": "HELLO", "pid": c11ExpectedPID,
            "runner_pid": Int(ProcessInfo.processInfo.processIdentifier), "runner_source": c13RunnerSource,
            "runner_bundle": "internal.c47.native-ui.xctrunner", "nonce": c13Nonce]
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            guard directory.standardizedFileURL.path == directory.resolvingSymlinksInPath().path,
                  !FileManager.default.fileExists(atPath: hello.path), !FileManager.default.fileExists(atPath: invitation.path) else {
                XCTFail("C47_OBSERVER13_PREPARATION_REPLAY"); return false
            }
            try JSONSerialization.data(withJSONObject: message).write(to: hello, options: .atomic)
        } catch { XCTFail("C47_OBSERVER13_PREPARATION_WRITE"); return false }
        let now = DispatchTime.now().uptimeNanoseconds
        guard now < c13PreparationDeadline else { XCTFail("C47_OBSERVER13_PREPARATION_EXPIRED"); return false }
        let available = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            if FileManager.default.fileExists(atPath: failure.path) { return true }
            guard let attrs = try? FileManager.default.attributesOfItem(atPath: invitation.path),
                  (attrs[.referenceCount] as? NSNumber)?.intValue == 1 else { return false }
            return true
        }, object: nil)
        let received = XCTWaiter.wait(for: [available], timeout: Double(c13PreparationDeadline - now) / 1_000_000_000) == .completed
        guard received, !FileManager.default.fileExists(atPath: failure.path),
              directory.standardizedFileURL.path == directory.resolvingSymlinksInPath().path,
              let attrs = try? FileManager.default.attributesOfItem(atPath: invitation.path),
              attrs[.type] as? FileAttributeType == .typeRegular, (attrs[.referenceCount] as? NSNumber)?.intValue == 1,
              let size = attrs[.size] as? NSNumber, size.intValue > 0, size.intValue <= 4096,
              let bytes = try? Data(contentsOf: invitation), bytes.count <= 4096,
              let reply = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any],
              Set(reply.keys) == Set(["schema", "binding", "kind", "pid", "runner_pid", "runner_source", "runner_bundle", "nonce", "prepared_ns", "deadline_ns"]),
              c13Integer(reply["schema"]) == 1, reply["binding"] as? String == c11BindingID,
              reply["kind"] as? String == "PREPARED", c13Integer(reply["pid"]) == UInt64(c11ExpectedPID),
              c13Integer(reply["runner_pid"]) == UInt64(ProcessInfo.processInfo.processIdentifier),
              reply["runner_source"] as? String == c13RunnerSource, reply["runner_bundle"] as? String == "internal.c47.native-ui.xctrunner",
              reply["nonce"] as? String == c13Nonce, let prepared = c13Integer(reply["prepared_ns"]),
              prepared <= DispatchTime.now().uptimeNanoseconds, c13Integer(reply["deadline_ns"]) == c13PreparationDeadline,
              DispatchTime.now().uptimeNanoseconds < c13PreparationDeadline else {
            capture("c13-preparation-refused", app); XCTFail("C47_OBSERVER13_PREPARATION_REFUSED"); return false
        }
        return true
    }

'''

def prefix13(before,envelope,deadline_ns=None):
    original=prefix11(before,envelope);after=original
    start=after.index(b'        guard let documents = FileManager.default.urls(')
    end=after.index(b'        return true\n    }',start)+len(b'        return true')
    old=after[start:end];new=b'        return c13Exchange("CHECKPOINT", phase: phase, sequence: c11Sequence, state: Int(app.state.rawValue), app)'
    after=after[:start]+new+after[end:]
    if deadline_ns is None:deadline_ns=time.monotonic_ns()+900_000_000_000
    need11(type(deadline_ns)is int and time.monotonic_ns()<deadline_ns<=time.monotonic_ns()+900_000_000_000,'PROTOCOL13_UI_DEADLINE')
    marker=b'    private func sameProcess11(';helper=SWIFT13.replace('@SOURCE@',envelope['runner_source']['head']).replace('@UI_DEADLINE@',str(deadline_ns)).encode();after=after.replace(marker,helper+marker,1)
    attach=b'    private func attachWarm11(_ app: XCUIApplication) -> Bool {\n';ready=b'        guard c13Prepare(app), c13Exchange("READY", phase: "", sequence: 0, state: Int(app.state.rawValue), app) else { return false }\n'
    need11(after.count(attach)==1,'PROTOCOL13_ATTACH');after=after.replace(attach,attach+ready,1)
    imports=b'import Dispatch\nimport CoreFoundation\n';after=imports+after
    recovered=after[len(imports):].replace(attach+ready,attach,1).replace(helper+marker,marker,1).replace(new,old,1)
    need11(recovered==original,'PROTOCOL13_REVERSIBLE_AFTERIMAGE')
    need11(all(q in after for q in [b'private let deadline: TimeInterval = 30',b'executionTimeAllowance = 600',b'5_000_000_000',b'app.activate()',b'guard attachWarm11(app)'])and
        b'Thread.sleep'not in after and after.count(b'app.activate()')==1,'PROTOCOL13_UI_BOUNDS')
    return after

def prepare_runner13(r,n,project,products,device,env):
    import plistlib,tarfile
    operation=r.receipt['ui_operation13'];started=operation['started_ns'];deadline=operation['deadline_ns']
    need11(type(started)is int and type(deadline)is int and started<=time.monotonic_ns()<deadline<=started+900_000_000_000 and deadline<=int(r.deadline*1e9),'PROTOCOL13_SHARED_UI_ENVELOPE')
    n.write_json(r.output/'UI_OPERATION13.json',{'started_ns':started,'deadline_ns':deadline,'maximum_seconds':900,'test_maximum_seconds':600})
    help_paths=r.run('diagnostic13-xcodebuild-help',['xcodebuild','-help'],timeout=min(30,remaining13(deadline,30)),required=False)
    help_text=b'\n'.join(n.read_native_file(p)for p in help_paths).decode('utf8')
    need11(all(q in help_text for q in ['build-for-testing','test-without-building','-xctestrun','-derivedDataPath','-test-timeouts-enabled','-maximum-test-execution-time-allowance']),'PROTOCOL13_ACTUAL_XCODE_OPTIONS')
    derived=products/'derived-ui13';need11(not derived.exists(),'PROTOCOL13_NEW_DERIVED')
    swift=project.parent/'native_ui47.swift';prefix_record=n.stage_json(n.read_native_file(r.output/'DIAGNOSTIC_PREFIX11.json'))
    need11(n.stage_file_digest(swift)==prefix_record['compiled_prefix'],'PROTOCOL13_COMPILER_AFTERIMAGE_BEFORE')
    argv=['xcodebuild','build-for-testing','-project',project,'-scheme','C47NativeUI','-destination','id='+device,
        '-derivedDataPath',derived,'-resultBundlePath',products/'ui-build13.xcresult',*n.SIMULATOR_BUILD_FLAGS]
    r.run('diagnostic13-build-for-testing',argv,env=env,timeout=remaining13(deadline,900))
    need11(n.stage_file_digest(swift)==prefix_record['compiled_prefix'],'PROTOCOL13_COMPILER_AFTERIMAGE_AFTER')
    root=derived/'Build/Products';runs=list(root.glob('*.xctestrun'));need11(len(runs)==1,'PROTOCOL13_ONE_XCTESTRUN')
    run=runs[0];raw,_=read13(run,1024*1024);config=plistlib.loads(raw)
    if 'TestConfigurations'in config:
        configurations=config['TestConfigurations'];need11(type(configurations)is list and len(configurations)==1,'PROTOCOL13_CONFIGURATION_COUNT')
        targets=configurations[0]['TestTargets'];need11(type(targets)is list and len(targets)==1,'PROTOCOL13_TARGET_COUNT');target=targets[0]
    else:
        targets=[v for k,v in config.items()if not k.startswith('__')];need11(len(targets)==1,'PROTOCOL13_TARGET_COUNT');target=targets[0]
    need11(type(target)is dict and target.get('IsUITestBundle')is True and target.get('BlueprintName')=='C47NativeUI','PROTOCOL13_ISOLATED_UI_TARGET')
    host_text=target.get('TestHostPath');need11(type(host_text)is str and host_text.startswith('__TESTROOT__/'),'PROTOCOL13_HOST_PATH')
    host=Path(host_text.replace('__TESTROOT__',str(root),1));need11(host==host.resolve(strict=True)and host.is_relative_to(root.resolve())and host.name=='C47NativeUI-Runner.app','PROTOCOL13_BUILT_HOST')
    info=plistlib.loads(read13(host/'Info.plist',1024*1024)[0]);need11(info['CFBundleIdentifier']==RUNNER_BUNDLE11 and info['CFBundleExecutable']=='C47NativeUI-Runner','PROTOCOL13_BUILT_RUNNER_IDENTITY')
    bundle_text=target.get('TestBundlePath');need11(type(bundle_text)is str,'PROTOCOL13_TEST_BUNDLE_PATH')
    bundle=Path(bundle_text.replace('__TESTROOT__',str(root),1).replace('__TESTHOST__',str(host),1));need11(bundle==bundle.resolve(strict=True)and bundle.is_relative_to(host)and bundle.name=='C47NativeUI.xctest','PROTOCOL13_BUILT_TEST_BUNDLE')
    test_info=plistlib.loads(read13(bundle/'Info.plist',1024*1024)[0]);need11(test_info['CFBundleExecutable']=='C47NativeUI','PROTOCOL13_TEST_EXECUTABLE')
    need11(not target.get('UITargetAppPath')and not target.get('UITargetAppBundleIdentifier'),'PROTOCOL13_NO_AUTOMATIC_TARGET_APP')
    inventory=n.bundle_inventory(host);records={q['path']:q for q in inventory if q.get('type')=='file'}
    test_relative=(bundle/'C47NativeUI').relative_to(host).as_posix();wanted=[info['CFBundleExecutable'],test_relative]
    need11(all(q in records for q in wanted),'PROTOCOL13_COMPILED_EXECUTABLES')
    n.write_json(r.output/'COMPILED_UI_RUNNER13.json',{'source':r.receipt['source'],'xctestrun':{'path':str(run),**identity(raw)},'target':target,
        'runner_path':str(host),'runner_bundle':info['CFBundleIdentifier'],'inventory':inventory,'compiled_swift':prefix_record['compiled_prefix'],'prepared_ns':time.monotonic_ns(),
        'UI_started_ns':started,'UI_deadline_ns':deadline,'remaining_ns':deadline-time.monotonic_ns(),'historical_app_rebuilt':False,'ordinary_admitted':False})
    need11(n.evidence_total(r)+sum(q.get('bytes',0)for q in inventory)<n.MAX_EVIDENCE-20*1024**2,'PROTOCOL13_COMPILED_RETENTION_BOUND')
    with tarfile.open(r.output/'compiled-ui-runner13.tar.gz','w:gz',format=tarfile.PAX_FORMAT)as archive:archive.add(host,arcname=host.name)
    need11(n.bundle_inventory(host)==inventory and read13(run,1024*1024)[0]==raw,'PROTOCOL13_PREPARED_INPUTS_UNCHANGED')
    return {'started_ns':started,'deadline_ns':deadline,'prepared_ns':time.monotonic_ns(),'xctestrun':run,'xctestrun_bytes':raw,'host':host,
        'inventory':inventory,'binaries':[(q,{k:records[q][k]for k in ['bytes','sha256']})for q in wanted]}

def discover13(r,n,state,envelope,device,prepared,deadline):
    """Discover an EXECUTING runner first; exactly one container query, never during compilation."""
    state['operation']='RUNNER_DISCOVERY'
    p=subprocess.run(['/bin/ps','-axo','pid=,lstart=,comm='],capture_output=True,env={**r.env,'LC_ALL':'C'},timeout=remaining13(deadline))
    need11(p.returncode==0 and len(p.stdout)<=1024*1024,'PROTOCOL13_RUNNER_PROCESS_LIST')
    expected=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Bundle/Application';found=[]
    for line in p.stdout.splitlines():
        match=re.fullmatch(rb'\s*([0-9]+)\s+([A-Za-z]{3} [A-Za-z]{3}\s+[0-9]{1,2} [0-9:]{8} [0-9]{4})\s+(.+)',line)
        if not match:continue
        executable=Path(match[3].decode('utf8'))
        if executable.name!='C47NativeUI-Runner':continue
        if executable.parent.parent.parent!=expected:continue
        need11(executable.parent.name=='C47NativeUI-Runner.app'and str(uuid.UUID(executable.parent.parent.name)).lower()==executable.parent.parent.name.lower(),'PROTOCOL13_RUNNER_BUNDLE_PATH')
        record=process_record11({'schema':1,'pid':int(match[1]),'sourceHead':PRODUCER['head'],'bundle':BUNDLE},line,int(match[1]),str(executable));found.append(record)
    need11(len(found)<=1,'PROTOCOL13_RUNNER_PROCESS_COUNT')
    if not found:return False
    state['runner']=found[0];installed=Path(found[0]['executable']).parent
    need11(n.bundle_inventory(installed)==prepared['inventory'],'PROTOCOL13_INSTALLED_RUNNER_BYTES')
    for relative,wanted in prepared['binaries']:state['_binaries'].append(pin_binary13(installed/relative,wanted))
    state['operation']='RUNNER_NAMESPACE';need11(state['runner_discovery_queries']==0,'PROTOCOL13_DISCOVERY_REPEATED');state['runner_discovery_queries']+=1
    p=subprocess.run(['xcrun','simctl','get_app_container',device,RUNNER_BUNDLE11,'data'],capture_output=True,env=r.env,timeout=remaining13(deadline))
    need11(p.returncode==0 and 0<len(p.stdout)<=4096,'PROTOCOL13_EXECUTING_RUNNER_CONTAINER')
    data=Path(p.stdout.decode().strip());expected=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'
    need11(data.parent==expected and str(uuid.UUID(data.name)).lower()==data.name.lower(),'PROTOCOL13_OWN_RUNNER_CONTAINER')
    state['_runner_data_pin']=directory13(data);state['_runner_data']=data
    n.write_json(r.output/'EXECUTING_RUNNER13.json',{'binding':envelope,'runner':state['runner'],'data':str(data),
        'installed_inventory':prepared['inventory'],'discovery_queries':state['runner_discovery_queries'],'phase':'PREPARATION','not_app_PID_adoption':True})
    return True

def observer13(r,n,device,installed,prepared,envelope,state,stop):
    deadline=prepared['deadline_ns'];target=r.output/'replay-capture11'
    try:
        target.mkdir(exist_ok=True);directory13(target)
        need11(state['prepared_ns']>=prepared['prepared_ns'],'PROTOCOL13_NOT_BUILT')
        while not stop.wait(.01):
            remaining13(deadline,900);need11(state['invalid']is None,'PROTOCOL13_TERMINAL')
            if 'runner'not in state:
                if not discover13(r,n,state,envelope,device,prepared,deadline):continue
            data=state['_runner_data'];directory13(data,state['_runner_data_pin'])
            ipc=data/'Documents/C47Replay13'/envelope['binding_id']
            if state['_ipc']is None:
                if not os.path.lexists(ipc):continue
                state['_ipc_pin']=directory13(ipc);state['_ipc']=ipc
            if 'invited_nonce'not in state:
                state['operation']='READY'
                if prepare_wire13(state,envelope,ipc,lambda end:pair13(r,n,state,envelope,end),deadline):n.write_json(target/'preparation-invitation13.json',state['preparation_invitation'])
                continue
            if serve13(state,envelope,ipc,lambda end:pair13(r,n,state,envelope,end)):
                key='ready'if len(state['checkpoints'])==0 else'checkpoint-'+str(len(state['checkpoints']))
                n.write_json(target/(key+'13.json'),state['ready']if key=='ready'else state['checkpoints'][-1])
    except BaseException as error:invalidate13(state,error,state.get('operation','PREPARATION'),state.get('_operation_deadline',deadline))

def test_command13(path):
    """Only the one recorded native75 test command; Runner.run owns this entire process group."""
    import signal
    need11(sys.platform=='darwin'and os.getpgrp()==os.getpid(),'PROTOCOL13_OWN_TEST_PROCESS_GROUP')
    config=json.loads(read13(path,65536)[0]);need11(set(config)=={'argv','deadline_ns','abort_directory','binding'}and
        config['argv'][:2]==['xcodebuild','test-without-building']and config['binding']==path.parent.name,'PROTOCOL13_TEST_COMMAND_SCHEMA')
    end=config['deadline_ns'];remaining13(end,900);directory=Path(config['abort_directory']);directory13(directory)
    process=subprocess.Popen(config['argv'])
    while process.poll()is None:
        if time.monotonic_ns()>=end or os.path.lexists(directory/'abort.json'):
            print('C47_OBSERVER13_OWNED_TEST_ABORT',flush=True)
            os.killpg(os.getpgrp(),signal.SIGTERM)
            raise ValueError('C47_REPLAY11_PROTOCOL13_TEST_ABORT')
        time.sleep(.01)
    return process.returncode

def trace13(r,n,d,envelope,state,stop,deadline):
    target=r.output/'replay-capture11';candidate_started=False
    try:target.mkdir(exist_ok=True);directory13(target);pid=validate_binding11(envelope)
    except BaseException as error:invalidate13(state,error,'TRACE',deadline);return
    while not stop.wait(.02)and time.monotonic_ns()<deadline and state['invalid']is None:
        if len(state['checkpoints'])<7:continue
        try:
            raw_id=n.read_native_file(r._storage05_first_data_container/'Documents/C47StorageOrigin05Identity.json');native=n.stage_json(raw_id)
            raw=n.read_native_file(r._storage05_first_data_container/('Documents/C47PrivacyOrigin08-'+str(pid)+'.json'))
            header=n.stage_json(raw);need11(header.get('sourceHead')==PRODUCER['head']and type(header.get('pid'))is int and header['pid']==pid and header.get('bundle')==BUNDLE,'TRACE_SOURCE_PID_MISMATCH')
            value=trace_binding11(d,raw,native,envelope)
            n.write_json(target/'latest-binding.json',envelope);(target/'latest-identity.json').write_bytes(raw_id);(target/'latest-trace.json').write_bytes(raw)
            origin=d.privacy_origin08(value)
            if origin is None:continue
            candidate_started=True;end=min(deadline,time.monotonic_ns()+5_000_000_000);observed={**state}
            pair13(r,n,observed,envelope,end)
            raw_id=n.read_native_file(r._storage05_first_data_container/'Documents/C47StorageOrigin05Identity.json');native=n.stage_json(raw_id)
            raw=n.read_native_file(r._storage05_first_data_container/('Documents/C47PrivacyOrigin08-'+str(pid)+'.json'))
            value=trace_binding11(d,raw,native,envelope);origin=d.privacy_origin08(value);need11(origin is not None,'ORIGIN_RETIRED')
            pair13(r,n,observed,envelope,end);need11(state['invalid']is None,'PROTOCOL13_TERMINAL')
            (target/'origin-trace.json').open('xb').write(raw);(target/'origin-identity.json').open('xb').write(raw_id)
            n.write_json(target/'ORIGIN_CANDIDATE.json',{'binding':envelope,'trace':identity(raw),'origin':origin,'checkpoint_sequence':len(state['checkpoints']),
                'same_frozen_PID_before_after':True,'first_source_causality_review_required':True,'ordinary_admitted':False,'capture_deadline_ns':end,'completed_ns':time.monotonic_ns()});return
        except BaseException as error:
            if not isinstance(error,Exception)or candidate_started or str(error)in('C47_REPLAY11_TRACE_SOURCE_PID_MISMATCH','C47_REPLAY11_TRACE_APP_SOURCE_PID','C47_REPLAY11_COMPLETE_TRACE'):
                invalidate13(state,error,'TRACE',locals().get('end',deadline));return
            # An unfinished local diagnostic flush is not origin or application admission.
            rows=state.setdefault('trace_unavailable',[])
            if len(rows)<8:rows.append({'operation':'TRACE','error_type':type(error).__name__,'origin_admitted':False})

def diagnostic_documents13(n,summary,tests,method,device,swift):
    need11(method==n.NORMAL_UI_CASES04[2],'PROTOCOL13_EXACT_CASE03')
    outcome=summary.get('result');need11(outcome in('Passed','Failed'),'PROTOCOL13_RESULT_OUTCOME')
    value=n.normal_result_case04(summary,tests,method,device,outcome)
    classification='PREFIX_PASS_NOT_ORDINARY'if outcome=='Passed'else'OTHER_DIAGNOSTIC_FAILURE'
    if outcome=='Failed':
        need11(len(value['failure_nodes'])==1 and len(value['failures'])==1,'PROTOCOL13_ONE_FAILURE_NODE')
        text=value['failures'][0].get('failureText');match=re.fullmatch(r'native_ui47\.swift:([1-9][0-9]*): ([^\r\n]+)',value['failure_nodes'][0].get('name',''))
        need11(match is not None and match[2]==text,'PROTOCOL13_FAILURE_SOURCE');line=int(match[1]);lines=swift.decode().splitlines();need11(line<=len(lines),'PROTOCOL13_FAILURE_LINE')
        if re.fullmatch(r'failed - C47_(?:OBSERVER13|WARM11)_[A-Z0-9_]+',text or''):classification='OBSERVER_OR_BINDING_FAILURE'
        elif re.fullmatch(r'XCTAssert(?:True|False|Equal) failed(?: - [^\r\n]+|: [^\r\n]+)?',text or''):
            classification='GOALS_ASSERTION'if 'XCTAssertTrue(c11Goals)'in lines[line-1]else'OTHER_DIAGNOSTIC_ASSERTION'
        value['failure_source']={'source_line':line,'failure_text_sha256':hashlib.sha256(text.encode()).hexdigest(),'source_line_sha256':hashlib.sha256(lines[line-1].encode()).hexdigest()}
    return {**value['parsed'],'classification':classification,'ordinary_admitted':False,**({'failure_source':value['failure_source']}if'failure_source'in value else{})}

def diagnostic_result13(r,n,products,method,device,after):
    source=products/'ui.xcresult';documents={};support={}
    if not source.is_dir():return {'outcome':'NO_RESULT_BUNDLE','executed':None,'ordinary_admitted':False}
    for command in ['summary','tests']:
        help_paths=r.run('diagnostic13-result-'+command+'-help',['xcrun','xcresulttool','help','get','test-results',command],timeout=30)
        text=b'\n'.join(n.read_native_file(p)for p in help_paths).decode();need11('--path'in text and'--schema'in text,'PROTOCOL13_RESULT_TOOL')
        paths=r.run('diagnostic13-result-'+command+'-schema',['xcrun','xcresulttool','get','test-results',command,'--schema'],timeout=30)
        support[command]=n.normal_result_schema04(n.stage_json(n.read_native_file(paths[0])),command)
        paths=r.run('diagnostic13-result-'+command,['xcrun','xcresulttool','get','test-results',command,'--path',source],timeout=60,required=False)
        if r.receipt['commands'][-1]['state']!='PASS':return {'outcome':'PARTIAL_RESULT_BUNDLE','executed':None,'ordinary_admitted':False}
        documents[command]=n.stage_json(n.read_native_file(paths[0]));n.write_json(r.output/('DIAGNOSTIC13_'+command.upper()+'.json'),documents[command])
    result=diagnostic_documents13(n,documents['summary'],documents['tests'],method,device,after)
    n.write_json(r.output/'DIAGNOSTIC_RESULT13.json',{'binding':binding11(r,device),'parsed':result,'actual_tool_support':support})
    return {'outcome':'PASS'if result['failed']==0 else'ASSERTION_FAILED','parsed':result,'ordinary_admitted':False}

def stop_threads13(state,threads):
    state['_stop'].set();state.setdefault('_join_deadline',time.monotonic()+5)
    for thread in threads:
        if thread.ident is not None:thread.join(timeout=max(0,state['_join_deadline']-time.monotonic()))
    return not any(thread.is_alive()for thread in threads)

def lifecycle13(r,n,d,project,products,device,installed,inventory,envelope,env,after):
    prepared=prepare_runner13(r,n,project,products,device,env)
    control=r.output/'protocol13'/envelope['binding_id'];control.mkdir(parents=True);state=state13(envelope,control,prepared['prepared_ns'])
    stop=threading.Event();state['_stop']=stop;threads=[];operation='BINARY_IDENTITY'
    try:
        state['_binaries'].append(pin_binary13(Path(installed)/'LayerwellStaging',MACHO))
        operation='APP_IDENTITY';process11(r,n,installed,envelope['warm_process']['pid'],envelope['warm_process'])
        argv=['xcodebuild','test-without-building','-xctestrun',str(prepared['xctestrun']),'-destination','id='+device,
            '-only-testing:C47NativeUI/C47NativeUI/'+n.NORMAL_UI_CASES04[2],'-parallel-testing-enabled','NO',
            '-maximum-concurrent-test-simulator-destinations','1','-test-timeouts-enabled','YES',
            '-default-test-execution-time-allowance','600','-maximum-test-execution-time-allowance','600','-resultBundlePath',str(products/'ui.xcresult')]
        config=control/'test-command.json';n.write_json(config,{'argv':argv,'deadline_ns':prepared['deadline_ns'],'abort_directory':str(control),'binding':envelope['binding_id']})
        threads=[threading.Thread(target=observer13,args=(r,n,device,installed,prepared,envelope,state,stop),daemon=True),
            threading.Thread(target=trace13,args=(r,n,d,envelope,state,stop,prepared['deadline_ns']),daemon=True)]
        operation='PREPARATION'
        for thread in threads:thread.start()
        operation='TEST_COMMAND'
        paths=r.run('native-diagnostic13-ui',['python3','-I','-B',Path(__file__).resolve(),'--test-command13',config],env=env,
            timeout=remaining13(prepared['deadline_ns'],900),required=False)
        if state['invalid']is None and not state['armed']:invalidate13(state,ValueError('C47_REPLAY11_PROTOCOL13_NOT_ARMED'),'PREPARATION',prepared['deadline_ns'])
        if state['invalid']is None:
            row=r.receipt['commands'][-1];need11(row['capture_complete']and not row.get('timed_out')and row['exit_code']in(0,65),'PROTOCOL13_COMPLETE_UI_COMMAND')
        # Stop protocol work before collecting results; its genuine first invalidation is retained below.
        need11(stop_threads13(state,threads),'PROTOCOL13_OBSERVERS_JOINED')
        result=diagnostic_result13(r,n,products,n.NORMAL_UI_CASES04[2],device,after)
        n.write_json(r.output/'UI_OPERATION13_FINISHED.json',{'started_ns':prepared['started_ns'],'deadline_ns':prepared['deadline_ns'],
            'test_command_finished_UTC':row.get('finished_utc')if state['invalid']is None else r.receipt['commands'][-1].get('finished_utc'),
            'observer_state':{k:v for k,v in state.items()if not k.startswith('_')},'ordinary_admitted':False})
        return result,state
    except BaseException as error:
        invalidate13(state,error,operation,prepared['deadline_ns']);raise
    finally:
        joined=stop_threads13(state,threads)
        n.write_json(r.output/'OBSERVER13.json',{'binding':envelope,'state':{k:v for k,v in state.items()if not k.startswith('_')},'thread_joined':joined,'ordinary_admitted':False})
        for pin in state['_binaries']:pin[0].close()
        need11(read13(prepared['xctestrun'],1024*1024)[0]==prepared['xctestrun_bytes']and n.bundle_inventory(prepared['host'])==prepared['inventory'],'PROTOCOL13_BUILT_INPUTS_NOT_ALTERED')

def main():
    if sys.argv[1:2]==['--test-command13']:
        need11(len(sys.argv)==3,'PROTOCOL13_TEST_COMMAND_ARGUMENT');return test_command13(Path(sys.argv[2]))
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--same-process11',action='store_true');p.add_argument('--host-first12',action='store_true');p.add_argument('--prepared-observer13',action='store_true');args=p.parse_args()
    if args.prepared_observer13:args.host_first12=True
    if args.host_first12:args.same_process11=True
    token=os.environ.pop('C47_ARTIFACT_READ_TOKEN','');need(bool(token),'EPHEMERAL_READ_TOKEN')
    root=Path(__file__).resolve().parents[3];n=module(root,'native_runtime47.py');d=module(root,'storage_trace47.py')
    output=args.output.absolute();need(not output.exists()and not output.resolve().is_relative_to(root),'NEW_OUTSIDE_EVIDENCE')
    output.mkdir(parents=True)
    import signal
    def coordinator_timeout(*_):raise ValueError('C47_REPLAY11_COORDINATOR_MAX84'if args.same_process11 else'C47_REPLAY10_COORDINATOR_MAX84')
    signal.signal(signal.SIGALRM,coordinator_timeout);signal.alarm(84*60)
    r=n.Runner(root,output,seconds=78*60);coordinator_deadline=r.deadline+6*60
    r.receipt.update(stage='diagnostic-prepared-observer13'if args.prepared_observer13 else'diagnostic-host-first12'if args.host_first12 else'diagnostic-same-process11'if args.same_process11 else'diagnostic-replay10',lane=DOMAIN13 if args.prepared_observer13 else DOMAIN12 if args.host_first12 else DOMAIN11 if args.same_process11 else DOMAIN,diagnostic_only=True,ordinary_admitted=False,producer_sealed=False,
        application_build_performed=False,internal_supported_owner='NOT_RUN',authorization=AUTH13 if args.prepared_observer13 else AUTH12 if args.host_first12 else AUTH11 if args.same_process11 else AUTH);r.persist();code=1
    try:
        ctx=(context13 if args.prepared_observer13 else context12 if args.host_first12 else context11 if args.same_process11 else context)(r,n,token)
        if args.host_first12:early_host12(r,n)
        run,_=n._stage_api('/actions/runs/'+str(PRODUCER['run_id']),token)
        job,_=n._stage_api('/actions/jobs/'+str(PRODUCER['job_id']),token)
        artifact,_=n._stage_api('/actions/artifacts/'+str(PRODUCER['artifact_id']),token)
        producer_metadata(run,job,artifact)
        raw_path=Path(r.env['RUNNER_TEMP'])/'c47-pinned-raw70.zip';need(not raw_path.exists(),'NEW_RAW_INPUT')
        n._stage_download({'artifact_id':PRODUCER['artifact_id'],'digest':RAW['sha256']},
            {'wire_bytes':RAW['bytes'],'service_digest':'sha256:'+RAW['sha256']},token,raw_path);token=None
        payload,inventory,proof=raw70(n,raw_path,root);r.receipt['upstream_payload_bytes']=proof['payload_bytes']
        n.write_json(output/'PINNED_PRODUCER149_INPUT.json',proof)
        result=execute(r,n,d,payload,inventory,same_process11=args.same_process11);n.write_json(output/('REPLAY'+str(ctx['native_attempt'])+'_RESULT.json'),result)
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
        n.write_json(output/('replay-provenance13.json'if args.prepared_observer13 else'replay-provenance12.json'if args.host_first12 else'replay-provenance11.json'if args.same_process11 else'replay-provenance10.json'),{'schema':1,'domain':DOMAIN13 if args.prepared_observer13 else DOMAIN12 if args.host_first12 else DOMAIN11 if args.same_process11 else DOMAIN,'producer':PRODUCER,
            'runner_source':r.receipt.get('source'),'execution':r.receipt.get('replay_execution11'if args.same_process11 else'replay_execution10'),'files':files,
            'ordinary_admitted':False,'internal_admitted':False,'producer70_sealed':False,'release':'NO_GO'})
        if not policy['upload_within_limit']:code=1
    print(json.dumps({'status':r.receipt['status'],'domain':DOMAIN13 if args.prepared_observer13 else DOMAIN12 if args.host_first12 else DOMAIN11 if args.same_process11 else DOMAIN,'native_attempt':75 if args.prepared_observer13 else SLOT12 if args.host_first12 else 73 if args.same_process11 else 72,'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}))
    return code
if __name__=='__main__':raise SystemExit(main())
