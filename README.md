# icebbo

A proposed four-layer, USB-connected iCE40UP5K board for a deliberately small market-data processing experiment. The FPGA will maintain the highest bid candidate and lowest ask candidate seen since reset for one instrument.

**Status:** protocol and RTL verification are complete for the constrained core. An initial provisional FPGA place-and-route run [failed the 48 MHz target](docs/synthesis.md). There is no board layout, final timing result, fabricated hardware, or physical latency measurement yet. All saved protocol vectors have been replayed against RTL; the verification coverage and limits are in [docs/verification.md](docs/verification.md).

This is a running-extrema demonstration. It cannot recover the next-best quote after a withdrawal and is not a complete order book, matching engine, or exchange feed.

## Proposed data path

```text
Host bytes -> FT2232H UART -> frame/CRC parser -> candidate register
                                            -> bid/ask compare and update
                                            -> BBO registers and readback
```

The proposed FPGA is an ICE40UP5K-SG48I clocked by a dedicated 48 MHz oscillator. The board architecture and electrical review gates are in [docs/architecture.md](docs/architecture.md). The exact byte protocol is in [protocol/spec.md](protocol/spec.md).

The initial RTL testbench observes a valid frame's last byte at edge N, a candidate transfer at N+1, and the updated BBO registers after edge N+2. This is **simulated cycle behaviour**, not a timed physical result. The candidate core alone updates one edge after its input transfer.

The module boundaries, initial directed test coverage and tool version are recorded in [docs/rtl-review.md](docs/rtl-review.md). Expanded coverage is in [docs/verification.md](docs/verification.md).

The provisional serial-input top, SG48 pin choices, synthesis counts, failed timing check, and tool-flow limitation are recorded in [docs/synthesis.md](docs/synthesis.md).

## Current reproducible check

Python 3.11 or later is sufficient for the reference model and its vectors:

```text
py -3 -m unittest discover -s protocol -p "test_*.py" -v
```

With Python on `PATH` and an OSS CAD Suite environment active, run the RTL testbenches from PowerShell:

```text
./sim/run.ps1
```

Alternatively, pass its `bin` directory through `-ToolBin`. The test runner uses Icarus Verilog, converts the saved vectors to temporary simulation inputs, and fails on a compile or simulation error.

The tscircuit and Bun versions selected for board development are pinned in `package.json` and `package-lock.json`. Install them with `npm ci`, then check the CLI with `npx tsci --version`. Bun is required by the tscircuit CLI on this Windows setup. The RTL simulator and synthesis tool versions will be pinned and reported with their first use.

## Evidence policy

RTL cycles, synthesis-derived timing, calculated datapath time, software benchmark samples, and physical board observations will be labelled separately. USB and UART transport time will never be called FPGA datapath latency. No performance number is available yet.
