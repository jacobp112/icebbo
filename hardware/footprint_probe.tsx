import React from "react"
import { Ice40Sg48Footprint, Tps7a90DskFootprint, Usb4105Footprint } from "./footprints"

export default function FootprintProbe() {
  return <board width="50mm" height="20mm" layers={4} routingDisabled>
    <chip name="U1" pcbX={-15} pcbY={0} pinLabels={{pin1:"OUT",pin11:"GND_EP"}} footprint={<Tps7a90DskFootprint />} />
    <chip name="U5" pcbX={15} pcbY={0} pinLabels={{pin1:"VCCIO2",pin49:"GND_EP"}} footprint={<Ice40Sg48Footprint />} />
    <connector name="J2" pcbX={0} pcbY={-6} standard="usb_c" manufacturerPartNumber="USB4105-GF-A" pinLabels={{pin1:"SHELL3",pin2:"SHELL4",pin13:"SHELL1",pin14:"SHELL2",pin15:"GND1",pin16:"VBUS1",pin17:"SBU2",pin18:"CC1",pin19:"DM2",pin20:"DP1",pin21:"DM1",pin22:"DP2",pin23:"SBU1",pin24:"CC2",pin25:"VBUS2",pin26:"GND2"}} footprint={<Usb4105Footprint />} />
    <trace from="U1.GND_EP" to="net.GND" />
    <trace from="U5.GND_EP" to="net.GND" />
    <trace from="J2.SHELL1" to="net.GND" />
    <trace from="J2.SHELL2" to="net.GND" />
    <trace from="J2.SHELL3" to="net.GND" />
    <trace from="J2.SHELL4" to="net.GND" />
  </board>
}
