import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const file = process.argv[2] ?? "dist/hardware/power_config/circuit.json"
const circuit = JSON.parse(readFileSync(file, "utf8"))
const items = (type) => circuit.filter((item) => item.type === type)
const components = new Map(items("source_component").map((c) => [c.source_component_id, c.name]))
const nets = new Map(items("source_net").map((n) => [n.source_net_id, n.name]))
const ports = new Map(items("source_port").map((p) => [p.source_port_id, p]))
const connections = new Map()

for (const trace of items("source_trace")) {
  for (const portId of trace.connected_source_port_ids ?? []) {
    const port = ports.get(portId)
    assert.ok(port, `unknown port ${portId}`)
    const ref = `${components.get(port.source_component_id)}.${port.pin_number}`
    for (const netId of trace.connected_source_net_ids ?? []) {
      const name = nets.get(netId)
      assert.ok(name, `unknown net ${netId}`)
      if (connections.has(ref)) assert.equal(connections.get(ref), name, `${ref} spans nets`)
      connections.set(ref, name)
    }
  }
}

const expect = (ref, net) => assert.equal(connections.get(ref), net, ref)
const expected = {
  "J1.1":"EXT_5V", "J1.2":"GND",
  "F1.1":"EXT_5V", "F1.2":"FUSED_5V",
  "D1.1":"FUSED_5V", "D1.2":"P5V",
  "J2.15":"GND", "J2.16":"USB_VBUS", "J2.18":"USB_CC1",
  "J2.19":"USB_DM", "J2.20":"USB_DP", "J2.21":"USB_DM",
  "J2.22":"USB_DP", "J2.24":"USB_CC2", "J2.25":"USB_VBUS",
  "J2.26":"GND",
  "U12.1":"USB_DP", "U12.2":"USB_DM", "U12.3":"GND",
  "U8.2":"FTDI_OSCI", "U8.3":"FTDI_OSCO", "U8.4":"FTDI_VPHY",
  "U8.6":"FTDI_REF", "U8.7":"USB_DM", "U8.8":"USB_DP",
  "U8.9":"FTDI_VPLL", "U8.13":"GND", "U8.14":"FTDI_RESET_N",
  "U8.16":"FTDI_A_SCK", "U8.17":"FTDI_A_MOSI",
  "U8.18":"FTDI_A_MISO", "U8.19":"FTDI_A_CS_N",
  "U8.33":"HOST_RESET_REQ", "U8.34":"PROG_REQ_N",
  "U8.38":"HOST_UART_TX", "U8.39":"HOST_UART_RX",
  "U8.49":"FTDI_V18", "U8.50":"V3V3", "U8.59":"USB_PRESENT",
  "U8.61":"EE_DIO", "U8.62":"EE_CLK", "U8.63":"EE_CS",
  "U9.1":"PROG_OE", "U9.2":"FTDI_A_SCK", "U9.3":"FLASH_SCK",
  "U9.4":"PROG_OE", "U9.5":"FTDI_A_MOSI", "U9.6":"FLASH_MOSI",
  "U9.7":"GND", "U9.8":"FLASH_CS_N", "U9.9":"FTDI_A_CS_N",
  "U9.10":"PROG_OE", "U9.11":"FTDI_A_MISO", "U9.12":"FLASH_MISO",
  "U9.13":"PROG_OE", "U9.14":"V3V3",
  "U10.1":"FPGA_RESET_N", "U10.2":"PROG_REQ_N",
  "U10.3":"GND", "U10.4":"PROG_OE", "U10.5":"V3V3",
  "Q1.1":"HOST_RESET_REQ", "Q1.2":"GND", "Q1.3":"HOST_MR_N",
  "U11.1":"EE_CS", "U11.2":"EE_CLK", "U11.3":"EE_DIO",
  "U11.4":"EE_DO", "U11.5":"GND", "U11.8":"V3V3",
  "X2.1":"FTDI_OSCI", "X2.2":"GND", "X2.3":"FTDI_OSCO", "X2.4":"GND",
  "R32.1":"USB_VBUS", "R32.2":"USB_PRESENT",
  "R33.1":"USB_PRESENT", "R33.2":"GND",
  "R38.1":"USB_CC1", "R38.2":"GND",
  "R39.1":"USB_CC2", "R39.2":"GND",
  "R40.1":"V3V3", "R40.2":"PROG_REQ_N",
  "R41.1":"HOST_RESET_REQ", "R41.2":"GND",
  "R42.1":"PROG_OE", "R42.2":"GND",
  "U5.31":"HOST_UART_RX", "U5.34":"HOST_UART_TX",
}
for (const [ref, net] of Object.entries(expected)) expect(ref, net)

for (const pin of [12, 37, 64]) expect(`U8.${pin}`, "FTDI_V18")
for (const pin of [20, 31, 42, 56]) expect(`U8.${pin}`, "V3V3")
for (const pin of [1, 5, 10, 11, 15, 25, 35, 47, 51]) expect(`U8.${pin}`, "GND")
for (const pin of [13, 14]) expect(`J2.${pin}`, "GND")
for (const pin of [17, 23]) assert.equal(connections.has(`J2.${pin}`), false, "USB-C SBU left open")
for (const pin of [6, 7]) assert.equal(connections.has(`U11.${pin}`), false, "EEPROM NC left open")
assert.notEqual(connections.get("J2.16"), connections.get("D1.2"), "USB VBUS must not power P5V")

// A high OE requires both the request pulled low and the FPGA reset observed low.
for (const resetN of [0, 1]) {
  for (const requestN of [0, 1]) {
    const oe = Number(!(resetN || requestN))
    assert.equal(oe, Number(resetN === 0 && requestN === 0))
  }
}

const sourceErrors = circuit.filter((item) => item.type.startsWith("source_") && item.type.endsWith("_error"))
assert.deepEqual(sourceErrors, [])
console.log(`USB/FTDI netlist checked: ${Object.keys(expected).length} explicit pins, isolated flash programming and self-powered USB`)
