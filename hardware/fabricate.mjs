import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { zipSync, strToU8 } from "fflate"
import { convertCircuitJsonToGerberFiles } from "circuit-json-to-gerber"
// Pinned through tscircuit's lockfile entry; npm will not place it directly.
import { convertCircuitJsonToPickAndPlaceCsv } from "circuit-json-to-pnp-csv"

// Fabrication outputs from the routed, checked board (routed.json from
// import_ses.mjs): gerbers and drill files, a JLCPCB BOM and a pick-and-place
// file. Run check_routing.mjs on the same input first.
// Usage: node hardware/fabricate.mjs routed.json out-dir
const [input, outDir] = process.argv.slice(2)
const circuit = JSON.parse(readFileSync(input, "utf8"))
mkdirSync(outDir, { recursive: true })

// The converter writes each USB-C shell slot as a drill hit followed by a bare
// G85 end point. Join them into Excellon's one-line slot form so CAM tools
// don't read the start as a separate hole.
const joinSlots = (drill) => drill.replace(/^(X[-\d.]+Y[-\d.]+)\r?\nG85/gm, "$1G85")

const gerbers = convertCircuitJsonToGerberFiles(circuit)
const archive = {}
for (const [name, raw] of Object.entries(gerbers)) {
  const content = name.endsWith(".drl") ? joinSlots(raw) : raw
  writeFileSync(join(outDir, name), content)
  archive[name] = strToU8(content)
}
writeFileSync(join(outDir, "gerbers.zip"), zipSync(archive))

// JLCPCB BOM: one row per orderable part. Custom footprints have no
// footprinter string, so their package names come from here.
const customPackages = {
  "TPS7A9001DSKR": "WSON-10 (DSK)",
  "TPS389025DSER": "WSON-6 (DSE)",
  "iCE40UP5K-SG48I": "QFN-48 (SG48)",
  "TPD2EUSB30ADRTR": "SOT-5X3 (DRT)",
  "USB4105-GF-A-120": "USB-C (USB4105)",
  "FT2232HL-REEL": "LQFP-64",
}
const cadBySource = Object.fromEntries(circuit.filter((e) => e.type === "cad_component").map((c) => [c.source_component_id, c]))
const rows = new Map()
for (const c of circuit.filter((e) => e.type === "source_component")) {
  const mpn = c.manufacturer_part_number
  const value = c.display_capacitance ?? c.display_resistance
  const footprint = customPackages[mpn] ?? cadBySource[c.source_component_id]?.footprinter_string
  if (!mpn || !footprint) throw new Error(`${c.name} has no MPN or footprint for the BOM`)
  const row = rows.get(mpn) ?? { comment: value ? `${value} ${mpn}` : mpn, designators: [], footprint, lcsc: c.supplier_part_numbers?.jlcpcb?.[0] ?? "" }
  row.designators.push(c.name)
  rows.set(mpn, row)
}
const byDesignator = (a, b) => a.localeCompare(b, "en", { numeric: true })
const csv = (cells) => cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
const bom = [csv(["Comment", "Designator", "Footprint", "LCSC Part #"])]
for (const row of [...rows.values()].sort((a, b) => byDesignator(a.designators.sort(byDesignator)[0], b.designators.sort(byDesignator)[0])))
  bom.push(csv([row.comment, row.designators.join(","), row.footprint, row.lcsc]))
writeFileSync(join(outDir, "bom.csv"), bom.join("\n") + "\n")

// Every rotation here is in the board frame (no part is rotated). JLCPCB's
// footprints use their own zero orientation, which the converter can't know
// for these parts, so each one is listed to confirm in JLCPCB's preview.
const warnings = []
const pnp = convertCircuitJsonToPickAndPlaceCsv(circuit, {
  supplier: "jlcpcb",
  onRotationWarning: (w) => warnings.push(`${w.designator}: ${w.reason}`),
})
writeFileSync(join(outDir, "pick_and_place.csv"), pnp)
writeFileSync(join(outDir, "rotation_review.txt"), warnings.join("\n") + (warnings.length ? "\n" : ""))

const parts = [...rows.values()].reduce((n, r) => n + r.designators.length, 0)
const unsourced = [...rows.values()].filter((r) => !r.lcsc).flatMap((r) => r.designators)
console.log(`Wrote ${Object.keys(gerbers).length} gerber/drill files, gerbers.zip, bom.csv (${rows.size} lines, ${parts} parts), pick_and_place.csv to ${outDir}`)
console.log(`No LCSC part: ${unsourced.join(", ") || "none"}; ${warnings.length} placement rotations to confirm in JLCPCB's preview`)
