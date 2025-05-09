# Architecture decision record — initial foundation

## Scope and interfaces

The board demonstrates a one-instrument stream of candidate bid/ask prices. It maintains the maximum bid and minimum ask observed since reset. It has no order identities, quantities, deletions, depth, matching, Ethernet, FIX, or exchange connectivity. An invalid side has a separate valid bit, so a zero price is representable.

The host sends bytes through FT2232H channel B in UART mode. A byte parser checks the fixed frame and CRC before presenting a decoded candidate through a ready/valid interface to the core. FT2232H channel A will serve SPI flash programming. A dedicated readback protocol for the two valid bits and prices remains to be specified with the host interface increment; it is outside the candidate input frame.

## FPGA and clock

Candidate: Lattice ICE40UP5K-SG48I, 7 x 7 mm QFN with 0.5 mm pitch, 39 I/O, and 5,280 LUTs. A dedicated 48 MHz CMOS oscillator is the planned clock. Forty-eight MHz is a constraint target, not a timing claim. Plain Verilog is chosen so the byte parser and state update have directly reviewable register boundaries. Yosys `synth_ice40`, nextpnr `--up5k --package sg48`, and IceStorm are the planned open flow.

## Proposed synchronous core

At an accepted `candidate_valid && candidate_ready` rising edge, the side and price enter a candidate register. On the next rising edge, the core compares that candidate with the corresponding stored extrema and updates the register if qualified. Outputs are register values after that edge. The initial directed Icarus testbenches confirm this one-cycle core transfer-to-update interval and consecutive same-side candidates. For a complete seven-byte frame, the final byte is accepted at edge N, the core accepts the parser output at N+1, and the state updates at N+2. The UART receiver precedes this byte interface and its latency is separate. These are simulated cycle results, not synthesis timing or physical measurements.

## Board subsystems and review gates

1. USB-C and FT2232H: use the FTDI **self-powered** reference. An external regulated 5 V input supplies the board; USB VBUS is sensed but does not feed the regulators. The FTDI has its own 12 MHz crystal, 1.8 V regulator connections, EEPROM, reset, USB protection and CC resistors. The initial source-current analysis is in [USB/FTDI review](usb-ftdi-review.md).
2. Configuration: 3.3 V SPI flash in master-SPI boot mode. A four-channel buffer isolates FT2232H channel A from the flash bus unless the host requests programming while FPGA reset is actually asserted. Review flash bus ownership in power-up, reset, programming and run states.
3. Power: proposed 1.2 V core/PLL, 3.3 V I/O/SPI/USB bridge and 2.5 V VPP rails. Initial load allowances are 150, 200 and 30 mA respectively; these are engineering budgets, not measurements. Check regulator dissipation, decoupling, ramp and sequencing against the current Lattice and FTDI datasheets. Hold CRESET_B asserted until rails are valid. Regulator and supervisor parts are not yet frozen.
4. Clock and layout: place the FPGA oscillator near its clock input. A four-layer stack is proposed: top signal, continuous ground, power/ground regions, bottom signal. Select a fabricator stack-up and calculate USB differential geometry before routing. Review return paths, QFN fanout, thermal pad and decoupler placement on the rendered board.

The schematic, PCB, timing and measurement reviews are separate gates. A tscircuit render or autorouter completion alone does not certify the design for fabrication.

## Source documents consulted

- [Lattice iCE40 UltraPlus data sheet, FPGA-DS-02008-2.4](https://www.latticesemi.com/-/media/LatticeSemi/Documents/DataSheets/iCE/FPGA-DS-02008-2-4-iCE40-UltraPlus-Family-Data-Sheet.ashx?document_id=51968)
- [Lattice iCE40 hardware checklist, FPGA-TN-02006-2.4](https://www.latticesemi.com/-/media/LatticeSemi/Documents/ApplicationNotes/IK/FPGA-TN-02006-2-4-iCE40-Hardware-Checklist.ashx?document_id=47779)
- [Lattice programming and configuration note](https://www.latticesemi.com/-/media/LatticeSemi/Documents/ApplicationNotes/IK/FPGA-TN-02001-3-4-iCE40-Programming-Configuration.ashx?document_id=46502)
- [FT2232H data sheet](https://ftdichip.com/wp-content/uploads/2020/07/DS_FT2232H.pdf)
- [FTDI MPSSE SPI application note](https://ftdichip.com/wp-content/uploads/2020/08/AN_114_FTDI_Hi_Speed_USB_To_SPI_Example.pdf)
- [tscircuit CLI](https://github.com/tscircuit/cli)
- [nextpnr iCE40 constraints](https://github.com/YosysHQ/nextpnr/blob/main/docs/ice40.md)
