# Personal Virtual Cycling World (v1)

A private, single-rider Zwift-style app that runs in Chrome/Edge on your computer and connects directly to your Zwift Ride over Bluetooth. No accounts, no subscription.

## About your Zwift Ride
- **Trainer (Zwift Hub inside the Ride):** speaks the standard Bluetooth fitness protocol (FTMS). We read power, cadence and speed, and send resistance for hills and ERG workouts. This is the reliable part.
- **Virtual shifting:** we build our own 24-gear virtual gearbox in the app. Shifting changes the resistance we send to the trainer, so gears feel real.
- **Ride controllers (shift/steer buttons):** they use Zwift's own protocol. We'll attempt to connect and map the shift buttons to our virtual gears. If they won't pair, keyboard keys and on-screen buttons do the same job. Treat controller support as best-effort.
- Requires Chrome or Edge on desktop (Safari/Firefox don't support Bluetooth in the browser).

## What you'll get
1. **Pairing screen** - connect trainer, controllers and a Bluetooth heart rate strap; live readout of each. A "simulation mode" (keyboard power) for testing without the bike.
2. **Free ride** - bright countryside 3D world: a looping road with rolling hills and one real climb, trees, fences, fields, a rider avatar and chase camera. Speed comes from your power, weight and the road gradient; the trainer gets stiffer on climbs.
3. **Live HUD** - power, 3s power, cadence, speed, heart rate, distance, elevation, time, current gear, gradient, and an elevation profile with your position.
4. **Structured workouts** - set your FTP and weight; a library of ~6 built-in workouts (endurance, sweet spot, VO2 intervals, ramp test). ERG mode holds target watts; workout graph shows progress and next interval.
5. **Ride history** - every ride saved on this device with summary stats (avg/NP power, HR, distance, climbing, time) and a power/HR chart. Export to .FIT/.TCX later is an easy follow-up for Strava.

## Out of scope for v1
Multiplayer, other riders, Strava upload, multiple worlds, running.

## Technical details
- Pages: `/` home (start ride / workouts / history / settings), `/pair`, `/ride` (3D, `ssr:false`), `/workouts`, `/history`, `/history/$id`, `/settings`.
- Bluetooth via Web Bluetooth: FTMS service 0x1826 (Indoor Bike Data 0x2AD2, Control Point 0x2AD9: request control, set simulation params, set target power), Cycling Power 0x1818 fallback, Heart Rate 0x180D. Zwift Ride/Play controller: custom service with "RideOn" handshake, parse button notifications; graceful fallback.
- Physics: standard cycling power model (gravity + rolling resistance + aero drag) with delta-time integration; virtual gear ratio scales the grade sent to the trainer.
- 3D: React Three Fiber + drei; road as a spline-based ribbon with heightmap terrain, instanced trees/props, CC0 low-poly cyclist model where available, Lightformer environment, fog, warm sunlight.
- State: zustand store for live telemetry; rides, settings, FTP stored in localStorage/IndexedDB (no backend needed for personal use).
- DOM HUD overlay; warm countryside palette with semantic design tokens.
