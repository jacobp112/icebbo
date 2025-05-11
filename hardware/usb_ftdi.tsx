import React from "react"
import { Ft2232HlFootprint, TiDrtFootprint, Usb4105Footprint } from "./footprints"
import { at } from "./placement"

// Self-powered FT2232H host interface. Package land patterns are provisional.
const ftdiPins = {
  pin1:"GND1", pin2:"OSCI", pin3:"OSCO", pin4:"VPHY",
  pin5:"GND5", pin6:"REF", pin7:"DM", pin8:"DP",
  pin9:"VPLL", pin10:"AGND", pin11:"GND11", pin12:"VCORE_A",
  pin13:"TEST", pin14:"RESET_N", pin15:"GND15", pin16:"ADBUS0",
  pin17:"ADBUS1", pin18:"ADBUS2", pin19:"ADBUS3", pin20:"VCCIO_A",
  pin21:"ADBUS4", pin22:"ADBUS5", pin23:"ADBUS6", pin24:"ADBUS7",
  pin25:"GND25", pin26:"ACBUS0", pin27:"ACBUS1", pin28:"ACBUS2",
  pin29:"ACBUS3", pin30:"ACBUS4", pin31:"VCCIO_B", pin32:"ACBUS5",
  pin33:"ACBUS6", pin34:"ACBUS7", pin35:"GND35", pin36:"SUSPEND_N",
  pin37:"VCORE_B", pin38:"BDBUS0", pin39:"BDBUS1", pin40:"BDBUS2",
  pin41:"BDBUS3", pin42:"VCCIO_C", pin43:"BDBUS4", pin44:"BDBUS5",
  pin45:"BDBUS6", pin46:"BDBUS7", pin47:"GND47", pin48:"BCBUS0",
  pin49:"VREGOUT", pin50:"VREGIN", pin51:"GND51", pin52:"BCBUS1",
  pin53:"BCBUS2", pin54:"BCBUS3", pin55:"BCBUS4", pin56:"VCCIO_D",
  pin57:"BCBUS5", pin58:"BCBUS6", pin59:"PWRSAV_N", pin60:"PWREN_N",
  pin61:"EEDATA", pin62:"EECLK", pin63:"EECS", pin64:"VCORE_C",
} as const

type Link = readonly [string, string]
const links: Link[] = [
  // J1 accepts an external regulated 5 V supply. USB VBUS is sense-only.
  ["J1.VIN", "EXT_5V"], ["J1.GND", "GND"],
  ["F1.IN", "EXT_5V"], ["F1.OUT", "FUSED_5V"],
  ["D1.A", "FUSED_5V"], ["D1.K", "P5V"],
  ["J2.VBUS1", "USB_VBUS"], ["J2.VBUS2", "USB_VBUS"],
  ["J2.DP1", "USB_DP"], ["J2.DP2", "USB_DP"],
  ["J2.DM1", "USB_DM"], ["J2.DM2", "USB_DM"],
  ["J2.CC1", "USB_CC1"], ["J2.CC2", "USB_CC2"],
  ["J2.GND1", "GND"], ["J2.GND2", "GND"],
  ["J2.SHELL1", "GND"], ["J2.SHELL2", "GND"],
  ["J2.SHELL3", "GND"], ["J2.SHELL4", "GND"],
  ["U12.DP", "USB_DP"], ["U12.DM", "USB_DM"], ["U12.GND", "GND"],
  // FT2232HL power and fixed-function pins follow its LQFP64 data sheet.
  ...["VCCIO_A","VCCIO_B","VCCIO_C","VCCIO_D","VREGIN"].map(p=>[`U8.${p}`,"V3V3"] as const),
  ...["VCORE_A","VCORE_B","VCORE_C","VREGOUT"].map(p=>[`U8.${p}`,"FTDI_V18"] as const),
  ...["GND1","GND5","AGND","GND11","GND15","GND25","GND35","GND47","GND51","TEST"].map(p=>[`U8.${p}`,"GND"] as const),
  ["U8.VPHY","FTDI_VPHY"], ["U8.VPLL","FTDI_VPLL"],
  ["U8.OSCI","FTDI_OSCI"], ["U8.OSCO","FTDI_OSCO"],
  ["U8.REF","FTDI_REF"], ["U8.RESET_N","FTDI_RESET_N"],
  ["U8.DP","USB_DP"], ["U8.DM","USB_DM"],
  ["U8.PWRSAV_N","USB_PRESENT"],
  ["U8.EECS","EE_CS"], ["U8.EECLK","EE_CLK"], ["U8.EEDATA","EE_DIO"],
  ["U8.ADBUS0","FTDI_A_SCK"], ["U8.ADBUS1","FTDI_A_MOSI"],
  ["U8.ADBUS2","FTDI_A_MISO"], ["U8.ADBUS3","FTDI_A_CS_N"],
  ["U8.ACBUS6","HOST_RESET_REQ"], ["U8.ACBUS7","PROG_REQ_N"],
  ["U8.BDBUS0","HOST_UART_TX"], ["U8.BDBUS1","HOST_UART_RX"],
  // U9 is a four-channel active-high-enabled isolation buffer. Its fourth
  // channel isolates FTDI ADBUS2, which is an output in initial UART mode.
  ...["OE1","OE2","OE3","OE4"].map(p=>[`U9.${p}`,"PROG_OE"] as const),
  ["U9.A1","FTDI_A_SCK"], ["U9.Y1","FLASH_SCK"],
  ["U9.A2","FTDI_A_MOSI"], ["U9.Y2","FLASH_MOSI"],
  ["U9.A3","FTDI_A_CS_N"], ["U9.Y3","FLASH_CS_N"],
  ["U9.A4","FLASH_MISO"], ["U9.Y4","FTDI_A_MISO"],
  ["U9.GND","GND"], ["U9.VCC","V3V3"],
  // NOR output is high only when the host requests programming and the
  // actual FPGA configuration reset net is low.
  ["U10.A","FPGA_RESET_N"], ["U10.B","PROG_REQ_N"],
  ["U10.GND","GND"], ["U10.Y","PROG_OE"], ["U10.VCC","V3V3"],
  ["Q1.G","HOST_RESET_REQ"], ["Q1.S","GND"], ["Q1.D","HOST_MR_N"],
  // EEPROM is fixed-16-bit 93LC46B. EEDATA drives DI directly and samples
  // DO through the FTDI-recommended 2.2 kΩ resistor.
  ["U11.CS","EE_CS"], ["U11.CLK","EE_CLK"], ["U11.DI","EE_DIO"],
  ["U11.DO","EE_DO"], ["U11.GND","GND"], ["U11.VCC","V3V3"],
  // Separate 12 MHz crystal for the FTDI USB PLL.
  ["X2.X1","FTDI_OSCI"], ["X2.X2","FTDI_OSCO"],
  ["X2.GND1","GND"], ["X2.GND2","GND"],
  ["FB1.IN","V3V3"], ["FB1.OUT","FTDI_VPHY"],
  ["FB2.IN","V3V3"], ["FB2.OUT","FTDI_VPLL"],
]

const resistors = [
  ["R30","12k","FTDI_REF","GND"],
  ["R31","1k","V3V3","FTDI_RESET_N"],
  ["R32","4.7k","USB_VBUS","USB_PRESENT"],
  ["R33","10k","USB_PRESENT","GND"],
  ["R34","10k","V3V3","EE_CS"],
  ["R35","10k","V3V3","EE_CLK"],
  ["R36","10k","V3V3","EE_DO"],
  ["R37","2.2k","EE_DO","EE_DIO"],
  ["R38","5.1k","USB_CC1","GND"],
  ["R39","5.1k","USB_CC2","GND"],
  ["R40","10k","V3V3","PROG_REQ_N"],
  ["R41","10k","HOST_RESET_REQ","GND"],
  ["R42","10k","PROG_OE","GND"],
] as const

const capacitors = [
  ["C30","4.7uF","FTDI_VPHY"], ["C31","100nF","FTDI_VPHY"],
  ["C32","4.7uF","FTDI_VPLL"], ["C33","100nF","FTDI_VPLL"],
  ["C34","3.3uF","FTDI_V18"], ["C35","100nF","FTDI_V18"],
  ["C36","100nF","V3V3"], ["C37","100nF","V3V3"],
  ["C38","100nF","V3V3"], ["C39","100nF","V3V3"],
  ["C40","100nF","V3V3"], ["C41","100nF","V3V3"],
  ["C42","27pF","FTDI_OSCI"], ["C43","27pF","FTDI_OSCO"],
] as const

export function UsbFtdi() {
  return <>
    <connector name="J1" {...at("J1")} manufacturerPartNumber="B2B-PH-K-S(LF)(SN)" footprint="pinrow2_p2mm" pinLabels={{pin1:"VIN",pin2:"GND"}} />
    <chip name="F1" {...at("F1")} manufacturerPartNumber="MF-PSMF110X-2" footprint="0805" pinLabels={{pin1:"IN",pin2:"OUT"}} />
    <chip name="D1" {...at("D1")} manufacturerPartNumber="SS14" footprint="sma" pinLabels={{pin1:"A",pin2:"K"}} />
    <connector name="J2" {...at("J2")} standard="usb_c" manufacturerPartNumber="USB4105-GF-A" footprint={<Usb4105Footprint />} pinLabels={{pin1:"SHELL3",pin2:"SHELL4",pin13:"SHELL1",pin14:"SHELL2",pin15:"GND1",pin16:"VBUS1",pin17:"SBU2",pin18:"CC1",pin19:"DM2",pin20:"DP1",pin21:"DM1",pin22:"DP2",pin23:"SBU1",pin24:"CC2",pin25:"VBUS2",pin26:"GND2"}} />
    <chip name="U12" {...at("U12")} manufacturerPartNumber="TPD2EUSB30ADRTR" footprint={<TiDrtFootprint />} pinLabels={{pin1:"DP",pin2:"DM",pin3:"GND"}} pinAttributes={{GND:{requiresGround:true}}} />
    <chip name="U8" {...at("U8")} manufacturerPartNumber="FT2232HL" footprint={<Ft2232HlFootprint />} pinLabels={ftdiPins} pinAttributes={{VREGIN:{requiresPower:true},VCCIO_A:{requiresPower:true},VCCIO_B:{requiresPower:true},VCCIO_C:{requiresPower:true},VCCIO_D:{requiresPower:true},GND1:{requiresGround:true},AGND:{requiresGround:true}}} />
    <chip name="U9" {...at("U9")} manufacturerPartNumber="SN74LVC126APWR" footprint="tssop14_w4.3mm_p0.65mm_pl1.5mm_pw0.45mm" pinLabels={{pin1:"OE1",pin2:"A1",pin3:"Y1",pin4:"OE2",pin5:"A2",pin6:"Y2",pin7:"GND",pin8:"Y3",pin9:"A3",pin10:"OE3",pin11:"Y4",pin12:"A4",pin13:"OE4",pin14:"VCC"}} pinAttributes={{VCC:{requiresPower:true},GND:{requiresGround:true}}} />
    <chip name="U10" {...at("U10")} manufacturerPartNumber="SN74LVC1G02DBVR" footprint="sot23_5_w2.6mm_pl1.1mm_pw0.6mm" pinLabels={{pin1:"A",pin2:"B",pin3:"GND",pin4:"Y",pin5:"VCC"}} pinAttributes={{VCC:{requiresPower:true},GND:{requiresGround:true}}} />
    <chip name="Q1" {...at("Q1")} manufacturerPartNumber="2N7002" footprint="sot23" pinLabels={{pin1:"G",pin2:"S",pin3:"D"}} />
    <chip name="U11" {...at("U11")} manufacturerPartNumber="93LC46B-I/SN" footprint="soic8_w6.95mm_p1.27mm_pl1.55mm_pw0.6mm" pinLabels={{pin1:"CS",pin2:"CLK",pin3:"DI",pin4:"DO",pin5:"GND",pin6:"NC6",pin7:"NC7",pin8:"VCC"}} pinAttributes={{VCC:{requiresPower:true},GND:{requiresGround:true}}} />
    <chip name="X2" {...at("X2")} manufacturerPartNumber="ABM8-12.000MHZ-B2-T" footprint="crystal4_px2.3mm_py1.75mm_pw1.3mm_ph1.05mm" pinLabels={{pin1:"X1",pin2:"GND1",pin3:"X2",pin4:"GND2"}} />
    <chip name="FB1" {...at("FB1")} manufacturerPartNumber="BLM18AG601SN1D" footprint="0603" pinLabels={{pin1:"IN",pin2:"OUT"}} />
    <chip name="FB2" {...at("FB2")} manufacturerPartNumber="BLM18AG601SN1D" footprint="0603" pinLabels={{pin1:"IN",pin2:"OUT"}} />
    {resistors.map(([name,value])=><resistor key={name} name={name} {...at(name)} resistance={value} footprint="0603" />)}
    {capacitors.map(([name,value])=><capacitor key={name} name={name} {...at(name)} capacitance={value} footprint={value === "4.7uF" || value === "3.3uF" ? "0805" : "0603"} />)}
    {links.map(([port,net],i)=><trace key={`usb-${i}`} from={port} to={`net.${net}`} />)}
    {resistors.flatMap(([name,,a,b])=>[
      <trace key={`${name}-1`} from={`${name}.pin1`} to={`net.${a}`} />,
      <trace key={`${name}-2`} from={`${name}.pin2`} to={`net.${b}`} />,
    ])}
    {capacitors.flatMap(([name,,rail])=>[
      <trace key={`${name}-1`} from={`${name}.pin1`} to={`net.${rail}`} />,
      <trace key={`${name}-2`} from={`${name}.pin2`} to="net.GND" />,
    ])}
  </>
}
