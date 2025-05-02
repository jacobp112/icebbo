# icebbo

A proposed four-layer, USB-connected iCE40UP5K board for a deliberately small market-data processing experiment. The FPGA will maintain the highest bid candidate and lowest ask candidate seen since reset for one instrument.

**Status:** protocol and tooling foundation. There is no board layout, RTL implementation, synthesis result, fabricated hardware, or latency measurement yet. The current software model and vectors define expected behaviour for the coming RTL work.

This is a running-extrema demonstration. It cannot recover the next-best quote after a withdrawal and is not a complete order book, matching engine, or exchange feed.

## Proposed data path

```text
Host bytes -> FT2232H UART -> frame/CRC parser -> candidate register
                                            -> bid/ask compare and update
                                            -> BBO registers and readback
```

The proposed FPGA is an ICE40UP5K-SG48I clocked by a dedicated 48 MHz oscillator. The board architecture and electrical review gates are in [docs/architecture.md](docs/architecture.md). The exact byte protocol is in [protocol/spec.md](protocol/spec.md).

## Current reproducible check

Python 3.11 or later is sufficient for the reference model and its vectors:

```text
py -3 -m unittest discover -s protocol -p "test_*.py" -v
```

The tscircuit and Bun versions selected for board development are pinned in `package.json` and `package-lock.json`. Install them with `npm ci`, then check the CLI with `npx tsci --version`. Bun is required by the tscircuit CLI on this Windows setup. The RTL simulator and synthesis tool versions will be pinned and reported with their first use.

## Evidence policy

RTL cycles, synthesis-derived timing, calculated datapath time, software benchmark samples, and physical board observations will be labelled separately. USB and UART transport time will never be called FPGA datapath latency. No performance number is available yet.
