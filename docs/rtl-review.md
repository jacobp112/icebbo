# Initial RTL engineering review

## Module boundaries

- `frame_parser` accepts a byte only when `byte_valid && byte_ready` at a rising edge. It recognizes `A5` only in idle, consumes the remaining six bytes, and emits a registered candidate only when control and CRC are valid.
- `candidate_bbo` accepts a decoded candidate each rising edge outside reset. It registers the input, then applies the comparison on the following rising edge. Its valid bits make zero a legal price.
- `market_data_core` connects these modules. UART reception and the host readback channel remain future integration work.

For a frame whose last byte is accepted at edge N, the parser raises candidate-valid after N; the core accepts it at N+1; BBO registers update after N+2. The directed testbench checks this sequence. This is a **simulated cycle count**. It implies no nanosecond figure until a real clock is constrained and the design is placed and routed.

The core accepts one candidate every clock edge, including consecutive candidates on the same side. The byte parser can consume bytes on consecutive edges; a completed frame is seven accepted bytes. This does not mean the board receives one market message each FPGA clock, because the intended host interface is UART.

## Directed simulation completed

`sim/tb_candidate_bbo.v` checks reset, one-cycle core latency, consecutive improving bids, and a zero-valued first ask. `sim/tb_market_data_core.v` checks first bid and ask, better and worse bids, malformed CRC and control, reset, and the two-edge final-byte-to-state path. Both passed with the Icarus compiler and runtime from OSS CAD Suite Windows x64 archive `oss-cad-suite-windows-x64-20260924.tgz` (SHA-256 `672AF9950C32139C5E0126B528BFF12EA7A1926551EE736DC1DBDEDFE21698D9`). The compiler reports `Icarus Verilog version 14.0 (devel) (s20260301-478-g3c8a8a9a1-dirty)`.

The test command was:

```powershell
./sim/run.ps1 -ToolBin 'C:\Users\jacob\AppData\Local\icebbo-toolchain\oss-cad-suite\bin'
```

For another installation, run `sim/run.ps1` inside an activated OSS CAD Suite environment, or pass its own `bin` directory to `-ToolBin`. The path above records the local run, not a project requirement.

## Review findings and next verification gate

The initial RTL implements the specified running extrema and does not require a pipeline bypass for consecutive core candidates: at each update edge it sees the BBO value written at the preceding edge. The next verification increment will drive **all saved protocol vectors** against RTL, including equal prices, both representable extremes, marker bytes inside price, and additional back-to-back frame cases. It will also test parser stalls and reset mid-frame. No synthesis result, timing slack, physical board behaviour or transport latency is claimed here.

That verification increment is recorded in [verification.md](verification.md). The next distinct gate is FPGA synthesis and place-and-route evidence.
