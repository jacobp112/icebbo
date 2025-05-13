// Trace widths by net, in mm. The router uses the widest width set on any
// trace of a net and does not neck traces down at pads, so nets that reach
// 0.5 mm-pitch pins stay at or below 0.25 mm. At 1 oz outer copper, 0.2 mm
// carries about 0.7 A for a 10 °C rise; these rails carry at most 0.26 A.
const netWidths: Record<string, number> = {
  EXT_5V: 0.5, FUSED_5V: 0.5, // J1, F1 and D1 only; up to about 0.45 A
  P5V: 0.25, // up to 0.45 A into the TPS7A90 IN pins at 0.5 mm pitch
  V1V2: 0.2, V2V5: 0.2, VPLL: 0.2,
  FTDI_V18: 0.2, FTDI_VPHY: 0.2, FTDI_VPLL: 0.2,
  GND: 0.25, V3V3: 0.25, // short stubs to vias into the inner planes
}

export const traceWidth = (net: string) => netWidths[net]
