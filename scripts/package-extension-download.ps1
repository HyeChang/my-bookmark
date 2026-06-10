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

function Get-FileSnapshot {
  param(
    [Parameter(Mandatory = $true)]
    [string] $RootPath
  )

  $resolvedRoot = (Resolve-Path -LiteralPath $RootPath).Path.TrimEnd("\", "/")
  Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
      $relativePath = $_.FullName.Substring($resolvedRoot.Length).TrimStart("\", "/")
      $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
      [pscustomobject]@{
        Path = $relativePath.Replace("\", "/")
        Length = $_.Length
        Hash = $hash.Hash
      }
    }
}

function Test-DirectoryContentEqual {
  param(
    [Parameter(Mandatory = $true)]
    [string] $LeftPath,
    [Parameter(Mandatory = $true)]
    [string] $RightPath
  )

  $leftSnapshot = @(Get-FileSnapshot -RootPath $LeftPath)
  $rightSnapshot = @(Get-FileSnapshot -RootPath $RightPath)

  if ($leftSnapshot.Count -ne $rightSnapshot.Count) {
    return $false
  }

  for ($index = 0; $index -lt $leftSnapshot.Count; $index++) {
    $leftFile = $leftSnapshot[$index]
    $rightFile = $rightSnapshot[$index]

    if (
      $leftFile.Path -ne $rightFile.Path -or
      $leftFile.Length -ne $rightFile.Length -or
      $leftFile.Hash -ne $rightFile.Hash
    ) {
      return $false
    }
  }

  return $true
}

if (Test-Path -LiteralPath $zipPath) {
  $existingExtractDir = Join-Path ([System.IO.Path]::GetTempPath()) "bookmark-extension-existing-$([guid]::NewGuid())"
  New-Item -ItemType Directory -Path $existingExtractDir -Force | Out-Null

  try {
    Expand-Archive -LiteralPath $zipPath -DestinationPath $existingExtractDir -Force
    if (Test-DirectoryContentEqual -LeftPath $extensionDist -RightPath $existingExtractDir) {
      Write-Host "Extension download zip is already up to date."
      return
    }
  } finally {
    if (Test-Path -LiteralPath $existingExtractDir) {
      Remove-Item -LiteralPath $existingExtractDir -Recurse -Force
    }
  }

  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $extensionDist "*") -DestinationPath $zipPath -Force
