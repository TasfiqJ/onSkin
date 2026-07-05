#!/usr/bin/env node
import { block, exists, printResult, read } from './lib.mjs';

const errors = [];
const warnings = [];

const workflowPath = '.github/workflows/security.yml';
block(errors, exists(workflowPath), 'Missing GitHub Actions security workflow.');

if (exists(workflowPath)) {
  const workflow = read(workflowPath);
  const workflowLines = workflow.split(/\r?\n/);
  const stepStarts = workflowLines
    .map((line, index) => {
      const match = line.match(/^(\s*)-\s+(?:name:|uses:|run:)/);
      return match ? { index, indent: match[1].length } : null;
    })
    .filter(Boolean);
  const workflowSteps = stepStarts.map((step, position) => {
    const nextStep = stepStarts.slice(position + 1).find((candidate) => candidate.indent <= step.indent);
    const end = nextStep?.index ?? workflowLines.length;
    return workflowLines.slice(step.index, end).join('\n');
  });
  const checkoutSteps = workflowSteps.filter((step) => /uses:\s*actions\/checkout@[^\s#]+/i.test(step));
  const artifactUploadSteps = workflowSteps.filter((step) => /uses:\s*actions\/upload-artifact@[^\s#]+/i.test(step));
  const runSteps = workflowSteps.filter((step) => /^\s*run:\s*/m.test(step));
  const actionUses = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
  const unpinnedActions = actionUses.filter((ref) => !ref.startsWith('./') && !ref.startsWith('docker://') && !/@[a-f0-9]{40}$/i.test(ref));
  block(errors, !/pull_request_target\s*:/.test(workflow), 'Security workflow must not use pull_request_target.');
  block(errors, !/uses:\s*[^@\s]+@(main|master)\b/.test(workflow), 'Security workflow must not use floating @main/@master action refs.');
  block(errors, unpinnedActions.length === 0, `Security workflow actions must be pinned to immutable SHAs: ${unpinnedActions.join(', ')}.`);
  block(errors, /permissions:\s*\n\s*contents:\s*read/.test(workflow), 'Security workflow must use read-only contents permission.');
  block(
    errors,
    checkoutSteps.length > 0 && checkoutSteps.every((step) => /^\s*persist-credentials:\s*false\s*$/m.test(step)),
    'Every Security workflow checkout step must disable persisted credentials.',
  );
  block(errors, /denoland\/setup-deno@[a-f0-9]{40}/i.test(workflow), 'Security workflow must install Deno from an immutable action SHA.');
  block(errors, runSteps.some((step) => /\bnpm ci\b/.test(step)), 'Security workflow must install from the lockfile with npm ci.');
  block(errors, !runSteps.some((step) => /\bnpm install\b/.test(step)), 'Security workflow must not use npm install; use npm ci from the lockfile.');
  block(errors, /npm run phase9:verify/.test(workflow), 'Security workflow must run phase9:verify.');
  block(errors, /npm run phase9:edge-functions-check/.test(workflow) || /npm run phase9:verify/.test(workflow), 'Security workflow must run the Deno Edge Function check.');
  block(errors, /PHASE9_RUN_NPM_AUDIT/.test(workflow), 'Security workflow must generate dependency audit metadata.');
  block(errors, /npm audit --audit-level=high/.test(workflow), 'Security workflow must fail on high or critical npm advisories.');
  block(errors, /npm-audit-high\.json/.test(workflow), 'Security workflow must archive high/critical npm audit JSON evidence.');
  block(errors, /gitleaks\/gitleaks-action/.test(workflow), 'Security workflow must run Gitleaks.');
  block(errors, /trufflesecurity\/trufflehog@[a-f0-9]{40}/i.test(workflow), 'Security workflow must run TruffleHog on an immutable SHA.');
  block(errors, /semgrep\/semgrep-action/.test(workflow), 'Security workflow must run Semgrep.');
  block(errors, /google\/osv-scanner-action/.test(workflow), 'Security workflow must run OSV scanner.');
  block(errors, /actions\/upload-artifact@[a-f0-9]{40}/i.test(workflow), 'Security workflow must upload scanner evidence with immutable upload-artifact.');
  block(errors, artifactUploadSteps.length >= 3, 'Security workflow must upload code, secret, and static scanner evidence artifacts.');
  block(
    errors,
    artifactUploadSteps.length >= 3 &&
      artifactUploadSteps.every(
        (step) =>
          /path:\s*docs\/phase-9\/generated\/ci-scanner-evidence\//.test(step) &&
          /if-no-files-found:\s*error/.test(step) &&
          /retention-days:\s*30/.test(step),
      ),
    'Every scanner evidence artifact upload must use the CI scanner evidence path, fail on missing files, and retain artifacts for 30 days.',
  );
  block(
    errors,
    /code-gates-outcomes\.json/.test(workflow) &&
      /secret-scan-outcomes\.json/.test(workflow) &&
      /static-analysis-outcomes\.json/.test(workflow),
    'Security workflow must write scanner outcome manifests for code, secret, and static-analysis jobs.',
  );
  block(
    errors,
    /steps\.phase9_verify\.outcome/.test(workflow) &&
      /steps\.dependency_sbom\.outcome/.test(workflow) &&
      /steps\.npm_audit_high\.outcome/.test(workflow) &&
      /steps\.gitleaks\.outcome/.test(workflow) &&
      /steps\.trufflehog\.outcome/.test(workflow) &&
      /steps\.semgrep\.outcome/.test(workflow) &&
      /steps\.osv\.outcome/.test(workflow),
    'Security workflow must record every scanner/gate step outcome in evidence manifests.',
  );
  block(
    errors,
    /test "\$\{\{ steps\.phase9_verify\.outcome \}\}" = "success"/.test(workflow) &&
      /test "\$\{\{ steps\.dependency_sbom\.outcome \}\}" = "success"/.test(workflow) &&
      /test "\$\{\{ steps\.npm_audit_high\.outcome \}\}" = "success"/.test(workflow) &&
      /test "\$\{\{ steps\.gitleaks\.outcome \}\}" = "success"/.test(workflow) &&
      /test "\$\{\{ steps\.trufflehog\.outcome \}\}" = "success"/.test(workflow) &&
      /test "\$\{\{ steps\.semgrep\.outcome \}\}" = "success"/.test(workflow) &&
      /test "\$\{\{ steps\.osv\.outcome \}\}" = "success"/.test(workflow),
    'Security workflow must enforce gate and scanner outcomes after uploading evidence.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-supabase-adversarial:strict/.test(workflow),
    'Live Supabase adversarial CI job must be manual-only and strict.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-edge-auth:strict/.test(workflow) &&
      /PHASE9_RUN_LIVE_EDGE_AUTH/.test(workflow) &&
      /STAGING_SUPABASE_SERVICE_ROLE_KEY/.test(workflow),
    'Live Edge auth CI job must be manual-only, strict, and use staging Supabase secrets.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-data-rights:strict/.test(workflow) &&
      /PHASE9_RUN_LIVE_DATA_RIGHTS/.test(workflow) &&
      /PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX/.test(workflow) &&
      /DATA_EXPORT_PHOTO_URL_TTL_SECONDS/.test(workflow) &&
      /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK/.test(workflow) &&
      /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS/.test(workflow) &&
      /STAGING_SUPABASE_SERVICE_ROLE_KEY/.test(workflow),
    'Live data-rights CI job must be manual-only, strict, use staging Supabase secrets, and include bounded data-export rate-limit and signed-URL expiry probes.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-consent-withdrawal:strict/.test(workflow) &&
      /PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL/.test(workflow) &&
      /STAGING_SUPABASE_SERVICE_ROLE_KEY/.test(workflow),
    'Live consent-withdrawal CI job must be manual-only, strict, and use staging Supabase secrets.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-public-forms:strict/.test(workflow) &&
      /PHASE9_RUN_LIVE_PUBLIC_FORMS/.test(workflow) &&
      /PHASE9_TURNSTILE_VALID_TOKEN/.test(workflow) &&
      /PUBLIC_FORMS_MAX_BYTES/.test(workflow) &&
      /PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX/.test(workflow),
    'Live public-forms CI job must be manual-only, strict, include Turnstile evidence, a body-size cap, and a bounded rate-limit probe max.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-catalog-rate-limit:strict/.test(workflow) &&
      /PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT/.test(workflow) &&
      /PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX/.test(workflow),
    'Live catalog rate-limit CI job must be manual-only, strict, and bounded by an explicit probe max.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-order-report-poll:strict/.test(workflow) &&
      /PHASE9_RUN_LIVE_ORDER_REPORT_POLL/.test(workflow) &&
      /PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED/.test(workflow) &&
      !/ORDER_REPORT_POLL_SECRET:\s*\$\{\{\s*secrets\./.test(workflow),
    'Live order-report-poll CI job must be manual-only, strict, expectation-driven, and must not expose the real scheduler secret.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-revenuecat-webhook:strict/.test(workflow) &&
      /STAGING_REVENUECAT_WEBHOOK_AUTH/.test(workflow) &&
      /STAGING_REVENUECAT_WEBHOOK_SIGNING_SECRET/.test(workflow) &&
      /STAGING_REVENUECAT_WEBHOOK_MAX_BYTES/.test(workflow),
    'Live RevenueCat webhook CI job must be manual-only, strict, and use staging webhook secrets plus max-body config.',
  );
  block(
    errors,
    /STAGING_SUPABASE_SERVICE_ROLE_KEY/.test(workflow) && !/pull_request_target\s*:/.test(workflow),
    'Live Supabase job must use staging service-role secret only outside pull_request_target.',
  );
}

printResult('Phase 9 security CI smoke', errors, warnings);
