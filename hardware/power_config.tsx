import React from "react"
import { UsbFtdi } from "./usb_ftdi"
import { Ice40Sg48Footprint, Tps3890DseFootprint, Tps7a90DskFootprint } from "./footprints"
import { at } from "./placement"
import { capacitorProps, resistorProps } from "./parts"
import { traceWidth } from "./routing"

// Electrical capture for the FPGA power, clock and master-SPI boot path.
// Package land patterns and board placement are provisional until PCB review.
const fpgaPins = {
  pin1: "VCCIO2", pin2: "IOB6A", pin3: "IOB9B", pin4: "IOB8A",
  pin5: "VCC_A", pin6: "IOB13B", pin7: "CDONE", pin8: "CRESET_B",
  pin9: "IOB16A", pin10: "IOB18A", pin11: "IOB20A", pin12: "IOB22A",
  pin13: "IOB24A", pin14: "SPI_SO", pin15: "SPI_SCK", pin16: "SPI_SS",
  pin17: "SPI_SI", pin18: "IOB31B", pin19: "IOB29B", pin20: "IOB25B_G3",
  pin21: "IOB23B", pin22: "SPI_VCCIO1", pin23: "IOT37A", pin24: "VPP_2V5",
  pin25: "IOT36B", pin26: "IOT39A", pin27: "IOT38B", pin28: "IOT41A",
  pin29: "VCCPLL", pin30: "VCC_B", pin31: "IOT42B", pin32: "IOT43A",
  pin33: "VCCIO0", pin34: "IOT44B", pin35: "IOT46B_G0", pin36: "IOT48B",
  pin37: "IOT45A_G1", pin38: "IOT50B", pin39: "RGB0", pin40: "RGB1",
  pin41: "RGB2", pin42: "IOT51A", pin43: "IOT49A", pin44: "IOB3B_G6",
  pin45: "IOB5B", pin46: "IOB0A", pin47: "IOB2A", pin48: "IOB4A",
  pin49: "GND_EP",
} as const

const regulatorPins = {
  pin1: "OUT1", pin2: "OUT2", pin3: "FB", pin4: "GND",
  pin5: "PG", pin6: "SS_CTRL", pin7: "EN", pin8: "NR_SS",
  pin9: "IN1", pin10: "IN2", pin11: "GND_EP",
} as const

type Link = readonly [string, string]
const links: Link[] = [
  // U1: always-on 1.2 V core supply. U2 and U3 are power-good cascaded.
  ...["IN1", "IN2"].map((p) => [`U1.${p}`, "P5V"] as const),
  ...["OUT1", "OUT2"].map((p) => [`U1.${p}`, "V1V2"] as const),
  ...["GND", "GND_EP", "SS_CTRL"].map((p) => [`U1.${p}`, "GND"] as const),
  ["U1.EN", "P5V"], ["U1.PG", "CORE_GOOD"], ["U1.FB", "FB_CORE"],
  ["U1.NR_SS", "SS_CORE"],
  ...["IN1", "IN2"].map((p) => [`U2.${p}`, "P5V"] as const),
  ...["OUT1", "OUT2"].map((p) => [`U2.${p}`, "V3V3"] as const),
  ...["GND", "GND_EP", "SS_CTRL"].map((p) => [`U2.${p}`, "GND"] as const),
  ["U2.EN", "CORE_GOOD"], ["U2.PG", "IO_GOOD"], ["U2.FB", "FB_IO"],
  ["U2.NR_SS", "SS_IO"],
  ...["IN1", "IN2"].map((p) => [`U3.${p}`, "P5V"] as const),
  ...["OUT1", "OUT2"].map((p) => [`U3.${p}`, "V2V5"] as const),
  ...["GND", "GND_EP", "SS_CTRL"].map((p) => [`U3.${p}`, "GND"] as const),
  ["U3.EN", "IO_GOOD"], ["U3.PG", "VPP_GOOD"], ["U3.FB", "FB_VPP"],
  ["U3.NR_SS", "SS_VPP"],
  // U4: TPS389025 monitors the actual VPP rail, then releases CRESET_B.
  ["U4.SENSE", "V2V5"], ["U4.GND", "GND"], ["U4.MR", "HOST_MR_N"],
  ["U4.VDD", "V3V3"], ["U4.CT", "RESET_DELAY"], ["U4.RESET", "FPGA_RESET_N"],
  // U5: iCE40UP5K-SG48I. The exposed paddle is ground.
  ...["VCC_A", "VCC_B"].map((p) => [`U5.${p}`, "V1V2"] as const),
  ["U5.VCCPLL", "VPLL"], ["U5.GND_EP", "GND"],
  ...["VCCIO2", "VCCIO0", "SPI_VCCIO1"].map((p) => [`U5.${p}`, "V3V3"] as const),
  ["U5.VPP_2V5", "V2V5"], ["U5.CRESET_B", "FPGA_RESET_N"],
  ["U5.CDONE", "FPGA_CDONE"], ["U5.SPI_SO", "FLASH_MOSI"],
  ["U5.SPI_SCK", "FLASH_SCK"], ["U5.SPI_SS", "FLASH_CS_N"],
  ["U5.SPI_SI", "FLASH_MISO"], ["U5.IOT46B_G0", "CLK48"],
  // Host UART on the bank-2 pins that face the FT2232H (pins 12 and 11).
  ["U5.IOB22A", "HOST_UART_TX"], ["U5.IOB20A", "HOST_UART_RX"],
  // U6: W25Q16JVSSIQ. /WP and /HOLD are inactive for single-bit SPI.
  ["U6.CS_N", "FLASH_CS_N"], ["U6.DO", "FLASH_MISO"],
  ["U6.WP_N", "FLASH_WP_N"], ["U6.GND", "GND"],
  ["U6.DI", "FLASH_MOSI"], ["U6.CLK", "FLASH_SCK"],
  ["U6.HOLD_N", "FLASH_HOLD_N"], ["U6.VCC", "V3V3"],
  // U7: SiT8008 48 MHz, 3.3 V oscillator.
  ["U7.OE", "CLOCK_OE"], ["U7.GND", "GND"],
  ["U7.OUT", "CLK48"], ["U7.VDD", "V3V3"],
]

const resistors = [
  ["R1", "49.9k", "V1V2", "FB_CORE"], ["R2", "100k", "FB_CORE", "GND"],
  ["R3", "316k", "V3V3", "FB_IO"], ["R4", "100k", "FB_IO", "GND"],
  ["R5", "220k", "V2V5", "FB_VPP"], ["R6", "100k", "FB_VPP", "GND"],
  ["R7", "10k", "V1V2", "CORE_GOOD"],
  ["R8", "10k", "V3V3", "IO_GOOD"],
  ["R9", "10k", "V2V5", "VPP_GOOD"],
  ["R10", "10k", "V3V3", "FPGA_RESET_N"],
  ["R11", "10k", "V3V3", "HOST_MR_N"],
  ["R12", "10k", "V3V3", "FPGA_CDONE"],
  ["R13", "10k", "V3V3", "FLASH_SCK"],
  ["R14", "10k", "V3V3", "FLASH_CS_N"],
  ["R15", "10k", "V3V3", "FLASH_WP_N"],
  ["R16", "10k", "V3V3", "FLASH_HOLD_N"],
  ["R17", "10k", "V3V3", "CLOCK_OE"],
  ["R18", "100ohm", "V1V2", "VPLL"],
] as const

const capacitors = [
  ["C1", "22uF", "P5V"], ["C2", "22uF", "V1V2"],
  ["C3", "22uF", "P5V"], ["C4", "22uF", "V3V3"],
  ["C5", "22uF", "P5V"], ["C6", "22uF", "V2V5"],
  ["C7", "6.8nF", "SS_CORE"], ["C8", "6.8nF", "SS_IO"],
  ["C9", "6.8nF", "SS_VPP"], ["C10", "10nF", "RESET_DELAY"],
  ["C11", "4.7uF", "V1V2"], ["C12", "100nF", "V1V2"],
  ["C13", "4.7uF", "V1V2"], ["C14", "100nF", "V1V2"],
  ["C15", "4.7uF", "VPLL"], ["C16", "100nF", "VPLL"],
  ["C17", "4.7uF", "V3V3"], ["C18", "100nF", "V3V3"],
  ["C19", "4.7uF", "V3V3"], ["C20", "100nF", "V3V3"],
  ["C21", "4.7uF", "V3V3"], ["C22", "100nF", "V3V3"],
  ["C23", "4.7uF", "V2V5"], ["C24", "100nF", "V2V5"],
  ["C25", "100nF", "V3V3"], ["C26", "100nF", "V3V3"],
] as const

export default function PowerConfig() {
  return <board width="100mm" height="70mm" layers={4}>
    {/* Inner planes: a solid ground reference and the widest supply rail. */}
    <copperpour layer="inner1" connectsTo="net.GND" unbroken />
    <copperpour layer="inner2" connectsTo="net.V3V3" unbroken />
    <schematicsheet name="power_config" sheetSize="ANSI_B">
    <chip name="U1" {...at("U1")} manufacturerPartNumber="TPS7A9001DSKR" supplierPartNumbers={{jlcpcb: ["C840111"]}} footprint={<Tps7a90DskFootprint />} pinLabels={regulatorPins} pinAttributes={{IN1:{requiresPower:true},GND:{requiresGround:true},GND_EP:{requiresGround:true}}} />
    <chip name="U2" {...at("U2")} manufacturerPartNumber="TPS7A9001DSKR" supplierPartNumbers={{jlcpcb: ["C840111"]}} footprint={<Tps7a90DskFootprint />} pinLabels={regulatorPins} pinAttributes={{IN1:{requiresPower:true},GND:{requiresGround:true},GND_EP:{requiresGround:true}}} />
    <chip name="U3" {...at("U3")} manufacturerPartNumber="TPS7A9001DSKR" supplierPartNumbers={{jlcpcb: ["C840111"]}} footprint={<Tps7a90DskFootprint />} pinLabels={regulatorPins} pinAttributes={{IN1:{requiresPower:true},GND:{requiresGround:true},GND_EP:{requiresGround:true}}} />
    <chip name="U4" {...at("U4")} manufacturerPartNumber="TPS389025DSER" footprint={<Tps3890DseFootprint />} pinLabels={{pin1:"SENSE",pin2:"GND",pin3:"MR",pin4:"VDD",pin5:"CT",pin6:"RESET"}} pinAttributes={{VDD:{requiresPower:true},GND:{requiresGround:true}}} />
    <chip name="U5" {...at("U5")} manufacturerPartNumber="iCE40UP5K-SG48I" supplierPartNumbers={{jlcpcb: ["C2678152"]}} footprint={<Ice40Sg48Footprint />} pinLabels={fpgaPins} pinAttributes={{VCC_A:{requiresPower:true},VCC_B:{requiresPower:true},VCCPLL:{requiresPower:true},VCCIO0:{requiresPower:true},VCCIO2:{requiresPower:true},SPI_VCCIO1:{requiresPower:true},VPP_2V5:{requiresPower:true},GND_EP:{requiresGround:true}}} />
    <chip name="U6" {...at("U6")} manufacturerPartNumber="W25Q16JVSSIQ" supplierPartNumbers={{jlcpcb: ["C82317"]}} footprint="soic8_w8.8mm_p1.27mm_pl1.625mm_pw0.65mm" pinLabels={{pin1:"CS_N",pin2:"DO",pin3:"WP_N",pin4:"GND",pin5:"DI",pin6:"CLK",pin7:"HOLD_N",pin8:"VCC"}} pinAttributes={{VCC:{requiresPower:true},GND:{requiresGround:true}}} />
    <chip name="U7" {...at("U7")} manufacturerPartNumber="SiT8008BI-23-33E-48.000000" footprint="crystal4_px2.2mm_py1.9mm_pw1.4mm_ph1.2mm" pinLabels={{pin1:"OE",pin2:"GND",pin3:"OUT",pin4:"VDD"}} pinAttributes={{VDD:{requiresPower:true},GND:{requiresGround:true}}} />
    {resistors.map(([name, resistance]) => <resistor key={name} name={name} {...at(name)} resistance={resistance} {...resistorProps(resistance)} />)}
    {capacitors.map(([name, capacitance]) => <capacitor key={name} name={name} {...at(name)} capacitance={capacitance} {...capacitorProps(capacitance)} />)}
    {links.map(([port, net], i) => <trace key={`ic-${i}`} from={port} to={`net.${net}`} thickness={traceWidth(net)} />)}
    {resistors.flatMap(([name,, a,b]) => [
      <trace key={`${name}-1`} from={`${name}.pin1`} to={`net.${a}`} thickness={traceWidth(a)} />,
      <trace key={`${name}-2`} from={`${name}.pin2`} to={`net.${b}`} thickness={traceWidth(b)} />,
    ])}
    {capacitors.flatMap(([name,, net]) => [
      <trace key={`${name}-1`} from={`${name}.pin1`} to={`net.${net}`} thickness={traceWidth(net)} />,
      <trace key={`${name}-2`} from={`${name}.pin2`} to="net.GND" thickness={traceWidth("GND")} />,
    ])}
    <UsbFtdi />
    </schematicsheet>
  </board>
}
