# Hedgerow Native — C++ Cycling Engine (Windows / macOS / Linux)

A native desktop cycling app in C++, single rider first, built so multiplayer and new routes can be added later. Connects directly to your Zwift Ride (trainer + controllers) and keeps power and resistance in sync.

## What I can and cannot do here (stated up front)

- **Can:** design the architecture, write all the C++ source, build files and tests, and compile + unit-test the engine-independent parts (physics, Bluetooth message parsing, workouts) inside this environment. Delivered as a downloadable source package.
- **Cannot:** run the 3D game window, an Unreal editor, or real Bluetooth here. You build and run it on your PC (Visual Studio on Windows, Xcode on Mac, or CMake on Linux), and we iterate on what you see.
- The existing web version stays untouched as a reference prototype.

## Stack decision (recommended — approve or change)

| Layer | Choice | Why |
|---|---|---|
| Language | C++20 | Native performance, same as Zwift and major engines |
| Rendering / world | **Unreal Engine 5** (C++ project) | Realistic worlds, World Partition streaming for long routes, built-in networking for later multiplayer, free for personal use |
| Bluetooth | **SimpleBLE** (C++ library) | One API for Windows, macOS and Linux Bluetooth LE |
| Build | CMake (core) + Unreal build tool (game) | Core library builds and tests anywhere |
| Tests | doctest | Lightweight, header-only |

Alternative if Unreal feels too heavy (≈100 GB install): **Godot 4 with C++ (GDExtension)** — lighter and open source, less realistic out of the box. The core library below works with either.

## Architecture

```text
hedgerow-native/
  core/                    engine-independent C++ library (compiled + tested here)
    sim/                   pure physics: step(state, inputs, dt), 30 Hz fixed tick
    devices/               FTMS trainer, Heart Rate, Zwift Ride controller protocols
    workouts/              workout definitions, ERG target timing
    course/                routes as versioned data files (one route now, more later)
    net/                   snapshot types + interpolation buffer (multiplayer seam)
    tests/                 unit tests for all of the above
  game/                    Unreal Engine 5 project
    Source/Hedgerow/       C++ game module: links core, drives rider pawn, HUD, camera
    Content/               world, road, terrain, rider model
  docs/                    architecture, hardware test checklist, multiplayer design
```

Key rules:
- **Core never depends on the engine.** Physics and device code are plain C++ — testable, and the same code can run on a future multiplayer server.
- **Fixed 30 Hz simulation**, rendering interpolates between snapshots — consistent on any PC, and the tick rate a server would use.
- **Your rider is just one entry in a rider list** fed by snapshots; remote riders later arrive through the same path.

## Zwift Ride sync (the main point)

- **Trainer (Zwift Hub inside the Ride):** open Bluetooth fitness standard (FTMS). Read power, cadence, speed ~4×/s; send road gradient (scaled by virtual gear) for hills, or target watts for ERG workouts.
- **Controllers (shift/steer buttons):** Zwift's proprietary protocol, known from community reverse-engineering ("RideOn" handshake, button bitmask messages). Implemented best-effort; keyboard shifting as guaranteed fallback.
- **Power sync loop:** your watts → speed in the world → road gradient → trainer resistance, every tick.

## Hardware testing (part of the build)

- Built-in **diagnostics screen**: raw live data per device, every command sent and acknowledged, controller button IDs, connection log, and a "ramp resistance" test.
- A ~10-minute **checklist** you run with your Ride; you send me the diagnostics log, I fix what it shows.

## Milestones

1. **Core library** — physics, FTMS/HR/controller protocols, workouts, one route, tests. Compiled and tested here. Delivered as a source package.
2. **Hardware validation** — small command-line tool using the core to pair your Ride and print live power, cadence and buttons. You run it; we fix issues before any 3D work.
3. **Unreal game** — world, road, rider, chase camera, HUD, workouts, ride history, diagnostics screen.
4. **Visual pass** — realistic countryside, lighting, scenery.
5. **Multiplayer design doc** — reviewed with you before any server work.

Out of scope for now: actual multiplayer, Strava upload, multiple worlds.
