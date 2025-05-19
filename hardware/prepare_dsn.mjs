import { readFileSync, writeFileSync } from "node:fs"
import { usbPairLayout } from "./usb_pair.mjs"

// Adapt tscircuit's Specctra DSN export for Freerouting:
// - GND and V3V3 planes fill the inner layers (the export omits pours). The
//   layers stay signal-typed so Freerouting joins pins to the planes by via,
//   and every net class routes on the outer layers only so no trace splits
//   a plane.
// - the USB pair arrives pre-routed as protected wiring (usb_pair.mjs)
// - clearances match the board's 0.1 mm design rule
// - non-plated holes (the USB-C locating pegs) become copper keep-outs
// - vias shrink to 0.45 mm pad / 0.2 mm drill to fit beside 0.5 mm-pitch pins,
//   and every net class uses that via (the export names undefined ones for
//   some classes, which leaves those nets unable to reach the planes)
// Usage: node hardware/prepare_dsn.mjs in.dsn built-circuit.json out.dsn
const [input, circuitFile, output] = process.argv.slice(2)
let dsn = readFileSync(input, "utf8")

const replaceOnce = (from, to) => {
  const count = dsn.split(from).length - 1
  if (count !== 1) throw new Error(`expected one "${from.slice(0, 40)}", found ${count}`)
  dsn = dsn.replace(from, to)
}

// `tsci export` runs tscircuit's own autorouter and has no option to skip
// it; drop any wiring it produced so Freerouting starts from bare pads.
const wiringStart = dsn.lastIndexOf("(wiring")
if (wiringStart < 0) throw new Error("wiring section not found")
const wireCount = (dsn.slice(wiringStart).match(/\(wire\b/g) ?? []).length
if (wireCount) console.log(`Dropped ${wireCount} pre-routed wires from the export`)

// The USB pair is laid out by usb_pair.mjs and handed over as protected
// wiring, so Freerouting keeps its 90 ohm geometry and routes around it.
const circuit = JSON.parse(readFileSync(circuitFile, "utf8"))
const netId = (name) => dsn.match(new RegExp(`\\(net "?(${name}_source_net_\\d+)"?`))?.[1]
const um = (mm) => Math.round(mm * 1000)
const pair = usbPairLayout(circuit)
const fixedNet = (name) => {
  if (!netId(name)) throw new Error(`net ${name} not found`)
  return `(net "${netId(name)}") (type protect)`
}
const fixed = [
  ...pair.wires.map(({ net, width, points }) =>
    `    (wire (path F.Cu ${um(width)} ${points.map((p) => `${um(p.x)} ${um(p.y)}`).join(" ")}) ${fixedNet(net)})\n`),
  ...pair.vias.map((v) =>
    `    (via "Via[0-3]_${um(v.outer)}:${um(v.hole)}_um" ${um(v.x)} ${um(v.y)} ${fixedNet(v.net)})\n`),
]
dsn = dsn.slice(0, wiringStart) + `(wiring\n${fixed.join("")}  )\n)\n`

// Planes stop 0.2 mm inside the 100 x 70 mm outline (DSN units are µm).
const [x, y] = [49800, 34800]
const outline = `${-x} ${-y} ${x} ${-y} ${x} ${y} ${-x} ${y} ${-x} ${-y}`
const netName = (name) => {
  const match = dsn.match(new RegExp(`\\(net "?(${name}_source_net_\\d+)"?`))
  if (!match) throw new Error(`net ${name} not found`)
  return match[1]
}
const viaLine = dsn.match(/ {4}\(via "[^"]+"\)\n/)[0]
replaceOnce(viaLine,
  `    (plane ${netName("GND")} (polygon In1.Cu 0  ${outline}))\n` +
  `    (plane ${netName("V3V3")} (polygon In2.Cu 0  ${outline}))\n` + viaLine)

// Keep copper 0.2 mm off each non-plated hole (DSN coordinates are µm).
const holes = circuit.filter((e) => e.type === "pcb_hole")
const keepouts = holes.map((h, i) => {
  const diameter = Math.round((h.hole_diameter + 2 * 0.2) * 1000)
  return `    (keepout "npth_${i}" (circle signal ${diameter} ${Math.round(h.x * 1000)} ${Math.round(h.y * 1000)}))\n`
}).join("")
const planeLine = dsn.match(/ {4}\(plane /).index
dsn = dsn.slice(0, planeLine) + keepouts + dsn.slice(planeLine)

const oldVia = dsn.match(/Via\[0-3\]_\d+:\d+_um/)?.[0]
if (!oldVia) throw new Error("via padstack not found")
const newVia = "Via[0-3]_450:200_um"
const padstackStart = dsn.indexOf(`(padstack "${oldVia}"`)
const padstackEnd = dsn.indexOf("(attach off)", padstackStart)
dsn = dsn.slice(0, padstackStart) +
  dsn.slice(padstackStart, padstackEnd).replace(/\(circle (\S+) \d+\)/g, "(circle $1 450)") +
  dsn.slice(padstackEnd)
dsn = dsn.replaceAll(oldVia, newVia)
  .replace(/\(use_via "[^"]+"\)/g, `(use_via "${newVia}")\n        (use_layer F.Cu B.Cu)`)

dsn = dsn.replace(/\(clearance (150|200)\)/g, "(clearance 100)")

// The export names each footprint image after the part type and its outline
// size, so two different land patterns of the same size share one image and
// the second part is routed to the first one's pads (the SOT-23-6 U4 and
// SOT-23-5 U10 are both 3.7 x 2.5 mm). Compare every placed part's pads with
// its image and give each mismatched part an image of its own pads.
const byId = (type) => new Map(circuit.filter((e) => e.type === type).map((e) => [e[`${type}_id`], e]))
const sourcePorts = byId("source_port")
const pcbPorts = byId("pcb_port")
const pcbComponentBySource = new Map(circuit.filter((e) => e.type === "pcb_component").map((c) => [c.source_component_id, c]))
const padsOfPart = (sourceComponentId) => {
  const part = pcbComponentBySource.get(sourceComponentId)
  return circuit.filter((e) => (e.type === "pcb_smtpad" || e.type === "pcb_plated_hole") && e.pcb_component_id === part.pcb_component_id)
    .map((pad) => ({ pad, pin: sourcePorts.get(pcbPorts.get(pad.pcb_port_id)?.source_port_id)?.pin_number,
      x: um(pad.x - part.center.x), y: um(pad.y - part.center.y) }))
}
// Same pins at the same positions, to 1 µm (the export rounds differently).
const samePins = (a, b) => a.length === b.length &&
  a.every((p) => b.some((q) => q.pin === p.pin && Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1))
const imagePins = new Map([...dsn.matchAll(/\(image "([^"]+)"\n([\s\S]*?)\n {4}\)/g)].map(([, name, body]) =>
  [name, [...body.matchAll(/\(pin \S+ (?:\(rotate [^)]+\) )?(\S+) (\S+) (\S+)\)/g)]
    .map(([, pin, px, py]) => ({ pin: Number(pin), x: Math.round(Number(px)), y: Math.round(Number(py)) }))]))
let splitImages = 0
for (const [, image, places] of dsn.matchAll(/\(component "([^"]+)"\n((?: {6}\(place [^\n]+\n)+)/g)) {
  for (const [line, sourceId] of places.matchAll(/ {6}\(place \S+?_(source_component_\d+) [^\n]+\n/g)) {
    const pads = padsOfPart(sourceId)
    if (samePins(pads, imagePins.get(image))) continue
    const name = `${image}:${sourceId}`
    const pins = pads.map(({ pad, pin, x, y }) => {
      if (pad.type !== "pcb_smtpad" || pad.shape !== "rect") throw new Error(`${sourceId}: cannot build an image for ${pad.type} ${pad.shape}`)
      const padstack = `RoundRect[T]Pad_${um(pad.width)}x${um(pad.height)}_um`
      if (!dsn.includes(`(padstack "${padstack}"`)) throw new Error(`${sourceId}: padstack ${padstack} not in the export`)
      return `      (pin ${padstack} ${pin} ${x} ${y})\n`
    })
    replaceOnce(line, "")
    replaceOnce(`    (component "${image}"\n`, `    (component "${name}"\n${line}    )\n    (component "${image}"\n`)
    replaceOnce(`    (image "${image}"\n`, `    (image "${name}"\n${pins.join("")}    )\n    (image "${image}"\n`)
    splitImages++
  }
}
if (splitImages) console.log(`Gave ${splitImages} ${splitImages === 1 ? "part its" : "parts their"} own footprint image`)

// Each plane net gets its own class that may also use its own plane layer,
// so its pins can reach the plane; the other plane stays untouched.
for (const [name, layer] of [["GND", "In1.Cu"], ["V3V3", "In2.Cu"]]) {
  const net = netName(name)
  const member = new RegExp(` "?${net}"?(?=[ )]|$)`)
  const classStart = dsn.search(new RegExp(`\\(class "[^"]+" "[^"]*"[^\\n]*"?${net}"?`))
  if (classStart < 0) throw new Error(`class for ${name} not found`)
  const lineEnd = dsn.indexOf("\n", classStart)
  const width = dsn.slice(classStart).match(/\(width (\d+)\)/)[1]
  dsn = dsn.slice(0, classStart) + dsn.slice(classStart, lineEnd).replace(member, "") + dsn.slice(lineEnd)
  // Inserted at the existing class's "(class", so it ends with that indent.
  const planeClass = `(class "plane_${name}" "" "${net}"\n      (circuit\n        (use_via "${newVia}")\n` +
    `        (use_layer F.Cu ${layer} B.Cu)\n      )\n      (rule\n        (width ${width})\n        (clearance 100)\n      )\n    )\n    `
  dsn = dsn.slice(0, classStart) + planeClass + dsn.slice(classStart)
}

writeFileSync(output, dsn)
console.log(`Prepared ${output} with ${holes.length} hole keep-outs`)
