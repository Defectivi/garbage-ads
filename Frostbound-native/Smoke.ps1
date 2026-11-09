param([switch]$Budget, [string]$Executable = "$PSScriptRoot/target/debug/frostbound-desktop.exe")
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$label = if ($Budget) { 'budget' } else { 'default' }
$info = [System.Diagnostics.ProcessStartInfo]::new($Executable, "--seed 42 --smoke$(if ($Budget) {' --budget'})")
$info.UseShellExecute = $false
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$info.CreateNoWindow = $true
$info.EnvironmentVariables['RUST_LOG'] = 'info'
$started = Get-Date
$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $info
[void]$process.Start()
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
if (-not $process.WaitForExit(120000)) { $process.Kill(); throw 'Native smoke test timed out.' }
[IO.File]::WriteAllText("$PSScriptRoot/smoke-$label.out.log", $stdout.Result)
[IO.File]::WriteAllText("$PSScriptRoot/smoke-$label.err.log", $stderr.Result)
if ($process.ExitCode -ne 0 -or $stderr.Result -match 'panicked|ERROR') {
    throw "Native smoke failed (exit $($process.ExitCode)); see smoke-$label.err.log."
}
foreach ($file in @('native-gameplay.png','native-inventory.png','smoke-save.json')) {
    $path = "$PSScriptRoot/captures/$file"
    if (-not (Test-Path $path) -or (Get-Item $path).LastWriteTime -lt $started) { throw "Missing fresh runtime artifact: $file" }
    Copy-Item $path "$PSScriptRoot/captures/$label-$file" -Force
}
$save = Get-Content "$PSScriptRoot/captures/smoke-save.json" -Raw | ConvertFrom-Json
if ($save.state.elapsed -lt 4 -or $save.state.elapsed -gt 6 -or $save.state.budget -ne [bool]$Budget) { throw 'Unexpected simulation clock or graphics preference.' }
Write-Output "Native smoke passed ($label): real window/render capture, inventory, validated save, elapsed=$($save.state.elapsed)."
