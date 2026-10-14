# Wahoo KICKR Core: learn, simulate, connect, control

## What the KICKR Core is (research summary)

- Direct-drive smart trainer, 1800 W max, ~5.4 kg flywheel, simulates up to 16% grade. Speaks Bluetooth LE and ANT+.
- Over Bluetooth it offers three ways in. Current firmware supports all of them:
  1. **FTMS** (the open fitness-machine standard): Indoor Bike Data for power, cadence and speed; Control Point for grade, ERG watts and resistance level. The app already uses this.
  2. **Cycling Power Service** (0x1818): power plus crank/wheel revolutions. Read-only.
  3. **Wahoo's own control channel** (Cycling Power service + characteristic `a026e005-0a7d-4ab3-97fa-f1500f9feb8b`): older Wahoo-only commands for ERG, sim mode, wind and weight. Used as a fallback when FTMS isn't available (old firmware).
- Behaviour worth modelling: ERG takes about 1–3 s to settle on a new target. Grade changes ramp in rather than snap. At low cadence in ERG the "spiral of death" happens (resistance climbs, power can't be held). The trainer reports cadence that it estimates from the flywheel, with no sensor, so cadence lags. It accepts commands from only one app at a time.

## What I can and cannot verify (honest)

- **Can:** build a virtual KICKR Core that runs inside the app and speaks the exact same Bluetooth bytes as the real one. The real connection code then talks to it unchanged. Automated tests can drive it: pair, request control, grade ramp, ERG steps, disconnect/reconnect.
- **Cannot:** touch your physical KICKR. The real connect-and-control step happens on your PC, using the Test page and the log loop we already have. A simulator built from published specs doesn't prove the real device behaves the same. Your log run is the proof.

## Build steps

1. **Virtual KICKR Core** (`src/lib/virtual/kickrCore.ts`): a fake Bluetooth device with the FTMS service, Cycling Power service and Wahoo control channel. It has a flywheel physics model (inertia, ERG settle lag, grade ramp, cadence estimate, low-cadence ERG spiral) and replies to control-point commands with real result codes. You set a simulated rider's legs (cadence, effort) on the Test page.
2. **Transport seam**: `ble.ts` gets its device from an adapter: real Web Bluetooth, or the virtual trainer. All parsing, commands, logging and reconnect logic run identically for both. No shortcuts in the virtual path.
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
