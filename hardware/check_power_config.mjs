import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const file = process.argv[2] ?? "dist/hardware/power_config/circuit.json"
const json = JSON.parse(readFileSync(file, "utf8"))
const byType = (type) => json.filter((item) => item.type === type)
const components = new Map(byType("source_component").map((c) => [c.source_component_id, c.name]))
const nets = new Map(byType("source_net").map((n) => [n.source_net_id, n.name]))
const ports = new Map(byType("source_port").map((p) => [p.source_port_id, p]))
const connections = new Map()

for (const trace of byType("source_trace")) {
  for (const portId of trace.connected_source_port_ids ?? []) {
    const port = ports.get(portId)
    const ref = `${components.get(port.source_component_id)}.${port.pin_number}`
    const names = [...(trace.connected_source_net_ids ?? [])].map((id) => nets.get(id))
    for (const name of names) {
      if (connections.has(ref)) assert.equal(connections.get(ref), name, `${ref} spans nets`)
      connections.set(ref, name)
    }
  }
}

const expect = (ref, net) => assert.equal(connections.get(ref), net, ref)
for (const [ref, net] of Object.entries({
  "U1.1":"V1V2", "U1.2":"V1V2", "U1.4":"GND", "U1.5":"CORE_GOOD",
  "U1.7":"P5V", "U1.9":"P5V", "U1.10":"P5V", "U1.11":"GND",
  "U2.5":"IO_GOOD", "U2.7":"CORE_GOOD", "U2.11":"GND",
  "U3.5":"VPP_GOOD", "U3.7":"IO_GOOD", "U3.11":"GND",
  "U4.1":"FPGA_RESET_N", "U4.2":"GND", "U4.3":"HOST_MR_N",
  "U4.4":"RESET_DELAY", "U4.5":"VPP_SENSE", "U4.6":"V3V3",
  "R43.1":"V2V5", "R43.2":"VPP_SENSE", "R44.1":"VPP_SENSE", "R44.2":"GND",
  "C44.1":"VPP_SENSE", "C44.2":"GND", "C45.1":"V3V3", "C45.2":"GND",
  "U5.1":"V3V3", "U5.5":"V1V2", "U5.7":"FPGA_CDONE",
  "U5.8":"FPGA_RESET_N", "U5.14":"FLASH_MOSI", "U5.15":"FLASH_SCK",
  "U5.16":"FLASH_CS_N", "U5.17":"FLASH_MISO", "U5.22":"V3V3",
  "U5.24":"V2V5", "U5.29":"VPLL", "U5.30":"V1V2",
  "U5.33":"V3V3", "U5.35":"CLK48", "U5.49":"GND",
  "U6.1":"FLASH_CS_N", "U6.2":"FLASH_MISO", "U6.4":"GND",
  "U6.5":"FLASH_MOSI", "U6.6":"FLASH_SCK", "U6.8":"V3V3",
  "U7.1":"CLOCK_OE", "U7.2":"GND", "U7.3":"CLK48", "U7.4":"V3V3",
  "R18.1":"V1V2", "R18.2":"VPLL",
})) expect(ref, net)

for (const [first, last, rail] of [
  [11,14,"V1V2"], [15,16,"VPLL"], [17,22,"V3V3"], [23,24,"V2V5"],
]) {
  for (let n=first;n<=last;n++) {
    expect(`C${n}.1`, rail)
    expect(`C${n}.2`, "GND")
  }
}

assert.equal(byType("source_failed_to_create_component_error").length, 0)
assert.equal(byType("source_trace_not_connected_error").length, 0)
console.log(`Power/config netlist checked: ${components.size} components, ${nets.size} nets`)
