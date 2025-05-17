import assert from "node:assert/strict"

// Fixed route for the USB D+/D- pair, J2 -> U12 -> U8 on the top layer,
// computed from the built pad positions. JLC04161H-7628 stack-up, top layer
// over the inner-1 ground plane: 90 ohm differential = 0.2332 mm traces with
// a 0.15 mm gap (docs/routing.md).
export const pairWidth = 0.2332
export const pairGap = 0.15
const half = (pairWidth + pairGap) / 2 // centre line to each trace

// Offset a polyline sideways by d (positive = left of travel), mitred joins.
function offset(points, d) {
  const normals = points.slice(1).map((b, i) => {
    const a = points[i], len = Math.hypot(b.x - a.x, b.y - a.y)
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }
  })
  return points.map((p, i) => {
    const n1 = normals[Math.max(0, i - 1)], n2 = normals[Math.min(normals.length - 1, i)]
    const m = { x: n1.x + n2.x, y: n1.y + n2.y }, ml = Math.hypot(m.x, m.y)
    const scale = d / ((m.x / ml) * n1.x + (m.y / ml) * n1.y)
    return { x: p.x + (m.x / ml) * scale, y: p.y + (m.y / ml) * scale }
  })
}

export function usbPairLayout(circuit) {
  const of = (type) => circuit.filter((e) => e.type === type)
  const component = new Map(of("source_component").map((c) => [c.source_component_id, c.name]))
  const sourcePort = new Map(of("source_port").map((p) => [p.source_port_id, p]))
  const pcbPort = new Map(of("pcb_port").map((p) => [p.pcb_port_id, p]))
  const pad = (name, portName) => {
    const found = of("pcb_smtpad").filter((s) => {
      const port = sourcePort.get(pcbPort.get(s.pcb_port_id)?.source_port_id)
      return port && component.get(port.source_component_id) === name && port.name === portName
    })
    assert.equal(found.length, 1, `${name}.${portName} pad`)
    return found[0]
  }
  const dm2 = pad("J2", "DM2"), dp1 = pad("J2", "DP1"), dm1 = pad("J2", "DM1"), dp2 = pad("J2", "DP2")
  const clampDm = pad("U12", "IO1"), clampDp = pad("U12", "IO2"), clampGnd = pad("U12", "GND")
  const ftdiDm = pad("U8", "DM"), ftdiDp = pad("U8", "DP")

  // The layout below assumes this arrangement; stop rather than route wrongly.
  const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`)
  near(dp1.x - dm2.x, 0.5, "J2 DM2/DP1 adjacent"); near(dp2.x - dm1.x, 0.5, "J2 DM1/DP2 adjacent")
  near(dm1.x - dp1.x, 0.5, "J2 contacts interleaved")
  const centre = (dm2.x + dp1.x) / 2
  near((clampDm.x + clampDp.x) / 2, centre, "U12 centred on the J2 DM2/DP1 pair")
  near(ftdiDm.x, ftdiDp.x, "U8 DM/DP on one edge"); near(ftdiDm.y - ftdiDp.y, 0.5, "U8 DM above DP")
  assert.ok(clampDm.y > dm2.y + dm2.height / 2 + 1.5, "U12 above J2")
  assert.ok(ftdiDm.x < centre, "U8 pins west of the pair start")

  const top = dm2.y + dm2.height / 2 // J2 contact top edge
  const bottom = dm2.y - dm2.height / 2
  // Freerouting counts a connection only where a wire has a vertex on the pad,
  // so every lead steps through its pad centres and every tie ends on a vertex.
  const pass = 0.46 // traces pass U12 this far either side of centre
  // U12's GND pin sits between the traces; its via goes just above it, and the
  // pair closes to 0.15 mm only after clearing the via (0.1 mm + trace half).
  const via = { x: clampGnd.x, y: clampGnd.y + clampGnd.height / 2 + 0.1 + 0.225, outer: 0.45, hole: 0.2 }
  const aboveClamp = via.y + 0.225 + 0.1 + pairWidth / 2 + 0.05
  const coupledStart = aboveClamp + 0.4
  const padEnd = ftdiDm.x - ftdiDm.width / 2 // west end of U8's DM/DP pads
  const column = padEnd - 1.6 // leaves room for U8's neighbours to via under the pair
  const turnY = (ftdiDm.y + ftdiDp.y) / 2
  const tieY = top + 0.47

  // Coupled section: centre line from above U12 to U8, 45° then north then east.
  const rise = centre - column
  const spine = [
    { x: centre, y: coupledStart }, { x: centre, y: coupledStart + 1.0 },
    { x: column, y: coupledStart + 1.0 + rise }, { x: column, y: turnY }, { x: ftdiDm.x, y: turnY },
  ]
  assert.ok(coupledStart + 1.0 + rise < turnY, "diagonal ends below the U8 turn")
  const dmCoupled = offset(spine, half), dpCoupled = offset(spine, -half)

  // Each wire ends on a pad centre (or on another wire's end): J2 -> U12 -> U8.
  // `main` marks the J2 -> U8 path of each side, used for length and skew.
  const toClamp = (from, passX, clampPad) => [
    from, { x: from.x, y: top + 0.72 }, { x: passX, y: top + 0.87 },
    { x: passX, y: clampPad.y - 0.3 }, { x: clampPad.x, y: clampPad.y },
  ]
  const toFtdi = (clampPad, passX, coupled, ftdiPad) => [
    { x: clampPad.x, y: clampPad.y }, { x: passX, y: clampPad.y + 0.3 }, { x: passX, y: aboveClamp },
    ...coupled, { x: ftdiPad.x, y: ftdiPad.y },
  ]
  const dpTie = { x: dp1.x, y: tieY } // where the DP2 tie meets the DP lead
  return {
    width: pairWidth,
    wires: [
      { net: "USB_DM", width: pairWidth, main: true, points: toClamp({ x: dm2.x, y: dm2.y }, centre - pass, clampDm) },
      { net: "USB_DM", width: pairWidth, main: true, points: toFtdi(clampDm, centre - pass, dmCoupled, ftdiDm) },
      { net: "USB_DP", width: pairWidth, main: true, points: [{ x: dp1.x, y: dp1.y }, dpTie] },
      { net: "USB_DP", width: pairWidth, main: true, points: toClamp(dpTie, centre + pass, clampDp) },
      { net: "USB_DP", width: pairWidth, main: true, points: toFtdi(clampDp, centre + pass, dpCoupled, ftdiDp) },
      // Ties for the reversed-plug contacts: DP2 over the top, DM1 under the pads.
      { net: "USB_DP", width: pairWidth, points: [{ x: dp2.x, y: dp2.y }, { x: dp2.x, y: tieY }, dpTie] },
      { net: "USB_DM", width: pairWidth, points: [{ x: dm1.x, y: dm1.y }, { x: dm1.x, y: bottom - 0.38 }, { x: dm2.x, y: bottom - 0.38 }, { x: dm2.x, y: dm2.y }] },
      { net: "GND", width: 0.25, points: [{ x: clampGnd.x, y: clampGnd.y }, { x: via.x, y: via.y }] },
    ],
    vias: [{ net: "GND", ...via }],
    coupled: { dm: dmCoupled, dp: dpCoupled },
  }
}
