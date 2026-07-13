param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF,
  [switch]$DeployCommerce
)

$ErrorActionPreference = "Stop"

function Read-AppEnvironment {
  $raw = $env:EXPO_PUBLIC_APP_ENV
  if (-not $raw) { $raw = $env:APP_ENV }
  if (-not $raw) { $raw = $env:APP_VARIANT }
  $candidate = "$raw".Trim().ToLowerInvariant()
  if (@("development", "staging", "production") -contains $candidate) { return $candidate }
  return "production"
}

if (-not $ProjectRef) {
  throw "SUPABASE_PROJECT_REF is required. Set it to the staging project ref before deploying."
}

$appEnv = Read-AppEnvironment
if ($appEnv -eq "production" -and $env:PHASE2_ALLOW_PRODUCTION_DEPLOY -ne "1") {
  throw "Refusing production deploy without PHASE2_ALLOW_PRODUCTION_DEPLOY=1."
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

Write-Host "Pushing migrations"
supabase db push

Write-Host "Deploying every manifest Edge Function"
foreach ($entry in $functionEntries) {
  supabase functions deploy $entry.Name --project-ref $ProjectRef
}

Write-Host "Generating local database types"
supabase gen types typescript --linked --schema public > packages/types/src/database.types.ts

Write-Host "Run npm run phase2:rls-smoke against this staging project before any EAS production build."
