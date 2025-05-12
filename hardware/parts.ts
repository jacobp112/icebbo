// Orderable capacitors for JLCPCB assembly, keyed by schematic value.
// Sources and effective-capacitance checks are in docs/part-selection.md.
type Capacitor = { mpn: string, footprint: string, lcsc?: string }

export const capacitorParts: Record<string, Capacitor> = {
  "22uF": { mpn: "GRM31CR61E226KE15L", footprint: "1206", lcsc: "C77091" },
  "4.7uF": { mpn: "CL21A475KAQNNNE", footprint: "0805", lcsc: "C1779" },
  "100nF": { mpn: "CL10B104KB8NNNC", footprint: "0603", lcsc: "C1591" },
  "10nF": { mpn: "CL10B103KB8NNNC", footprint: "0603", lcsc: "C1589" },
  // Soft-start capacitors: +-10% or better keeps the calculated ramps in range.
  "8.2nF": { mpn: "CL10B822KB8NNNC", footprint: "0603" },
  "27pF": { mpn: "CL10C270JB8NNNC", footprint: "0603", lcsc: "C1656" },
}

export function capacitorProps(value: string) {
  const part = capacitorParts[value]
  if (!part) throw new Error(`No orderable part for ${value} capacitor`)
  return {
    manufacturerPartNumber: part.mpn,
    footprint: part.footprint,
    ...(part.lcsc ? { supplierPartNumbers: { jlcpcb: [part.lcsc] } } : {}),
  }
}
