// Retain every advisory and exact lock path. This produces no exception or waiver.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const args=process.argv.slice(2);
if(args.length!==5) throw new Error('repo exact-commit npm-audit.json osv.json output.json required');
const [repo,commit,npmPath,osvPath,output]=args;
if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Exact commit required');
const semver=createRequire(pathToFileURL(resolve(repo,'package.json')))('semver');
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const rawLock=execFileSync('git',['-C',repo,'show',`${commit}:package-lock.json`]);
const lock=JSON.parse(rawLock);if(lock.lockfileVersion!==3)throw new Error('Lock v3 required');
const packages=lock.packages;
const nameOf=(path,row)=>row.name??path.split('node_modules/').at(-1);
function resolveDependency(from,name){
  let cursor=from;
  for(;;){
    const candidate=posix.join(cursor,'node_modules',name);
    if(packages[candidate])return packages[candidate].link?packages[candidate].resolved:candidate;
    if(!cursor)return null;
    cursor=posix.dirname(cursor);if(cursor==='.')cursor='';
  }
}
const edges=[];
for(const [from,row] of Object.entries(packages)){
  for(const group of ['dependencies','optionalDependencies','devDependencies']){
    if(group==='devDependencies'&&from.includes('node_modules/'))continue;
    for(const [name,range] of Object.entries(row[group]??{}))edges.push({from,name,range,kind:group,to:resolveDependency(from,name)});
  }
}
const shortest=new Map([['',[]]]);const queue=[''];
for(let i=0;i<queue.length;i++)for(const edge of edges.filter(e=>e.from===queue[i]&&e.to!==null)){
  if(!shortest.has(edge.to)){shortest.set(edge.to,[...shortest.get(edge.from),{from:edge.from,to:edge.to,name:edge.name,kind:edge.kind}]);queue.push(edge.to);}
}
const inventory=Object.entries(packages).filter(([path,row])=>path.includes('node_modules/')&&!row.link).map(([path,row])=>({
  path,name:nameOf(path,row),version:row.version,integrity:row.integrity??null,
  exposure:row.dev?'DEVELOPER_BUILD':'RUNTIME_OR_SHARED',dependency_path:shortest.get(path)??null,
  unresolved_path_reason:shortest.has(path)?null:'NO_ROOT_EDGE_IN_LOCK_GRAPH',
}));
const npmRaw=readFileSync(npmPath),osvRaw=readFileSync(osvPath);const audit=JSON.parse(npmRaw),osv=JSON.parse(osvRaw);
if(audit.auditReportVersion!==2||!audit.vulnerabilities)throw new Error('Unrecognized npm audit');
const npmRecords=Object.entries(audit.vulnerabilities).map(([name,row])=>({name,raw_record:row,admission:'NONE',
  source_paths:row.nodes.map(path=>{const pkg=inventory.find(r=>r.path===path);if(!pkg)throw new Error('Advisory path missing from lock');return pkg;}),
  direct_advisories:row.via.filter(v=>typeof v==='object').map(v=>({id:v.source,url:v.url,range:v.range,
    exact_vulnerable_paths:inventory.filter(p=>p.name===v.name&&semver.satisfies(p.version,v.range,{includePrerelease:true})).map(p=>p.path)})),
  disposition:'UNRESOLVED_OR_EXISTING_MITIGATION_ONLY_NO_RENEWAL',
}));
const osvRecords=[];
for(const result of osv.results??[])for(const pkg of result.packages??[])for(const advisory of pkg.vulnerabilities??[]){
  const name=pkg.package?.name,version=pkg.package?.version;
  osvRecords.push({name,version,source:result.source,raw_record:advisory,
    source_paths:inventory.filter(p=>p.name===name&&p.version===version).map(p=>p.path),
    disposition:'UNRESOLVED_NO_NEW_EXCEPTION',admission:'NONE'});
}
const primaryUrls=[...new Set(npmRecords.flatMap(r=>r.direct_advisories.map(a=>a.url)).concat(osvRecords.flatMap(r=>r.raw_record.references?.map(x=>x.url)??[])))];
writeFileSync(output,JSON.stringify({admission:'NONE',classification:'NON_ADMITTING_UNREVIEWED',source_commit:commit,
  package_lock_sha256:hash(rawLock),npm_audit_sha256:hash(npmRaw),osv_sha256:hash(osvRaw),
  npm_record_count:npmRecords.length,osv_record_count:osvRecords.length,npm_records:npmRecords,osv_records:osvRecords,
  graph:edges,inventory,primary_urls:primaryUrls},null,2)+'\n');
console.log(JSON.stringify({admission:'NONE',npm_records:npmRecords.length,osv_records:osvRecords.length,lock_packages:inventory.length,
  unresolved_graph_paths:inventory.filter(x=>x.dependency_path===null).length}));
