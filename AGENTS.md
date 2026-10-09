<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Bluetooth (FTMS trainer, HR, Zwift controller) lives in src/lib/ble.ts and writes into zustand stores in src/lib/store.ts — single source for live device data.
- Ride physics runs inside the R3F frame loop (src/components/world/SimLoop.tsx) on a mutable `sim` object; the HUD reads throttled snapshots from `useRide` to avoid per-frame React renders.
- The course is a procedural closed loop (src/lib/course.ts); terrain, road, trees and the elevation profile all derive from it so they stay consistent.
- Personal-use app: settings and rides persist in localStorage, no backend.
- Rider physics lives in src/sim/physics.ts as pure functions (no React/three/BLE imports) stepped at a fixed 30 Hz tick from SimLoop, with rendering interpolated between ticks — keeps physics deterministic and portable to a future multiplayer server.
- All Bluetooth traffic is mirrored into src/lib/bleLog.ts so the hardware test page can show and export it for remote debugging.
- Desktop app: electron/main.cjs runs the built server bundle (dist/server/index.mjs) on a local 127.0.0.1 port and serves dist/client statically, so the full app works offline in a native window; it also handles Electron's select-bluetooth-device prompt. Build with scripts/package-desktop.sh (Electron tooling installed in a temp dir, not in package.json).
