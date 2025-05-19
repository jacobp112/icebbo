import assert from "node:assert/strict"

// Static worst-case power budget for the three TPS7A90 regulators.
// Every figure is sourced in docs/thermal-budget.md.
const ambient = 40 // °C, bench rating
const thetaJA = 62.5 // °C/W, TI DSK0010A on a JEDEC 4-layer board
const boardPenalty = 2 // this board is assumed up to 2x worse than JEDEC
const tjMax = 125 // °C
const vinMax = 5.25 // external 5 V +5 %, no credit for F1 or D1 drop
const vinMinSupply = 4.75 // external 5 V -5 %
const groundCurrent = 3.5 // mA per regulator, TI maximum
const dropout = 0.1 // V at 0.5 A, VIN <= 5 V
const fuseResistance = 0.21 // ohm, MF-PSMF110X R1max
const diodeDrop = 0.55 // V, SS14 at 1 A

// Worst-case load currents in mA.
const loads = {
  "U1 1.2 V": { vout: 1.219, current: 150 }, // rail budget; Lattice gives no operating maximum
  "U2 3.3 V": {
    vout: 3.412,
    current: 150 + 60 + 25 + 21.4 + 2 + 10 + 3.3, // FTDI core, FTDI PHY, flash, oscillator, EEPROM, FPGA I/O, pull-ups
  },
  "U3 2.5 V": { vout: 2.621, current: 30 }, // rail budget; VPP startup peak is 2.5 mA
}

let inputCurrent = 0
for (const [name, rail] of Object.entries(loads)) {
  const power = ((vinMax - rail.vout) * rail.current + vinMax * groundCurrent) / 1000
  const tj = ambient + power * thetaJA * boardPenalty
  assert.ok(tj < tjMax, `${name} junction ${tj.toFixed(1)} °C at ${power.toFixed(3)} W`)
  console.log(`${name}: ${power.toFixed(3)} W, TJ <= ${tj.toFixed(1)} °C`)
  inputCurrent += rail.current + groundCurrent
}

// The 3.3 V regulator must stay out of dropout at the lowest input voltage.
const vin = vinMinSupply - fuseResistance * inputCurrent / 1000 - diodeDrop
const needed = loads["U2 3.3 V"].vout + dropout
assert.ok(vin > needed, `P5V ${vin.toFixed(3)} V is below the ${needed.toFixed(3)} V the 3.3 V rail needs`)
console.log(`P5V >= ${vin.toFixed(3)} V at ${inputCurrent.toFixed(0)} mA; 3.3 V rail needs ${needed.toFixed(3)} V`)
