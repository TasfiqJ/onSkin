from pathlib import Path
o=Path(__file__).resolve().parent
old='f8a364c38533cbd15b81bd5f52ea37c87cdf4000';new='b29e731097984be98f5b06024d11255dbb732809'
oldtree='1e4d0720aef3d81eef1beed074ce0131c81828e6';newtree='bb63940c79e1fde4c946c8162f401baeac2b90c1'
for n in ['audit/gather.py','audit/github_delivery.py','prepare_reports.py','package_evidence.py']:
 p=o/n;s=p.read_text(encoding='utf-8').replace(old,new).replace(oldtree,newtree)
 if n in ['prepare_reports.py','package_evidence.py']:
  for label in ['root-tests','typecheck','lint','consumer-build','professional-build','privacy-focused','mapping-browser','outcome-browser','professional-owner375','professional-owner430','professional-queue375','professional-queue430']:
   s=s.replace(label+'-final',label+'-final2')
  s=s.replace('Two ordinary local source commits','Three ordinary local source commits').replace("'sourceCommits':2","'sourceCommits':3")
  s=s.replace('Two local source commits','Three local source commits').replace('[two source commits]','[three source commits]')
 if n=='prepare_reports.py':
  s=s.replace("['raw','audit','stage'","['raw','raw-f8-intermediate','audit','stage'")
  s=s.replace('There were no final root/type/lint/build failures.', 'An initial clean-f8 queue browser regression failed before UI setup because its copied pure-domain list omitted new transitive template modules. b29e731097984be98f5b06024d11255dbb732809 adds those dependencies and moves server startup after fixture preparation under cleanup; all original queue assertions remain. Those failing375/430 receipts are retained, and every final check is repeated at the final clean three-commit checkpoint. There were no final root/type/lint/build failures.')
  s=s.replace('original local source', 'original local source')
 p.write_text(s,encoding='utf-8')
print('Updated final evidence metadata; preserved all preceding receipts.')
