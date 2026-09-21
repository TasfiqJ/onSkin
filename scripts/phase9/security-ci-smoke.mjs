#!/usr/bin/env node
import { block, exists, printResult, read } from './lib.mjs';

const errors = [];
const warnings = [];

const workflowPath = '.github/workflows/security.yml';
const liveEdgeAuthPath = 'scripts/phase9/live-edge-auth.mjs';
const liveDataRightsPath = 'scripts/phase9/live-data-rights.mjs';
block(errors, exists(workflowPath), 'Missing GitHub Actions security workflow.');
block(errors, exists(liveEdgeAuthPath), 'Missing live Edge auth harness.');
block(errors, exists(liveDataRightsPath), 'Missing live data-rights harness.');

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
    const nextStep = stepStarts
      .slice(position + 1)
      .find((candidate) => candidate.indent <= step.indent);
    const end = nextStep?.index ?? workflowLines.length;
    return workflowLines.slice(step.index, end).join('\n');
  });
  const checkoutSteps = workflowSteps.filter((step) =>
    /uses:\s*actions\/checkout@[^\s#]+/i.test(step),
  );
  const artifactUploadSteps = workflowSteps.filter((step) =>
    /uses:\s*actions\/upload-artifact@[^\s#]+/i.test(step),
  );
  const scannerArtifactUploadSteps = artifactUploadSteps.filter((step) =>
    /path:\s*docs\/phase-9\/generated\/ci-scanner-evidence\//.test(step),
  );
  const accountDeletionArtifactUploadSteps = artifactUploadSteps.filter((step) =>
    /account-deletion-live-evidence-/.test(step),
  );
  const trufflehogSteps = workflowSteps.filter((step) =>
    /uses:\s*trufflesecurity\/trufflehog@[^\s#]+/i.test(step),
  );
  const runSteps = workflowSteps.filter((step) => /^\s*run:\s*/m.test(step));
  const actionUses = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
  const unpinnedActions = actionUses.filter(
    (ref) => !ref.startsWith('./') && !ref.startsWith('docker://') && !/@[a-f0-9]{40}$/i.test(ref),
  );
  block(
    errors,
    !/pull_request_target\s*:/.test(workflow),
    'Security workflow must not use pull_request_target.',
  );
  block(
    errors,
    !/uses:\s*[^@\s]+@(main|master)\b/.test(workflow),
    'Security workflow must not use floating @main/@master action refs.',
  );
  block(
    errors,
    unpinnedActions.length === 0,
    `Security workflow actions must be pinned to immutable SHAs: ${unpinnedActions.join(', ')}.`,
  );
  block(
    errors,
    /permissions:\s*\n\s*contents:\s*read/.test(workflow),
    'Security workflow must use read-only contents permission.',
  );
  block(
    errors,
    checkoutSteps.length > 0 &&
      checkoutSteps.every((step) => /^\s*persist-credentials:\s*false\s*$/m.test(step)),
    'Every Security workflow checkout step must disable persisted credentials.',
  );
  block(
    errors,
    /denoland\/setup-deno@[a-f0-9]{40}/i.test(workflow),
    'Security workflow must install Deno from an immutable action SHA.',
  );
  block(
    errors,
    runSteps.some((step) => /\bnpm ci\b/.test(step)),
    'Security workflow must install from the lockfile with npm ci.',
  );
  block(
    errors,
    !runSteps.some((step) => /\bnpm install\b/.test(step)),
    'Security workflow must not use npm install; use npm ci from the lockfile.',
  );
  block(
    errors,
    /npm run phase9:verify/.test(workflow),
    'Security workflow must run phase9:verify.',
  );
  block(
    errors,
    /npm run phase9:edge-functions-check/.test(workflow) || /npm run phase9:verify/.test(workflow),
    'Security workflow must run the Deno Edge Function check.',
  );
  block(
    errors,
    /PHASE9_RUN_NPM_AUDIT/.test(workflow),
    'Security workflow must generate dependency audit metadata.',
  );
  block(
    errors,
    /npm audit --audit-level=high/.test(workflow),
    'Security workflow must fail on high or critical npm advisories.',
  );
  block(
    errors,
    /npm-audit-high\.json/.test(workflow),
    'Security workflow must archive high/critical npm audit JSON evidence.',
  );
  block(errors, /gitleaks\/gitleaks-action/.test(workflow), 'Security workflow must run Gitleaks.');
  block(
    errors,
    /trufflesecurity\/trufflehog@[a-f0-9]{40}/i.test(workflow),
    'Security workflow must run TruffleHog on an immutable SHA.',
  );
  block(
    errors,
    trufflehogSteps.length > 0 &&
      trufflehogSteps.every((step) => !/^\s+(?:base|head):\s*/m.test(step)),
    'TruffleHog must use event-derived base/head SHAs; hard-coded base/head inputs break pushes to main.',
  );
  block(
    errors,
    /pipx install semgrep==\d+\.\d+\.\d+/.test(workflow) &&
      /\bsemgrep scan --error\b/.test(workflow) &&
      ['p/owasp-top-ten', 'p/typescript', 'p/react', 'p/secrets'].every((ruleset) =>
        workflow.includes(`--config ${ruleset}`),
      ) &&
      !/semgrep\/semgrep-action/.test(workflow),
    'Security workflow must run a pinned Semgrep CLI with the OWASP, TypeScript, React, and secrets rulesets.',
  );
  block(
    errors,
    /google\/osv-scanner-action/.test(workflow),
    'Security workflow must run OSV scanner.',
  );
  block(
    errors,
    /actions\/upload-artifact@[a-f0-9]{40}/i.test(workflow),
    'Security workflow must upload scanner evidence with immutable upload-artifact.',
  );
  block(
    errors,
    scannerArtifactUploadSteps.length >= 3,
    'Security workflow must upload code, secret, and static scanner evidence artifacts.',
  );
  block(
    errors,
    scannerArtifactUploadSteps.length >= 3 &&
      scannerArtifactUploadSteps.every(
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
      /PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION:\s*'true'/.test(workflow) &&
      /PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX/.test(workflow) &&
      /DATA_EXPORT_PHOTO_URL_TTL_SECONDS/.test(workflow) &&
      /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK/.test(workflow) &&
      /PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS/.test(workflow) &&
      /STAGING_SUPABASE_SERVICE_ROLE_KEY/.test(workflow),
    'Live data-rights CI job must be manual-only, strict, explicitly authorize disposable-account deletion, use staging Supabase secrets, and include bounded data-export rate-limit and signed-URL expiry probes.',
  );
  block(
    errors,
    /if:\s*github\.event_name == 'workflow_dispatch'/.test(workflow) &&
      /npm run phase9:live-consent-withdrawal:strict/.test(workflow) &&
      /PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL/.test(workflow) &&
      /id:\s*live_consent_withdrawal/.test(workflow) &&
      /STAGING_SUPABASE_SERVICE_ROLE_KEY/.test(workflow),
    'Live consent-withdrawal CI job must be manual-only, strict, outcome-addressable, and use staging Supabase secrets.',
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
      !/PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED/.test(workflow) &&
      !/(?:SHOPMY_BRAND_API_KEY|SHOPMY_BRAND_DOMAIN|ORDER_REPORT_POLL_SECRET):\s*\$\{\{/.test(
        workflow,
      ),
    'Live order-report-poll CI job must be manual-only, strict, and free of commerce activation/provider credentials.',
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
  const liveJob = workflow.match(/\n  live-supabase-adversarial:[\s\S]*$/)?.[0] ?? '';
  block(
    errors,
    /environment:\s*staging-security/.test(liveJob) &&
      /^\s+APP_ENV:\s*staging\s*$/m.test(liveJob) &&
      /^\s+EXPO_PUBLIC_APP_ENV:\s*staging\s*$/m.test(liveJob) &&
      /PHASE9_EXPECTED_SUPABASE_PROJECT_REF:\s*\$\{\{\s*vars\.STAGING_SUPABASE_PROJECT_REF\s*\}\}/.test(
        liveJob,
      ) &&
      !/PHASE9_EXPECTED_SUPABASE_PROJECT_REF:\s*\$\{\{\s*secrets\./.test(liveJob),
    'Protected live evidence must bind exact staging environment labels to the independently reviewed non-secret STAGING_SUPABASE_PROJECT_REF environment variable.',
  );
  block(
    errors,
    /confirm_destructive_account_deletion:\s*\n[\s\S]{0,240}default:\s*false[\s\S]{0,120}type:\s*boolean/.test(
      workflow,
    ) &&
      /if:\s*github\.event_name == 'workflow_dispatch' && inputs\.confirm_destructive_account_deletion == true/.test(
        liveJob,
      ) &&
      /environment:\s*staging-security/.test(liveJob),
    'Destructive deletion must require an explicit false-by-default manual input and protected staging-security review.',
  );
  block(
    errors,
    (workflow.match(/PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION/g) ?? []).length === 1 &&
      /PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION:\s*'true'/.test(liveJob),
    'Destructive deletion authorization must appear only inside the protected manual live job.',
  );
  block(
    errors,
    /ios_build_id:/.test(workflow) &&
      /PHASE5_IOS_BUILD_ID:\s*\$\{\{ inputs\.ios_build_id \}\}/.test(liveJob) &&
      !/android_build_id:|PHASE5_ANDROID_BUILD_ID/.test(liveJob),
    'The iOS-only launch contract may accept an optional iOS build ID but must not request Android live evidence.',
  );
  for (const field of [
    'PHASE9_EVIDENCE_SOURCE_SHA',
    'PHASE9_EVIDENCE_WORKFLOW_RUN_ID',
    'PHASE9_EVIDENCE_WORKFLOW_RUN_ATTEMPT',
    'PHASE9_EVIDENCE_REF',
    'PHASE9_EVIDENCE_ACTOR',
    'PHASE9_EVIDENCE_TRIGGERING_ACTOR',
    'PHASE9_EVIDENCE_REPOSITORY',
    'PHASE9_EVIDENCE_WORKFLOW',
    'PHASE9_EVIDENCE_EVENT',
  ]) {
    block(errors, liveJob.includes(field), `Protected live evidence job is missing ${field}.`);
  }
  block(
    errors,
    /Remove stale protected live evidence/.test(liveJob) &&
      /live-edge-auth\.json/.test(liveJob) &&
      /live-data-rights\.json/.test(liveJob) &&
      /live-consent-withdrawal\.json/.test(liveJob),
    'Protected live job must remove tracked/stale account-deletion and consent-withdrawal evidence before execution.',
  );
  block(
    errors,
    accountDeletionArtifactUploadSteps.length === 1 &&
      accountDeletionArtifactUploadSteps.every(
        (step) =>
          /if:\s*always\(\)/.test(step) &&
          /live-edge-auth\.json/.test(step) &&
          /live-data-rights\.json/.test(step) &&
          /live-consent-withdrawal\.json/.test(step) &&
          /account-deletion-live-outcomes\.json/.test(step) &&
          /if-no-files-found:\s*error/.test(step) &&
          /retention-days:\s*30/.test(step),
      ),
    'Protected live job must always upload bounded, redacted account-deletion and consent-withdrawal evidence plus its outcome manifest.',
  );
  block(
    errors,
    /PHASE9_EVIDENCE_ACTOR/.test(liveJob) &&
      /PHASE9_EVIDENCE_TRIGGERING_ACTOR/.test(liveJob) &&
      /PHASE9_EVIDENCE_REPOSITORY/.test(liveJob) &&
      /PHASE9_EVIDENCE_WORKFLOW/.test(liveJob) &&
      /PHASE9_EVIDENCE_EVENT/.test(liveJob) &&
      /LIVE_EDGE_AUTH_OUTCOME/.test(liveJob) &&
      /LIVE_DATA_RIGHTS_OUTCOME/.test(liveJob) &&
      /LIVE_CONSENT_WITHDRAWAL_OUTCOME/.test(liveJob) &&
      /liveConsentWithdrawal/.test(liveJob),
    'Live outcome manifest must bind authorization identity and all three protected live step outcomes.',
  );
  block(
    errors,
    /Enforce protected live evidence results/.test(liveJob) &&
      /test "\$LIVE_EDGE_AUTH_OUTCOME" = "success"/.test(liveJob) &&
      /test "\$LIVE_DATA_RIGHTS_OUTCOME" = "success"/.test(liveJob) &&
      /test "\$LIVE_CONSENT_WITHDRAWAL_OUTCOME" = "success"/.test(liveJob) &&
      /live-consent-withdrawal\.json/.test(liveJob) &&
      /evidence\.schemaVersion !== 2/.test(liveJob) &&
      /evidence\.sourceTreeClean !== true/.test(liveJob) &&
      /evidence\.checkManifest\.names\.length !== 8/.test(liveJob) &&
      /evidence\.status !== 'pass'/.test(liveJob) &&
      /evidence\.sourceSha !== process\.env\.PHASE9_EVIDENCE_SOURCE_SHA/.test(liveJob) &&
      /evidence\.triggeringActor !== process\.env\.PHASE9_EVIDENCE_TRIGGERING_ACTOR/.test(
        liveJob,
      ) &&
      /evidence\.expectedSupabaseProjectRef !== process\.env\.PHASE9_EXPECTED_SUPABASE_PROJECT_REF/.test(
        liveJob,
      ) &&
      /evidence\.actualSupabaseProjectRef !== process\.env\.PHASE9_EXPECTED_SUPABASE_PROJECT_REF/.test(
        liveJob,
      ) &&
      /evidence\.supabaseHost !== process\.env\.PHASE9_EXPECTED_SUPABASE_PROJECT_REF \+ '\.supabase\.co'/.test(
        liveJob,
      ),
    'Protected live job must fail unless all three harnesses pass and their uploaded revision, target, and exact consent-check metadata matches the run.',
  );
}

if (exists(liveEdgeAuthPath)) {
  const liveEdgeAuth = read(liveEdgeAuthPath);
  block(
    errors,
    /parseAccountDeletionPreflight/.test(liveEdgeAuth) &&
      /body: \{ action: 'preflight' \}/.test(liveEdgeAuth) &&
      /authenticated preflight returns only the exact owner-bound clear response/.test(
        liveEdgeAuth,
      ) &&
      /preflight rejects missing and invalid bearer credentials/.test(liveEdgeAuth) &&
      /preflight rejects a stale token after its Auth user is deleted/.test(liveEdgeAuth) &&
      /deleteUser\(stalePreflightUser\.id\)/.test(liveEdgeAuth) &&
      /exactObjectKeys\(body, \['status'\]\)/.test(liveEdgeAuth) &&
      /exactObjectKeys\(body, \['status', 'ownerSubject'\]\)/.test(liveEdgeAuth) &&
      /ACCOUNT_OWNER_SUBJECT_PATTERN\.test\(body\.ownerSubject\)/.test(liveEdgeAuth) &&
      /ACCOUNT_DELETION_SESSION_REJECTED/.test(liveEdgeAuth) &&
      /assertExactErrorCode/.test(liveEdgeAuth) &&
      /accepted clear without its authenticated owner/.test(liveEdgeAuth) &&
      /validator accepted active without its authenticated owner/.test(liveEdgeAuth),
    'Live Edge auth must validate exact authenticated owner-attested clear/active preflight schemas plus lane-specific missing, invalid, and stale rejection contracts.',
  );
  block(
    errors,
    /harnessErrorDetail\(error\)/.test(liveEdgeAuth) &&
      !/function resultError|error\.message|response\.text\.slice/.test(liveEdgeAuth),
    'Live Edge auth artifacts must never retain raw error messages or response bodies.',
  );
  block(
    errors,
    /await admin\.auth\.admin\.deleteUser\(user\.id\)[\s\S]*'catalog_corrections'[\s\S]*errors\.push\(`\$\{table\} cleanup left residual rows\.`\)/.test(
      liveEdgeAuth,
    ) &&
      /errors\.push\(`Edge auth user cleanup failed/.test(liveEdgeAuth) &&
      /strict && warnings\.length > 0/.test(liveEdgeAuth),
    'Live Edge auth must verify Auth-cascade cleanup for catalog corrections, and cleanup failures plus strict warnings must block pass artifacts.',
  );
}

for (const path of [liveEdgeAuthPath, liveDataRightsPath]) {
  if (!exists(path)) continue;
  const source = read(path);
  const exactAppEnvGate = source.indexOf("env.APP_ENV === 'staging'");
  const exactTargetGate = source.indexOf('supabaseTarget.valid');
  const adminClientCreation = source.indexOf('const admin = createClient');
  block(
    errors,
    /const supabaseUrl = env\.SUPABASE_URL;/.test(source) &&
      !/SUPABASE_URL \?\? env\.EXPO_PUBLIC_SUPABASE_URL/.test(source) &&
      /resolveHostedSupabaseProjectTarget\(\s*supabaseUrl,\s*env\.PHASE9_EXPECTED_SUPABASE_PROJECT_REF/.test(
        source,
      ) &&
      exactAppEnvGate >= 0 &&
      exactTargetGate >= 0 &&
      adminClientCreation >= 0 &&
      exactAppEnvGate < adminClientCreation &&
      exactTargetGate < adminClientCreation &&
      /expectedSupabaseProjectRef:\s*supabaseTarget\.expectedProjectRef/.test(source) &&
      /actualSupabaseProjectRef:\s*supabaseTarget\.actualProjectRef/.test(source),
    `${path} must fail on a non-staging or unreviewed canonical Supabase target before creating its admin client and record only safe target provenance.`,
  );
  block(
    errors,
    /sourceSha: evidenceContext\.sourceSha/.test(source) &&
      /workflowRunId: evidenceContext\.workflowRunId/.test(source) &&
      /workflowRunAttempt: evidenceContext\.workflowRunAttempt/.test(source) &&
      /actor: evidenceContext\.actor/.test(source) &&
      /triggeringActor: evidenceContext\.triggeringActor/.test(source) &&
      /repository: evidenceContext\.repository/.test(source) &&
      /workflow: evidenceContext\.workflow/.test(source) &&
      /event: evidenceContext\.event/.test(source) &&
      /PHASE5_IOS_BUILD_ID/.test(source) &&
      !/PHASE5_ANDROID_BUILD_ID/.test(source),
    `${path} must bind exact workflow authorization metadata and optional iOS-only build evidence.`,
  );
}

printResult('Phase 9 security CI smoke', errors, warnings);
