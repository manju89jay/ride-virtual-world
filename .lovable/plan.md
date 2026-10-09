# Hedgerow v2 — Architecture for a Realistic, Multiplayer-Ready World

Goal: evolve the working solo app into a polished stylized world whose core is architected so multiplayer can be added later **without rewriting gameplay**. Plan-first from here on: nothing gets built without an approved plan.

## Core architectural decision: deterministic simulation core

The single most important change. Today physics runs inline in the render loop on a mutable global. We replace that with:

```text
src/sim/
  types.ts      — RiderState, SimInputs, SimSnapshot (plain serializable data)
  step.ts       — step(state, inputs, dt) → new state. Pure, deterministic, no
                  imports from three.js, React, BLE, or the DOM.
  constants.ts  — physics constants (mass, CRR, CdA, gear table)
```

- **Fixed timestep:** simulation ticks at 30 Hz regardless of frame rate. The render loop accumulates real time and runs whole ticks; rendering interpolates between the last two snapshots. Same visuals on a 144 Hz monitor and a 45 fps laptop — and 30 Hz is exactly the tick a future server would run.
- **Snapshots:** each tick produces a plain-data snapshot. Your own rider is "snapshot source: local sim"; future remote riders are "snapshot source: network". The renderer cannot tell the difference — that is the entire multiplayer trick, designed in now.
- **Inputs, not state mutation:** keyboard/controller/BLE power become an `inputs` object per tick (power, cadence, gear shift requested, steer). The sim consumes inputs; nothing else writes sim state.

## Multiplayer-ready seams (built now, wired later)

1. **Snapshot interpolation buffer** — renderer keeps the last ~1 s of snapshots per rider and renders ~100 ms in the past. Solo today; this is exactly what remote-rider smoothing needs later.
2. **Rider registry** — world renders `Map<riderId, RiderAvatar>` from snapshots, not one hardcoded rider. Solo = a map of one.
3. **Course as versioned data** — course definition gets an ID + hash so a future server can verify all riders are on the same world.
4. **Clock discipline** — all gameplay time comes from the sim tick counter, never `Date.now()`, so replays and server reconciliation are possible.

Later (not in this plan): Lovable Cloud backend, a server route running the same `step.ts` authoritatively, presence/rooms, anti-cheat. Because `step.ts` is pure and dependency-free, it runs unchanged on the server.

## Lessons from the big engines (compared before designing)

Reviewed Unreal 5, Unity, Godot 4, CryEngine, and custom engines (Zwift itself runs a custom C++ engine). What we deliberately borrow:

- **UE5 World Partition / CryEngine terrain streaming** → chunked world tiles; only tiles near the rider mount.
- **Unity DOTS/ECS** → data-oriented sim: plain serializable state, zero allocation in the hot loop.
- **id Tech / networked-game standard** → fixed 30 Hz sim tick decoupled from render, with snapshot interpolation.
- **Zwift's own example** → their engine is custom because the hard problems are physics + netcode, not graphics; we invest in the sim core, not in photoreal rendering.
- **Deliberately skipped:** C++ engine, Nanite/Lumen-class rendering, photorealism — wrong tool for a browser app whose differentiator is Bluetooth trainer integration.

## Performance budget (enforced, not aspirational)

| Metric | Budget | How enforced |
|---|---|---|
| Draw calls | < 100 | instancing for all repeated props; scene audit in verification |
| Triangles | < 150 K | LOD tiers on trees/props; terrain chunk resolution tiers |
| Sim cost | < 1 ms/tick | pure math, no allocation in the hot loop |
| Shadow map | 2048, single cascade | follows rider, as today |
| Post-processing | ≤ 1 pass | color grade only, if any |

Chunked world: terrain/road/props split into tiles keyed by course distance; only tiles near the rider are mounted. This is what lets the world grow (longer routes, more scenery) without growing frame cost.

## Visual upgrade: polished stylized countryside

Deliberate art direction — warm, painterly-realistic countryside (think Cotswolds morning), not photorealism and not neon:

1. **Real models where they matter:** CC0 low-poly cyclist + bike (replacing the procedural stick rider), tree/hedgerow/fence kits from Kenney/Quaternius/poly.pizza, validated on disk before wiring.
2. **Terrain & road:** heightmap terrain with blended grass/dirt textures, road with edge wear and center line, distant hills as low-LOD ring.
3. **Lighting & atmosphere:** warm key sun + sky, soft fog, Lightformer environment (already in place), gentle color grade; fixed the floating-tree artifact via proper terrain height sampling.
4. **Life:** swaying trees (shader wind), birds or clouds drifting, occasional gates/signs — cheap ambient motion that sells realism.

## Reliability

- Sim core gets unit tests (physics invariants: energy, stopping, climbing speeds; workout target timing) — it is pure, so this is easy and high-value.
- BLE layer unchanged (already isolated behind the device store); sim consumes its output as inputs.
- Verification loop per milestone: typecheck + browser screenshot + console-clean check, as before.

## Milestones (each separately verifiable)

1. **Sim extraction** — pure `step.ts`, fixed timestep, input abstraction, rider registry, interpolation buffer. Gameplay identical to today; all tests pass.
2. **World chunking + LOD + budgets** — tiled terrain/props, instancing audit, draw-call measurement.
3. **Visual pass** — CC0 rider/bike + vegetation kit, textures, lighting/grade polish, floating-tree fix.
4. **Multiplayer design doc** — written protocol/authority design (rooms, snapshot rate, reconciliation) reviewed with you before any backend work.

Out of scope (unchanged): actual multiplayer, Strava upload, multiple worlds, running.

## Process agreement

Plan-first, always: significant work starts with a plan like this one for your approval; small fixes and polish are done directly and reported.
