# Regulator thermal and headroom budget

This is a static worst-case calculation for the three TPS7A90 linear regulators at the 40 °C bench rating. [check_power_budget.mjs](../hardware/check_power_budget.mjs) reproduces it and runs in `hardware/check_schematic.ps1`. It is a desk calculation, not a thermal simulation or a measurement.

## Loads

| Rail | Load | Typical | Bound used | Source |
| --- | --- | --- | --- | --- |
| 1.2 V (U1) | iCE40UP5K core and PLL | not computed | **150 mA** | The rail budget. The [UltraPlus data sheet](https://www.latticesemi.com/view_document?document_id=51968) table 4.6 gives only 75 µA static and a 12 mA startup peak. Running current depends on the design and needs Lattice's Power Calculator. |
| 3.3 V (U2) | FT2232H core via VREGIN | 70 mA | 150 mA | [FT2232H data sheet](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf): Icc1 is 70 mA typical with no maximum given, so the internal regulator's 150 mA rating is used as the ceiling. |
| | FT2232H PHY and PLL | 30 mA | 60 mA | Iccphy maximum |
| | W25Q16JV flash | 8 mA | 25 mA | [Winbond](https://www.winbond.com/resource-files/w25q16jv%20spi%20revd%2008122016.pdf) program/erase maximum |
| | SiT8008 at 48 MHz | 4 mA | 7 mA | [SiTime](https://www.sitime.com/datasheet/SiT8008): 4.5 mA maximum at 20 MHz with no load, plus C·V·f = 15 pF × 3.3 V × 48 MHz ≈ 2.4 mA |
| | 93LC46B EEPROM | 0.5 mA | 2 mA | [Microchip](https://ww1.microchip.com/downloads/aemDocuments/documents/MPD/ProductDocuments/DataSheets/93AA46A-B-C-93LC46A-B-C-93C46A-B-C-1-Kbit-Microwire-Compatible-Serial-EEPROM-Data-Sheet-DS20001749.pdf) write maximum |
| | FPGA I/O banks | 2 mA | 10 mA | Allowance above the 9 mA SPI_VCCIO1 startup peak |
| | 10 kΩ pull-ups held low | 0 | 3.3 mA | Ten at once |
| | **3.3 V total** | **115 mA** | **257 mA** | |
| 2.5 V (U3) | VPP_2V5 | not computed | **30 mA** | The rail budget; the startup peak is 2.5 mA |

Each regulator also draws up to 3.5 mA of ground current, per the [TPS7A90 data sheet](https://www.ti.com/lit/ds/symlink/tps7a90.pdf).

## Junction temperature

P = (V<sub>IN</sub> − V<sub>OUT</sub>) × I<sub>LOAD</sub> + V<sub>IN</sub> × I<sub>GND</sub>. The calculation takes V<sub>IN</sub> as 5.25 V, the top of a 5 V ±5 % supply, with no credit for the fuse or diode drop. V<sub>OUT</sub> is each rail's lowest static value. TI gives R<sub>θJA</sub> = 62.5 °C/W for the DSK package on a JEDEC 4-layer board. Because this board's copper and via layout is not yet designed, the check also assumes it could be twice as bad.

| Regulator | Worst-case dissipation | T<sub>J</sub> at 62.5 °C/W | T<sub>J</sub> at 125 °C/W |
| --- | --- | --- | --- |
| U1 1.2 V | 0.623 W | 78.9 °C | 117.9 °C |
| U2 3.3 V | 0.491 W | 70.7 °C | 101.4 °C |
| U3 2.5 V | 0.097 W | 46.1 °C | 52.2 °C |

All three stay below TI's 125 °C maximum junction temperature. **U1 is the limiting part.** At the pessimistic thermal resistance it leaves only about 7 °C, and it relies on the 150 mA core budget, which is likely far above what a small design at 48 MHz draws. At the typical 3.3 V load, U2 dissipates about 0.21 W.

**Layout requirement.** The TI figure assumes each exposed pad is soldered and tied to internal ground planes, as TI's layout guidance recommends. U1, U2 and U3 each need a via array from the thermal pad to the ground planes. They sit about 10 mm apart and together dissipate up to about 1.2 W, so the surrounding ground copper should be kept continuous.

## Input headroom and protection

At the 448 mA bound, the lowest regulator input is 4.75 V − 0.21 Ω × 0.448 A − 0.55 V = **4.11 V**. That uses the supply's −5 % limit, the fuse's post-trip maximum resistance and the SS14's 1 A forward-voltage maximum. The 3.3 V rail needs at most 3.412 V + 0.1 V dropout = 3.51 V, leaving about 0.59 V of headroom. D1 dissipates at most about 0.25 W. F1 holds 0.92 A at 40 °C, about twice the bound.

## Remaining

- Estimate the FPGA core current with Lattice's Power Calculator once the design is final. It will probably lower the U1 bound considerably.
- Confirm the external 5 V supply specification. The ±5 % used here is an assumption.
- After layout, check the thermal-pad via count, and measure regulator case temperatures on the bench.
