# Power, clock and master-SPI schematic review

This review records the FPGA power, reset, clock and boot-flash slice of [hardware/power_config.tsx](../hardware/power_config.tsx) at the power/configuration checkpoint. The later [USB/FTDI review](usb-ftdi-review.md) covers the integrated self-powered USB and flash-programming circuit. `P5V` receives external regulated 5 V through a fuse and diode; raw USB VBUS is sense-only.

## Captured circuit

| Function | Captured parts and connection | Primary design source |
| --- | --- | --- |
| Core supply | TPS7A9001DSKR U1, 1.1992 V nominal; U1 PG enables U2 | [TI TPS7A90 data sheet](https://www.ti.com/lit/ds/symlink/tps7a90.pdf) |
| I/O and flash supply | TPS7A9001DSKR U2, 3.328 V nominal; U2 PG enables U3 | [TI TPS7A90 data sheet](https://www.ti.com/lit/ds/symlink/tps7a90.pdf) |
| Master-SPI VPP supply | TPS7A9001DSKR U3, 2.56 V nominal | [Lattice UltraPlus data sheet](https://www.latticesemi.com/view_document?document_id=51968) |
| Reset release | TPS3808G01DBVR U4 senses 2.5 V through a 0.1 % divider and drives open-drain `CRESET_B`; 10 nF CT gives about 58 ms nominal delay | [TI TPS3808 data sheet](https://www.ti.com/lit/ds/symlink/tps3808.pdf) |
| FPGA | iCE40UP5K-SG48I U5, package numbers 1–48 and exposed paddle represented as schematic pin 49 | [Lattice SG48 pinout](https://www.latticesemi.com/view_document?document_id=51971) |
| Boot flash | W25Q16JVSSIQ U6 candidate on FPGA master-SPI signals; `/WP` and `/HOLD` pulled high | [Lattice programming note](https://www.latticesemi.com/view_document?document_id=46502) |
| FPGA clock | Abracon ASE-48.000MHZ-LC-T U7, 48 MHz at FPGA pin 35 | [Abracon ASE data sheet](https://abracon.com/Oscillators/ASEseries.pdf) |

For the regulator feedback dividers, `VOUT = 0.8 × (1 + RTOP/RBOTTOM)` gives 1.1992, 3.328 and 2.56 V with `RBOTTOM=100 kΩ` and `RTOP=49.9/316/220 kΩ`. These are calculated nominal values. Their 1 % static tolerance budget, including regulator accuracy, is in [part selection](part-selection.md); rail transients remain to be added. The 6.8 nF NR/SS capacitors produce the calculated ideal ramp bounds in [power-design.md](power-design.md); they do not constitute measured ramp evidence.

The Lattice hardware checklist calls for 4.7 µF + 100 nF at each FPGA supply pin and 100 Ω plus local capacitors on VCCPLL. The schematic represents two core-pin pairs, three 3.3 V I/O-pin pairs, one VPP pair, and a filtered VCCPLL pair. Input and output regulator capacitors are 22 µF nominal; a capacitor orderable part must be selected whose **effective** capacitance meets TI's 10 µF minimum after DC-bias loss. The final physical placement must put each pair near its corresponding package pin.

## Netlist checks actually performed

At this checkpoint, `hardware/check_schematic.ps1` built the partial circuit without PCB output, checked the generated netlist against explicit SG48 pin/rail/flash/clock expectations in [check_power_config.mjs](../hardware/check_power_config.mjs), and invoked `tsci check netlist`. That run returned 51 components, 27 nets, zero netlist errors and zero netlist warnings. `tsci check pin_specification` also returned zero errors and zero warnings. The rendered schematic was inspected for component grouping and signal intent; the generated drawing's automatic passive layout was dense, so pin-accurate review used the generated netlist and targeted checks. The current combined circuit has additional components and checks; see [USB/FTDI review](usb-ftdi-review.md).

These checks verify connectivity in the captured schematic. They do not verify analogue startup, a real PCB pad map, USB current limits, signal integrity, manufacturability, or physical timing.

## Release gates for the next hardware increments

1. Review the integrated FT2232H/USB-C circuit's actual footprints, external 5 V entry protection, host reset control and flash-bus isolation. Preserve the default FPGA ownership of the flash bus.
2. Confirm the exact flash and oscillator orderable numbers, configuration commands, startup timing, current consumption, and available stock.
3. The FPGA, regulator, supervisor, FTDI and USB-C land patterns have been compared with manufacturer drawings, and the exposed FPGA and TPS7A90 pads map to schematic pins 49 and 11 ([footprint review](footprint-review.md)). The generic flash, oscillator and passive footprints, courtyards and paste apertures remain to be reviewed.
4. Select rated capacitors and perform a worst-case load, thermal and voltage-tolerance calculation. Verify 3.3 V rail current with the FTDI bridge included, and resolve the zero guaranteed low-level noise margin between regulator PG and downstream EN.
5. Simulate or measure the three rail ramps and reset state during power-up, power-down and brownout. Confirm the flash is command-ready before the FPGA starts reading it.

No physical board measurements are claimed.
