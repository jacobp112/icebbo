# Part selection

This board is built for **JLCPCB assembly** and a **0–40 °C bench environment**, so parts were chosen from stock carried by LCSC, JLCPCB's parts supplier. The orderable capacitors are listed in [parts.ts](../hardware/parts.ts). Each schematic part carries its manufacturer part number, plus a `jlcpcb` supplier number where one has been confirmed. Stock levels change, so confirm them when ordering.

## Input path

At the initial rail budgets of 150, 200 and 30 mA, plus FT2232H operation, the linear regulators draw about **0.45 A** from `P5V`. That current flows through F1 and D1.

| Ref | Part | LCSC | Basis |
| --- | --- | --- | --- |
| F1 | Bourns MF-PSMF110X-2 (0805 PTC) | not confirmed | [Bourns MF-PSMF](https://www.bourns.com/docs/Product-Datasheets/mfpsmf.pdf) derating table: Ihold 1.10 A at 23 °C and 0.92 A at 40 °C, twice the 0.45 A load at the 40 °C bench limit. It falls to 0.65 A at 70 °C and 0.52 A at 85 °C, so an industrial rating would need a larger fuse. |
| D1 | MDD SS14 (SMA) | C2480 | 40 V, 1 A Schottky; 0.55 V at 1 A per LCSC. At 0.45 A its drop leaves `P5V` near 4.5 V, which is enough headroom for the 3.3 V regulator. |

D1's schematic **pin 1 is the cathode**. Before this change, pin 1 was the anode. The SMA footprint's silkscreen bracket, and the usual distributor orientation for SMA diodes, both mark pin 1 as the cathode, so the diode would have been assembled reversed and blocked the 5 V input. `check_pcb.mjs` now asserts the pin 1 = cathode mapping.

## Reset MOSFET

Q1 lets FTDI ACBUS6 pull the TPS3890 `MR` input low through a 10 kΩ pull-up. The [TPS3890 data sheet](https://www.ti.com/lit/ds/symlink/tps3890.pdf) requires `MR` ≤ 0.25 × VDD, about 0.81 V at 3.3 V, so Q1 must sink about 0.25 mA.

- **Rejected: 2N7002** (JSCJ, LCSC C8545). Its threshold is specified at up to 2.5 V at only 250 µA. The FTDI output-high guarantee is around 2.4 V, so worst-case turn-on is not assured.
- **Selected: AOS AO3400A** (LCSC C20917). Its [data sheet](https://www.aosmd.com/res/datasheets/AO3400A.pdf) gives a threshold of 0.65 / 1.05 / 1.45 V (min / typ / max) at 250 µA, and R<sub>DS(on)</sub> ≤ 48 mΩ at V<sub>GS</sub> = 2.5 V. It is fully on from a 3.3 V gate, and the 10 kΩ gate pulldown holds it off. Its SOT-23 pinout (1 G, 2 S, 3 D) matches the schematic.

## Capacitors

| Value | Part | Size | LCSC | Positions |
| --- | --- | --- | --- | --- |
| 22 µF 25 V X5R ±10% | Murata GRM31CR61E226KE15L | 1206 | C77091 | C1–C6, regulator input and output |
| 4.7 µF 25 V X5R ±10% | Samsung CL21A475KAQNNNE | 0805 | C1779 | FPGA and FTDI bulk, FTDI VCORE |
| 100 nF 50 V X7R ±10% | Samsung CL10B104KB8NNNC | 0603 | C1591 | local decoupling |
| 10 nF 50 V X7R ±10% | Samsung CL10B103KB8NNNC | 0603 | C1589 | C10, supervisor delay |
| 8.2 nF 50 V X7R ±10% | Samsung CL10B822KB8NNNC | 0603 | **not confirmed** | C7–C9, regulator soft-start |
| 27 pF 50 V C0G ±5% | Samsung CL10C270JB8NNNC | 0603 | C1656 | C42–C43, FTDI crystal load |

The Samsung 22 µF part used before (CL31A226KAHNNNE, C12891) was out of stock at LCSC, so the Murata part replaces it.

**TPS7A90 10 µF effective minimum.** The following figures use Murata's typical DC-bias curve for the GRM31CR61E226KE15, from its [spec sheet](https://datasheet.octopart.com/GRM31CR61E226KE15L-Murata-datasheet-14713244.pdf), minus the 10 % tolerance:

| Position | DC bias | Typical change | Effective |
| --- | --- | --- | --- |
| Regulator inputs on `P5V` | 4.6–5.0 V | −31 to −36 % | 12.7–13.7 µF |
| 3.3 V output | 3.3 V | −19 % | 16.0 µF |
| 2.5 V output | 2.5 V | −11 % | 17.6 µF |
| 1.2 V output | 1.2 V | about −1 % | 19.6 µF |

Even at a 5.25 V input and a few percent temperature loss, the inputs stay near 12 µF. These are typical curves read from a chart, not guaranteed minima. The margin is about 20 %, not large.

**FTDI VCORE.** C34 was 3.3 µF nominal, but FTDI requires at least 3.3 µF effective, and any tolerance or bias loss would breach that. It is now 4.7 µF. No DC-bias curve has been reviewed for the Samsung 4.7 µF part at 1.8 V, so this remains an assumption: a 10 % tolerance plus about 15 % bias loss still leaves 3.6 µF.

**Soft-start.** The ramp calculation in [power-design.md](power-design.md) needs ±10 % or better on C7–C9. A 10 nF substitute would move the 1.2 V ramp's lower bound to about 0.55 V/ms, below Lattice's 0.6 V/ms minimum, so 8.2 nF stays even though its LCSC stock number is unconfirmed.

## Open items

- Confirm LCSC or global-sourcing availability for the 8.2 nF capacitors and F1.
- Choose the 0.1 % feedback resistors and the other resistors.
- Recalculate the regulator dissipation with the FT2232H current. For example, at its 150 mA budget the 1.2 V regulator drops about 3.3 V and dissipates about 0.5 W.
