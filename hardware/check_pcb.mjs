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

const pcbErrors = circuit.filter((item) => item.type.startsWith("pcb_") && item.type.endsWith("_error"))
assert.deepEqual(pcbErrors, [])
console.log(`PCB placement checked: ${pads.length} copper pads on ${board.width} x ${board.height} mm, >= ${minGap} mm between components, reviewed footprints intact`)
