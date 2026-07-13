param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF,
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
  throw "SUPABASE_PROJECT_REF is required. Set it to the staging project ref before deploying."
}
if ($ProjectRef -notmatch '^[a-z0-9]{20}$') {
  throw "SUPABASE_PROJECT_REF_INVALID"
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "SUPABASE_CLI_UNAVAILABLE"
}

$manifestPath = Join-Path $PSScriptRoot "..\..\supabase\functions\manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Edge Function manifest is missing: $manifestPath"
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$functionEntries = @(
  $manifest.functions.PSObject.Properties |
    Where-Object { $_.Value.deployByDefault -eq $true } |
    Sort-Object Name
)
if ($functionEntries.Count -eq 0) {
  throw "Edge Function manifest has no deployByDefault functions."
}

$missingSecrets = @()
foreach ($entry in $functionEntries) {
  foreach ($group in $entry.Value.requiredSecrets) {
    $names = @($group)
    $hasAny = $false
    foreach ($name in $names) {
      if ([Environment]::GetEnvironmentVariable("$name")) {
        $hasAny = $true
        break
      }
    }
    if (-not $hasAny) {
      $missingSecrets += "$($entry.Name): one of [$($names -join ', ')]"
    }
  }
}

if ($missingSecrets.Count -gt 0) {
  Write-Warning "Required Edge Function secret groups not set in this shell: $($missingSecrets -join '; ')"
  Write-Warning "Set them in Supabase with: supabase secrets set NAME=value --project-ref $ProjectRef"
}

if ($PSBoundParameters.ContainsKey("DeployCommerce")) {
  Write-Warning "-DeployCommerce is retained for command compatibility; every manifest function is now deployed."
}

Write-Host "Validating declarative Edge Function manifest"
node scripts/phase9/edge-function-manifest-check.mjs
if ($LASTEXITCODE -ne 0) {
  throw "Edge Function manifest validation failed."
}

Write-Host "Linking Supabase project $ProjectRef"
supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) {
  throw "SUPABASE_LINK_FAILED"
}

Write-Host "Setting the explicit Edge Function app environment"
supabase secrets set "APP_ENV=$appEnv" "EXPO_PUBLIC_APP_ENV=$appEnv" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) {
  throw "APP_ENV_REMOTE_CONFIGURATION_FAILED"
}

Write-Host "Pushing migrations"
supabase db push
if ($LASTEXITCODE -ne 0) {
  throw "SUPABASE_DB_PUSH_FAILED"
}

Write-Host "Deploying every manifest Edge Function"
foreach ($entry in $functionEntries) {
  supabase functions deploy $entry.Name --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) {
    throw "SUPABASE_FUNCTION_DEPLOY_FAILED:$($entry.Name)"
  }
}

Write-Host "Generating local database types"
$typesPath = Join-Path $PSScriptRoot "..\..\packages\types\src\database.types.ts"
$typesTempPath = "$typesPath.pending-$PID"
try {
  $generatedTypes = @(& supabase gen types typescript --linked --schema public)
  if ($LASTEXITCODE -ne 0) {
    throw "SUPABASE_TYPE_GENERATION_FAILED"
  }
  $generatedTypesText = (($generatedTypes -join "`n").TrimEnd() + "`n")
  if ($generatedTypesText.Length -lt 100 -or $generatedTypesText -notmatch 'export type Database') {
    throw "SUPABASE_TYPE_GENERATION_INVALID"
  }
  [System.IO.File]::WriteAllText(
    $typesTempPath,
    $generatedTypesText,
    [System.Text.UTF8Encoding]::new($false)
  )
  Move-Item -LiteralPath $typesTempPath -Destination $typesPath -Force
} finally {
  if (Test-Path -LiteralPath $typesTempPath) {
    Remove-Item -LiteralPath $typesTempPath -Force
  }
}

Write-Host "Run npm run phase2:rls-smoke against this staging project before any EAS production build."
