param(
    [string]$ToolBin = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $projectRoot "build/sim"
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

if ($ToolBin) {
    $compiler = Join-Path $ToolBin "iverilog.exe"
    $runtime = Join-Path $ToolBin "vvp.exe"
    $toolRoot = Split-Path -Parent $ToolBin
    $env:PATH = @($ToolBin, (Join-Path $toolRoot "lib"), $env:PATH) -join ";"
} else {
    $compiler = "iverilog"
    $runtime = "vvp"
}

$rtl = @(
    (Join-Path $projectRoot "rtl/candidate_bbo.v"),
    (Join-Path $projectRoot "rtl/frame_parser.v"),
    (Join-Path $projectRoot "rtl/market_data_core.v")
)

$vectorCount = & python (Join-Path $PSScriptRoot "build_vector_mem.py") --output-dir $buildDir
if ($LASTEXITCODE -ne 0) { throw "Vector conversion failed" }

foreach ($testName in @("tb_candidate_bbo", "tb_market_data_core", "tb_frame_parser", "tb_vector_replay")) {
    $output = Join-Path $buildDir "$testName.vvp"
    $testSource = Join-Path $PSScriptRoot "$testName.v"
    & $compiler -g2012 -Wall -s $testName -o $output @rtl $testSource
    if ($LASTEXITCODE -ne 0) { throw "Icarus compile failed: $testName" }
    if ($testName -eq "tb_vector_replay") {
        Push-Location $buildDir
        try {
            & $runtime $output "+vector_count=$vectorCount"
        } finally {
            Pop-Location
        }
    } else {
        & $runtime $output
    }
    if ($LASTEXITCODE -ne 0) { throw "Icarus simulation failed: $testName" }
}
