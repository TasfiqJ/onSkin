# Cloud-only setup — no Windows/WSL dependency

## Founder setup in Codex Cloud (outside engineering prompt)

In ChatGPT/Codex on web or desktop, choose **Work in > Cloud** and select an existing **published** private cloud environment with GitHub repo `TasfiqJ/onSkin`, or choose **Create environment**. Select only that repository and connect GitHub if prompted. Let Codex inspect/setup the environment; request Node.js 22.x, Python 3.12.x, Git, npm, and basic Unix tooling (`tar`, `gzip`, `unzip`, `jq`) as needed. The repo's lockfiles determine project dependencies: prefer `npm ci` in isolated Linux. Inspect setup, publish, then start the cloud task in that environment. The setup should not create or commit repository source changes. If it does, discard setup source changes rather than publishing them as authorization.

Use private environment **Only me**, without PHI/patient/JANUS inputs and **no credentials** for Supabase, patient services, paid APIs, signing or registries. GitHub access is via the authorized account connection; repository write/push permissions are separate and must be verified. Do not paste GitHub tokens into task text.

For setup-only dependency installation, enable the **Package managers** internet preset where workspace rules permit it. This preset includes npm, PyPI, GitHub source/archive endpoints and Ubuntu/Debian package repositories. Add **only** `api.github.com` and (if actually required) `raw.githubusercontent.com` in Additional allowed domains for authenticated public GitHub metadata; never use unrestricted egress by default. All external source downloads must be pinned and hash-verified per the project. No network secrets or outbound identity is needed. Packages must be installed without weakening the sealed candidate no-network runtime. If trusted setup already provides all tools, leave unnecessary network access disabled.

## Engineering cloud preflight

1. Check repository identity/ref/tree, existing clean workspace, current CPU/memory/disk space of **cloud VM only**, `python3`, Node/npm/Git versions and ability to fetch required authorized Git history. Record the cloud identity and limits in a safe receipt; do not enforce a Windows C: threshold.
2. Inspect capability of temporary Git object pool, real historical blob import, `unshare`/namespace or existing capsule network isolation, ability to launch original pinned scanner without accidental network egress. Test an actual denied outbound network attempt. If a required capability is unavailable, mark **BLOCKED_CLOUD_CAPABILITY**, not an untested PASS; do not circumvent sandbox controls.
3. Use original GitHub Actions for independent Original Quality / Security / iOS / PostgreSQL job evidence, including Docker-backed original CI. Never claim these as local Codex execution. This source-only issuance does not authorize a new CI workflow or a self-hosted paid runner.
4. Keep the private 66-wheel graph, raw candidates and full scanner logs out of source control when sensitive; commit only bounded redacted deterministic evidence. No cloud file cleanup outside task-owned disposable temporary artifacts; never touch/retry the Windows cleanup rejected by policy.

## Cost & privacy

No upgrades, paid third-party compute, top-ups, credit purchases, paid provider calls, native signing, remote databases or ECR credential work. Normal included Codex/GitHub allowances are subject to the user's plan/workspace limits; if a paid action is required, STOP and report instead of authorizing expense. Codex Cloud is not covered by an OpenAI BAA: **never ingest PHI or individually restricted JANUS/patient records**.

Official cloud environment setup: https://developers.openai.com/codex/environments/cloud-environments
