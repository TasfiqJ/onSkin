function ConvertTo-SupabaseCliVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RawVersion
  )

  $candidate = "$RawVersion".Trim()
  if (
    $candidate.Length -eq 0 -or
    $candidate.Length -gt 64 -or
    $candidate -notmatch '\Av?(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?\z'
  ) {
    throw "SUPABASE_CLI_VERSION_INVALID"
  }

  try {
    return [Version]::new(
      [int]$Matches.major,
      [int]$Matches.minor,
      [int]$Matches.patch
    )
  } catch {
    throw "SUPABASE_CLI_VERSION_INVALID"
  }
}

function Resolve-SupabaseCliApplicationPath {
  $supabaseCommand = Get-Command supabase -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $supabaseCommand) {
    throw "SUPABASE_CLI_UNAVAILABLE"
  }

  $cliPath = "$($supabaseCommand.Source)"
  if (
    [string]::IsNullOrWhiteSpace($cliPath) -or
    -not [System.IO.Path]::IsPathRooted($cliPath) -or
    -not (Test-Path -LiteralPath $cliPath -PathType Leaf)
  ) {
    throw "SUPABASE_CLI_UNAVAILABLE"
  }
  return [System.IO.Path]::GetFullPath($cliPath)
}

function Assert-SupabaseCliMinimumVersion {
  param(
    [string]$RawVersion,
    [string]$CliPath,
    [Version]$MinimumVersion = [Version]::new(2, 109, 0)
  )

  if (-not $PSBoundParameters.ContainsKey("RawVersion")) {
    if (-not $PSBoundParameters.ContainsKey("CliPath")) {
      $CliPath = Resolve-SupabaseCliApplicationPath
    }

    if (
      [string]::IsNullOrWhiteSpace($CliPath) -or
      -not [System.IO.Path]::IsPathRooted($CliPath) -or
      -not (Test-Path -LiteralPath $CliPath -PathType Leaf)
    ) {
      throw "SUPABASE_CLI_UNAVAILABLE"
    }

    $versionOutput = @(& $CliPath --version 2>$null)
    if ($LASTEXITCODE -ne 0 -or $versionOutput.Count -eq 0) {
      throw "SUPABASE_CLI_VERSION_UNAVAILABLE"
    }
    $RawVersion = "$($versionOutput | Select-Object -Last 1)"
  }

  $version = ConvertTo-SupabaseCliVersion -RawVersion $RawVersion
  if ($version -lt $MinimumVersion) {
    throw "SUPABASE_CLI_TOO_OLD"
  }
  return $version
}
