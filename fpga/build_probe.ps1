param(
    [string]$ToolBin = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $projectRoot "build/fpga"
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

if ($ToolBin) {
    $yosys = Join-Path $ToolBin "yosys.exe"
    $nextpnr = Join-Path $ToolBin "nextpnr-ice40.exe"
    $icepack = Join-Path $ToolBin "icepack.exe"
    $toolRoot = Split-Path -Parent $ToolBin
    $env:PATH = @($ToolBin, (Join-Path $toolRoot "lib"), $env:PATH) -join ";"
} else {
    $yosys = "yosys"
    $nextpnr = "nextpnr-ice40"
    $icepack = "icepack"
}

Push-Location $projectRoot
try {
    $synthScript = @(
        "read_verilog rtl/candidate_bbo.v rtl/frame_parser.v rtl/market_data_core.v rtl/uart_rx.v fpga/timing_probe_top.v",
        "synth_ice40 -device u -noabc -top timing_probe_top",
        "techmap -map fpga/map_ornot.v",
        "write_json build/fpga/probe.json",
        "stat"
    ) -join "; "
    & $yosys -Q -T -l "build/fpga/probe-yosys.log" -p $synthScript *> $null
    if ($LASTEXITCODE -ne 0) { throw "Yosys failed; see build/fpga/probe-yosys.log" }

    & $nextpnr --up5k --package sg48 --json "build/fpga/probe.json" `
        --pcf "fpga/timing_probe.pcf" --asc "build/fpga/probe.asc" `
        --freq 48 --seed 1 --log "build/fpga/probe-nextpnr.log" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "nextpnr failed or did not meet 48 MHz; see build/fpga/probe-nextpnr.log"
    }

    & $icepack "build/fpga/probe.asc" "build/fpga/probe.bin" *> $null
    if ($LASTEXITCODE -ne 0) { throw "icepack failed" }
    Write-Output "PASS timing probe: synthesis, place and route, 48 MHz check, bitstream"
} finally {
    Pop-Location
}
