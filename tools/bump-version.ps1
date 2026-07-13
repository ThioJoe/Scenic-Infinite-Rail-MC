#!/usr/bin/env pwsh
# =============================================================================
#  bump-version.ps1 -- set the project version everywhere at once
#
#  The project's version lives in six product-version references across the two
#  Bedrock manifests (Java's pack.mcmeta carries only a Minecraft-compatibility
#  pack_format, never a product version, so it is not touched):
#
#    src/bedrock/bp/manifest.json  header.version, both modules[].version,
#                                  and the BP->RP dependency version   (4)
#    src/bedrock/rp/manifest.json  header.version, modules[].version    (2)
#
#  This prompts for a new version (or takes -Version) and rewrites all six to
#  match, preserving each file's formatting. It matches only array-form
#  "version": [a, b, c] fields, so it leaves min_engine_version (a different
#  key) and the @minecraft/server string pins alone. Documentation that cites a
#  specific version as an example (BUILDING.md, workflow comments) is
#  intentionally not rewritten.
#
#  If you ever add the version to another file, update this script, the CI
#  consistency check (tools/check-version.mjs), and the list in tools/BUILDING.md.
#
#  Works on Windows PowerShell 5.1 and PowerShell 7+.
#
#  Usage:
#    pwsh tools/bump-version.ps1              # prompts for the new version
#    pwsh tools/bump-version.ps1 -Version 1.4.7
#    pwsh tools/bump-version.ps1 -Version 1.4.7 -Yes   # skip the confirmation
# =============================================================================
[CmdletBinding()]
param(
    [string]$Version,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'

# --- locate the repo root ----------------------------------------------------
# Primary: the script's own folder is <repo>/tools, so its parent is the repo
# root -- this is correct no matter what the current directory is. Fallbacks
# cover being dot-sourced or run oddly: if the current directory is "tools",
# go up one; otherwise try the current directory itself. The first candidate
# that actually contains the BP manifest wins.
function Resolve-RepoRoot {
    $bpRel = 'src/bedrock/bp/manifest.json'
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($PSScriptRoot) { $candidates.Add((Split-Path -Parent $PSScriptRoot)) }
    $cwd = (Get-Location).Path
    if ((Split-Path -Leaf $cwd) -ieq 'tools') { $candidates.Add((Split-Path -Parent $cwd)) }
    $candidates.Add($cwd)
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c $bpRel))) { return $c }
    }
    return $null
}

$repoRoot = Resolve-RepoRoot
if (-not $repoRoot) {
    Write-Error "Could not find src/bedrock/bp/manifest.json. Run this script from the repo (it normally lives in the 'tools' folder)."
}

# Each manifest with a friendly relative label for the report (no reliance on
# [System.IO.Path]::GetRelativePath, which is missing on Windows PowerShell 5.1).
$manifests = @(
    @{ Rel = 'src/bedrock/bp/manifest.json'; Path = (Join-Path $repoRoot 'src/bedrock/bp/manifest.json') },
    @{ Rel = 'src/bedrock/rp/manifest.json'; Path = (Join-Path $repoRoot 'src/bedrock/rp/manifest.json') }
)

# Every array-form "version": [a, b, c]. min_engine_version (different key) and
# the string module pins ("version": "2.6.0") do not match this shape.
$versionArrayPattern = '"version"\s*:\s*\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]'

function Read-Utf8NoBom([string]$path) {
    return [System.IO.File]::ReadAllText($path)
}
function Write-Utf8NoBom([string]$path, [string]$text) {
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# --- current version (source of truth: the BP header) ------------------------
$bpText = Read-Utf8NoBom $manifests[0].Path
if ($bpText -notmatch $versionArrayPattern) {
    Write-Error "Could not find a version array in $($manifests[0].Rel)."
}
$currentArray = ([regex]::Match($bpText, $versionArrayPattern)).Value
$currentVersion = ([regex]::Matches($currentArray, '\d+') | ForEach-Object { $_.Value }) -join '.'
Write-Host "Current version: $currentVersion" -ForegroundColor Cyan

# --- new version -------------------------------------------------------------
if (-not $Version) {
    $Version = (Read-Host "Enter new version (e.g. $currentVersion -> higher, x.y.z)").Trim()
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be three dot-separated numbers, e.g. 1.4.7 (got '$Version')."
}

# Warn (do not block) if it is not strictly greater than the current one -- the
# release-bump CI check will reject a version that isn't ahead of the latest tag.
$cur = $currentVersion.Split('.') | ForEach-Object { [int]$_ }
$new = $Version.Split('.')        | ForEach-Object { [int]$_ }
$isGreater = ($new[0] -gt $cur[0]) -or
             ($new[0] -eq $cur[0] -and $new[1] -gt $cur[1]) -or
             ($new[0] -eq $cur[0] -and $new[1] -eq $cur[1] -and $new[2] -gt $cur[2])
if ($Version -eq $currentVersion) {
    Write-Host "New version equals the current version; nothing to change." -ForegroundColor Yellow
    return
}
if (-not $isGreater) {
    Write-Host "Warning: $Version is not greater than $currentVersion -- the release-bump check will fail against a higher tag." -ForegroundColor Yellow
}

$replacement = '"version": [' + ($new -join ', ') + ']'

if (-not $Yes) {
    $answer = (Read-Host "Set version $currentVersion -> $Version across the manifests? [y/N]").Trim()
    if ($answer -notmatch '^(y|yes)$') {
        Write-Host "Aborted; no files changed." -ForegroundColor Yellow
        return
    }
}

# --- rewrite -----------------------------------------------------------------
$total = 0
foreach ($m in $manifests) {
    $text = Read-Utf8NoBom $m.Path
    $count = ([regex]::Matches($text, $versionArrayPattern)).Count
    if ($count -eq 0) {
        Write-Error "No version arrays found in $($m.Rel) -- aborting (nothing written)."
    }
    $updated = [regex]::Replace($text, $versionArrayPattern, $replacement)
    if ($updated -ne $text) {
        Write-Utf8NoBom $m.Path $updated
    }
    Write-Host ("  {0,-32} {1} reference(s) -> {2}" -f $m.Rel, $count, $Version) -ForegroundColor Green
    $total += $count
}
Write-Host "Updated $total version reference(s) to $Version." -ForegroundColor Cyan

# --- verify (best effort) ----------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    Write-Host ""
    node (Join-Path $repoRoot 'tools/check-version.mjs') --consistency
} else {
    Write-Host "(node not found -- skipping the consistency check)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next: commit the manifests, then tag the release (e.g. git tag $Version)." -ForegroundColor Cyan
