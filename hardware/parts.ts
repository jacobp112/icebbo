// Orderable passives for JLCPCB assembly, keyed by schematic value.
// Sources and effective-capacitance checks are in docs/part-selection.md.
type Passive = { mpn: string, footprint: string, lcsc?: string }

export const capacitorParts: Record<string, Passive> = {
  "22uF": { mpn: "GRM31CR61E226KE15L", footprint: "1206", lcsc: "C77091" },
  "4.7uF": { mpn: "CL21A475KAQNNNE", footprint: "0805", lcsc: "C1779" },
  "100nF": { mpn: "CL10B104KB8NNNC", footprint: "0603", lcsc: "C1591" },
  "10nF": { mpn: "CL10B103KB8NNNC", footprint: "0603", lcsc: "C1589" },
  // Soft-start capacitors: +-10% or better keeps the calculated ramps in range.
  "6.8nF": { mpn: "0603B682K500NT", footprint: "0603", lcsc: "C1631" },
  "27pF": { mpn: "CL10C270JB8NNNC", footprint: "0603", lcsc: "C1656" },
}

// All 0603, 1 %, 100 mW, +-100 ppm/C thick film. The regulator dividers are
// sized so 1 % parts meet the rail and supervisor limits (part-selection.md).
export const resistorParts: Record<string, Passive> = {
  "100ohm": { mpn: "0603WAF1000T5E", footprint: "0603", lcsc: "C22775" },
  "1k": { mpn: "0603WAF1001T5E", footprint: "0603", lcsc: "C21190" },
  "2.2k": { mpn: "0603WAF2201T5E", footprint: "0603", lcsc: "C4190" },
  "4.7k": { mpn: "0603WAF4701T5E", footprint: "0603", lcsc: "C23162" },
  "5.1k": { mpn: "0603WAF5101T5E", footprint: "0603", lcsc: "C23186" },
  "10k": { mpn: "RC0603FR-0710KL", footprint: "0603", lcsc: "C98220" },
  "12k": { mpn: "0603WAF1202T5E", footprint: "0603", lcsc: "C22790" },
  "49.9k": { mpn: "0603WAF4992T5E", footprint: "0603", lcsc: "C23184" },
  "100k": { mpn: "0603WAF1003T5E", footprint: "0603", lcsc: "C25803" },
  "220k": { mpn: "0603WAF2203T5E", footprint: "0603", lcsc: "C22961" },
  "316k": { mpn: "0603WAF3163T5E", footprint: "0603", lcsc: "C25814" },
}

function passiveProps(table: Record<string, Passive>, kind: string, value: string) {
  const part = table[value]
  if (!part) throw new Error(`No orderable part for ${value} ${kind}`)
  return {
    manufacturerPartNumber: part.mpn,
    footprint: part.footprint,
    ...(part.lcsc ? { supplierPartNumbers: { jlcpcb: [part.lcsc] } } : {}),
  }
}

// 0.1 %, +-25 ppm/C thin film for the VPP reset-threshold divider, where 1 %
// parts cannot hold the threshold between 2.30 V and the rail (part-selection.md).
export const precisionResistorParts: Record<string, Passive> = {
  "10k": { mpn: "RT0603BRD0710KL", footprint: "0603", lcsc: "C95204" },
  "48.1k": { mpn: "RT0603BRD0748K1L", footprint: "0603", lcsc: "C861428" },
}

export const capacitorProps = (value: string) => passiveProps(capacitorParts, "capacitor", value)
export const resistorProps = (value: string, tolerance?: "0.1%") =>
  passiveProps(tolerance ? precisionResistorParts : resistorParts, `${tolerance ?? ""} resistor`.trim(), value)
