# Routing

The board is routed with [Freerouting](https://github.com/freerouting/freerouting), not tscircuit's built-in autorouter. The tscircuit source remains the single source of truth for the netlist, footprints and placement. Freerouting produces only copper: the traces and vias. Its session file is merged back onto tscircuit's own build and checked there.

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
| Empty the DSN `wiring` section | `tsci export` runs tscircuit's own autorouter and cannot skip it. Any traces it produced would be handed to Freerouting as fixed copper. On this board that router currently fails, so the section is already empty. |

The trace widths come from [routing.ts](../hardware/routing.ts). Freerouting does not narrow a trace near a pad, so no net that reaches a 0.5 mm-pitch pin is wider than 0.25 mm. Freerouting's optimiser stage is disabled because it re-routed finished connections and left more of them unrouted.

## Checking

`check_routing.mjs` is the routing sign-off:

- **Connectivity from copper geometry, planes included.** Pads, trace segments, vias and plated holes are joined wherever their copper touches on a shared layer. Plated holes are modelled by shape: round, square pad, or pill slot. A via or plated hole joins a plane when its centre lies in plane copper rather than in an antipad. Every net must form one connected group (no opens), and no group may contain two nets (no shorts).
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

- The USB D+/D− pair is routed as two independent signals. Its 90 Ω differential geometry (0.2332 mm traces with a 0.15 mm gap on JLCPCB's JLC04161H-7628 stack-up) is not yet enforced.
- Freerouting reports "violations" under its own rules. The routing sign-off is `check_routing.mjs`.
- The routed copper depends on the placement. Any change to placement, footprints or the netlist needs a fresh route, and `check_routing.mjs` fails on a session that no longer fits.
