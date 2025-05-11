# Footprint and placement review

The five hand-drawn land patterns in [footprints.tsx](../hardware/footprints.tsx) were compared with their manufacturers' published drawings. The initial component positions in [placement.ts](../hardware/placement.ts) put all 91 parts on a 100 × 70 mm four-layer outline. This is a desk review of copper geometry against documents. No board has been routed, fabricated or assembled, and no part has been test-fitted.

## Land-pattern comparison

| Part | Package | Reference | Result |
| --- | --- | --- | --- |
| U1–U3 TPS7A9001 | DSK0010A, 2.5 mm WSON | TI example board layout 4218903/C, reproduced in the [TPS63900 data sheet](https://www.ti.com/lit/ds/symlink/tps63900.pdf). The current [TPS7A90 data sheet](https://www.ti.com/lit/ds/symlink/tps7a90.pdf) revision B omits the package addendum. | Matches: 10 × 0.6 × 0.25 mm pads at 0.5 mm pitch, 2.3 mm row centres, 1.2 × 2.0 mm thermal pad as pin 11. |
| U4 TPS389025 | DSE0006A, 1.5 mm WSON | TI example board layout 4220552/B in the [TPS3890 data sheet](https://www.ti.com/lit/ds/symlink/tps3890.pdf) | **Corrected.** TI specifies five 0.7 mm pads and one 0.8 mm pin-1 pad, all 0.25 mm wide on 1.2 mm row centres. Pins 2 and 3 were previously 0.8 mm. Pin 1's longer terminal is taken to extend toward the package centre, keeping its outer edge flush with the others. |
| U5 iCE40UP5K-SG48I | 48-pin QFN, 7 × 7 mm | Lattice [Package Diagrams](https://www.latticesemi.com/view_document?document_id=213), FPGA-DS-02053-8.8, section 31 | Consistent. The package paddle D2/E2 is 5.20/5.35/5.50 mm (min/nom/max), b is 0.15/0.225/0.30 mm and L is 0.35/0.40/0.45 mm. The 5.4 mm paddle pad and 0.25 × 0.8 mm leads centred 3.4 mm out cover each terminal with a 0.3 mm toe, and leave 0.3 mm to the paddle pad. Lattice publishes no land pattern for this package, so these proportions are an engineering choice. |
| U8 FT2232HL | LQFP-64, 10 mm body | FTDI [TN_166](https://brtchip.com/wp-content/uploads/Support/Documentation/Technical_Notes/ICs/MCU/TN-166-FTDI-Example-IC-PCB-Footprints.pdf), figure 26.2 | **Corrected.** TN_166 gives 1.65 × 0.30 mm pads on 11.15 mm row centres. The rows were previously at 12.0 mm, which put each pad's inner edge only about 0.1 mm past the lead heel. |
| J2 GCT USB4105-GF-A | USB-C, 16-pin SMT top mount | GCT [USB4105 drawing](https://gct.co/files/drawings/usb4105.pdf) revision B, recommended PCB layout; cross-checked against the KiCad library footprint `USB_C_Receptacle_GCT_USB4105-xx-A_16P_TopMnt_Horizontal` | **Corrected.** The contacts, rear stakes and locating holes matched. The front shell stakes were 1.0 × 2.0 mm copper; GCT specifies 1.0 × 1.8 mm with 0.6 × 1.4 mm slots. The rear stakes were 1.05 mm wide; GCT specifies 1.00 mm. |

The USB4105 contact order was also checked against GCT's A/B pin table. From the component side the row reads A1/B12 GND, A4/B9 VBUS, B8 SBU2, A5 CC1, B7 D−2, A6 D+1, A7 D−1, B6 D+2, A8 SBU1, B5 CC2, B4/A9 VBUS, B1/A12 GND. That matches `pin15`–`pin26` in [usb_ftdi.tsx](../hardware/usb_ftdi.tsx). All four shell stakes connect to GND.

## Placement

The board outline grew from 80 × 60 mm to 100 × 70 mm to hold the FTDI section. Parts are grouped by function: the 5 V entry and three regulators at the top left, the FPGA, flash and oscillator at the right, and the USB-C connector, FT2232HL, EEPROM and crystal at the bottom left. J2 is placed so its front stakes sit 2.6 mm inside the board edge, at the reference edge line in the KiCad footprint. **That offset comes from the KiCad library rather than a dimension read directly from the GCT drawing, so confirm it against the drawing before fabrication.**

The 1206 and 0805 case sizes for bulk capacitors are placeholders for the rated, orderable parts still to be selected.

## Checks run

`hardware/check_schematic.ps1` builds the board with PCB output and autorouting disabled. It runs both targeted netlist checks and `tsci check netlist`, which reports zero errors and zero warnings. It also runs [check_pcb.mjs](../hardware/check_pcb.mjs) on the generated circuit JSON, which asserts that:

- every schematic port has a PCB pad
- all copper stays at least the board's 0.2 mm edge clearance inside the 100 × 70 mm outline
- pads of different components are at least 0.2 mm apart, compared pad against pad
- each reviewed footprint keeps its pad count and the corrected dimensions above: the DSK and SG48 exposed pads, TPS3890 pad lengths, FT2232HL row spacing, and USB4105 stake sizes and edge offset

The check caught each of these deliberately broken copies of the generated board:

- a pad overlapping another part
- a pad at the board edge
- the old TPS3890 pad length
- the old 12 mm FT2232HL row spacing
- the old J2 position
- a pin with no pad

`hardware/footprint_probe.tsx` also builds with PCB output.

## Open items

- The custom footprints have no courtyard or silkscreen outline yet. The tscircuit builder warns about the missing courtyards.
- The generic `crystal4`, `sma`, `sot23*`, `soic8`, `tssop14` and passive footprints have not been compared with their parts' data sheets.
- Paste-mask apertures for the exposed pads follow the tool default. The TI drawings recommend reduced-coverage stencils, for example 84 % for DSK0010A.
- Decoupling placement against each FPGA supply pin, thermal vias, and USB differential routing all wait for routing.
