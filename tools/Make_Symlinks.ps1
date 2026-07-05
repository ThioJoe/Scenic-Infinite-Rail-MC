# Set working directory to the root of the repository
$repoRoot = (Get-Item "$PSScriptRoot\..").FullName
Set-Location $repoRoot

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

Write-Host "Creating dist_links shadow tree..."

# Wipe existing shadow tree to ensure a clean slate 
# (using cmd rmdir to avoid PS5.1 bugs with Remove-Item deleting symlink targets)
if (Test-Path "dist_links") { 
    cmd /c rmdir /s /q "dist_links"
}
New-Item -ItemType Directory -Path "dist_links" | Out-Null

Write-Host "Setting up Resource Pack (RP) symlinks..."
New-DirJunction -LinkPath "dist_links\RP" -TargetPath "src\bedrock\rp"

Write-Host "Setting up Behavior Pack (BP) shadow tree..."
New-Item -ItemType Directory -Force -Path "dist_links\BP\functions\infinite_rail" | Out-Null
New-DirJunction -LinkPath "dist_links\BP\blocks" -TargetPath "src\bedrock\bp\blocks"
New-DirJunction -LinkPath "dist_links\BP\entities" -TargetPath "src\bedrock\bp\entities"
New-DirJunction -LinkPath "dist_links\BP\scripts" -TargetPath "src\bedrock\bp\scripts"
New-FileSymlink -LinkPath "dist_links\BP\manifest.json" -TargetPath "src\bedrock\bp\manifest.json"

# Link native BP functions (including the new ir_* trampolines in the root functions folder)
$bpRootFns = Get-ChildItem -Path "src\bedrock\bp\functions" -File
foreach ($file in $bpRootFns) {
    New-FileSymlink -LinkPath "dist_links\BP\functions\$($file.Name)" -TargetPath "src\bedrock\bp\functions\$($file.Name)"
}

$bpNative = Get-ChildItem -Path "src\bedrock\bp\functions\infinite_rail" -File
foreach ($file in $bpNative) {
    New-FileSymlink -LinkPath "dist_links\BP\functions\infinite_rail\$($file.Name)" -TargetPath "src\bedrock\bp\functions\infinite_rail\$($file.Name)"
}

Write-Host "Setting up Java Data Pack shadow tree..."
New-Item -ItemType Directory -Force -Path "dist_links\Java\data\infinite_rail\function" | Out-Null
New-DirJunction -LinkPath "dist_links\Java\overlay_snake" -TargetPath "src\java\overlay_snake"

# We must construct the intermediate folders for Java to use directory symlinks deeper down
New-Item -ItemType Directory -Force -Path "dist_links\Java\data" | Out-Null
New-DirJunction -LinkPath "dist_links\Java\data\minecraft" -TargetPath "src\java\data\minecraft"

New-Item -ItemType Directory -Force -Path "dist_links\Java\data\infinite_rail" | Out-Null
New-DirJunction -LinkPath "dist_links\Java\data\infinite_rail\tags" -TargetPath "src\java\data\infinite_rail\tags"

New-FileSymlink -LinkPath "dist_links\Java\pack.mcmeta" -TargetPath "src\java\pack.mcmeta"

# Link native Java functions
$javaNative = Get-ChildItem -Path "src\java\data\infinite_rail\function" -File
foreach ($file in $javaNative) {
    New-FileSymlink -LinkPath "dist_links\Java\data\infinite_rail\function\$($file.Name)" -TargetPath "src\java\data\infinite_rail\function\$($file.Name)"
}

Write-Host "Linking shared functions..."
$sharedFiles = Get-ChildItem -Path "src\shared\functions" -File
foreach ($file in $sharedFiles) {
    New-FileSymlink -LinkPath "dist_links\BP\functions\infinite_rail\$($file.Name)" -TargetPath "src\shared\functions\$($file.Name)"
    New-FileSymlink -LinkPath "dist_links\Java\data\infinite_rail\function\$($file.Name)" -TargetPath "src\shared\functions\$($file.Name)"
}

Write-Host "`nShadow tree created successfully!"

Read-Host "`nPress Enter to exit"