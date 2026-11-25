$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$syncScript = Join-Path $PSScriptRoot "daily-git-sync.ps1"
$taskName = "PlaywrightShopDailyCommit"
$powerShell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $powerShell)) {
  throw "Windows PowerShell was not found at '$powerShell'."
}

$branch = (& git -C $repositoryRoot branch --show-current | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $branch) {
  throw "Could not determine the current Git branch."
}

$upstream = (& git -C $repositoryRoot rev-parse --abbrev-ref --symbolic-full-name "@{upstream}" | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $upstream -ne "origin/$branch") {
  throw "The current branch must track origin/$branch before scheduling."
}

$user = (whoami).Trim()
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$syncScript`" -ExpectedBranch $branch"
$action = New-ScheduledTaskAction `
  -Execute $powerShell `
  -Argument $arguments `
  -WorkingDirectory $repositoryRoot
$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours(16))
$principal = New-ScheduledTaskPrincipal `
  -UserId $user `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries = $false

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Run routine checks, commit repository changes, and push to origin/$branch daily at 4 PM local time." `
  -Force | Out-Null

$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
Write-Output "Installed '$taskName' for $user."
Write-Output "Daily time: 4:00 PM computer local time; next run: $($taskInfo.NextRunTime)."
Write-Output "The task runs only in your interactive Windows account and starts when available after sleep."
