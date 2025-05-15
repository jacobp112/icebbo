import { readFileSync, writeFileSync } from "node:fs"
import {
  CopperPourPipelineSolver,
  convertCircuitJsonToInputProblem,
  initializeManifoldGeometry,
} from "@tscircuit/copper-pour-solver"

// Merge a Freerouting session (.ses) into the circuit JSON that tscircuit
// built for the same placement, replacing any autorouted copper, then
// regenerate the inner planes so they clear the new vias and traces.
// Usage: node hardware/import_ses.mjs routed.ses built.json out.json
const [sesFile, builtFile, outFile] = process.argv.slice(2)
const planes = [["inner1", "GND"], ["inner2", "V3V3"]]

// Minimal S-expression reader: lists become arrays, atoms stay strings.
function parse(text) {
  const tokens = text.match(/"[^"]*"|[()]|[^\s()"]+/g)
  let i = 0
  const read = () => {
    const token = tokens[i++]
    if (token !== "(") return token.startsWith('"') ? token.slice(1, -1) : token
    const list = []
    while (tokens[i] !== ")") list.push(read())
    i++
    return list
  }
  return read()
}
const child = (list, name) => list.find((item) => Array.isArray(item) && item[0] === name)
const children = (list, name) => list.filter((item) => Array.isArray(item) && item[0] === name)

const session = parse(readFileSync(sesFile, "utf8"))
const routes = child(session, "routes")
const [, unit, perUnit] = child(routes, "resolution") // e.g. (resolution um 10)
if (unit !== "um") throw new Error(`unexpected resolution unit ${unit}`)
const toMm = (value) => Number(value) / Number(perUnit) / 1000
const layerNames = { "F.Cu": "top", "In1.Cu": "inner1", "In2.Cu": "inner2", "B.Cu": "bottom" }

const circuit = JSON.parse(readFileSync(builtFile, "utf8")).filter((e) =>
  !["pcb_trace", "pcb_via", "pcb_copper_pour"].includes(e.type) && !e.type.endsWith("_error"))
const of = (type) => circuit.filter((e) => e.type === type)
const nets = new Map(of("source_net").map((n) => [n.source_net_id, n]))
const sourcePorts = new Map(of("source_port").map((p) => [p.source_port_id, p]))

// Pads per net, for tagging trace endpoints that land on them.
const netOfSourcePort = new Map()
for (const trace of of("source_trace")) {
  for (const netId of trace.connected_source_net_ids ?? []) {
    for (const portId of trace.connected_source_port_ids) netOfSourcePort.set(portId, netId)
  }
}
const padsByNet = new Map()
for (const pad of [...of("pcb_smtpad"), ...of("pcb_plated_hole")]) {
  const port = of("pcb_port").find((p) => p.pcb_port_id === pad.pcb_port_id)
  const netId = port && netOfSourcePort.get(port.source_port_id)
  if (!netId) continue
  const w = pad.width ?? pad.outer_width ?? pad.rect_pad_width ?? pad.outer_diameter
  const h = pad.height ?? pad.outer_height ?? pad.rect_pad_height ?? pad.outer_diameter
  const list = padsByNet.get(netId) ?? []
  list.push({ portId: pad.pcb_port_id, x0: pad.x - w / 2, x1: pad.x + w / 2, y0: pad.y - h / 2, y1: pad.y + h / 2 })
  padsByNet.set(netId, list)
}
const padAt = (netId, x, y) => (padsByNet.get(netId) ?? []).find((p) =>
  x >= p.x0 - 1e-6 && x <= p.x1 + 1e-6 && y >= p.y0 - 1e-6 && y <= p.y1 + 1e-6)?.portId

// The DSN export names nets "<name>_<source_net_id>".
const sourceNet = (sesName) => {
  const match = sesName.match(/^(.*)_(source_net_\d+)$/)
  const net = match && nets.get(match[2])
  if (!net || net.name !== match[1]) throw new Error(`unknown session net ${sesName}`)
  return net
}

let traces = 0, vias = 0
for (const sesNet of children(child(routes, "network_out"), "net")) {
  const net = sourceNet(sesNet[1])
  const sourceTrace = of("source_trace").find((t) => (t.connected_source_net_ids ?? []).includes(net.source_net_id))
  const common = {
    subcircuit_id: net.subcircuit_id,
    subcircuit_connectivity_map_key: net.subcircuit_connectivity_map_key,
  }
  const netTraceIds = []
  for (const wire of children(sesNet, "wire")) {
    const [, layer, width, ...coords] = child(wire, "path")
    if (!layerNames[layer]) throw new Error(`unknown layer ${layer}`)
    const route = []
    for (let k = 0; k < coords.length; k += 2) {
      route.push({ route_type: "wire", x: toMm(coords[k]), y: toMm(coords[k + 1]), width: toMm(width), layer: layerNames[layer] })
    }
    const start = padAt(net.source_net_id, route[0].x, route[0].y)
    const end = padAt(net.source_net_id, route.at(-1).x, route.at(-1).y)
    if (start) route[0].start_pcb_port_id = start
    if (end) route.at(-1).end_pcb_port_id = end
    const id = `pcb_trace_ses_${traces++}`
    netTraceIds.push(id)
    circuit.push({
      type: "pcb_trace", pcb_trace_id: id, source_trace_id: sourceTrace?.source_trace_id,
      connection_name: net.source_net_id, route, ...common,
    })
  }
  for (const via of children(sesNet, "via")) {
    // Padstack names look like Via[0-3]_600:300_um (pad:drill in µm).
    const size = via[1].match(/_(\d+):(\d+)_um/)
    if (!size) throw new Error(`unknown via padstack ${via[1]}`)
    circuit.push({
      type: "pcb_via", pcb_via_id: `pcb_via_ses_${vias++}`, pcb_trace_id: netTraceIds[0],
      x: toMm(via[2]), y: toMm(via[3]),
      outer_diameter: Number(size[1]) / 1000, hole_diameter: Number(size[2]) / 1000,
      layers: ["top", "inner1", "inner2", "bottom"], from_layer: "top", to_layer: "bottom", ...common,
    })
  }
}

// Regenerate each plane around the merged copper.
await initializeManifoldGeometry()
for (const [layer, name] of planes) {
  const net = [...nets.values()].find((n) => n.name === name)
  // Planes keep 0.2 mm from other-net copper (antipads) and 0.3 mm from the edge.
  const problem = convertCircuitJsonToInputProblem(circuit, {
    layer, source_net_id: net.source_net_id,
    pad_margin: 0.2, trace_margin: 0.2, pour_margin: 0.2, board_edge_margin: 0.3,
  })
  const solver = new CopperPourPipelineSolver(problem)
  solver.solve()
  for (const [k, brep_shape] of solver.getOutput().brep_shapes.entries()) {
    circuit.push({
      type: "pcb_copper_pour", pcb_copper_pour_id: `pcb_copper_pour_${layer}_${k}`, shape: "brep",
      layer, source_net_id: net.source_net_id, subcircuit_id: net.subcircuit_id,
      covered_with_solder_mask: true, brep_shape,
    })
  }
}

writeFileSync(outFile, JSON.stringify(circuit))
console.log(`Merged ${traces} traces and ${vias} vias; regenerated planes on ${planes.map(([l]) => l).join(", ")}`)
