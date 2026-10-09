# Hedgerow v2 — Desktop App, Multiplayer-Ready Architecture, Hardware-Validated

Goal: evolve the working solo app into a **cross-platform desktop app** (Windows/Mac/Linux via Electron) with a polished stylized world, architected so multiplayer can be added later without rewriting gameplay. Plan-first from here on.

## Platform: Electron desktop shell

- Electron wrapper (Chromium inside → Web Bluetooth keeps working; same tech as VS Code/Discord). Real installers per OS; the Lovable preview remains a browser tab for fast iteration.
- `electron/main.cjs` main process, `base: './'` in Vite config, `@electron/packager` for builds. Offline-capable: localStorage persistence, no CDN dependencies at runtime.
- Desktop extras: fullscreen/windowed mode, native menu, auto-reconnect to last paired devices on launch.

## Core architectural decision: deterministic simulation core

```text
src/sim/
  types.ts      — RiderState, SimInputs, SimSnapshot (plain serializable data)
  step.ts       — step(state, inputs, dt) → new state. Pure, deterministic, no
                  imports from three.js, React, BLE, or the DOM.
  constants.ts  — physics constants (mass, CRR, CdA, gear table)
```

- **Fixed timestep:** 30 Hz sim tick regardless of frame rate; rendering interpolates between snapshots. Same visuals on any machine — and 30 Hz is the tick a future server would run.
- **Snapshots:** plain-data per tick. Your rider = "snapshot source: local sim"; future remote riders = "snapshot source: network". Renderer can't tell the difference — the entire multiplayer trick, designed in now.
- **Inputs, not mutation:** keyboard/controller/BLE power become an `inputs` object per tick. Nothing else writes sim state.

## Lessons from the big engines (compared before designing)

Reviewed Unreal 5, Unity, Godot 4, CryEngine, and custom engines (Zwift runs a custom C++ engine). Deliberately borrowed:

- **UE5 World Partition / CryEngine streaming** → chunked world tiles; only tiles near the rider mount.
- **Unity DOTS/ECS** → data-oriented sim: plain serializable state, zero allocation in the hot loop.
- **id Tech / networked-game standard** → fixed 30 Hz tick decoupled from render, snapshot interpolation.
- **Zwift's own example** → their engine is custom because the hard problems are physics + netcode, not graphics; we invest in the sim core, not photoreal rendering.
- **Skipped:** C++ engine, Nanite/Lumen-class rendering, photorealism — wrong tool for an app whose differentiator is trainer integration.

## Multiplayer-ready seams (built now, wired later)

1. **Snapshot interpolation buffer** — renderer keeps ~1 s of snapshots per rider, renders ~100 ms in the past. Solo today; exactly what remote-rider smoothing needs later.
2. **Rider registry** — world renders `Map<riderId, RiderAvatar>` from snapshots. Solo = a map of one.
3. **Course as versioned data** — course ID + hash so a future server can verify all riders are on the same world; also the foundation for adding new routes later (route = data, not code).
4. **Clock discipline** — gameplay time from the sim tick counter, never `Date.now()`.

## Hardware validation (built into the build)

I have no Bluetooth hardware in the sandbox, so validation is a designed loop: the app ships with a **diagnostics screen** and you run it with your Ride.

- **Diagnostics page:** live raw readouts per device (trainer power/cadence/speed, last command sent + acknowledgement, controller button events with bit IDs), connection log, and a "test resistance" button that ramps grade so you can feel the trainer respond.
- **Validation checklist** (you run it, ~10 min): trainer pairs → power flows → grade command changes resistance → ERG holds target watts → controller buttons register → shifting changes resistance.
- Known risk, stated plainly: the Zwift controller protocol is community-reverse-engineered; if it misbehaves, the diagnostics show exactly which bytes arrive and I fix the parser. Keyboard/on-screen shifting is the guaranteed fallback.

## Performance budget (enforced, not aspirational)

| Metric | Budget | How enforced |
|---|---|---|
| Draw calls | < 100 | instancing for all repeated props; scene audit in verification |
| Triangles | < 150 K | LOD tiers on trees/props; terrain chunk resolution tiers |
| Sim cost | < 1 ms/tick | pure math, no allocation in the hot loop |
| Shadow map | 2048, single cascade | follows rider |
| Post-processing | ≤ 1 pass | color grade only, if any |

## Visual upgrade: polished stylized countryside

Warm, painterly-realistic countryside (Cotswolds morning), not photoreal, not neon:

1. **Real models where they matter:** CC0 low-poly cyclist + bike (replacing the procedural stick rider), tree/hedgerow/fence kits (Kenney/Quaternius/poly.pizza), validated on disk before wiring.
2. **Terrain & road:** heightmap terrain with blended grass/dirt, road with edge wear and center line, distant hills as low-LOD ring.
3. **Lighting & atmosphere:** warm key sun, soft fog, Lightformer environment, gentle color grade; fix the floating-tree artifact via proper terrain height sampling.
4. **Life:** shader wind in trees, drifting clouds, gates/signs — cheap ambient motion that sells realism.

## Reliability

- Sim core unit tests (physics invariants: stopping, climbing speeds, workout target timing) — pure code, easy and high-value.
- BLE layer unchanged (already isolated); sim consumes its output as inputs.
- Verification per milestone: typecheck + browser screenshot + console-clean check.

## Milestones (each separately verifiable)

1. **Sim extraction + Electron shell** — pure `step.ts`, fixed timestep, input abstraction, rider registry, interpolation buffer; Electron wrapper builds and launches. Gameplay identical to today; tests pass.
2. **Diagnostics + hardware validation** — diagnostics page; you run the checklist with your Ride; I fix what it reveals.
3. **World chunking + LOD + budgets** — tiled terrain/props, instancing audit, draw-call measurement.
4. **Visual pass** — CC0 rider/bike + vegetation, textures, lighting/grade, floating-tree fix.
5. **Multiplayer design doc** — protocol/authority design (rooms, snapshot rate, reconciliation) reviewed with you before any backend work.

Out of scope (unchanged): actual multiplayer, Strava upload, multiple worlds, running.

## Process agreement

Plan-first, always: significant work starts with a plan for your approval; small fixes and polish are done directly and reported.
