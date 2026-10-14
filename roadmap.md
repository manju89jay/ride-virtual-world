# Roadmap

## Track A — C++ native engine (user's team builds it)
- [x] Detailed spec: requirements, architecture, protocols, milestones, acceptance criteria → Files

## Track B — Web/desktop version (I build and verify, full freedom)
- [x] Deterministic sim core (pure step, fixed 30 Hz tick) + unit tests
- [x] Diagnostics page for hardware testing (raw device data, command log, resistance ramp)
- [x] Electron desktop packaging (Win/Mac/Linux)
- [ ] World chunking + LOD + perf budgets
- [x] Visual pass 1: CC0 Kenney trees/rocks/bushes (instanced), grass texture, sun shadows, ACES grading
- [ ] Visual pass 2: better rider/bike model, hedgerows/fences, post-processing
- [ ] Multiple routes as data

## Blocked on user
- [ ] Real Bluetooth test with Zwift Ride (needs user's hardware)
- [ ] Real KICKR Core test: run Test page, send log (needs user's hardware)

- [x] External virtual KICKR Core simulator (separate program, like a virtual ECU) to test the app without hardware
- [x] Virtual peloton: bot riders driven by simulated trainers, shown in the world via the rider snapshot path
