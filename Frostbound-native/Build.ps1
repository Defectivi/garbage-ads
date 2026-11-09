param([switch]$Release)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (Test-Path "$PSScriptRoot/.tools/cargo/bin/cargo.exe") {
    $env:CARGO_HOME = "$PSScriptRoot/.tools/cargo"
    $env:RUSTUP_HOME = "$PSScriptRoot/.tools/rustup"
    $env:PATH = "$PSScriptRoot/.tools/cargo/bin;$env:PATH"
}
$cargoArgs = @('build', '-p', 'frostbound-desktop', '--locked')
$profile = 'debug'
if ($Release) { $cargoArgs += '--release'; $profile = 'release' }
& cargo @cargoArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
New-Item -ItemType Directory -Force "$PSScriptRoot/build" | Out-Null
Copy-Item "$PSScriptRoot/target/$profile/frostbound-desktop.exe" "$PSScriptRoot/build/Frostbound.exe" -Force
Copy-Item "$PSScriptRoot/assets" "$PSScriptRoot/build" -Recurse -Force
foreach ($document in @('README.md','VERIFICATION.md','THIRD_PARTY.md','DESIGN.md')) {
    Copy-Item "$PSScriptRoot/$document" "$PSScriptRoot/build/$document" -Force
}
Write-Output "Built $PSScriptRoot/build/Frostbound.exe with local assets ($profile)."
