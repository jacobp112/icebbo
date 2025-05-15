param(
    # Java 25 or later (Freerouting 2.4.1 is compiled for class version 69).
    [Parameter(Mandatory = $true)][string]$Java,
    # freerouting-2.4.1.jar from the official GitHub release.
    [Parameter(Mandatory = $true)][string]$Freerouting,
    [int]$Passes = 40
)

# Route the board with Freerouting and check the result. See docs/routing.md.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$bun = Join-Path $repo 'node_modules\bun\bin'
$env:PATH = "$bun;$env:PATH"
$tsci = Join-Path $repo 'node_modules\.bin\tsci.cmd'
$work = Join-Path $repo 'build\routing'
$built = 'dist/hardware/power_config/circuit.json'
$session = 'hardware/routing/board.ses'

Push-Location $repo
try {
    New-Item -ItemType Directory -Force $work | Out-Null
    New-Item -ItemType Directory -Force (Split-Path $session) | Out-Null

    # The same unrouted build that check_schematic.ps1 verifies.
    & $tsci build hardware/power_config.tsx --routing-disabled --disable-parts-engine
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & $tsci export hardware/power_config.tsx -f specctra-dsn --disable-parts-engine -o (Join-Path $work 'board.dsn')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & node hardware/prepare_dsn.mjs (Join-Path $work 'board.dsn') $built (Join-Path $work 'board_prepared.dsn')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    # The optimizer stage re-routes finished connections and was seen to
    # leave more of them unrouted, so only the routing stage runs.
    & $Java -jar $Freerouting -de (Join-Path $work 'board_prepared.dsn') -do $session -mp $Passes `
        --gui.enabled=false --router.optimizer.enabled=false
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & node hardware/import_ses.mjs $session $built 'dist/hardware/power_config/routed.json'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & node hardware/check_routing.mjs 'dist/hardware/power_config/routed.json'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
