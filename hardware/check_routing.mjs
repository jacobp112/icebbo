import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runAllRoutingChecks } from "@tscircuit/checks"

// Routing sign-off for the board produced by import_ses.mjs.
// 1. Connectivity from copper geometry, including the inner planes: every net
//    joins all of its pins (no opens) and no copper joins two nets (no shorts).
// 2. tscircuit's clearance checks. Its own connectivity checks only follow
//    traces, so pins joined through a plane are left to check 1.
const file = process.argv[2] ?? "dist/hardware/power_config/routed.json"
const circuit = JSON.parse(readFileSync(file, "utf8"))
const of = (type) => circuit.filter((e) => e.type === type)
assert.ok(of("pcb_trace").length > 0, "no routed traces; run the routing step first")
const planeLayers = [...new Set(of("pcb_copper_pour").map((p) => p.layer))].sort()
assert.deepEqual(planeLayers, ["inner1", "inner2"], "GND and V3V3 planes")

const allLayers = ["top", "inner1", "inner2", "bottom"]
const eps = 1e-6

// Copper items: a shape on one or more layers, and the net of any pin it is.
const items = []
const portNet = new Map()
for (const trace of of("source_trace")) {
  for (const netId of trace.connected_source_net_ids ?? []) {
    for (const portId of trace.connected_source_port_ids) portNet.set(portId, netId)
  }
}
const pcbPortSource = new Map(of("pcb_port").map((p) => [p.pcb_port_id, p.source_port_id]))
const sourcePortName = new Map()
const componentName = new Map(of("source_component").map((c) => [c.source_component_id, c.name]))
for (const p of of("source_port")) sourcePortName.set(p.source_port_id, `${componentName.get(p.source_component_id)}.${p.name}`)

for (const pad of of("pcb_smtpad")) {
  const source = pcbPortSource.get(pad.pcb_port_id)
  items.push({ kind: "rect", layers: [pad.layer ?? "top"], x: pad.x, y: pad.y, w: pad.width, h: pad.height,
    net: portNet.get(source), pin: sourcePortName.get(source) })
}
for (const hole of of("pcb_plated_hole")) {
  const source = pcbPortSource.get(hole.pcb_port_id)
  const common = { layers: allLayers, x: hole.x, y: hole.y, net: portNet.get(source), pin: sourcePortName.get(source), throughHole: true }
  if (hole.shape === "circle") {
    items.push({ kind: "circle", r: hole.outer_diameter / 2, ...common })
  } else if (hole.shape === "pill") {
    // A slot: a segment along the long axis with round ends.
    const r = Math.min(hole.outer_width, hole.outer_height) / 2
    const half = Math.max(hole.outer_width, hole.outer_height) / 2 - r
    const vertical = hole.outer_height > hole.outer_width
    const a = vertical ? { x: hole.x, y: hole.y - half } : { x: hole.x - half, y: hole.y }
    const b = vertical ? { x: hole.x, y: hole.y + half } : { x: hole.x + half, y: hole.y }
    items.push({ kind: "segment", a, b, r, ...common })
  } else {
    items.push({ kind: "rect", w: hole.rect_pad_width, h: hole.rect_pad_height, ...common })
  }
}
for (const via of of("pcb_via")) {
  items.push({ kind: "circle", layers: allLayers, x: via.x, y: via.y, r: via.outer_diameter / 2, throughHole: true })
}
for (const trace of of("pcb_trace")) {
  for (let i = 1; i < trace.route.length; i++) {
    const a = trace.route[i - 1], b = trace.route[i]
    if (a.route_type !== "wire" || b.route_type !== "wire" || a.layer !== b.layer) continue
    items.push({ kind: "segment", layers: [a.layer], a, b, r: Math.max(a.width, b.width) / 2 })
  }
}

// Geometry: distance between two items' outlines on a shared layer (<= 0 touches).
const pointSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
const segmentSegment = (a, b, c, d) => {
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x)
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d)
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b))
}
const rectCorners = (r) => [
  { x: r.x - r.w / 2, y: r.y - r.h / 2 }, { x: r.x + r.w / 2, y: r.y - r.h / 2 },
  { x: r.x + r.w / 2, y: r.y + r.h / 2 }, { x: r.x - r.w / 2, y: r.y + r.h / 2 },
]
const insideRect = (p, r) => Math.abs(p.x - r.x) <= r.w / 2 + eps && Math.abs(p.y - r.y) <= r.h / 2 + eps
const segmentRect = (a, b, r) => {
  if (insideRect(a, r) || insideRect(b, r)) return 0
  const c = rectCorners(r)
  return Math.min(...c.map((p, i) => segmentSegment(a, b, p, c[(i + 1) % 4])))
}
const gap = (m, n) => {
  if (m.kind === "segment" && n.kind === "segment") return segmentSegment(m.a, m.b, n.a, n.b) - m.r - n.r
  if (m.kind === "segment" || n.kind === "segment") {
    const [s, o] = m.kind === "segment" ? [m, n] : [n, m]
    if (o.kind === "circle") return pointSegment(o, s.a, s.b) - s.r - o.r
    return segmentRect(s.a, s.b, o) - s.r
  }
  if (m.kind === "circle" && n.kind === "circle") return Math.hypot(m.x - n.x, m.y - n.y) - m.r - n.r
  if (m.kind === "circle" || n.kind === "circle") {
    const [c, r] = m.kind === "circle" ? [m, n] : [n, m]
    const dx = Math.max(Math.abs(c.x - r.x) - r.w / 2, 0), dy = Math.max(Math.abs(c.y - r.y) - r.h / 2, 0)
    return Math.hypot(dx, dy) - c.r
  }
  const dx = Math.max(Math.abs(m.x - n.x) - (m.w + n.w) / 2, 0), dy = Math.max(Math.abs(m.y - n.y) - (m.h + n.h) / 2, 0)
  return Math.hypot(dx, dy)
}
const bounds = (m) => m.kind === "segment"
  ? [Math.min(m.a.x, m.b.x) - m.r, Math.max(m.a.x, m.b.x) + m.r, Math.min(m.a.y, m.b.y) - m.r, Math.max(m.a.y, m.b.y) + m.r]
  : m.kind === "circle" ? [m.x - m.r, m.x + m.r, m.y - m.r, m.y + m.r]
  : [m.x - m.w / 2, m.x + m.w / 2, m.y - m.h / 2, m.y + m.h / 2]

// Union-find over touching items.
const parent = items.map((_, i) => i)
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
const join = (i, j) => { parent[find(i)] = find(j) }
const boxes = items.map(bounds)
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    const [a, b] = [boxes[i], boxes[j]]
    if (a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2]) continue
    if (!items[i].layers.some((l) => items[j].layers.includes(l))) continue
    if (gap(items[i], items[j]) <= eps) join(i, j)
  }
}

// Planes: a through-hole item connects to a plane when its centre lies in
// plane copper (outside every antipad hole of the pour).
const inRing = (p, ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i], ring[j]]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
for (const pour of of("pcb_copper_pour")) {
  const shape = pour.brep_shape
  const index = items.push({ kind: "plane", layers: [pour.layer], net: pour.source_net_id }) - 1
  parent.push(index)
  for (let i = 0; i < index; i++) {
    const item = items[i]
    if (!item.throughHole) continue
    const inCopper = inRing(item, shape.outer_ring.vertices) &&
      !(shape.inner_rings ?? []).some((ring) => inRing(item, ring.vertices))
    if (inCopper) join(i, index)
  }
}

// Opens and shorts.
const nets = new Map(of("source_net").map((n) => [n.source_net_id, n.name]))
const findings = []
const componentsByNet = new Map()
const netsByComponent = new Map()
items.forEach((item, i) => {
  if (!item.net) return
  const root = find(i)
  if (!componentsByNet.has(item.net)) componentsByNet.set(item.net, new Map())
  const groups = componentsByNet.get(item.net)
  groups.set(root, [...(groups.get(root) ?? []), item.pin ?? "plane"])
  netsByComponent.set(root, new Set([...(netsByComponent.get(root) ?? []), item.net]))
})
for (const [netId, groups] of componentsByNet) {
  if (groups.size <= 1) continue
  const parts = [...groups.values()].sort((a, b) => b.length - a.length)
  findings.push(`open: ${nets.get(netId)} splits into ${groups.size} groups; isolated: ${parts.slice(1).map((g) => g.join(" ")).join(" | ")}`)
}
for (const joined of netsByComponent.values()) {
  if (joined.size > 1) findings.push(`short: ${[...joined].map((n) => nets.get(n)).join(" + ")}`)
}

// Clearance findings from tscircuit, minus its trace-only connectivity checks.
const traceOnly = /not connected to net|missing a connection to|disconnected endpoint/
for (const error of await runAllRoutingChecks(circuit)) {
  if (!traceOnly.test(error.message ?? "")) findings.push(error.message)
}

for (const finding of findings) console.error(`- ${finding}`)
assert.equal(findings.length, 0, `${findings.length} routing findings`)
console.log(`Routing checked: ${of("pcb_trace").length} traces, ${of("pcb_via").length} vias; ${componentsByNet.size} nets connected, no shorts, clearances clean`)
