param(
  [string]$ExpectedBranch = "main"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDirectory = Join-Path $env:LOCALAPPDATA "PlaywrightShopDailyCommit\logs"
$logPath = Join-Path $logDirectory "$(Get-Date -Format 'yyyy-MM-dd').log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Start-Transcript -Path $logPath -Append | Out-Null

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Description
  )

  Write-Host "Running: $Description"
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

function Get-GitOutput {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $result = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
  return $result
}

try {
  Set-Location $repositoryRoot
  Write-Output "Daily Git sync started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')."

  $branch = (Get-GitOutput @("branch", "--show-current") | Out-String).Trim()
  if ($branch -ne $ExpectedBranch) {
    throw "Current branch is '$branch'; expected '$ExpectedBranch'. No files were staged."
  }

  $upstream = (Get-GitOutput @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}") | Out-String).Trim()
  if ($upstream -ne "origin/$ExpectedBranch") {
    throw "Branch upstream is '$upstream'; expected 'origin/$ExpectedBranch'."
  }

  Invoke-CheckedCommand "git" @("fetch", "--prune", "origin") "fetch latest origin refs"
  $counts = (Get-GitOutput @("rev-list", "--left-right", "--count", "$upstream...HEAD") | Out-String).Trim() -split "\s+"
  $behind = [int]$counts[0]
  $ahead = [int]$counts[1]
  if ($behind -gt 0) {
    throw "Local branch is behind origin/$ExpectedBranch by $behind commit(s); refusing to commit or push."
  }

  $workingTree = @(Get-GitOutput @("status", "--porcelain", "--untracked-files=all"))
  if ($workingTree.Count -eq 0 -and $ahead -eq 0) {
    Write-Output "No repository changes or unpushed commits. Nothing to do."
    return
  }

  $candidatePaths = @()
  $candidatePaths += @(Get-GitOutput @("diff", "--name-only"))
  $candidatePaths += @(Get-GitOutput @("diff", "--cached", "--name-only"))
  $candidatePaths += @(Get-GitOutput @("ls-files", "--others", "--exclude-standard"))
  $blockedPattern = "(?i)(^|/)(\.env($|\.)|[^/]*\.(pem|pfx|p12|key)|id_(rsa|ed25519)|secrets?(\.[^/]*)?|credentials?(\.[^/]*)?|\.npmrc|terraform\.tfstate($|\.))"
  $blockedPath = $candidatePaths |
    Where-Object {
      $_ -ne ".env.example" -and
      $_ -match $blockedPattern
    } |
    Select-Object -First 1
  if ($blockedPath) {
    throw "Sensitive-looking file '$blockedPath' is present; refusing to stage or commit."
  }

  $env:RUN_MUTATING_TESTS = "false"
  $env:RUN_RESET_API_TEST = "false"
  Invoke-CheckedCommand "npm.cmd" @("run", "lint") "ESLint"
  Invoke-CheckedCommand "npm.cmd" @("run", "typecheck") "TypeScript typecheck"
  Invoke-CheckedCommand "npm.cmd" @("test") "routine Playwright suite"

  $workingTree = @(Get-GitOutput @("status", "--porcelain", "--untracked-files=all"))
  $candidatePaths = @()
  $candidatePaths += @(Get-GitOutput @("diff", "--name-only"))
  $candidatePaths += @(Get-GitOutput @("diff", "--cached", "--name-only"))
  $candidatePaths += @(Get-GitOutput @("ls-files", "--others", "--exclude-standard"))
  $blockedPath = $candidatePaths |
    Where-Object {
      $_ -ne ".env.example" -and
      $_ -match $blockedPattern
    } |
    Select-Object -First 1
  if ($blockedPath) {
    throw "Sensitive-looking file '$blockedPath' is present after checks; refusing to stage or commit."
  }

  if ($workingTree.Count -gt 0) {
    Invoke-CheckedCommand "git" @("add", "--all") "stage repository changes"
    $stagedPaths = @(Get-GitOutput @("diff", "--cached", "--name-only"))
    if ($stagedPaths.Count -gt 0) {
      $login = (Invoke-CheckedCommand "gh" @("api", "user", "--jq", ".login") "read authenticated GitHub login" | Out-String).Trim()
      $userId = (Invoke-CheckedCommand "gh" @("api", "user", "--jq", ".id") "read authenticated GitHub user ID" | Out-String).Trim()
      $displayName = (Invoke-CheckedCommand "gh" @("api", "user", "--jq", ".name // .login") "read authenticated GitHub display name" | Out-String).Trim()
      if (-not $login -or -not $userId -or -not $displayName) {
        throw "Could not determine the authenticated GitHub commit identity."
      }

      $commitEmail = "$userId+$login@users.noreply.github.com"
      $commitMessage = "chore: daily update $(Get-Date -Format 'yyyy-MM-dd')"
      Invoke-CheckedCommand "git" @("-c", "user.name=$displayName", "-c", "user.email=$commitEmail", "commit", "-m", $commitMessage) "create daily commit"
      $ahead += 1
    } else {
      Write-Output "No staged changes remain after checks."
    }
  }

  if ($ahead -gt 0) {
    Invoke-CheckedCommand "git" @("push", "origin", $ExpectedBranch) "push daily commit(s) to origin/$ExpectedBranch"
  }

  Write-Output "Daily Git sync completed successfully."
} catch {
  Write-Error $_
  exit 1
} finally {
  Stop-Transcript | Out-Null
}
