"""Download exact public Windows scanner releases into a NEW CI temp directory."""
import argparse,io,json,pathlib,sys,tarfile,urllib.request,zipfile
sys.dont_write_bytecode=True
from contract import HERE,SHA,load,require

ASSETS={
 'gitleaks':('https://github.com/gitleaks/gitleaks/releases/download/v8.24.3/gitleaks_8.24.3_windows_x64.zip','gitleaks.exe'),
 'trufflehog':('https://github.com/trufflesecurity/trufflehog/releases/download/v3.99.2/trufflehog_3.99.2_windows_amd64.tar.gz','trufflehog.exe'),
 'osv':('https://github.com/google/osv-scanner/releases/download/v2.3.8/osv-scanner_windows_amd64.exe',None)}
def main():
 p=argparse.ArgumentParser();p.add_argument('new_directory');a=p.parse_args();root=pathlib.Path(a.new_directory).resolve();require(not root.exists(),'NEW_TOOL_DIRECTORY_REQUIRED');root.mkdir(parents=True)
 policy=load(HERE,'proposal.json');rows=[]
 for name,(url,member) in ASSETS.items():
  with urllib.request.urlopen(url,timeout=90) as response:raw=response.read()
  (root/(name+'.download')).write_bytes(raw)
  if url.endswith('.zip'):
   with zipfile.ZipFile(io.BytesIO(raw)) as z:b=z.read(member)
  elif url.endswith('.tar.gz'):
   with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as t:b=t.extractfile(member).read()
  else:b=raw
  require(SHA(b) in policy['toolBytes'][name],'SCANNER_RELEASE_IDENTITY_DRIFT:'+name)
  out=root/(name+'.exe');out.write_bytes(b);rows.append({'tool':name,'url':url,'downloadSha256':SHA(raw),'binarySha256':SHA(b),'path':str(out)})
 (root/'release-receipts.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps({'verifiedTools':len(rows),'directory':str(root)}))
if __name__=='__main__':main()
