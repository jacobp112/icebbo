$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$bun = Join-Path $repo 'node_modules\bun\bin'
$env:PATH = "$bun;$env:PATH"

Push-Location $repo
try {
    & (Join-Path $repo 'node_modules\.bin\tsci.cmd') build hardware/power_config.tsx --routing-disabled --disable-parts-engine
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & node hardware/check_power_config.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & node hardware/check_usb_ftdi.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & node hardware/check_pcb.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $netlist = & (Join-Path $repo 'node_modules\.bin\tsci.cmd') check netlist hardware/power_config.tsx
    if ($LASTEXITCODE -ne 0) { $netlist | Write-Output; exit $LASTEXITCODE }
    $netlist | Select-Object -First 2 | Write-Output
}
finally {
    Pop-Location
}
