import pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from gf01_run import run,ROOT
commands=[('full-governance',['python3.12','-B','-m','unittest','discover','-s','scripts/brain','-p','test_*.py','-v'],ROOT),('targeted-qr02',['python3.12','-B','-m','unittest','test_m103_quality_recovery02_profile','-v'],ROOT/'scripts/brain'),('targeted-qr03',['python3.12','-B','-m','unittest','test_m103_quality_recovery03_profile','-v'],ROOT/'scripts/brain'),('fixture-ast-proof',['python3.12','-B',str(pathlib.Path(__file__).parent/'gf01_run.py'),'ast-proof'],ROOT),('strict-profile',['python3.12','-B','scripts/brain/brain.py','--profile','M1-03','validate'],ROOT)]
for label,argv,cwd in commands:
 result=run(label,argv,cwd)
 if result:sys.exit(result)
