# Configuration and USB interface — electrical design in progress

## Boot path

The FPGA will use master SPI to load its CRAM from a 3.3 V serial flash. In the [SG48 pinout](https://www.latticesemi.com/view_document?document_id=51971), `SPI_SO` is pin 14, `SPI_SCK` pin 15, `SPI_SS` pin 16, and `SPI_SI` pin 17. `SPI_SO` drives flash data input, flash data output drives `SPI_SI`, and the clock and chip select are shared. `SPI_SS` must be high when `CRESET_B` is released to select master SPI. The [Lattice hardware checklist](https://www.latticesemi.com/view_document?document_id=47779), section 3, recommends 10 kΩ pull-ups on `SPI_SCK` and `SPI_SS` in this mode. `CRESET_B` is pin 8; `CDONE` is pin 7 and needs a pull-up sized for the configuration clock and trace capacitance.

The [Lattice programming note](https://www.latticesemi.com/view_document?document_id=46502), section 9, lists a 104,161-byte bitstream for the UP5K, so a flash with at least 833,288 bits is required. It must support 0x0B Fast Read with a 24-bit address and eight dummy bits, and operate at the FPGA configuration-clock rate. Support for 0xAB wake and 0xB9 deep power-down is desirable. Its power-on command-ready time must be checked; holding `CRESET_B` until the flash is ready is a valid mitigation. A captured candidate is Winbond W25Q16JVSSIQ (16 Mbit, 2.7–3.6 V, SOP-8), but its exact orderable status, detailed command/power-up timing, and footprint still need to be checked against its own data sheet. Its `CS_N`, `DO`, `DI`, and `CLK` connections in the [partial schematic](../hardware/power_config.tsx) follow the standard SOIC-8 SPI pin map. `/WP` and `/HOLD` have separate 10 kΩ pull-ups. No flash part is frozen.

## Host programming ownership

FT2232HL channel A is reserved for MPSSE flash programming. [FTDI AN_114](https://ftdichip.com/Support/Documents/AppNotes/AN_114_FTDI_Hi_Speed_USB_To_SPI_Example.pdf) maps ADBUS0/pin 16 to clock, ADBUS1/pin 17 to MOSI, ADBUS2/pin 18 to MISO, and ADBUS3/pin 19 to chip select. Channel B is reserved for candidate-data UART and later BBO readback; its UART TXD is BDBUS0/pin 38 and RXD is BDBUS1/pin 39 in the [FT2232H data sheet](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf). FPGA user-I/O pin assignments for these signals are not final.

The FTDI outputs must be isolated from the shared flash clock, MOSI and chip-select nets outside a programming operation. [FTDI AN_184](https://www.ftdichip.cn/Support/Documents/AppNotes/AN_184%20FTDI%20Device%20Input%20Output%20Pin%20States.pdf) shows that channel-A pins have reset/enumeration and active functions that are not guaranteed to remain high impedance in every host state; direct permanent connection would risk driving the FPGA master-SPI outputs during boot. A proposed hardware interlock uses tri-state buffers on the FTDI-to-flash outputs. Their output enable may assert only when a host programming-enable signal is asserted **and** `CRESET_B` is held low. External pulls must keep programming disabled and reset released by default. The partial schematic brings out a `HOST_MR_N` supervisor input for an open-drain host control. The exact gates, buffer voltage behavior, and FTDI GPIO startup states are still to be selected and checked.

| State | FPGA `CRESET_B` | FTDI-to-flash drive | Flash owner |
| --- | --- | --- | --- |
| Power ramp | Held low by rail supervision | Disabled | None |
| FPGA boot/run | Released high | Disabled | FPGA during boot; idle afterward |
| Flash programming | Held low by host reset control | Enabled after reset is low | FT2232H channel A |
| Programming exit | Remains low until host drive is disabled | Disabled first | None, then FPGA on reset release |

The host tool must verify flash contents, disable its SPI drive, then release FPGA reset and check `CDONE`. A host crash or USB reset must return the programming buffers to their disabled state. The state table is a design intent, not a tested circuit. It requires schematic-level review of every control polarity and pull resistor.

## FT2232H support circuit

The [FT2232H bus-powered reference](https://www.ftdichip.cn/Support/Documents/DataSheets/ICs/DS_FT2232H.pdf), Figure 6.1, supplies `VREGIN`, `VPLL`, `VPHY`, and all four `VCCIO` pins from 3.3 V. Its internal `VREGOUT` supplies the three 1.8 V `VCORE` pins and requires at least 3.3 µF of local filtering. The reference also includes a 12 MHz crystal, an EEPROM for configuration, the USB D+/D− and `REF` support connections, reset, and local decoupling. The exact support parts and trace/ground details must be copied from checked datasheets, then verified in the rendered schematic. USB-C sink CC resistors, ESD protection, bus-power budget, and inrush remain to be designed.

The FPGA clock source in the partial schematic is a 48 MHz, 3.3 V [SiT8008BI-23-33E-48.000000](https://www.sitime.com/products/mhz-oscillators/lvcmos-oscillators/sit8008), connected to SG48 pin 35 (`IOT_46b_G0`) with its output-enable pulled high. Its data sheet calls for at least 100 nF across VDD/GND, which is represented by C26. The 48 MHz timing assumption still lacks routed closure in the initial FPGA probe; see [synthesis evidence](synthesis.md). Oscillator startup, clock quality, and IO voltage levels are not physically measured.

The partial power/configuration schematic has a generated netlist with no netlist-check warnings. Its package footprints, the FTDI programming circuit, and a complete PCB have not been electrically or physically validated.
