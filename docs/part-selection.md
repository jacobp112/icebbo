# Part selection

This board is built for **JLCPCB assembly** and a **0–40 °C bench environment**, so parts were chosen from stock carried by LCSC, JLCPCB's parts supplier. The orderable capacitors are listed in [parts.ts](../hardware/parts.ts). Each schematic part carries its manufacturer part number, plus a `jlcpcb` supplier number where one has been confirmed. Stock levels change, so confirm them when ordering.

## Input path

At the initial rail budgets of 150, 200 and 30 mA, plus FT2232H operation, the linear regulators draw about **0.45 A** from `P5V`. That current flows through F1 and D1.

| Ref | Part | LCSC | Basis |
| --- | --- | --- | --- |
| F1 | Bourns MF-PSMF110X-2 (0805 PTC) | C89658 | [Bourns MF-PSMF](https://www.bourns.com/docs/Product-Datasheets/mfpsmf.pdf) derating table: Ihold 1.10 A at 23 °C and 0.92 A at 40 °C, twice the 0.45 A load at the 40 °C bench limit. It falls to 0.65 A at 70 °C and 0.52 A at 85 °C, so an industrial rating would need a larger fuse. |
| D1 | MDD SS14 (SMA) | C2480 | 40 V, 1 A Schottky; 0.55 V at 1 A per LCSC. At 0.45 A its drop leaves `P5V` near 4.5 V, which is enough headroom for the 3.3 V regulator. |

D1's schematic **pin 1 is the cathode**. Before this change, pin 1 was the anode. The SMA footprint's silkscreen bracket, and the usual distributor orientation for SMA diodes, both mark pin 1 as the cathode, so the diode would have been assembled reversed and blocked the 5 V input. `check_pcb.mjs` now asserts the pin 1 = cathode mapping.

## Reset MOSFET

Q1 lets FTDI ACBUS6 pull the TPS3808 `MR` input low against a 10 kΩ pull-up and the chip's internal 90 kΩ one. The [TPS3808 data sheet](https://www.ti.com/lit/ds/symlink/tps3808.pdf) requires `MR` ≤ 0.3 × VDD, about 0.99 V at 3.3 V, so Q1 must sink about 0.37 mA.

- **Rejected: 2N7002** (JSCJ, LCSC C8545). Its threshold is specified at up to 2.5 V at only 250 µA. The FTDI output-high guarantee is around 2.4 V, so worst-case turn-on is not assured.
- **Selected: AOS AO3400A** (LCSC C20917). Its [data sheet](https://www.aosmd.com/res/datasheets/AO3400A.pdf) gives a threshold of 0.65 / 1.05 / 1.45 V (min / typ / max) at 250 µA, and R<sub>DS(on)</sub> ≤ 48 mΩ at V<sub>GS</sub> = 2.5 V. It is fully on from a 3.3 V gate, and the 10 kΩ gate pulldown holds it off. Its SOT-23 pinout (1 G, 2 S, 3 D) matches the schematic.

## Capacitors

| Value | Part | Size | LCSC | Positions |
| --- | --- | --- | --- | --- |
| 22 µF 25 V X5R ±10% | Murata GRM31CR61E226KE15L | 1206 | C77091 | C1–C6, regulator input and output |
| 4.7 µF 25 V X5R ±10% | Samsung CL21A475KAQNNNE | 0805 | C1779 | FPGA and FTDI bulk, FTDI VCORE |
| 100 nF 50 V X7R ±10% | Samsung CL10B104KB8NNNC | 0603 | C1591 | local decoupling |
| 10 nF 50 V X7R ±10% | Samsung CL10B103KB8NNNC | 0603 | C1589 | C10, supervisor delay; C44, supervisor sense filter |
| 6.8 nF 50 V X7R ±10% | Fenghua 0603B682K500NT | 0603 | C1631 | C7–C9, regulator soft-start |
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

**Soft-start.** No stocked 8.2 nF 0603 part could be confirmed at LCSC, and 10 nF would move the 1.2 V ramp's lower bound to about 0.55 V/ms, below Lattice's 0.6 V/ms minimum. With 6.8 nF ±10 %, TI's 4–9 µA soft-start current and the updated rail voltages, the ideal ramps are 0.80–2.20 V/ms (1.2 V), 2.22–6.12 V/ms (3.3 V) and 1.71–4.71 V/ms (2.5 V). All three sit inside Lattice's 0.6–10 V/ms, and the 1.2 V lower bound improves on the earlier 0.665 V/ms.

## Resistors

31 of the 33 resistors are 0603 ±1 % 100 mW ±100 ppm/°C thick film, listed in [parts.ts](../hardware/parts.ts). UNI-ROYAL `0603WAF` parts are used for every value except 10 kΩ. That value's UNI-ROYAL part (C25804) was out of stock at LCSC, so it uses Yageo RC0603FR-0710KL (C98220). The other two, the VPP reset divider R43/R44, are ±0.1 % ±25 ppm/°C thin film (see [VPP reset threshold](#vpp-reset-threshold)).

**Feedback dividers.** The earlier design assumed 0.1 % resistors, and its 312 kΩ and 213 kΩ values are rare E192 values. TI specifies the TPS7A90 output accuracy as ±1.0 %, excluding external resistors. A divider with top resistor R<sub>T</sub> and bottom R<sub>B</sub>, both ±1 %, adds up to ±2 % × R<sub>T</sub>/(R<sub>T</sub>+R<sub>B</sub>).

| Rail | Divider | Nominal | Static range with 1 % | Limit |
| --- | --- | --- | --- | --- |
| 1.2 V | 49.9k / 100k | 1.199 V | 1.179–1.219 V | FPGA VCC 1.14–1.26 V |
| 3.3 V | **316k** / 100k (was 312k) | 3.328 V | 3.244–3.412 V | FPGA I/O 3.14–3.46 V |
| 2.5 V | **220k** / 100k (was 213k) | 2.56 V | 2.499–2.621 V | U4 reset release ≤ 2.479 V; VPP ≤ 3.46 V |

The 2.5 V rail sets the requirement. The reset supervisor holds the FPGA in reset until `VPP_2V5` exceeds its rising threshold, up to 2.479 V (see [VPP reset threshold](#vpp-reset-threshold)). With 220k the static margin is 20 mV. A worst-case ±100 ppm/°C mismatch across 0–40 °C removes about 5 mV more. The 3.3 V change replaces a rare E192 value with a stocked E96 one while keeping 40–100 mV of margin to the I/O limits. Neither regulator divider needs 0.1 % parts. The regulator power-good thresholds, as a percentage of nominal, and the sequencing analysis are unchanged.

## VPP reset threshold

U4, a TPS3808G01, releases `CRESET_B` when its sense input rises through 0.405 V plus hysteresis. R43 (48.1 kΩ) and R44 (10 kΩ) divide `VPP_2V5` down to that input. The release point must sit above the FPGA's 2.30 V `VPP_2V5` minimum and below the rail's 2.499 V static minimum. The worst case combines:

- the [TPS3808 data sheet](https://www.ti.com/lit/ds/symlink/tps3808.pdf)'s ±2 % threshold and 1.5–3 % hysteresis for the G01
- ±25 nA sense current through the 8.3 kΩ divider source resistance (±0.2 mV)
- ±0.1 % resistors with ±25 ppm/°C across 0–40 °C

Those put the release between **2.334 V and 2.479 V** and the falling threshold between 2.300 V and 2.407 V. The FPGA is therefore held in reset whenever `VPP_2V5` is below 2.30 V, and the rail clears the release point by at least 20 mV. With 1 % resistors the spread would be wider than the 2.30–2.499 V window. The divider draws about 44 µA.

| Ref | Value | Part | LCSC |
| --- | --- | --- | --- |
| R43 | 48.1 kΩ ±0.1 % | Yageo RT0603BRD0748K1L | C861428 |
| R44 | 10 kΩ ±0.1 % | Yageo RT0603BRD0710KL | C95204 |
| C44 | 10 nF, sense filter | Samsung CL10B103KB8NNNC | C1589 |
| C45 | 100 nF, U4 VDD bypass | Samsung CL10B104KB8NNNC | C1591 |

The 10 nF CT capacitor (C10) sets the release delay to about 58 ms: TI's `t(s) = C(nF) / 175 + 0.5 ms`.

## ICs, crystal, beads and connectors

Every non-passive part also has an LCSC number. Stock was checked when these were chosen and will change.

| Ref | Part | LCSC | Note |
| --- | --- | --- | --- |
| U1–U3 | TI TPS7A9001DSKR | C840111 | |
| U4 | TI TPS3808G01DBVR (SOT-23-6) | C19653 | About 24,000 in stock. It replaces the TPS389025DSER, which LCSC does not stock. The fixed 2.5 V TPS3808G25 is nearly out of stock (3 and 83 pieces), so the adjustable part is used with a divider. |
| U5 | Lattice iCE40UP5K-SG48I | C2678152 | about 500 in stock |
| U6 | Winbond W25Q16JVSSIQ (208-mil SOIC) | C82317 | |
| U7 | Abracon ASE-48.000MHZ-LC-T | C2650694 | About 1,700 in stock. It replaces the SiT8008BI-23-33E-48.000000, which LCSC carries only at other frequencies; the 48 MHz clock is built into the RTL and UART timing. It is a 3.3 V ±5 % CMOS part, ±50 ppm, rated −40 to 85 °C. Pin 1 runs the oscillator when high or open, and R17 pulls it high. |
| U8 | FTDI FT2232HL-REEL | C27882 | The orderable name of the FT2232HL in tape and reel. |
| U9 | TI SN74LVC126APWR | C7815 | |
| U10 | TI SN74LVC1G02DBVR | C16360 | |
| U11 | Microchip 93LC46BT-I/SN | C16253 | The tape-and-reel form of the 93LC46B-I/SN. |
| U12 | TI TPD2EUSB30ADRTR | C94934 | **low stock**, 137 at selection |
| X2 | Abracon ABM8-12.000MHZ-B2-T | C596894 | **low stock**, 25 at selection |
| FB1, FB2 | Murata BLM18AG601SN1D | C19330 | |
| J1 | JST B2B-PH-K-S(LF)(SN) | C131337 | |
| J2 | GCT USB4105-GF-A-120 | C5184243 | The plain USB4105-GF-A (C3020560) was out of stock. The -120 suffix means 1.20 mm shell stakes instead of 0.95 mm, per the stake-length options on GCT's drawing. The land pattern is the same, and the stakes suit a 1.6 mm board. |

`check_pcb.mjs` requires a manufacturer part number and a JLCPCB number on every part.

## Open items

- Re-check the low-stock U12 and X2 before ordering.
- Regulator dissipation and headroom are in [thermal-budget.md](thermal-budget.md).
