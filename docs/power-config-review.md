# Power, clock and master-SPI schematic review

This review covers [hardware/power_config.tsx](../hardware/power_config.tsx), a **partial** tscircuit schematic for the FPGA power, reset, clock and boot-flash path. The full USB/FT2232H circuit and four-layer placement/routing are later increments. `P5V` is an input from a conditioned 5 V source; this file does not connect raw USB VBUS to bulk capacitance.

## Captured circuit

| Function | Captured parts and connection | Primary design source |
| --- | --- | --- |
| Core supply | TPS7A9001DSKR U1, 1.1992 V nominal; U1 PG enables U2 | [TI TPS7A90 data sheet](https://www.ti.com/lit/ds/symlink/tps7a90.pdf) |
| I/O and flash supply | TPS7A9001DSKR U2, 3.296 V nominal; U2 PG enables U3 | [TI TPS7A90 data sheet](https://www.ti.com/lit/ds/symlink/tps7a90.pdf) |
| Master-SPI VPP supply | TPS7A9001DSKR U3, 2.504 V nominal | [Lattice UltraPlus data sheet](https://www.latticesemi.com/view_document?document_id=51968) |
| Reset release | TPS389025DSER U4 senses 2.5 V and drives open-drain `CRESET_B`; 10 nF CT gives about 10.7 ms nominal delay | [TI TPS3890 data sheet](https://www.ti.com/lit/ds/symlink/tps3890.pdf) |
| FPGA | iCE40UP5K-SG48I U5, package numbers 1–48 and exposed paddle represented as schematic pin 49 | [Lattice SG48 pinout](https://www.latticesemi.com/view_document?document_id=51971) |
| Boot flash | W25Q16JVSSIQ U6 candidate on FPGA master-SPI signals; `/WP` and `/HOLD` pulled high | [Lattice programming note](https://www.latticesemi.com/view_document?document_id=46502) |
| FPGA clock | SiT8008BI-23-33E-48.000000 U7, 48 MHz at FPGA pin 35 | [SiTime SiT8008 data sheet](https://www.sitime.com/datasheet/sit8008) |

For the regulator feedback dividers, `VOUT = 0.8 × (1 + RTOP/RBOTTOM)` gives 1.1992, 3.296 and 2.504 V with `RBOTTOM=100 kΩ` and `RTOP=49.9/312/213 kΩ`. These are calculated nominal values. The selected 0.1% feedback resistors and regulator accuracy need to be combined with rail transients and temperature for a final tolerance budget. The 8.2 nF NR/SS capacitors produce the calculated ideal ramp bounds in [power-design.md](power-design.md); they do not constitute measured ramp evidence.

The Lattice hardware checklist calls for 4.7 µF + 100 nF at each FPGA supply pin and 100 Ω plus local capacitors on VCCPLL. The schematic represents two core-pin pairs, three 3.3 V I/O-pin pairs, one VPP pair, and a filtered VCCPLL pair. Input and output regulator capacitors are 22 µF nominal; a capacitor orderable part must be selected whose **effective** capacitance meets TI's 10 µF minimum after DC-bias loss. The final physical placement must put each pair near its corresponding package pin.

## Netlist checks actually performed

Run `powershell -File hardware/check_schematic.ps1` from the repository root. The script builds the tscircuit schematic without PCB output, checks the generated netlist against explicit SG48 pin/rail/flash/clock expectations in [check_power_config.mjs](../hardware/check_power_config.mjs), and invokes `tsci check netlist`. The latest run returned 51 components, 27 nets, zero netlist errors and zero netlist warnings. `tsci check pin_specification` also returned zero errors and zero warnings. The rendered schematic was inspected for component grouping and signal intent; the generated drawing's automatic passive layout is dense, so pin-accurate review uses the generated netlist and targeted checks.

These checks verify connectivity in the captured schematic. They do not verify analogue startup, a real PCB pad map, USB current limits, signal integrity, manufacturability, or physical timing.

## Release gates for the next hardware increments

1. Integrate FT2232H, USB-C, inrush-controlled `P5V`, pre-enumeration current management, host reset control and flash-bus isolation. Preserve the default FPGA ownership of the flash bus.
2. Confirm the exact flash and oscillator orderable numbers, configuration commands, startup timing, current consumption, and available stock.
3. Replace provisional land patterns with manufacturer-reviewed footprints. The exposed FPGA and TPS7A90 pads are represented as numbered schematic pins; the current generic footprinter footprints have not yet been shown to map those pins to the copper pad. PCB output from this partial design is intentionally disabled.
4. Select rated capacitors and perform a worst-case load, thermal and voltage-tolerance calculation. Verify 3.3 V rail current with the FTDI bridge included, and resolve the zero guaranteed low-level noise margin between regulator PG and downstream EN.
5. Simulate or measure the three rail ramps and reset state during power-up, power-down and brownout. Confirm the flash is command-ready before the FPGA starts reading it.

No physical board measurements are claimed.
