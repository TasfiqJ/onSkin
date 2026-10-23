# Canonical DB / ECR custody boundary

The contract requires `public.ecr.aws/supabase/postgres:15.8.1.085` and checks the original ECR RepoDigest, immutable image/platform, and full container proof. Provider Quality image acquisition failed with `Error response from daemon: error from registry: Data limit exceeded`. The public ECR image is not replaceable by DockerHub, local PG15/17, GHCR mirror, an ad hoc export/load, or altered `RepoDigests`.

Codex may use the provider logs and original source contract read-only. **Do not call `docker pull`, `docker login`, `aws ecr`, hosted Supabase, staging credentials, or any paid API.** Do not mutate quota/accounts, images, workflows, Dockerfiles or tests. A local pre-existing image cannot replace the provider's original test.

Deliver a simple issuer/custodian action request whose returned evidence could actually validate authorized image acquisition (or an authenticated refusal) without transmitting credentials to chat. `ECR_CUSTODY.md` must not say fixed or green unless legitimate original CI later proves it.
