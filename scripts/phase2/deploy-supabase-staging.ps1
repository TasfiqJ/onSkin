param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF,
  [string]$OperatorRole = $env:DB06_OPERATOR_ROLE,
  [string]$RollbackRef = $env:DB06_ROLLBACK_REF,
  [string]$CutoverRecord = $env:DB06_CUTOVER_RECORD,
  [string]$CutoverEvidenceDirectory = $env:DB06_CUTOVER_EVIDENCE_DIR,
  [string]$EvidenceId = $env:DB06_EVIDENCE_ID,
  [switch]$DeployCommerce
)

$ErrorActionPreference = "Stop"

function Read-AppEnvironment {
  $helperPath = Join-Path $PSScriptRoot "read-edge-app-environment.ts"
  if (-not (Test-Path -LiteralPath $helperPath)) {
    throw "APP_ENV_VALIDATION_UNAVAILABLE"
  }
  if (-not (Get-Command deno -ErrorAction SilentlyContinue)) {
    throw "APP_ENV_VALIDATION_UNAVAILABLE"
  }

  $helperOutput = @(& deno run --no-config --quiet "--allow-env=APP_ENV,EXPO_PUBLIC_APP_ENV" $helperPath 2>$null)
  $helperExitCode = $LASTEXITCODE
  $result = "$($helperOutput | Select-Object -Last 1)".Trim()
  if ($helperExitCode -ne 0) {
    if (@(
      "APP_ENV_NOT_CONFIGURED",
      "APP_ENV_INVALID",
      "EXPO_PUBLIC_APP_ENV_INVALID",
      "APP_ENV_CONFLICT"
    ) -contains $result) {
      throw $result
    }
    throw "APP_ENV_VALIDATION_FAILED"
  }
  if (@("development", "staging", "production") -notcontains $result) {
    throw "APP_ENV_VALIDATION_FAILED"
  }
  return $result
}

$appEnv = Read-AppEnvironment
if ($appEnv -ne "staging") {
  throw "STAGING_DEPLOY_REQUIRES_APP_ENV_STAGING"
}
if (-not $ProjectRef) {
  throw "SUPABASE_PROJECT_REF_REQUIRED"
}
if ($ProjectRef -notmatch '^[a-z0-9]{20}$') {
  throw "SUPABASE_PROJECT_REF_INVALID"
}
if ($env:PHASE9_EXPECTED_SUPABASE_PROJECT_REF -ne $ProjectRef) {
  throw "EXPECTED_SUPABASE_PROJECT_REF_MISMATCH"
}
if (-not $OperatorRole) {
  throw "DB06_OPERATOR_ROLE_REQUIRED"
}
if (-not $RollbackRef) {
  throw "DB06_ROLLBACK_REF_REQUIRED"
}
if (-not $CutoverRecord) {
  throw "DB06_CUTOVER_RECORD_REQUIRED"
}
if (-not $CutoverEvidenceDirectory) {
  throw "DB06_CUTOVER_EVIDENCE_DIRECTORY_REQUIRED"
}
if (-not (Test-Path -LiteralPath $CutoverRecord -PathType Leaf)) {
  throw "DB06_CUTOVER_RECORD_UNAVAILABLE"
}
if (-not (Test-Path -LiteralPath $CutoverEvidenceDirectory -PathType Container)) {
  throw "DB06_CUTOVER_EVIDENCE_DIRECTORY_UNAVAILABLE"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "NODE_RUNTIME_UNAVAILABLE"
}

if ($PSBoundParameters.ContainsKey("DeployCommerce")) {
  Write-Warning "-DeployCommerce is retained for command compatibility; the reviewed manifest is always deployed in full."
}

$orchestratorPath = Join-Path $PSScriptRoot "deploy-supabase-staging.mjs"
if (-not (Test-Path -LiteralPath $orchestratorPath -PathType Leaf)) {
  throw "DB06_DEPLOY_ORCHESTRATOR_UNAVAILABLE"
}

$arguments = @(
  $orchestratorPath,
  "--project-ref", $ProjectRef,
  "--operator-role", $OperatorRole,
  "--rollback-ref", $RollbackRef,
  "--cutover-record", (Resolve-Path -LiteralPath $CutoverRecord).Path,
  "--cutover-evidence-dir", (Resolve-Path -LiteralPath $CutoverEvidenceDirectory).Path
)
if ($EvidenceId) {
  $arguments += @("--evidence-id", $EvidenceId)
}

$previousPowerShellVersion = $env:DB06_POWERSHELL_VERSION
try {
  $env:DB06_POWERSHELL_VERSION = $PSVersionTable.PSVersion.ToString()
  & node @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "DB06_STAGING_DEPLOY_FAILED"
  }
} finally {
  $env:DB06_POWERSHELL_VERSION = $previousPowerShellVersion
}
