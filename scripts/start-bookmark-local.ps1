$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$url = 'http://localhost:8787'
$browserOpenDelayMs = 1500

Set-Location $repoRoot

function Assert-CommandAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [string] $CommandName
  )

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $CommandName"
  }
}

function Start-BrowserAfterDelay {
  param(
    [Parameter(Mandatory = $true)]
    [string] $TargetUrl,

    [Parameter(Mandatory = $true)]
    [int] $DelayMs
  )

  try {
    Start-Job -ScriptBlock {
      param($JobUrl, $JobDelayMs)
      Start-Sleep -Milliseconds $JobDelayMs
      Start-Process $JobUrl
    } -ArgumentList $TargetUrl, $DelayMs | Out-Null
  }
  catch {
    Write-Warning "브라우저 자동 열기에 실패했습니다. 직접 열어주세요: $TargetUrl"
  }
}

try {
  Assert-CommandAvailable -CommandName 'npm'

  Write-Host ''
  Write-Host '[bookmark] 웹 자산을 빌드합니다...'
  & npm run build:web
  if ($LASTEXITCODE -ne 0) {
    throw "build:web failed with exit code $LASTEXITCODE"
  }

  Write-Host ''
  Write-Host "[bookmark] 브라우저를 엽니다: $url"
  Start-BrowserAfterDelay -TargetUrl $url -DelayMs $browserOpenDelayMs

  Write-Host ''
  Write-Host '[bookmark] 로컬 개발 서버를 시작합니다...'
  & npm run dev:api
  exit $LASTEXITCODE
}
catch {
  Write-Host ''
  Write-Error "[bookmark] 로컬 실행에 실패했습니다: $($_.Exception.Message)"
  Write-Host '창을 닫지 말고 오류를 확인한 뒤 다시 시도하세요.'
  exit 1
}
