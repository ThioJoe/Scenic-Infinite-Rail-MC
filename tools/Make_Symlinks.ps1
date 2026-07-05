# Set working directory to the root of the repository
$repoRoot = (Get-Item "$PSScriptRoot\..").FullName
Set-Location $repoRoot

# --- Configuration ---
$outDir  = "dist_links"
$rpDir   = "InfiniteRail_RP"
$bpDir   = "InfiniteRail_BP"
$javaDir = "InfiniteRail_Java"

# --- Helper Functions ---

# Dynamically calculates the relative path and creates a file symlink
function New-FileSymlink {
    param (
        [string]$LinkPath,
        [string]$TargetPath
    )
    
    $linkFull = Join-Path $repoRoot $LinkPath
    $linkDir = Split-Path $linkFull -Parent
    $targetFull = Join-Path $repoRoot $TargetPath
    
    # Calculate relative path from link directory to target file (PS 5.1 compatible)
    $fromUri = [System.Uri]"$linkDir\"
    $toUri = [System.Uri]"$targetFull"
    $relUri = $fromUri.MakeRelativeUri($toUri)
    $relPath = [System.Uri]::UnescapeDataString($relUri.ToString()).Replace('/', '\')
    
    cmd /c mklink "$LinkPath" "$relPath" | Out-Null
}

# Creates a Directory Junction (Does NOT require Admin or Developer Mode!)
function New-DirJunction {
    param (
        [string]$LinkPath,
        [string]$TargetPath
    )
    $targetFull = Join-Path $repoRoot $TargetPath
    New-Item -ItemType Junction -Path $LinkPath -Target $targetFull | Out-Null
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
New-DirJunction -LinkPath "$outDir\$rpDir" -TargetPath "src\bedrock\rp"

Write-Host "Setting up Behavior Pack ($bpDir) shadow tree..."
New-Item -ItemType Directory -Force -Path "$outDir\$bpDir\functions\infinite_rail" | Out-Null
New-DirJunction -LinkPath "$outDir\$bpDir\blocks" -TargetPath "src\bedrock\bp\blocks"
New-DirJunction -LinkPath "$outDir\$bpDir\entities" -TargetPath "src\bedrock\bp\entities"
New-DirJunction -LinkPath "$outDir\$bpDir\scripts" -TargetPath "src\bedrock\bp\scripts"
New-FileSymlink -LinkPath "$outDir\$bpDir\manifest.json" -TargetPath "src\bedrock\bp\manifest.json"

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
New-DirJunction -LinkPath "$outDir\$javaDir\overlay_snake" -TargetPath "src\java\overlay_snake"

# We must construct the intermediate folders for Java to use directory symlinks deeper down
New-Item -ItemType Directory -Force -Path "$outDir\$javaDir\data" | Out-Null
New-DirJunction -LinkPath "$outDir\$javaDir\data\minecraft" -TargetPath "src\java\data\minecraft"

New-Item -ItemType Directory -Force -Path "$outDir\$javaDir\data\infinite_rail" | Out-Null
New-DirJunction -LinkPath "$outDir\$javaDir\data\infinite_rail\tags" -TargetPath "src\java\data\infinite_rail\tags"

New-FileSymlink -LinkPath "$outDir\$javaDir\pack.mcmeta" -TargetPath "src\java\pack.mcmeta"

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