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

## Library footprints

The remaining non-passive parts use tscircuit footprint-generator strings. Their defaults are generic, so each part was compared with its own manufacturer's drawing. Where they disagreed, the drawing's dimensions are now passed as parameters.

| Part | Package | Reference | Result |
| --- | --- | --- | --- |
| U6 W25Q16JVSSIQ | 8-pin SOIC, **208 mil** (code SS) | [Winbond W25Q16JV](https://www.winbond.com/resource-files/w25q16jv%20spi%20revd%2008122016.pdf) section 10.2; the land follows the KiCad `SOIC-8_5.3x5.3mm_P1.27mm` footprint | **Corrected.** The default `soic8` is a 150-mil pattern whose pads ended 2.65 mm from centre, while Winbond's feet lie 3.15–3.95 mm out (H 7.70–8.10, L 0.50–0.80), so the pads would not have touched the leads. Now 1.625 × 0.65 mm pads on 7.175 mm centres. U6 moved 2 mm right to clear its decoupling capacitors. |
| U11 93LC46B-I/SN | 8-pin SOIC, 150 mil | Microchip land pattern C04-2057-SN in the [93LC46B data sheet](https://ww1.microchip.com/downloads/aemDocuments/documents/MPD/ProductDocuments/DataSheets/93AA46A-B-C-93LC46A-B-C-93C46A-B-C-1-Kbit-Microwire-Compatible-Serial-EEPROM-Data-Sheet-DS20001749.pdf) | **Corrected** to 1.55 × 0.60 mm pads on 5.40 mm centres. The default was 1.0 mm pads on 4.3 mm centres. |
| U9 SN74LVC126APWR | TSSOP-14 (PW0014A) | TI example board layout 4220202/B in the [SN74LVC126A data sheet](https://www.ti.com/lit/ds/symlink/sn74lvc126a.pdf) | **Corrected** to 1.5 × 0.45 mm pads on 5.8 mm centres. The default 1.45 × 0.30 mm pads on 4.45 mm centres ended short of the lead feet. |
| U10 SN74LVC1G02DBVR | SOT-23-5 (DBV0005A) | TI example board layout 4214839/K in the [SN74LVC1G02 data sheet](https://www.ti.com/lit/ds/symlink/sn74lvc1g02.pdf) | **Aligned** to TI's 1.1 × 0.6 mm pads on 2.6 mm centres. The default IPC-style pattern also covered the feet. |
| U12 TPD2EUSB30ADRTR | DRT, 1.0 × 0.8 mm three-pin SOT | TI DRT land pattern 4211172/A, taken from an [archived 2019 TPD2EUSB30A data sheet](https://agelectronica.lat/pdfs/textos/T/TPD2EUSB30ADRTR.PDF) because the [current TI data sheet](https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf) omits the addendum | **Corrected.** This was drawn as a 2.9 mm SOT-23, a different package. A custom `TiDrtFootprint` now has three 0.3 mm square pads: pins 1 and 2 on 0.70 mm centres, and pin 3 0.85 mm opposite. D+ and D− are symmetric clamps to pin 3 GND, so the D+/D− pin assignment does not change function. |
| U7 SiT8008BI-23-33E | 3.2 × 2.5 mm 4-pad oscillator | [SiT8008 data sheet](https://www.sitime.com/datasheet/SiT8008) recommended land pattern; package code `2` confirmed as 3.2 × 2.5 mm on [SiTime's part page](https://www.sitime.com/parts/sit8008bi-23-33e-25000000) | **Corrected.** Pads are 1.4 × 1.2 mm, 2.2 mm apart along pins 1–2 and **1.9 mm** across. The default was 1.7 mm across. |
| X2 ABM8-12.000MHZ-B2-T | 3.2 × 2.5 mm 4-pad crystal | [Abracon ABM8](https://abracon.com/Resonators/abm8.pdf) recommended land pattern | **Corrected** to 1.3 × 1.05 mm pads with a 1.0 × 0.7 mm gap, which gives centres of 2.3 × 1.75 mm. The default had 1.4 × 1.2 mm pads with a 0.8 × 0.5 mm gap. |
| F1 MF-PSMF110X-2 | **0805** PTC | [Bourns MF-PSMF](https://www.bourns.com/docs/Product-Datasheets/mfpsmf.pdf): body 2.00–2.30 × 1.20–1.50 mm, "PSMF = 0805 Surface Mount" | **Corrected** from a 1206 footprint to 0805. Bourns gives Ihold as 1.10 A at 23 °C but only 0.65 A at 70 °C. That derating belongs in the power review. |
| J1 B2B-PH-K-S | JST PH, 2 × 2.0 mm, through-hole | [JST PH catalogue](https://www.jst-mfg.com/product/pdf/eng/ePH.pdf) | The 2.0 mm pitch and 5.9 × 4.5 mm body are consistent. The catalogue gives no PCB hole size; the generic 1.0 mm hole with 1.5 mm pad is **unverified** against JST's individual drawing. |
| D1 SS14, Q1 2N7002 | SMA, SOT-23 | — | **Unverified.** Both part numbers are multi-vendor, and no manufacturer has been chosen. The generic `sma` and `sot23` patterns stay until an orderable part is fixed. |

The pin order of U7 and X2 (1 → 2 along the long pitch, counter-clockwise from above) and of U6, U9, U10 and U11 matches their data-sheet top views. The tscircuit builder's courtyard check first flagged U6 against C23 and C24; that clash is resolved by the move.

## Placement

The board outline grew from 80 × 60 mm to 100 × 70 mm to hold the FTDI section. Parts are grouped by function: the 5 V entry and three regulators at the top left, the FPGA, flash and oscillator at the right, and the USB-C connector, FT2232HL, EEPROM and crystal at the bottom left. J2 is placed so its front stakes sit 2.6 mm inside the board edge, at the reference edge line in the KiCad footprint. **That offset comes from the KiCad library rather than a dimension read directly from the GCT drawing, so confirm it against the drawing before fabrication.**

The 1206 and 0805 case sizes for bulk capacitors are placeholders for the rated, orderable parts still to be selected.

## Courtyards and silkscreen

Each custom footprint has a courtyard rectangle enclosing the larger of its body and its copper, plus 0.25 mm (IPC-7351 nominal):

| Footprint | Courtyard | Silkscreen |
| --- | --- | --- |
| TPS7A90 DSK0010A | 3.4 × 3.0 mm | lines above and below the body, pin-1 dot |
| TPS3890 DSE0006A | 2.4 × 2.0 mm | lines above and below the body, pin-1 dot |
| iCE40 SG48 | 8.1 × 8.1 mm | body corner marks, pin-1 dot |
| FT2232HL LQFP-64 | 13.3 × 13.3 mm | body corner marks, pin-1 dot |
| TI DRT | 1.5 × 1.65 mm | pin-1 dot |
| USB4105 | 10.64 × 8.94 mm | side lines between the shell stakes |

The USB4105 body outline, courtyard and side marks follow the KiCad library footprint, converted with y = 1.075 − y<sub>KiCad</sub>. The body front sits on the board-edge line, and the courtyard extends 0.5 mm past the edge as the connector mouth overhangs. With courtyards on every part, the builder's overlap check found the FPGA touching C15's courtyard, so C15 moved 0.3 mm.

Silkscreen on these footprints is at least 0.1 mm from copper. The generator's SOIC and TSSOP outlines (U6, U9, U11) sit at a fixed 0.05 mm inside their pad rows. Its only alternative drops all silkscreen, including the pin-1 mark, so they are kept; the fabricator may trim them.

## Checks run

`hardware/check_schematic.ps1` builds the board with PCB output and autorouting disabled. It runs both targeted netlist checks and `tsci check netlist`, which reports zero errors and zero warnings. It also runs [check_pcb.mjs](../hardware/check_pcb.mjs) on the generated circuit JSON, which asserts that:

- every schematic port has a PCB pad
- all copper stays at least the board's 0.2 mm edge clearance inside the 100 × 70 mm outline
- pads of different components are at least 0.2 mm apart, compared pad against pad
- every part has a courtyard
- silkscreen is at least 0.1 mm from copper on the custom footprints and 0.05 mm on generator footprints
- each reviewed footprint keeps its pad count and the corrected dimensions above: the DSK and SG48 exposed pads, TPS3890 pad lengths, FT2232HL row spacing, USB4105 stake sizes and edge offset, the SOIC/TSSOP/SOT-23-5 row spacing and pad sizes, the DRT pads, and the oscillator and crystal pitches

The check caught each of these deliberately broken copies of the generated board:

- a pad overlapping another part
- a pad at the board edge
- the old TPS3890 pad length
- the old 12 mm FT2232HL row spacing
- the old J2 position
- a pin with no pad
- a part without a courtyard
- a pin-1 dot on a pad
- a SOIC outline pushed onto its pads
- U6 back on 150-mil rows
- the old U9 pad width
- a SOT-23-sized U12 pad
- the default crystal pitch on X2

`hardware/footprint_probe.tsx` also builds with PCB output.

## Open items

- Choose manufacturers for D1 and Q1 and review their footprints. Confirm J1's hole size from JST's individual drawing. The standard 0603/0805/1206 passive patterns are unreviewed.
- Paste-mask apertures for the exposed pads follow the tool default. The TI drawings recommend reduced-coverage stencils, for example 84 % for DSK0010A.
- Decoupling placement against each FPGA supply pin, thermal vias, and USB differential routing all wait for routing.
