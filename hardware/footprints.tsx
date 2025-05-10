import React from "react"

// TI DSK0010A, 2.5 mm WSON: five pads on each side, 0.5 mm pitch,
// and an electrically grounded, exposed center pad numbered 11.
export function Tps7a90DskFootprint() {
  return <footprint>
    {Array.from({length: 5}, (_, i) => <smtpad key={`left-${i}`} shape="rect" pcbX={-1.15} pcbY={1 - i * 0.5} width="0.6mm" height="0.25mm" portHints={[`pin${i + 1}`]} />)}
    {Array.from({length: 5}, (_, i) => <smtpad key={`right-${i}`} shape="rect" pcbX={1.15} pcbY={-1 + i * 0.5} width="0.6mm" height="0.25mm" portHints={[`pin${i + 6}`]} />)}
    <smtpad shape="rect" pcbX={0} pcbY={0} width="1.2mm" height="2mm" portHints={["pin11"]} />
  </footprint>
}

// TI DSE0006A 1.5 mm WSON supervisor: pin 1-3 at left, 4-6 at right.
export function Tps3890DseFootprint() {
  return <footprint>
    {Array.from({length: 3}, (_, i) => <smtpad key={`left-${i}`} shape="rect"
      pcbX={-0.6} pcbY={0.5 - i * 0.5} width="0.8mm" height="0.25mm"
      portHints={[`pin${i + 1}`]} />)}
    {Array.from({length: 3}, (_, i) => <smtpad key={`right-${i}`} shape="rect"
      pcbX={0.6} pcbY={-0.5 + i * 0.5} width="0.7mm" height="0.25mm"
      portHints={[`pin${i + 4}`]} />)}
  </footprint>
}

// SG48 has twelve contacts per edge at 0.5 mm pitch. The central exposed
// paddle is electrical ground; the pad must be associated with source pin 49.
export function Ice40Sg48Footprint() {
  const leads = Array.from({length: 48}, (_, i) => {
    const pin = i + 1
    const edge = Math.floor(i / 12)
    const slot = i % 12
    const offset = -2.75 + slot * 0.5
    const x = edge === 0 ? -3.4 : edge === 1 ? offset : edge === 2 ? 3.4 : -offset
    const y = edge === 0 ? -offset : edge === 1 ? -3.4 : edge === 2 ? offset : 3.4
    return <smtpad key={`lead-${pin}`} shape="rect" pcbX={x} pcbY={y}
      width={edge % 2 === 0 ? "0.8mm" : "0.25mm"}
      height={edge % 2 === 0 ? "0.25mm" : "0.8mm"}
      portHints={[`pin${pin}`]} />
  })
  return <footprint>
    {leads}
    <smtpad shape="rect" pcbX={0} pcbY={0} width="5.4mm" height="5.4mm" portHints={["pin49"]} />
  </footprint>
}

// GCT USB4105-GF-A: twelve shared contact pads, four plated shell stakes,
// and two 0.65 mm locating holes. Coordinates are from the manufacturer's
// component-side recommended PCB layout (the Y axis is inverted here).
export function Usb4105Footprint() {
  const contacts = [
    [-3.2, 15, 0.6], [-2.4, 16, 0.6], [-1.75, 17, 0.3],
    [-1.25, 18, 0.3], [-0.75, 19, 0.3], [-0.25, 20, 0.3],
    [0.25, 21, 0.3], [0.75, 22, 0.3], [1.25, 23, 0.3],
    [1.75, 24, 0.3], [2.4, 25, 0.6], [3.2, 26, 0.6],
  ] as const
  return <footprint insertionDirection="from_bottom">
    {contacts.map(([x,pin,width]) => <smtpad key={`contact-${pin}`} shape="rect"
      pcbX={x} pcbY={4.755} width={width} height="1.15mm" portHints={[`pin${pin}`]} />)}
    <platedhole shape="pill" pcbX={-4.32} pcbY={4.18} outerWidth="1.05mm" outerHeight="2.1mm" holeWidth="0.6mm" holeHeight="1.7mm" portHints={["pin13"]} />
    <platedhole shape="pill" pcbX={4.32} pcbY={4.18} outerWidth="1.05mm" outerHeight="2.1mm" holeWidth="0.6mm" holeHeight="1.7mm" portHints={["pin14"]} />
    <platedhole shape="pill" pcbX={-4.32} pcbY={0} outerWidth="1mm" outerHeight="2mm" holeWidth="0.6mm" holeHeight="1.4mm" portHints={["pin1"]} />
    <platedhole shape="pill" pcbX={4.32} pcbY={0} outerWidth="1mm" outerHeight="2mm" holeWidth="0.6mm" holeHeight="1.4mm" portHints={["pin2"]} />
    <hole shape="circle" diameter="0.65mm" pcbX={-2.89} pcbY={3.68} />
    <hole shape="circle" diameter="0.65mm" pcbX={2.89} pcbY={3.68} />
  </footprint>
}

// FT2232HL LQFP-64: 10 mm body, nominal 12 mm lead span, 0.5 mm pitch.
// The 0.30 x 1.65 mm copper pads follow FTDI TN_166's annotated example.
export function Ft2232HlFootprint() {
  const leads = Array.from({length: 64}, (_, i) => {
    const pin = i + 1
    const edge = Math.floor(i / 16)
    const slot = i % 16
    const offset = -3.75 + slot * 0.5
    const x = edge === 0 ? -6 : edge === 1 ? offset : edge === 2 ? 6 : -offset
    const y = edge === 0 ? -offset : edge === 1 ? -6 : edge === 2 ? offset : 6
    return <smtpad key={`ftdi-${pin}`} shape="rect" pcbX={x} pcbY={y}
      width={edge % 2 === 0 ? "1.65mm" : "0.3mm"}
      height={edge % 2 === 0 ? "0.3mm" : "1.65mm"}
      portHints={[`pin${pin}`]} />
  })
  return <footprint>{leads}</footprint>
}
