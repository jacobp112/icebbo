# Deterministic RTL verification

## Shared oracle

`protocol/build_vectors.py` defines 21 named cases with literal expected valid bits and prices. It checks those expectations against the Python reference model, then saves the frames and expected state in `protocol/vectors.json`. `sim/build_vector_mem.py` converts that saved JSON into temporary Icarus memory files; it does not calculate BBO results. `sim/tb_vector_replay.v` sends each frame byte by byte to `market_data_core` and checks both decoded candidate acceptance and the complete state after the update edge. Reset actions also check that both valid bits and both prices clear.

The saved cases include first, improving, worse and equal prices on each side; invalid CRC and control; repeated frames; reset; zero and maximum 32-bit values; and an `A5` marker inside a price. The Python test independently exercises the reference stream decoder against these same cases.

## Parser handshake and reset

`sim/tb_frame_parser.v` holds a decoded candidate while the consumer is stalled and checks that the output remains stable and input ready stays low. It then consumes that candidate and the next frame's start marker on the same edge. It also resets the parser during an incomplete frame, sends the discarded suffix, verifies that a subsequent complete frame decodes, and sends two complete frames with no idle byte between them.

The earlier directed tests still check the core's registered update interval, consecutive improving bids, the zero-price validity case, and the final-frame-byte-to-state cycle sequence.

## Reproduce

Run from the repository root with Python on `PATH` and OSS CAD Suite activated:

```powershell
python -m unittest discover -s protocol -p test_reference.py
python protocol/build_vectors.py --check
./sim/run.ps1
```

Alternatively pass the suite's `bin` directory as `-ToolBin` to `sim/run.ps1`. The script runs four Icarus testbenches and fails if compilation, simulation, or vector conversion fails. Vector memory and simulation binaries are generated under ignored `build/sim/`.

These are **simulation results**. The suite does not establish placed-and-routed timing, UART or USB transport time, or physical board latency. It is deterministic coverage of the stated protocol, not exhaustive formal verification.
