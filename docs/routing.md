# Routing

The board is routed with [Freerouting](https://github.com/freerouting/freerouting), not tscircuit's built-in autorouter. The tscircuit source remains the single source of truth for the netlist, footprints and placement. Freerouting produces only copper: the traces and vias. Its session file is merged back onto tscircuit's own build and checked there.

## Current routing

`hardware/routing/board.ses` is the committed Freerouting session. Its routing stage ran with the optimiser off and left **0 unrouted connections**:

- **Copper:** 650 traces, about 1.81 m in total (1.35 m top, 0.47 m bottom), and 128 vias of 0.45/0.2 mm.
- **Planes:** no traces on the inner layers, so both planes are unbroken apart from antipads.
- **Sign-off:** all 55 nets connected, no shorts, no clearance findings from tscircuit's checks, and the USB pair exactly as designed.

`hardware/check_schematic.ps1` merges this session onto every build and runs the routing sign-off. It needs no Java or Freerouting. A deliberately stale case, R1 moved 1 mm without re-routing, fails with a V1V2 + FB_CORE short.

The last routing blocker was the host UART. On FPGA pins 34/31, which face away from the FT2232H, the receive line stayed unrouted in every Freerouting configuration tried, so the UART moved to bank-2 pins 12/11. The fixed USB pair later left FLASH_MISO unrouted at U6, and moving U6 1 mm east cleared it.

## USB pair

The USB D+/D− pair is laid out by [usb_pair.mjs](../hardware/usb_pair.mjs) and not by Freerouting. It is JLCPCB's 90 Ω differential geometry for the JLC04161H-7628 stack-up: 0.2332 mm traces with a 0.15 mm gap, on the top layer over the inner-1 ground plane. `prepare_dsn.mjs` hands the pair to Freerouting as protected wiring, and Freerouting routes everything else around it. The route is computed from the built pad positions. It asserts the placement it relies on, and stops rather than drawing a wrong route.

- **J2:** USB-C interleaves the contacts DM2, DP1, DM1, DP2. The pair leaves from DM2 and DP1. DP2 ties to D+ above the contacts, and DM1 ties to D− below them, under the connector body. Everything stays on the top layer with no vias.
- **U12:** the ESD clamp sits in the pair's path. The traces pass 0.46 mm either side of its centre and step through each clamp pad. U12's ground pin between them gets a fixed via just above it, and the pair closes to 0.15 mm only after clearing that via. TI names the pins D+ and D−, but the clamps are identical, so D− uses the left pin to keep the pair uncrossed.
- **U12 to U8:** the pair runs coupled at a 45° diagonal, then north in a column 1.6 mm west of the FT2232H's pins, leaving room for its neighbouring pins to via under the pair. It then turns east into pins 7 (DM) and 8 (DP).
- **Length:** J2 to U8 is 22.9 mm, with 0.77 mm D+/D− skew from the bends. The usual limit for USB 2.0 high speed is about 1.25 mm.

Freerouting counts a connection only where a wire ends on a pad, not where a wire passes over one. Each part of the pair therefore ends on a pad centre or on another wire's end. Otherwise Freerouting adds its own 0.15 mm stubs to the USB nets.

`check_routing.mjs` compares the routed USB copper with the design as geometry. Every USB trace must lie on the designed wires at 0.2332 mm on the top layer, every designed segment must be present, and no via may sit on the pair. The check caught each of these deliberately broken copies of the routed board: a stray 0.15 mm stub on D+, the pair drawn at 0.15 mm, and a missing pair segment.

## Why not the built-in router

tscircuit's autorouter connected all 255 connections, but the result always had 17 design-rule errors on this board: 5 traces crossing other nets' vias, 6 clearance violations and 6 board-edge violations. The result was identical across runs. The trace-clearance setting, plane fan-out maps, reroute phases and the older `sequential-trace` preset did not change it, and the `auto-cloud` Freerouting service is deprecated in the pinned tscircuit version. tscircuit also caches routing results in `.tscircuit/cache` under keys that do not include those settings, so the cache has to be cleared between experiments.

## Pipeline

`hardware/route.ps1` runs these steps:

1. **Build** the board with autorouting disabled. This is the same circuit JSON that `check_schematic.ps1` verifies.
2. **Export** it as a Specctra DSN with `tsci export -f specctra-dsn`.
3. **Prepare** the DSN for Freerouting with [prepare_dsn.mjs](../hardware/prepare_dsn.mjs).
4. **Route** with Freerouting in headless mode. The session is written to `hardware/routing/board.ses`.
5. **Import** the session with [import_ses.mjs](../hardware/import_ses.mjs), which merges its wires and vias into the built circuit JSON. The script links each trace and via to its net the way tscircuit's own routes are linked, then regenerates both inner planes around the new copper with tscircuit's copper-pour solver. The planes keep 0.2 mm from other-net copper and 0.3 mm from the board edge.
6. **Check** the merged board with [check_routing.mjs](../hardware/check_routing.mjs).

## DSN adjustments

Each adjustment in `prepare_dsn.mjs` fixes a failure seen while routing:

| Adjustment | Failure without it |
| --- | --- |
| Add GND and V3V3 plane polygons on In1 and In2 | The export omits copper pours, so Freerouting has no planes to connect to. |
| Keep the inner layers `signal`-typed, and restrict classes with `use_layer`: signals to F.Cu/B.Cu, GND to F.Cu/In1/B.Cu, V3V3 to F.Cu/In2/B.Cu | With `power`-typed layers, Freerouting reached the planes only by wiring plane nets on the surface. With unrestricted signal layers, traces ran through the inner layers and split the planes into islands. |
| Point every class at the one defined via | The export names an undefined `Via[0-1]` padstack for some classes. Nets in those classes could not place vias and never reached the planes. |
| Via 0.45 mm pad / 0.2 mm drill instead of 0.6/0.3 | The larger via does not fit beside 0.5 mm-pitch pins. |
| Clearance 0.1 mm in every rule (the export uses 0.15–0.2 mm) | Wide power traces could not enter fine-pitch pins, leaving up to 36 connections unrouted. |
| Keep-outs around the USB-C locating holes | The export omits non-plated holes, and traces were routed across them. |
| Replace the DSN `wiring` section with the protected USB pair | `tsci export` runs tscircuit's own autorouter and cannot skip it. Any traces it produced would be handed to Freerouting as fixed copper, so they are dropped. On this board that router currently fails. The section then carries only the fixed USB pair (see [USB pair](#usb-pair)). |

The trace widths come from [routing.ts](../hardware/routing.ts). Freerouting does not narrow a trace near a pad, so no net that reaches a 0.5 mm-pitch pin is wider than 0.25 mm. Freerouting's optimiser stage is disabled because it re-routed finished connections and left more of them unrouted.

## Checking

`check_routing.mjs` is the routing sign-off:

- **Connectivity from copper geometry, planes included.** Pads, trace segments, vias and plated holes are joined wherever their copper touches on a shared layer. Plated holes are modelled by shape: round, square pad, or pill slot. A via or plated hole joins a plane when its centre lies in plane copper rather than in an antipad. Every net must form one connected group (no opens), and no group may contain two nets (no shorts).
- **Plane antipads.** The gerbers flash every via and plated pad on both inner layers, so any through-hole copper that is not on a plane's net must sit in an antipad at least 0.15 mm from that plane's copper. The pour keeps 0.2 mm; the lower limit allows for its polygonal arcs, and the closest measured is 0.198 mm. The check caught a deliberately shrunken antipad around one 3.3 V-plane via.
- **Clearances** from tscircuit's `runAllRoutingChecks`. Its connectivity messages are excluded, because they follow traces only and report pins that are joined through a plane as unconnected.

## Tools

| Tool | Version | Source | SHA-256 |
| --- | --- | --- | --- |
| Freerouting | 2.4.1 | [`freerouting-2.4.1.jar`](https://github.com/freerouting/freerouting/releases/tag/v2.4.1) (official release, 64,076,787 bytes) | `251101c3eeac22d7e7dfcf6796603279e5d1000283eb82d8f093780f7afc6aa9` |
| Java runtime | Temurin 25.0.4.1+1 JRE | [`OpenJDK25U-jre_x64_windows_hotspot_25.0.4.1_1.zip`](https://github.com/adoptium/temurin25-binaries/releases/tag/jdk-25.0.4.1%2B1) (Eclipse Adoptium) | `4c95451cea98556def2c54f7782933f52a26d4a36bd85e1d59f0364464828b07` |
| `@tscircuit/checks`, `@tscircuit/copper-pour-solver` | 0.0.208, 0.0.57 | Installed by `npm ci` as tscircuit dependencies, pinned in `package-lock.json` | — |

Freerouting 2.4.1 needs Java 25; Java 21 fails with `UnsupportedClassVersionError`. Both tools are needed only to re-route. Neither is required to check the committed routing.

```text
powershell -NoProfile -ExecutionPolicy Bypass -File hardware/route.ps1 -Java <path\to\java.exe> -Freerouting <path\to\freerouting-2.4.1.jar>
```

## Limits

- The 90 Ω pair geometry comes from JLCPCB's calculator via the JITX library, and IPC-2141 cross-checks it at about 95 Ω. The fabricated impedance depends on JLCPCB's process and is not measured.
- Freerouting reports 15 violations under its own rules. There are exactly 15 in-pad thermal vias (9 on the FPGA paddle and 2 on each regulator), and the count went from 0 to 15 when they were added. It flags each via that overlaps its own pad. The routing sign-off is `check_routing.mjs`.
- The routed copper depends on the placement. Any change to placement, footprints or the netlist needs a fresh route, and `check_routing.mjs` fails on a session that no longer fits.
