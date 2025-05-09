# USB, FT2232H and flash-programming schematic review

The [captured circuit](../hardware/usb_ftdi.tsx) adds the USB-C data interface, FT2232HL, EEPROM, support clock and isolated flash-programming path to the [FPGA power/configuration schematic](../hardware/power_config.tsx). This is schematic connectivity evidence, not a fabricated-board result. PCB output remains disabled until the package pad maps, thermal pads, supply ratings and placement have been reviewed.

## Power architecture

The board takes **external regulated 5 V** at J1. A resettable fuse F1 and series Schottky D1 feed `P5V`, which supplies the three existing regulators. The USB-C connector's VBUS contacts are joined only on `USB_VBUS`, which feeds R32/R33 and FTDI `PWRSAV#`; they do not supply `P5V`. The 5.1 kΩ CC1 and CC2 pulldowns identify the board as a USB-C sink for the data connection. The data pins are tied for plug reversal; the SBU pins are intentionally open. U12 adds a two-line, low-capacitance USB ESD device.

The [FT2232H data sheet](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf) gives typical 70 mA VCORE and 30 mA PHY operating currents, already 100 mA before I/O and board loads. That makes a USB 2.0 pre-enumeration bus-power assumption unsound without a much deeper power analysis. The captured architecture therefore follows its self-powered Figure 6.3. `USB_PRESENT` is approximately `VBUS × 10/(4.7+10)` at the FTDI power-save input. Actual upstream-port disconnect and suspend behavior remain bench checks. The 3.3 V regulator load and heat budget need revision using the actual FTDI operating mode; the earlier 200 mA allowance is only a preliminary engineering budget.

The input connector's mechanical polarity, fuse trip/hold behavior, diode rating and voltage drop, 5 V supply specification, and whether the board should enforce USB VBUS presence before enabling its UART outputs remain design review items. External power must be available for USB enumeration; the board cannot run from the data cable alone.

## Pin-level circuit

| Function | Schematic connection | Source |
| --- | --- | --- |
| FTDI 3.3 V inputs | `VREGIN` pin 50 and `VCCIO` pins 20, 31, 42, 56 directly on `V3V3`; `VPHY` pin 4 and `VPLL` pin 9 via separate ferrite beads | [FT2232H data sheet](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf) |
| FTDI 1.8 V core | `VREGOUT` pin 49 to `VCORE` pins 12, 37, 64, with 3.3 µF and 100 nF nominal local capacitors | [FT2232H data sheet](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf) |
| USB and reference | D− pin 7, D+ pin 8; `REF` pin 6 to ground through 12 kΩ; `RESET#` pin 14 pulled to 3.3 V through 1 kΩ; `TEST` pin 13 grounded | [FT2232H data sheet](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf) |
| FTDI clock | 12 MHz ABM8-12.000MHZ-B2-T crystal between OSCI pin 2 and OSCO pin 3, each side with 27 pF to ground | [Abracon ABM8](https://abracon.com/parametric/crystals/ABM8-12.000MHZ-B2-T) |
| EEPROM | 93LC46B-I/SN in fixed 16-bit mode. FTDI EECS/EECLK to CS/CLK, EEDATA to DI, and DO through 2.2 kΩ to EEDATA; 10 kΩ pulls on EECS, EECLK and DO | [Microchip 93LC46B data sheet](https://ww1.microchip.com/downloads/aemDocuments/documents/MPD/ProductDocuments/DataSheets/93AA46A-B-C-93LC46A-B-C-93C46A-B-C-1-Kbit-Microwire-Compatible-Serial-EEPROM-Data-Sheet-DS20001749.pdf), [FT2232H Figure 6.3](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf) |
| USB ESD and CC | TPD2EUSB30ADRTR on D+/D−; separate 5.1 kΩ Rd resistors on CC1 and CC2 | [TI TPD2EUSB30A data sheet](https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf) |

The 27 pF crystal capacitors yield approximately 13.5 pF from the two equal capacitors in series; allowing approximately 5 pF board/pin stray capacitance gives 18.5 pF, close to the crystal's stated 18 pF load. Stray capacitance is a layout assumption, so oscillation margin and clock accuracy require later review. The 3.3 µF FTDI output capacitor is a **nominal** value; its effective value under bias and tolerance must meet FTDI's minimum.

## Flash ownership and initial FTDI state

Channel A initially operates as a UART until the host selects MPSSE. ADBUS0/2 can then be driven in directions that conflict with FPGA boot, so all four channel-A SPI lines pass through U9, a quad [SN74LVC126A](https://www.ti.com/lit/gpn/SN74LVC126A) with active-high enables. The fourth channel is directed from flash MISO toward FTDI ADBUS2. U10, an [SN74LVC1G02](https://www.ti.com/lit/ds/symlink/sn74lvc1g02.pdf), implements:

`PROG_OE = !(FPGA_RESET_N || PROG_REQ_N)`

| FPGA reset net | Host request, active low | Buffer enable | Flash owner |
| --- | --- | --- | --- |
| High | High | Low | FPGA boot or idle |
| High | Low | Low | FPGA boot or idle |
| Low | High | Low | None |
| Low | Low | High | FTDI channel A |

ACBUS6 drives Q1's gate and can pull the TPS3890 manual-reset input low. A 10 kΩ gate pulldown holds Q1 off at FTDI startup. ACBUS7 has a 10 kΩ pull-up to keep programming disabled by default; the buffer enable also has a 10 kΩ pulldown as recommended for the 126's safe power-up state. The NOR input monitors the real FPGA reset net, not merely the host command. Both FTDI control pins must be explicitly configured by the host before programming. The host must disable the buffers before releasing reset. An actively driven FTDI state can persist after a host process crash; software recovery and a physical service path are still required.

Channel B TXD on FTDI pin 38 connects to FPGA pin 34; channel B RXD on pin 39 connects to FPGA pin 31. The host protocol for reading the running bid/ask state and the final PCF/RTL integration remain later work. This does not add order identities or withdrawal recovery to the constrained running-extrema engine.

## Reproducible checks and release gates

`hardware/check_schematic.ps1` builds the combined schematic without PCB output, runs [targeted FPGA power/config net checks](../hardware/check_power_config.mjs), [USB/FTDI checks](../hardware/check_usb_ftdi.mjs), and the tscircuit netlist checker. The combined build produced 91 source components and 55 named nets. The USB check verifies 90 explicit pin connections, USB-VBUS separation from `P5V`, four isolated SPI paths, default pull connectivity, and the two-input interlock truth table. The netlist checker reported zero errors and zero warnings. The separate pin-specification checker reported zero errors and 19 warnings because the generic fuse, diode, MOSFET, crystal, ferrite and ESD symbols lack semantic power/ground annotations. The schematic renderer also reports two net labels and one trace outside its ANSI_B drawing boundary, and both intentionally open SBU ports. Those drawing and symbol warnings need resolution before a final schematic review. A Boolean truth table does not verify analog thresholds, propagation delay or power sequencing.

Before routing or fabrication: verify the exact connector and IC footprints against manufacturer land patterns, especially the USB-C shell/contact numbering and FPGA/regulator exposed pads; select qualified capacitor parts; revisit regulator dissipation with FTDI current; check reset/enable levels through ramp and brownout; calculate USB differential geometry from the fabricator's four-layer stack-up; and create/program an EEPROM image declaring self-powered operation and its power-save option. USB enumeration, suspend, MPSSE/UART coexistence, boot and flash reprogramming require physical validation. No USB signal-integrity or board-latency measurement exists.
