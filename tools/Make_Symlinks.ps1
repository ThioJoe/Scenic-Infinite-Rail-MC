# Set working directory to the root of the repository
$repoRoot = (Get-Item "$PSScriptRoot\..").FullName
Set-Location $repoRoot

# --- Configuration ---
$useJunctions = $true
$outDir  = "tools\dist_links"
$rpDir   = "Scenic_Infinite_Rail_Mode_RP"
$bpDir   = "Scenic_Infinite_Rail_Mode_BP"
$javaDir = "Scenic_Infinite_Rail_Mode_Java"

# --- Helper Functions ---

# Creates a file symlink using absolute paths
function New-FileSymlink {
    param (
        [string]$LinkPath,
        [string]$TargetPath
    )
    
    $linkFull = Join-Path $repoRoot $LinkPath
    $targetFull = Join-Path $repoRoot $TargetPath
    
    cmd /c mklink "$linkFull" "$targetFull" | Out-Null
}

# Creates a directory symlink using absolute paths (Requires Admin or Developer Mode)
function New-DirSymlink {
    param (
        [string]$LinkPath,
        [string]$TargetPath
    )
    
    $linkFull = Join-Path $repoRoot $LinkPath
    $targetFull = Join-Path $repoRoot $TargetPath
    
    if ($useJunctions) {
        cmd /c mklink /j "$linkFull" "$targetFull" | Out-Null
    } else {
        cmd /c mklink /d "$linkFull" "$targetFull" | Out-Null
    }
}

# --- Script Execution ---

Write-Host "Creating $outDir shadow tree..."

# Wipe existing shadow tree to ensure a clean slate 
# (using cmd rmdir to avoid PS5.1 bugs with Remove-Item deleting symlink targets)
if (Test-Path $outDir) { 
    cmd /c rmdir /s /q $outDir
}
New-Item -ItemType Directory -Path $outDir | Out-Null

Write-Host "Setting up Resource Pack ($rpDir) symlinks..."
New-DirSymlink -LinkPath "$outDir\$rpDir" -TargetPath "src\bedrock\rp"

Write-Host "Setting up Behavior Pack ($bpDir) shadow tree..."
New-Item -ItemType Directory -Force -Path "$outDir\$bpDir\functions\infinite_rail" | Out-Null

# Link every top-level BP directory except functions\ (which must MERGE the
# native files with src\shared\functions, so it is assembled file-by-file
# below). Dynamic on purpose: the old hardcoded list (blocks, entities,
# scripts) silently dropped any folder added later -- items\ (the pack's
# own hotbar items) was never linked, so every dev world running this
# shadow tree had NO custom item definitions: the speed trio quietly
# degraded to its vanilla lookalike fallbacks (invisible -- same icons)
# and the Toggle HUD item pinned as a visible amethyst stand-in.
$bpDirs = Get-ChildItem -Path "src\bedrock\bp" -Directory | Where-Object { $_.Name -ne "functions" }
foreach ($dir in $bpDirs) {
    New-DirSymlink -LinkPath "$outDir\$bpDir\$($dir.Name)" -TargetPath "src\bedrock\bp\$($dir.Name)"
}
# Top-level BP files (manifest.json today), linked dynamically like the dirs.
$bpRootFiles = Get-ChildItem -Path "src\bedrock\bp" -File
foreach ($file in $bpRootFiles) {
    New-FileSymlink -LinkPath "$outDir\$bpDir\$($file.Name)" -TargetPath "src\bedrock\bp\$($file.Name)"
}

# Link native BP functions (including the new ir_* trampolines in the root functions folder)
$bpRootFns = Get-ChildItem -Path "src\bedrock\bp\functions" -File
foreach ($file in $bpRootFns) {
    New-FileSymlink -LinkPath "$outDir\$bpDir\functions\$($file.Name)" -TargetPath "src\bedrock\bp\functions\$($file.Name)"
}

$bpNative = Get-ChildItem -Path "src\bedrock\bp\functions\infinite_rail" -File
foreach ($file in $bpNative) {
    New-FileSymlink -LinkPath "$outDir\$bpDir\functions\infinite_rail\$($file.Name)" -TargetPath "src\bedrock\bp\functions\infinite_rail\$($file.Name)"
}

Write-Host "Setting up Java Data Pack ($javaDir) shadow tree..."
New-Item -ItemType Directory -Force -Path "$outDir\$javaDir\data\infinite_rail\function" | Out-Null
New-DirSymlink -LinkPath "$outDir\$javaDir\overlay_snake" -TargetPath "src\java\overlay_snake"

# We must construct the intermediate folders for Java to use directory symlinks deeper down
New-Item -ItemType Directory -Force -Path "$outDir\$javaDir\data" | Out-Null
New-DirSymlink -LinkPath "$outDir\$javaDir\data\minecraft" -TargetPath "src\java\data\minecraft"

New-Item -ItemType Directory -Force -Path "$outDir\$javaDir\data\infinite_rail" | Out-Null
New-DirSymlink -LinkPath "$outDir\$javaDir\data\infinite_rail\tags" -TargetPath "src\java\data\infinite_rail\tags"
New-DirSymlink -LinkPath "$outDir\$javaDir\data\infinite_rail\predicate" -TargetPath "src\java\data\infinite_rail\predicate"

New-FileSymlink -LinkPath "$outDir\$javaDir\pack.mcmeta" -TargetPath "src\java\pack.mcmeta"
New-FileSymlink -LinkPath "$outDir\$javaDir\pack.png" -TargetPath "src\java\pack.png"

# Link native Java functions
$javaNative = Get-ChildItem -Path "src\java\data\infinite_rail\function" -File
foreach ($file in $javaNative) {
    New-FileSymlink -LinkPath "$outDir\$javaDir\data\infinite_rail\function\$($file.Name)" -TargetPath "src\java\data\infinite_rail\function\$($file.Name)"
}

Write-Host "Linking shared functions..."
$sharedFiles = Get-ChildItem -Path "src\shared\functions" -File
foreach ($file in $sharedFiles) {
    New-FileSymlink -LinkPath "$outDir\$bpDir\functions\infinite_rail\$($file.Name)" -TargetPath "src\shared\functions\$($file.Name)"
    New-FileSymlink -LinkPath "$outDir\$javaDir\data\infinite_rail\function\$($file.Name)" -TargetPath "src\shared\functions\$($file.Name)"
}

Write-Host "`nShadow tree created successfully!"

Read-Host "`nPress Enter to exit"