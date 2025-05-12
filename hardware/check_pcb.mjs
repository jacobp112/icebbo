import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Placement-level PCB checks on the unrouted board. Copper extents are
// axis-aligned rectangles; no footprint in this design is rotated.
const file = process.argv[2] ?? "dist/hardware/power_config/circuit.json"
const circuit = JSON.parse(readFileSync(file, "utf8"))
const items = (type) => circuit.filter((item) => item.type === type)
const names = new Map(items("source_component").map((c) => [c.source_component_id, c.name]))
const pcbNames = new Map(items("pcb_component").map((c) => [c.pcb_component_id, names.get(c.source_component_id)]))

const [board] = items("pcb_board")
assert.equal(items("pcb_board").length, 1)
assert.deepEqual([board.width, board.height, board.num_layers], [100, 70, 4], "board outline")
for (const c of items("pcb_component")) assert.equal(c.rotation, 0, `${pcbNames.get(c.pcb_component_id)} is rotated`)

const extent = (pad) => {
  const [w, h] =
    pad.type === "pcb_smtpad" ? [pad.width, pad.height] :
    pad.shape === "pill" ? [pad.outer_width, pad.outer_height] :
    pad.shape === "circular_hole_with_rect_pad" ? [pad.rect_pad_width, pad.rect_pad_height] :
    [pad.outer_diameter, pad.outer_diameter]
  assert.ok(w > 0 && h > 0, `unknown copper extent for ${pad.pcb_component_id} ${pad.port_hints}`)
  return { x0: pad.x - w / 2, x1: pad.x + w / 2, y0: pad.y - h / 2, y1: pad.y + h / 2 }
}

// Resolve each pad's pin through its port; plated holes carry generated
// names in their port hints.
const sourcePorts = new Map(items("source_port").map((p) => [p.source_port_id, p]))
const pinOf = new Map(items("pcb_port").map((p) => [p.pcb_port_id, sourcePorts.get(p.source_port_id)?.pin_number]))
const pads = [...items("pcb_smtpad"), ...items("pcb_plated_hole")].map((pad) => ({
  owner: pcbNames.get(pad.pcb_component_id),
  pin: pinOf.has(pad.pcb_port_id) ? `pin${pinOf.get(pad.pcb_port_id)}` : pad.port_hints?.[0],
  ...extent(pad),
}))

// Every schematic pin needs a copper pad.
const pcbPorts = new Set(items("pcb_port").map((p) => p.source_port_id))
const unplaced = items("source_port").filter((p) => !pcbPorts.has(p.source_port_id))
assert.deepEqual(unplaced.map((p) => `${names.get(p.source_component_id)}.${p.name}`), [], "ports without pads")

// Copper must stay on the board, clear of its edge.
const edge = board.min_board_edge_clearance
const halfW = board.width / 2 - edge
const halfH = board.height / 2 - edge
for (const p of pads) {
  assert.ok(p.x0 >= -halfW && p.x1 <= halfW && p.y0 >= -halfH && p.y1 <= halfH,
    `${p.owner} ${p.pin} within ${edge} mm of the board edge`)
}

// Pads of different components keep a placement gap wider than the
// fabricator's pad-to-pad minimum, leaving room for later routing.
const minGap = 0.2
for (let i = 0; i < pads.length; i++) {
  for (let k = i + 1; k < pads.length; k++) {
    const a = pads[i], b = pads[k]
    if (a.owner === b.owner) continue
    const gap = Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1)
    assert.ok(gap >= minGap, `${a.owner} ${a.pin} is ${gap.toFixed(3)} mm from ${b.owner} ${b.pin}`)
  }
}

// Reviewed custom footprints: pad counts and the dimensions corrected in
// docs/footprint-review.md.
const padsOf = (name) => pads.filter((p) => p.owner === name)
const pad = (name, pin) => {
  const found = padsOf(name).filter((p) => p.pin === pin)
  assert.equal(found.length, 1, `${name} ${pin}`)
  return found[0]
}
const size = (p) => [+(p.x1 - p.x0).toFixed(3), +(p.y1 - p.y0).toFixed(3)]
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2]
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} != ${expected}`)

for (const name of ["U1", "U2", "U3"]) {
  assert.equal(padsOf(name).length, 11, `${name} DSK0010A pads`)
  assert.deepEqual(size(pad(name, "pin11")), [1.2, 2], `${name} thermal pad`)
}
assert.equal(padsOf("U4").length, 6, "U4 DSE0006A pads")
assert.deepEqual(size(pad("U4", "pin1")), [0.8, 0.25], "U4 pin 1")
for (const pin of [2, 3, 4, 5, 6]) assert.deepEqual(size(pad("U4", `pin${pin}`)), [0.7, 0.25], `U4 pin ${pin}`)
assert.equal(padsOf("U5").length, 49, "U5 SG48 pads")
assert.deepEqual(size(pad("U5", "pin49")), [5.4, 5.4], "U5 exposed paddle")
assert.equal(padsOf("U8").length, 64, "U8 LQFP-64 pads")
near(centre(pad("U8", "pin17"))[1] - centre(pad("U8", "pin64"))[1], -11.15, "U8 row spacing")
assert.equal(padsOf("J2").length, 16, "J2 contacts and shell stakes")
for (const pin of ["pin1", "pin2"]) assert.deepEqual(size(pad("J2", pin)), [1, 1.8], `J2 front stake ${pin}`)
for (const pin of ["pin13", "pin14"]) assert.deepEqual(size(pad("J2", pin)), [1, 2.1], `J2 rear stake ${pin}`)
near(centre(pad("J2", "pin1"))[1] - -board.height / 2, 2.6, "J2 front stakes from board edge")

// Library footprints whose parameters were set from manufacturer drawings.
const rowSpacing = (name, a, b) => centre(pad(name, b))[0] - centre(pad(name, a))[0]
const libraryRows = [
  // [part, pad count, pin on left row, pin on right row, row centres, pad size]
  ["U6", 8, "pin1", "pin8", 7.175, [1.625, 0.65]],
  ["U11", 8, "pin1", "pin8", 5.4, [1.55, 0.6]],
  ["U9", 14, "pin1", "pin14", 5.8, [1.5, 0.45]],
  ["U10", 5, "pin1", "pin5", 2.6, [1.1, 0.6]],
]
for (const [name, count, left, right, spacing, padSize] of libraryRows) {
  assert.equal(padsOf(name).length, count, `${name} pads`)
  near(rowSpacing(name, left, right), spacing, `${name} row spacing`)
  for (const p of padsOf(name)) assert.deepEqual(size(p), padSize, `${name} ${p.pin}`)
}
assert.equal(padsOf("U12").length, 3, "U12 DRT pads")
for (const p of padsOf("U12")) assert.deepEqual(size(p), [0.3, 0.3], `U12 ${p.pin}`)
near(rowSpacing("U12", "pin1", "pin2"), 0.7, "U12 pin 1-2 spacing")
near(centre(pad("U12", "pin3"))[1] - centre(pad("U12", "pin1"))[1], 0.85, "U12 pin 3 offset")
for (const [name, dx, dy, padSize] of [["U7", 2.2, 1.9, [1.4, 1.2]], ["X2", 2.3, 1.75, [1.3, 1.05]]]) {
  near(rowSpacing(name, "pin1", "pin2"), dx, `${name} pin 1-2 pitch`)
  near(centre(pad(name, "pin4"))[1] - centre(pad(name, "pin1"))[1], dy, `${name} pin 1-4 pitch`)
  for (const p of padsOf(name)) assert.deepEqual(size(p), padSize, `${name} ${p.pin}`)
}

// D1 (MDD SMA) and Q1 (AOS SOT-23) follow their vendors' land patterns.
near(rowSpacing("D1", "pin1", "pin2"), 3.9, "D1 pad pitch")
for (const p of padsOf("D1")) assert.deepEqual(size(p), [1.52, 1.68], `D1 ${p.pin}`)
near(rowSpacing("Q1", "pin1", "pin3"), 2.4, "Q1 row spacing")
for (const p of padsOf("Q1")) assert.deepEqual(size(p), [0.8, 0.8], `Q1 ${p.pin}`)
// The SMA silkscreen bracket closes on pin 1, which must be D1's cathode.
const d1Source = items("source_component").find((c) => c.name === "D1")
const d1Pin1 = items("source_port").find((p) => p.source_component_id === d1Source.source_component_id && p.pin_number === 1)
assert.equal(d1Pin1.name, "K", "D1 pin 1 must be the cathode")

// Every resistor and capacitor is an orderable JLCPCB part (hardware/parts.ts).
const passives = items("source_component").filter((c) => /simple_(resistor|capacitor)/.test(c.ftype))
const unsourced = passives.filter((c) => !c.manufacturer_part_number || !c.supplier_part_numbers?.jlcpcb?.length).map((c) => c.name)
assert.deepEqual(unsourced, [], "passives without a manufacturer and JLCPCB part number")

// Every part carries a courtyard, so the builder's overlap check covers it.
const withCourtyard = new Set(circuit.filter((e) => e.type.startsWith("pcb_courtyard_")).map((e) => e.pcb_component_id))
const bare = items("pcb_component").filter((c) => !withCourtyard.has(c.pcb_component_id)).map((c) => pcbNames.get(c.pcb_component_id))
assert.deepEqual(bare, [], "components without a courtyard")

// Silkscreen stays clear of copper: 0.1 mm for the footprints drawn in
// footprints.tsx; 0.05 mm for generator footprints, whose SOIC/TSSOP body
// outline sits at that fixed distance inside the pad rows.
const customFootprints = new Set(["U1", "U2", "U3", "U4", "U5", "U8", "U12", "J2"])
const silkGapFor = (owner) => (customFootprints.has(owner) ? 0.1 : 0.05)
const rectDistance = (x, y, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1))
const segmentDistance = (a, b, r) => {
  // Sample the segment finely; exact enough at silkscreen scale.
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.01))
  let best = Infinity
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    best = Math.min(best, rectDistance(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r))
  }
  return best
}
const silk = [
  ...items("pcb_silkscreen_path").flatMap((p) => p.route.slice(1).map((b, i) => ({
    owner: pcbNames.get(p.pcb_component_id), half: p.stroke_width / 2, dist: (r) => segmentDistance(p.route[i], b, r),
  }))),
  ...items("pcb_silkscreen_circle").map((c) => ({
    owner: pcbNames.get(c.pcb_component_id), half: c.radius, dist: (r) => rectDistance(c.center.x, c.center.y, r),
  })),
]
for (const mark of silk) {
  for (const p of pads) {
    const gap = mark.dist(p) - mark.half
    assert.ok(gap >= silkGapFor(mark.owner) - 1e-9, `${mark.owner} silkscreen is ${gap.toFixed(3)} mm from ${p.owner} ${p.pin}`)
  }
}

const pcbErrors = circuit.filter((item) => item.type.startsWith("pcb_") && item.type.endsWith("_error"))
assert.deepEqual(pcbErrors, [])
console.log(`PCB placement checked: ${pads.length} copper pads on ${board.width} x ${board.height} mm, >= ${minGap} mm between components, reviewed footprints intact`)
