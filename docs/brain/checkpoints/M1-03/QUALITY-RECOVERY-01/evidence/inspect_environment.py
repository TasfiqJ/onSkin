"""Content-free environment, installed dependency and immutable input identities."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess

root = Path.cwd()
def cmd(*args):
    return subprocess.check_output(args).decode().strip()
names = ['expo', 'expo-network', '@expo/cli', '@expo/config-plugins', 'expo-modules-core',
         'expo-modules-jsi', '@expo/ui', 'expo-router', 'expo-sharing', 'expo-widgets',
         'react-native', 'xcode', 'metro-runtime']
installed = {}
for name in names:
    path = root / 'node_modules' / name / 'package.json'
    installed[name] = json.loads(path.read_bytes())['version'] if path.exists() else None
value = dict(platform=platform.platform(), python=platform.python_version(), node=cmd('node', '--version'),
             npm=cmd('npm', '--version'), npm_binary=cmd('which', 'npm'), ci=os.environ.get('CI'),
             source_commit=cmd('git', 'rev-parse', 'HEAD'), source_tree=cmd('git', 'rev-parse', 'HEAD^{tree}'),
             installed=installed, package_count=len(list((root / 'node_modules').glob('*/package.json'))) +
             len(list((root / 'node_modules').glob('@*/*/package.json'))),
             sha256={name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in
                     ['apps/mobile/package.json', 'package.json', 'package-lock.json']},
             official_check='npx expo install --check', doctor='npx --yes expo-doctor@1.21.5',
             reference='https://docs.expo.dev/more/expo-cli/#install', admission='NONE')
print(json.dumps(value, indent=2))
