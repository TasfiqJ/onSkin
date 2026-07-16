param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
  throw "DB06_WINDOWS_JOB_RUNNER_SOURCE_MISSING"
}
if (Test-Path -LiteralPath $OutputPath) {
  throw "DB06_WINDOWS_JOB_RUNNER_OUTPUT_EXISTS"
}

$source = Get-Content -LiteralPath $SourcePath -Raw
Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $OutputPath -OutputType ConsoleApplication

if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
  throw "DB06_WINDOWS_JOB_RUNNER_BUILD_FAILED"
}
