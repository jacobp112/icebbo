# Initial FPGA synthesis and timing probe

## Scope

`fpga/timing_probe_top.v` adds a 3 Mbaud, 8N1 UART receiver in front of the verified byte parser and BBO core. It exposes a single activity output that depends on every BBO state bit so the logic remains in the synthesized design. This is a **provisional synthesis top**. It has no BBO readback, flash control, power-up logic, or final board pin assignment. Its timing cannot be presented as final board timing.

The 48 MHz clock and 16 clocks per UART bit imply 3 Mbaud **by calculation**. No UART waveform has been measured on physical hardware. FTDI's [FT2232H data sheet](https://ftdichip.com/wp-content/uploads/2024/03/DS_FT2232H.pdf) lists UART rates up to 12 Mbaud; the selected rate still needs host and board validation.

`fpga/timing_probe.pcf` provisionally maps clock to SG48 pin 35 (`IOT_46b_G0`), reset to pin 38 (`IOT_50b`), UART input to pin 34 (`IOT_44b`) at the time of the recorded run, and activity output to pin 32 (`IOT_43a`). The PCF has since moved the UART input to pin 12 (`IOB_22a`) to match the routed board, so the recorded logs predate that change. These names and numbers were checked against Lattice's [iCE40UP5K pinout workbook, revision 1.1](https://www.latticesemi.com/view_document?document_id=51971). Configuration reset (`CRESET_B`, pin 8) is a distinct board function and is not represented by this probe's `reset_n` input.

## Reproduce and tool versions

From the repository root with OSS CAD Suite active:

```powershell
./fpga/build_probe.ps1
```

Alternatively, pass the suite's `bin` directory as `-ToolBin`. The script uses Yosys `synth_ice40 -device u -noabc`, an explicit mapping for `$_ORNOT_`, nextpnr `--up5k --package sg48 --freq 48 --seed 1`, and IceStorm `icepack` only if timing passes. Intermediate outputs remain in ignored `build/fpga/`. Complete logs for this run are retained in `evidence/initial-probe-yosys.log` and `evidence/initial-probe-nextpnr.log`.

The run used OSS CAD Suite Windows x64 archive `oss-cad-suite-windows-x64-20260924.tgz` (SHA-256 `672AF9950C32139C5E0126B528BFF12EA7A1926551EE736DC1DBDEDFE21698D9`). Yosys reports `0.69+150 (0d3483f04-dirty)` and nextpnr reports `nextpnr-0.11.1-31-g3edea68e`. The default ABC9 path failed in this Windows build at `write_xaiger2` with an assertion in `aiger.cc`; `-noabc` completed but left 12 `$_ORNOT_` cells that nextpnr cannot accept. `fpga/map_ornot.v` maps each to an equivalent iCE40 LUT. Its four-entry truth table was checked independently. This is a tool-flow workaround, not a performance optimization.

## Observed results

| Evidence | Result |
| --- | --- |
| RTL serial-path simulation | Five testbenches passed, including candidate frames through the UART receiver and a stop-bit error case. |
| Yosys synthesis | 315 `SB_LUT4`, 74 `SB_CARRY`, and 219 `SB_DFF*` cells in the probe netlist. |
| nextpnr device utilization | 570/5280 logic cells (10%), 4/39 I/O (10%), 2/8 global buffers (25%). |
| nextpnr 48 MHz timing check | **Failed**. Routed maximum frequency was 35.52 MHz with seed 1. The critical register path traverses the 32-bit BBO comparison carry chain. |
| Bitstream | Not produced because the timing gate failed. |

The place-and-route frequency is **synthesis-derived tool evidence**, not a measured board clock. The reported result is tied to this provisional top, pin map, tool version, mapping workaround, and seed. The 48 MHz target remains open; it has not been relaxed to claim success. Further work must improve the mapped comparison path or use a validated ABC9 flow, then rerun timing on the final board top.
