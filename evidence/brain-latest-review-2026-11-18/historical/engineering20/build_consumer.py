import os, subprocess
from pathlib import Path
repo = Path(__file__).resolve().parent.parent / 'c16-candidate'
env = dict(os.environ, EXPO_OFFLINE='1', EXPO_NO_DOTENV='1')
cli = subprocess.check_output(['node', '-p', "require.resolve('@expo/cli')"], cwd=repo, text=True).strip()
raise SystemExit(subprocess.run(['node', cli, 'export', '--platform', 'web', '--output-dir', '../../.tmp/engineering20/mobile-web'], cwd=repo/'apps/mobile', env=env).returncode)
