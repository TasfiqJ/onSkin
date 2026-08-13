$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "supabase-cli-version-gate.ps1")

function Assert-Equal {
  param(
    [Parameter(Mandatory = $true)]
    $Actual,
    [Parameter(Mandatory = $true)]
    $Expected,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  if ($Actual -ne $Expected) {
    throw "ASSERTION_FAILED:$Label"
  }
}

function Assert-ThrowsCode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Expected,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Operation
  )

  try {
    & $Operation
  } catch {
    Assert-Equal -Actual $_.Exception.Message -Expected $Expected -Label "throw-$Expected"
    return
  }
  throw "ASSERTION_FAILED:missing-$Expected"
}

$accepted = @(
  @{ Raw = "2.109.0"; Expected = "2.109.0" },
  @{ Raw = " 2.109.0 `r`n"; Expected = "2.109.0" },
  @{ Raw = "2.109.0+build.7"; Expected = "2.109.0" },
  @{ Raw = "v2.110.1"; Expected = "2.110.1" },
  @{ Raw = "3.0.0"; Expected = "3.0.0" }
)
foreach ($fixture in $accepted) {
  $actual = Assert-SupabaseCliMinimumVersion -RawVersion $fixture.Raw
  Assert-Equal -Actual $actual.ToString() -Expected $fixture.Expected -Label "accept-$($fixture.Raw)"
}

Assert-ThrowsCode -Expected "SUPABASE_CLI_TOO_OLD" -Operation {
  Assert-SupabaseCliMinimumVersion -RawVersion "2.108.9"
}
Assert-ThrowsCode -Expected "SUPABASE_CLI_VERSION_INVALID" -Operation {
  Assert-SupabaseCliMinimumVersion -RawVersion "2.109.0-rc.1"
}
Assert-ThrowsCode -Expected "SUPABASE_CLI_VERSION_INVALID" -Operation {
  Assert-SupabaseCliMinimumVersion -RawVersion "2.109"
}
Assert-ThrowsCode -Expected "SUPABASE_CLI_VERSION_INVALID" -Operation {
  Assert-SupabaseCliMinimumVersion -RawVersion "2.109.0`nraw-untrusted-output"
}
Assert-ThrowsCode -Expected "SUPABASE_CLI_VERSION_INVALID" -Operation {
  Assert-SupabaseCliMinimumVersion -RawVersion "999999999999999999999.0.0"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "layerwell-supabase-cli-gate-$PID-$([Guid]::NewGuid().ToString('N'))"
$fakeCliPaths = @()
try {
  $null = New-Item -ItemType Directory -Path $tempRoot

  function New-FakeSupabaseCli {
    param(
      [Parameter(Mandatory = $true)]
      [string]$Name,
      [string[]]$OutputLines = @(),
      [int]$ExitCode = 0
    )

    $path = Join-Path $tempRoot "$Name.cmd"
    $body = @("@echo off", 'if not "%~1"=="--version" exit /b 64')
    foreach ($line in $OutputLines) {
      $body += "echo $line"
    }
    $body += "exit /b $ExitCode"
    [System.IO.File]::WriteAllText(
      $path,
      (($body -join "`r`n") + "`r`n"),
      [System.Text.UTF8Encoding]::new($false)
    )
    $script:fakeCliPaths += $path
    return $path
  }

  $exactCli = New-FakeSupabaseCli -Name "exact" -OutputLines @("2.109.0")
  Assert-Equal `
    -Actual (Assert-SupabaseCliMinimumVersion -CliPath $exactCli).ToString() `
    -Expected "2.109.0" `
    -Label "application-exact-minimum"

  $oldCli = New-FakeSupabaseCli -Name "old" -OutputLines @("2.108.9")
  Assert-ThrowsCode -Expected "SUPABASE_CLI_TOO_OLD" -Operation {
    Assert-SupabaseCliMinimumVersion -CliPath $oldCli
  }

  $nonzeroCli = New-FakeSupabaseCli -Name "nonzero" -OutputLines @("2.109.0") -ExitCode 9
  Assert-ThrowsCode -Expected "SUPABASE_CLI_VERSION_UNAVAILABLE" -Operation {
    Assert-SupabaseCliMinimumVersion -CliPath $nonzeroCli
  }

  $emptyCli = New-FakeSupabaseCli -Name "empty"
  Assert-ThrowsCode -Expected "SUPABASE_CLI_VERSION_UNAVAILABLE" -Operation {
    Assert-SupabaseCliMinimumVersion -CliPath $emptyCli
  }

  $multilineCli = New-FakeSupabaseCli -Name "multiline" -OutputLines @(
    "2.109.0",
    "untrusted-output"
  )
  Assert-ThrowsCode -Expected "SUPABASE_CLI_VERSION_INVALID" -Operation {
    Assert-SupabaseCliMinimumVersion -CliPath $multilineCli
  }

  Assert-ThrowsCode -Expected "SUPABASE_CLI_UNAVAILABLE" -Operation {
    Assert-SupabaseCliMinimumVersion -CliPath ".\supabase.cmd"
  }

  $originalPath = $env:PATH
  try {
    $env:PATH = $tempRoot
    function global:supabase { return "999.0.0" }
    Assert-ThrowsCode -Expected "SUPABASE_CLI_UNAVAILABLE" -Operation {
      Assert-SupabaseCliMinimumVersion
    }
  } finally {
    Remove-Item function:\global:supabase -ErrorAction SilentlyContinue
    $env:PATH = $originalPath
  }

  $mixedCliPath = Join-Path $tempRoot "supabase.cmd"
  $mixedLogPath = Join-Path $tempRoot "mixed-cli.log"
  [System.IO.File]::WriteAllText(
    $mixedCliPath,
    (@(
      "@echo off",
      'echo %*>>"%LAYERWELL_FAKE_SUPABASE_LOG%"',
      'if "%~1"=="--version" echo 2.109.0',
      "exit /b 0"
    ) -join "`r`n") + "`r`n",
    [System.Text.UTF8Encoding]::new($false)
  )
  $fakeCliPaths += @($mixedCliPath, $mixedLogPath)
  $originalPath = $env:PATH
  $originalLogPath = $env:LAYERWELL_FAKE_SUPABASE_LOG
  try {
    $env:PATH = $tempRoot
    $env:LAYERWELL_FAKE_SUPABASE_LOG = $mixedLogPath
    $global:LayerwellSupabaseShadowCalls = 0
    function global:supabase {
      $global:LayerwellSupabaseShadowCalls += 1
      return "999.0.0"
    }

    $resolvedCliPath = Resolve-SupabaseCliApplicationPath
    Assert-Equal `
      -Actual $resolvedCliPath `
      -Expected ([System.IO.Path]::GetFullPath($mixedCliPath)) `
      -Label "resolve-application-over-function"
    $null = Assert-SupabaseCliMinimumVersion -CliPath $resolvedCliPath
    & $resolvedCliPath link --project-ref "aaaaaaaaaaaaaaaaaaaa"
    Assert-Equal -Actual $LASTEXITCODE -Expected 0 -Label "absolute-application-invocation"
    Assert-Equal -Actual $global:LayerwellSupabaseShadowCalls -Expected 0 -Label "function-not-invoked"
    Assert-Equal `
      -Actual ((Get-Content -LiteralPath $mixedLogPath) -join "`n") `
      -Expected ("--version`nlink --project-ref aaaaaaaaaaaaaaaaaaaa") `
      -Label "absolute-application-call-log"
  } finally {
    Remove-Item function:\global:supabase -ErrorAction SilentlyContinue
    Remove-Variable -Name LayerwellSupabaseShadowCalls -Scope Global -ErrorAction SilentlyContinue
    $env:PATH = $originalPath
    if ($null -eq $originalLogPath) {
      Remove-Item Env:\LAYERWELL_FAKE_SUPABASE_LOG -ErrorAction SilentlyContinue
    } else {
      $env:LAYERWELL_FAKE_SUPABASE_LOG = $originalLogPath
    }
  }
} finally {
  foreach ($fakeCliPath in $fakeCliPaths) {
    if (Test-Path -LiteralPath $fakeCliPath) {
      Remove-Item -LiteralPath $fakeCliPath -Force
    }
  }
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Force
  }
}

$wrapper = Get-Content -LiteralPath (Join-Path $PSScriptRoot "deploy-supabase-staging.ps1") -Raw
$gateImport = $wrapper.IndexOf('. (Join-Path $PSScriptRoot "supabase-cli-version-gate.ps1")')
$pathResolve = $wrapper.IndexOf('$supabaseCliPath = Resolve-SupabaseCliApplicationPath')
$gateCall = $wrapper.IndexOf(
  '$null = Assert-SupabaseCliMinimumVersion -CliPath $supabaseCliPath'
)
$firstRemoteMutation = $wrapper.IndexOf('& $supabaseCliPath link --project-ref')
$migrationCommand = $wrapper.IndexOf('& $supabaseCliPath migration up --linked')
Assert-Equal -Actual ($gateImport -ge 0) -Expected $true -Label "wrapper-import"
Assert-Equal -Actual ($pathResolve -gt $gateImport) -Expected $true -Label "wrapper-resolve"
Assert-Equal -Actual ($gateCall -gt $pathResolve) -Expected $true -Label "wrapper-call"
Assert-Equal -Actual ($firstRemoteMutation -gt $gateCall) -Expected $true -Label "pre-mutation-order"
Assert-Equal -Actual ($migrationCommand -gt $firstRemoteMutation) -Expected $true -Label "migration-up-linked"
Assert-Equal -Actual ($wrapper.IndexOf('supabase db push')) -Expected (-1) -Label "no-legacy-db-push"
Assert-Equal `
  -Actual ([regex]::IsMatch($wrapper, '(?m)^\s*supabase\s+\w+')) `
  -Expected $false `
  -Label "no-bare-supabase-invocation"
Assert-Equal `
  -Actual ($wrapper.IndexOf('SUPABASE_MIGRATION_UP_FAILED') -gt $migrationCommand) `
  -Expected $true `
  -Label "migration-up-failure-code"

$catalogHarness = Get-Content -LiteralPath (
  Join-Path $PSScriptRoot "..\optimization\catalog-search-plan-load.mjs"
) -Raw
Assert-Equal `
  -Actual ($catalogHarness.IndexOf("minimum_supabase_cli_for_concurrent_index_migration: '2.109.0'") -ge 0) `
  -Expected $true `
  -Label "catalog-minimum-version-parity"
Assert-Equal `
  -Actual ($catalogHarness.IndexOf("staging_deployer_migration_command: 'supabase migration up --linked'") -ge 0) `
  -Expected $true `
  -Label "catalog-runner-parity"
Assert-Equal `
  -Actual ($catalogHarness.IndexOf("exact_staging_runner_replayed: false") -ge 0) `
  -Expected $true `
  -Label "external-runner-replay-not-fabricated"

Write-Output "PASS Supabase CLI minimum-version gate smoke"
