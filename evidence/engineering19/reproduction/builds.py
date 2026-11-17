import os, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent/'c16-candidate'
env = {k:v for k,v in os.environ.items() if not k.startswith('EXPO_PUBLIC_') and not re.search(r'(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY)', k, re.I)}
env.update(EXPO_NO_DOTENV='1', EXPO_PUBLIC_APP_ENV='development', EXPO_PUBLIC_SUPABASE_URL='https://blocked-supabase-url.invalid', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='__BLOCKED_PLACEHOLDER__')
cli = subprocess.check_output(['node','-p',"require.resolve('@expo/cli')"],cwd=REPO,text=True).strip()
result = subprocess.run(['node',cli,'export','--platform','web','--output-dir','../../.tmp/engineering19/mobile-web'],cwd=REPO/'apps/mobile',env=env)
raise SystemExit(result.returncode)
