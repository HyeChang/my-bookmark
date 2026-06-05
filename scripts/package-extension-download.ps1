$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$extensionDist = Join-Path $repoRoot "apps\extension\dist"
$extensionManifest = Join-Path $extensionDist "manifest.json"
$downloadsDir = Join-Path $repoRoot "apps\web\public\downloads"
$zipPath = Join-Path $downloadsDir "bookmark-saver-extension.zip"

if (-not (Test-Path -LiteralPath $extensionManifest)) {
  throw "Extension build output not found at $extensionManifest. Run the extension build first."
}

New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $extensionDist "*") -DestinationPath $zipPath -Force
