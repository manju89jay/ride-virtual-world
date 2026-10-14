# Wahoo KICKR Core: learn, simulate, connect, control

## What the KICKR Core is (research summary)

- Direct-drive smart trainer, 1800 W max, ~5.4 kg flywheel, simulates up to 16% grade. Speaks Bluetooth LE and ANT+.
- Over Bluetooth it offers three ways in. Current firmware supports all of them:
  1. **FTMS** (the open fitness-machine standard): Indoor Bike Data for power, cadence and speed; Control Point for grade, ERG watts and resistance level. The app already uses this.
  2. **Cycling Power Service** (0x1818): power plus crank/wheel revolutions. Read-only.
  3. **Wahoo's own control channel** (Cycling Power service + characteristic `a026e005-0a7d-4ab3-97fa-f1500f9feb8b`): older Wahoo-only commands for ERG, sim mode, wind and weight. Used as a fallback when FTMS isn't available (old firmware).
- Behaviour worth modelling: ERG takes about 1–3 s to settle on a new target. Grade changes ramp in rather than snap. At low cadence in ERG the "spiral of death" happens (resistance climbs, power can't be held). The trainer reports cadence that it estimates from the flywheel, with no sensor, so cadence lags. It accepts commands from only one app at a time.

## What I can and cannot verify (honest)

- **Can:** build a separate virtual KICKR Core program (a "virtual ECU") that speaks the exact same Bluetooth bytes as the real trainer. The app connects to it through the same code path it uses for real hardware. Automated tests can drive it here.
- **Cannot:** touch your physical KICKR. The real connect-and-control step happens on your PC, using the Test page and the log loop we already have. A simulator built from published specs doesn't prove the real device behaves the same. Your log run is the proof.

## Build steps

1. **Standalone virtual KICKR Core** (`tools/kickr-sim/`, a separate Node program with no app code inside). It has a flywheel physics model (inertia, ERG settle lag, grade ramp, cadence estimate, low-cadence ERG spiral), FTMS + Cycling Power + Wahoo control channel byte encoding, and real control-point result codes. A small terminal/web control panel sets the simulated rider (cadence, effort) and injects faults: dropouts, rejected commands, slow acks. A scripted mode runs headless for automated tests.
   - **Link to the app, two modes:**
     - **Wire mode (default, verifiable here):** the simulator exposes the GATT services over a local WebSocket (`ws://127.0.0.1:8765`). Every message is the raw Bluetooth byte payload plus the characteristic UUID, so it is effectively Bluetooth carried over a socket.
     - **Real Bluetooth mode (later, your PC only):** the same simulator advertises as an actual BLE peripheral named "KICKR CORE SIM", using a BLE peripheral library. Then even the real Bluetooth stack gets tested end to end. It needs a Bluetooth adapter that supports peripheral mode. I can't verify this mode here.
2. **Transport seam in the app**: `ble.ts` gets its device from an adapter, either real Web Bluetooth or the WebSocket "virtual device". All parsing, commands, logging and reconnect logic are shared. The only extra UI is a "Connect to virtual trainer" button on the Devices page, shown in dev builds and the desktop app.
3. **KICKR-specific connection logic**:
   - Pairing filter matches "KICKR CORE" by name plus the FTMS/CPS/Wahoo services.
   - Order of preference: FTMS, then the Wahoo control channel (old firmware), then read-only Cycling Power.
   - Auto-reconnect on drop, with the last command re-sent after reconnect.
   - Commands are rate-limited to ≤ 4 per second, sent only on change, and kept in grade/ERG range (KICKR Core: ±10%..+16%, ERG 0–1800 W).
   - Optional spindown/calibration command, if the trainer reports support for it.
4. **Test page upgrades**: a "Virtual KICKR Core" toggle, simulated-rider sliders, a measured response time for each command (sent → acknowledged → power settled), and a pass/fail result for each checklist item. Log export stays the same.
5. **Automated tests**: unit tests for byte parsing/encoding on both protocols, plus an end-to-end browser test that pairs the virtual KICKR, runs the grade ramp and the ERG test, and checks that power settles within tolerance.
6. **Docs**: a KICKR Core section in the README with step-by-step pairing on your PC (close Zwift/Wahoo apps first, update firmware in the Wahoo app, then Devices → Pair trainer → Test page).

## Then on your side

Run the Test page against the real KICKR Core and send me the log. I compare its response times and acknowledgements with the simulator and fix any differences.

## Technical notes

- The virtual device implements a minimal `BluetoothDevice`/GATT interface (`getPrimaryService`, `getCharacteristic`, `startNotifications`, `writeValueWithResponse`, `characteristicvaluechanged` events). This keeps `ble.ts` untouched apart from the adapter injection.
- Simulator physics stays pure, stepping at 10 Hz. Notifications go out at 4 Hz, like the real unit.
- Zwift Ride controller code is unchanged and still works alongside the KICKR.
