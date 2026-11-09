param([switch]$Release, [string]$Seed = '42')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (Test-Path "$PSScriptRoot/.tools/cargo/bin/cargo.exe") {
    $env:CARGO_HOME = "$PSScriptRoot/.tools/cargo"
    $env:RUSTUP_HOME = "$PSScriptRoot/.tools/rustup"
    $env:PATH = "$PSScriptRoot/.tools/cargo/bin;$env:PATH"
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'Install Rust using https://rustup.rs, then run this script again.'
}
$cargoArgs = @('run', '-p', 'frostbound-desktop')
if ($Release) { $cargoArgs += '--release' }
& cargo @cargoArgs -- --seed $Seed
exit $LASTEXITCODE
