# Places symbolic links within minecraft bedrock directories that point to the dist_links

$rpLink = "$env:APPDATA\Minecraft Bedrock\Users\Shared\games\com.mojang\development_resource_packs\Scenic_Infinite_Rail_Mode_RP"
$rpTarget = "$PSScriptRoot\dist_links\Scenic_Infinite_Rail_Mode_RP"

$bpLink = "$env:APPDATA\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs\Scenic_Infinite_Rail_Mode_BP"
$bpTarget = "$PSScriptRoot\dist_links\Scenic_Infinite_Rail_Mode_BP"

try {
	# Ensure the parent directories in AppData exist before trying to create the links
	$rpParent = Split-Path $rpLink
	if (-not (Test-Path $rpParent)) { 
		New-Item -Path $rpParent -ItemType Directory -Force -ErrorAction Stop | Out-Null 
	}

	$bpParent = Split-Path $bpLink
	if (-not (Test-Path $bpParent)) { 
		New-Item -Path $bpParent -ItemType Directory -Force -ErrorAction Stop | Out-Null 
	}

    # Create the symbolic links
    cmd /c mklink /d `"$rpLink`" `"$rpTarget`" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "mklink failed to create RP Symlink." }
    Write-Host "Successfully created RP Symlink:`n$rpLink -> $rpTarget`n"

    cmd /c mklink /d `"$bpLink`" `"$bpTarget`" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "mklink failed to create BP Symlink." }
    Write-Host "Successfully created BP Symlink:`n$bpLink -> $bpTarget`n"
}
catch {
    Write-Error "Failed to create symlinks. You likely need to run this script as an Administrator (or enable Windows Developer Mode)."
    Write-Error $_.Exception.Message
	Read-Host "Press Enter to exit"
}
