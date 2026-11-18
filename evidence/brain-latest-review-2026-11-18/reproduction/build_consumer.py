import os, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
REPO=ROOT.parent/'c16-candidate'
cli=subprocess.check_output(['node','-p',"require.resolve('@expo/cli')"],cwd=REPO,text=True).strip()
env=dict(os.environ,EXPO_OFFLINE='1',EXPO_NO_DOTENV='1',EXPO_NO_TELEMETRY='1',EXPO_UNSTABLE_HEADLESS='1')
raise SystemExit(subprocess.run(['node',cli,'export','--platform','web','--output-dir',str(ROOT/'consumer-web-build')],cwd=REPO/'apps/mobile',env=env).returncode)
