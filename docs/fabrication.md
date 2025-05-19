# Fabrication outputs

[fabricate.mjs](../hardware/fabricate.mjs) writes the files for a JLCPCB 4-layer order with assembly. It reads the routed board that [check_routing.mjs](../hardware/check_routing.mjs) signs off (see [routing.md](routing.md)), and [check_schematic.ps1](../hardware/check_schematic.ps1) runs it on every check. The outputs go to `dist/hardware/fabrication/`. They are build products, so they are not committed.

```text
node hardware/fabricate.mjs dist/hardware/power_config/routed.json dist/hardware/fabrication
```

| File | Contents |
| --- | --- |
| `gerbers.zip` | Upload to JLCPCB. It holds all 14 files listed below. |
| `F_Cu`, `In1_Cu`, `In2_Cu`, `B_Cu` `.gbr` | Copper. The inner layers are the GND (In1) and 3.3 V (In2) planes, with their antipads drawn as clear polarity. |
| `F_Mask`, `B_Mask`, `F_Paste`, `B_Paste`, `F_SilkScreen`, `B_SilkScreen`, `F_Fab`, `Edge_Cuts` `.gbr` | Mask, paste, legend, fabrication notes and the 100 × 70 mm outline |
| `drill-L1-L4.drl` | Plated holes: 138 vias of 0.2 mm, 15 in-pad thermal vias of 0.3 mm, J1's two 1.0 mm pins, and J2's four 0.6 mm shell slots |
| `drill_npth.drl` | J2's two 0.65 mm locating holes |
| `bom.csv` | JLCPCB BOM: Comment, Designator, Footprint and LCSC Part #, with one line per orderable part (36 lines, 95 parts) |
| `pick_and_place.csv` | JLCPCB CPL: designator, centre, layer and rotation for all 95 parts (all on top) |
| `rotation_review.txt` | The parts whose rotation needs confirming in JLCPCB's preview. At present that is all of them. |

## Checked

- **Gerbers and drill files** come from tscircuit's `circuit-json-to-gerber` 0.0.107. The file headers say 0.0.106 because of a stale version string in that package.
- **Inner planes.** Each plane is drawn as one dark region followed by clear-polarity antipads: 105 on In1 and 132 on In2. These match the regenerated pours one for one. Vias and plated pads are then flashed dark on both inner layers. Non-plane copper is isolated inside its antipad; `check_routing.mjs` requires at least 0.15 mm (see [routing.md](routing.md#checking)). J1's square pin has a square antipad. J2's shell and the in-pad thermal vias join the GND plane and clear the 3.3 V plane by 0.2 mm.
- **Slots.** J2's shell stakes are 0.6 × 1.7 mm (front) and 0.6 × 1.4 mm (rear), centred on the footprint's pads. The converter writes each slot's start point and its `G85` end on separate lines, which some CAM tools read as an extra round hole. `fabricate.mjs` joins them into Excellon's one-line form, `X…Y…G85X…Y…`.
- **BOM.** The converter's own BOM put the LCSC number in the value and footprint columns and listed each part on its own line. `fabricate.mjs` writes it from the circuit instead: value and MPN, grouped designators, the footprint (the package names in the script for custom land patterns) and the LCSC number.

## Before ordering

- **Rotations.** No part is rotated on the board, so every CPL rotation is 0 in the board frame. JLCPCB's library footprints each have their own zero orientation, which the converter cannot know for these parts. Check every part in JLCPCB's placement preview, especially pin 1 on U1–U12 and the cathode of D1 (pin 1, the `K` pad).
- **Centres.** The CPL uses the centre of each footprint's pads. For J2 that is 2.2 mm from the connector's placement origin, because its pads do not sit symmetrically about it. Confirm it sits on its pads in the preview.
- **Via-in-pad.** The 15 thermal vias (0.3 mm) sit inside the exposed pads of U1–U3 and U5. Without resin fill and capping (JLCPCB's "via-in-pad" option), solder can wick into them during reflow. Choose filled vias, or accept the risk of voids under those pads.
- **Stack-up and impedance.** Order JLC04161H-7628 with impedance control for the USB pair (see [routing.md](routing.md#usb-pair)).
- **Stock.** Every part has an LCSC number. Re-check the low-stock U12 and X2 ([part-selection.md](part-selection.md#ics-crystal-beads-and-connectors)).
