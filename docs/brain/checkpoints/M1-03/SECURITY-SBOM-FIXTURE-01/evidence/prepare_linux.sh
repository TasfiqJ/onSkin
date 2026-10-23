#!/usr/bin/env bash
set -euo pipefail
task_repo=/tmp/onskin-security-sbom-fixture01-20261022
test ! -e "$task_repo"
git clone --no-hardlinks --branch stage/m1-gate-recovery /mnt/c/Users/jasim/Documents/ChatGPT/MasterV2Code/postmerge-gate-triage01-stage "$task_repo"
test "$(git -C "$task_repo" rev-parse HEAD)" = bfa2cf14110e701937d4b50b063565f3dea34f8a
task_tools=/tmp/onskin-security-sbom-fixture01-tools
mkdir -p "$task_tools"
cd "$task_tools"
curl -fL --max-time 90 -o node-v22.21.0-linux-x64.tar.xz https://nodejs.org/dist/v22.21.0/node-v22.21.0-linux-x64.tar.xz
curl -fL --max-time 30 -o SHASUMS256.txt https://nodejs.org/dist/v22.21.0/SHASUMS256.txt
awk '$2 == "node-v22.21.0-linux-x64.tar.xz"' SHASUMS256.txt | sha256sum -c -
tar -xJf node-v22.21.0-linux-x64.tar.xz
./node-v22.21.0-linux-x64/bin/node --version
python3.12 --version
