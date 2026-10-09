# Hedgerow

A personal virtual cycling world for your indoor trainer. You pedal, the world reacts: hills get
harder, workouts hold you at target watts, and every ride is logged. It talks to your equipment
over Bluetooth, needs no account, no subscription and no internet once installed.

Built with React + TypeScript + three.js, packaged as a desktop app for Windows, macOS and Linux
with Electron.

---

## 1. Fastest way to ride: use a packaged build

No code, no install step. Pick the file for your machine, unzip it, run the app inside.

| Machine | File |
| --- | --- |
| Windows 10/11 (64-bit) | `Hedgerow-win32-x64.zip` |
| Mac with Apple silicon (M1/M2/M3/M4) | `Hedgerow-darwin-arm64.zip` |
| Mac with Intel chip | `Hedgerow-darwin-x64.zip` |
| Linux (x86-64) | `Hedgerow-linux-x64.tar.gz` |

Unzip somewhere permanent (the app saves your rides next to itself), then:

- **Windows** — open the folder, double-click `Hedgerow.exe`.
- **macOS** — the build is not signed, so the first open must be **right-click the app → Open →
  Open**. After that a normal double-click works.
- **Linux** — extract, then run the `hedgerow` binary inside (make it executable first:
  `chmod +x hedgerow`).

Then go to **Devices** in the app's menu and pair (see section 4).

## 2. Run it from source

You need **Node.js 20 or newer**.

```sh
git clone <your-repository-url>
cd <repository-name>
npm install
npm run dev
```

Open the address it prints (this workspace uses `http://localhost:8080`). The app is the same
either way — the desktop version is this build wrapped in a native window.

Other useful commands:

```sh
npm run build      # production build into dist/
npm test           # physics unit tests
npm run lint       # style/lint check
```

## 3. Build the desktop app yourself

```sh
bash scripts/package-desktop.sh
```

This compiles the web app and wraps it in Electron for all four targets, writing them to
`electron-release/`. It needs internet the first time (it downloads Electron) and takes a few
minutes. The Electron tooling is installed into a temporary folder, so it never becomes part of
the web app's dependencies.

## 4. Connect your equipment

Your **Zwift Ride** has two separate Bluetooth pieces. They are different devices and pair
separately on the **Devices** page.

1. **Close the Zwift app first.** A trainer only talks to one app at a time, and Zwift keeps the
   connection even in the background. Quit it properly — this is the single most common reason for
   "it won't connect".
2. **Trainer** — pair the device named **Zwift Hub**. This is the important one: it sends your
   power, cadence and speed to the app, and the app sets its resistance. When the road climbs, the
   trainer gets harder; during a workout it holds you at target watts (ERG mode). This is the open
   FTMS standard, the same protocol Zwift itself uses.
3. **Controllers** — pair the left and right Ride controllers. These use Zwift's private protocol
   that the community has only partly documented, so support is best-effort. If buttons do nothing,
   the keyboard always works: **Q/E** shift, **↑/↓** adjust watts, **Space** pause.
4. **Heart-rate strap** — optional, pairs as a standard heart-rate device.
5. Set your **FTP, weight and hill feel** on the **Settings** page. Hill feel scales how much of
   each slope actually reaches the trainer; 50% is a sane starting point.

Chrome or Edge only — Firefox and Safari cannot do Bluetooth pairing.

## 5. Prove it works: the Test page

The **Test** page exists because real hardware can only be validated with your bike in front of
you. There:

- watch live power, cadence, heart rate and controller buttons as you produce them;
- run the **resistance ramp** (0 → 10% in 10-second steps) and feel the trainer get harder;
- run the **ERG test** (100 → 250 W) and check the trainer holds those watts;
- tick off a six-step checklist, then **download the log** and send it to me if anything is off.

That log is the debugging loop: you ride, the log tells us what happened, I fix it.

## 6. What is where

```
src/sim/physics.ts      bike physics, pure functions, no rendering — stepped at a fixed 30 Hz
src/lib/course.ts       the route: a procedural closed loop everything else is built from
src/lib/ble.ts          Bluetooth: FTMS trainer, heart rate, Ride controllers
src/lib/bleLog.ts       every Bluetooth byte mirrored here so the Test page can show and export it
src/lib/store.ts        live device data (zustand)
src/components/world/   the 3D world: terrain, road, vegetation, rider, simulation loop
src/routes/             pages: home, devices, workouts, ride, history, settings, test
electron/main.cjs       desktop shell: runs the built app in a native window, handles Bluetooth
scripts/package-desktop.sh
```

Rides and settings live in local storage on your machine — nothing leaves your computer, and there
is no server to lose.

## 7. Honest limits

- One 5.5 km loop. Adding routes is a configuration change, not a rewrite.
- Single-player. The simulation is deliberately separated from rendering so a future server can
  run the same code and put riders in the same world — but that is not built yet.
- Controller buttons are best-effort (private protocol). Keyboard fallback is guaranteed.
- The world is stylized, using free CC0 game models — closer to a clean indie game than to Zwift's
  art.
- macOS builds are unsigned: expect the right-click-to-open step, and a possible Gatekeeper
  warning on a fresh machine.
