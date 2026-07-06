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

$requiredSecrets = @(
  "SUPABASE_SECRET_KEY",
  "REVENUECAT_WEBHOOK_AUTH",
  "APPLE_TEAM_ID",
  "APPLE_SIWA_SERVICE_ID",
  "APPLE_SIWA_KEY_ID",
  "APPLE_SIWA_PRIVATE_KEY",
  "POSTHOG_PERSONAL_API_KEY"
)

$missingSecrets = $requiredSecrets | Where-Object { -not [Environment]::GetEnvironmentVariable($_) }
if ($missingSecrets.Count -gt 0) {
  Write-Warning "The following secrets are not set in this shell: $($missingSecrets -join ', ')"
  Write-Warning "Set them in Supabase with: supabase secrets set NAME=value --project-ref $ProjectRef"
}

Write-Host "Linking Supabase project $ProjectRef"
supabase link --project-ref $ProjectRef

Write-Host "Pushing migrations"
supabase db push

Write-Host "Deploying required Edge Functions"
supabase functions deploy revenuecat-webhook --project-ref $ProjectRef
supabase functions deploy account-deletion --project-ref $ProjectRef
supabase functions deploy data-export --project-ref $ProjectRef
supabase functions deploy catalog-lookup --project-ref $ProjectRef
supabase functions deploy catalog-search --project-ref $ProjectRef
supabase functions deploy catalog-report --project-ref $ProjectRef

if ($DeployCommerce) {
  Write-Host "Deploying commerce polling Edge Function"
  supabase functions deploy order-report-poll --project-ref $ProjectRef
}

Write-Host "Generating local database types"
supabase gen types typescript --linked --schema public > packages/types/src/database.types.ts

Write-Host "Run npm run phase2:rls-smoke against this staging project before any EAS production build."
