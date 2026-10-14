/// <reference types="web-bluetooth" />
import { useDevices, useSettings } from "./store";
import { bleLog, hex } from "./bleLog";
import { WAHOO_CP } from "./bleUuid";

const FTMS = 0x1826;
const IBD = 0x2ad2;
const FTMS_CP = 0x2ad9;
const CPS = 0x1818;
const CPM = 0x2a63;
const HRS = 0x180d;
const HRM = 0x2a37;
const ZW_SVC = "00000001-19ca-4651-86e5-fa29dcdd09d1";
const ZW_ASYNC = "00000002-19ca-4651-86e5-fa29dcdd09d1";
const ZW_RX = "00000003-19ca-4651-86e5-fa29dcdd09d1";
const ZW_TX = "00000004-19ca-4651-86e5-fa29dcdd09d1";

/** KICKR Core limits — commands are clamped to these. */
export const TRAINER_LIMITS = { gradeMin: -10, gradeMax: 16, ergMax: 1800 } as const;

type Mode = "ftms" | "wahoo" | null;
export type Cmd = { kind: "grade" | "erg"; v: number };

let controlPoint: BluetoothRemoteGATTCharacteristic | null = null;
let mode: Mode = null;
let queue: Promise<unknown> = Promise.resolve();
let trainerDevice: BluetoothDevice | null = null;
let manualDisconnect = false;
let hrDevice: BluetoothDevice | null = null;
let ctrlDevice: BluetoothDevice | null = null;

let lastCmd: Cmd | null = null;
let lastSentKey = "";
let lastSentAt = 0;
let rateTimer: ReturnType<typeof setTimeout> | null = null;
const MIN_GAP_MS = 250; // ≤ 4 commands per second

export const controllerListeners = new Set<(bit: number) => void>();

export function bleSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

const set = useDevices.setState;

const CP_NAMES: Record<number, string> = {
  0x00: "request control",
  0x07: "start",
  0x11: "set grade",
  0x05: "target power",
  0x20: "wahoo unlock",
  0x42: "wahoo ERG",
  0x43: "wahoo sim init",
  0x46: "wahoo grade",
};
const CP_RESULTS: Record<number, string> = { 1: "OK", 2: "not supported", 3: "invalid param", 4: "failed", 5: "not permitted" };
const opName = (op: number) => CP_NAMES[op] ?? `cmd 0x${op.toString(16)}`;

const pending = new Map<number, { resolve: (code: number | null) => void; t0: number }>();

/** Write a control command and wait for the trainer's answer. Resolves to the result code (1 = OK) or null on timeout. */
function writeCP(bytes: number[]): Promise<number | null> {
  const cp = controlPoint;
  if (!cp) return Promise.resolve(null);
  const op = bytes[0]!;
  const p = queue
    .then(async () => {
      const t0 = performance.now();
      bleLog("trainer", "out", `${opName(op)} · ${hex(bytes)}`);
      const answer = new Promise<number | null>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(op);
          bleLog("trainer", "info", `${opName(op)}: no answer within 3 s`);
          resolve(null);
        }, 3000);
        pending.set(op, { t0, resolve: (c) => (clearTimeout(timer), resolve(c)) });
      });
      await cp.writeValueWithResponse(new Uint8Array(bytes));
      return answer;
    })
    .catch((e) => {
      bleLog("trainer", "info", `write failed: ${String(e)}`);
      return null;
    });
  queue = p;
  return p;
}

function answer(op: number, code: number, raw: Uint8Array) {
  const p = pending.get(op);
  pending.delete(op);
  const ms = p ? Math.round(performance.now() - p.t0) : null;
  bleLog("trainer", "in", `${opName(op)} → ${CP_RESULTS[code] ?? code}${ms !== null ? ` in ${ms} ms` : ""} · ${hex(raw)}`);
  p?.resolve(code);
}

function onFtmsCP(dv: DataView) {
  const b = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  if (b[0] === 0x80) answer(b[1]!, b[2]!, b);
  else bleLog("trainer", "in", `control point · ${hex(b)}`);
}
function onWahooCP(dv: DataView) {
  const b = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  answer(b[1]!, b[0] === 1 ? 1 : 4, b);
}

const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

/** Bytes for a command in the given protocol. Pure — exported for tests. */
export function encodeCommand(m: "ftms" | "wahoo", c: Cmd): number[] {
  if (c.kind === "erg") {
    const w = Math.round(Math.max(0, Math.min(TRAINER_LIMITS.ergMax, c.v)));
    return m === "ftms" ? [0x05, ...u16(w)] : [0x42, ...u16(w)];
  }
  const g = Math.max(TRAINER_LIMITS.gradeMin, Math.min(TRAINER_LIMITS.gradeMax, c.v));
  if (m === "ftms") {
    const raw = Math.round(g * 100) & 0xffff;
    return [0x11, 0, 0, ...u16(raw), 40, 51];
  }
  return [0x46, ...u16(Math.round((g / 100 + 1) * 32767.5))];
}

function sendCmd(c: Cmd, force = false) {
  lastCmd = c;
  if (!controlPoint || !mode) return;
  const key = `${c.kind}:${c.kind === "erg" ? Math.round(c.v) : c.v.toFixed(1)}`;
  if (!force && key === lastSentKey) return; // only send on change
  const wait = MIN_GAP_MS - (performance.now() - lastSentAt);
  if (!force && wait > 0) {
    if (rateTimer) clearTimeout(rateTimer);
    rateTimer = setTimeout(() => {
      rateTimer = null;
      if (lastCmd) sendCmd(lastCmd);
    }, wait);
    return;
  }
  lastSentKey = key;
  lastSentAt = performance.now();
  void writeCP(encodeCommand(mode, c));
}

/** grade in percent */
export function setSimGrade(gradePct: number) {
  sendCmd({ kind: "grade", v: gradePct });
}
export function setTargetPower(watts: number) {
  sendCmd({ kind: "erg", v: watts });
}
export function trainerHasControl() {
  return !!controlPoint && useDevices.getState().trainer.control;
}

type DevicePatch = Partial<ReturnType<typeof useDevices.getState>>;

/** Decode FTMS Indoor Bike Data. Pure — exported for tests. */
export function decodeIBD(dv: DataView): DevicePatch {
  const flags = dv.getUint16(0, true);
  let o = 2;
  const patch: DevicePatch = {};
  if (!(flags & 0x1)) {
    patch.trainerSpeed = dv.getUint16(o, true) / 100;
    o += 2;
  }
  if (flags & 0x2) o += 2;
  if (flags & 0x4) {
    patch.cadence = dv.getUint16(o, true) / 2;
    o += 2;
  }
  if (flags & 0x8) o += 2;
  if (flags & 0x10) o += 3;
  if (flags & 0x20) o += 2;
  if (flags & 0x40) {
    patch.power = Math.max(0, dv.getInt16(o, true));
    o += 2;
  }
  if (flags & 0x80) o += 2;
  if (flags & 0x100) o += 5;
  if (flags & 0x200 && o < dv.byteLength) {
    const hr = dv.getUint8(o);
    if (hr > 0) patch.heartRate = hr;
  }
  return patch;
}

function parseIBD(dv: DataView) {
  const patch = decodeIBD(dv);
  if (patch.heartRate && useDevices.getState().hrm.status === "connected") delete patch.heartRate;
  patch.lastPowerAt = performance.now();
  set(patch);
}

let lastCrank: { revs: number; time: number } | null = null;
function parseCPM(dv: DataView) {
  const flags = dv.getUint16(0, true);
  const power = Math.max(0, dv.getInt16(2, true));
  let o = 4;
  if (flags & 0x1) o += 1;
  if (flags & 0x4) o += 2;
  if (flags & 0x10) o += 6;
  const patch: DevicePatch = { power, lastPowerAt: performance.now() };
  if (flags & 0x20) {
    const revs = dv.getUint16(o, true);
    const time = dv.getUint16(o + 2, true);
    if (lastCrank) {
      const dr = (revs - lastCrank.revs + 65536) % 65536;
      const dt = ((time - lastCrank.time + 65536) % 65536) / 1024;
      if (dt > 0) patch.cadence = Math.round((dr / dt) * 60);
      else if (dr === 0) patch.cadence = 0;
    }
    lastCrank = { revs, time };
  }
  set(patch);
}

const onValue = (fn: (dv: DataView) => void) => (e: Event) => fn((e.target as BluetoothRemoteGATTCharacteristic).value!);

function waitForPower(since: number, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const t = setInterval(() => {
      if (useDevices.getState().lastPowerAt > since) {
        clearInterval(t);
        resolve();
      } else if (performance.now() - since > ms) {
        clearInterval(t);
        reject(new Error(`no power data within ${ms / 1000} s`));
      }
    }, 100);
  });
}

/**
 * Full handshake. "Connected" is reported only after every step succeeds, including the
 * trainer acknowledging request-control and the first power reading arriving.
 */
async function setupSession(device: BluetoothDevice, virtual: boolean) {
  let step = "";
  const s = (name: string) => {
    step = name;
    bleLog("trainer", "info", `step: ${name}`);
  };
  set({ trainer: { status: "connecting", name: device.name, control: false, virtual } });
  controlPoint = null;
  mode = null;
  lastCrank = null;
  lastSentKey = "";
  const t0 = performance.now();
  try {
    s("connect");
    const server = await device.gatt!.connect();
    try {
      s("find FTMS service");
      const svc = await server.getPrimaryService(FTMS);
      s("subscribe to Indoor Bike Data");
      const data = await svc.getCharacteristic(IBD);
      data.addEventListener("characteristicvaluechanged", onValue(parseIBD));
      await data.startNotifications();
      s("subscribe to FTMS control point");
      const cp = await svc.getCharacteristic(FTMS_CP);
      cp.addEventListener("characteristicvaluechanged", onValue(onFtmsCP));
      await cp.startNotifications();
      controlPoint = cp;
      mode = "ftms";
      s("request control");
      const code = await writeCP([0x00]);
      if (code !== 1) throw new Error(`request control → ${code === null ? "no answer" : CP_RESULTS[code] ?? code}`);
      s("start");
      await writeCP([0x07]);
    } catch (e) {
      bleLog("trainer", "info", `FTMS unavailable (${e instanceof Error ? e.message : e}) — trying Wahoo / Cycling Power`);
      controlPoint = null;
      mode = null;
      s("find Cycling Power service");
      const svc = await server.getPrimaryService(CPS);
      s("subscribe to Cycling Power");
      const ch = await svc.getCharacteristic(CPM);
      ch.addEventListener("characteristicvaluechanged", onValue(parseCPM));
      await ch.startNotifications();
      try {
        s("Wahoo control channel");
        const w = await svc.getCharacteristic(WAHOO_CP);
        w.addEventListener("characteristicvaluechanged", onValue(onWahooCP));
        await w.startNotifications();
        controlPoint = w;
        mode = "wahoo";
        const code = await writeCP([0x20, 0xee, 0xfc]);
        if (code !== 1) throw new Error("unlock refused");
        const kg = Math.round((useSettings.getState().weight + useSettings.getState().bikeWeight) * 100);
        await writeCP([0x43, ...u16(kg), ...u16(40), ...u16(510)]);
      } catch (e2) {
        bleLog("trainer", "info", `no resistance control (${e2 instanceof Error ? e2.message : e2}) — power only`);
        controlPoint = null;
        mode = null;
      }
    }
    s("first power reading");
    await waitForPower(t0, 5000);
    const protocol = mode === "ftms" ? "FTMS" : mode === "wahoo" ? "Wahoo" : "power only";
    bleLog("trainer", "info", `connected to ${device.name ?? "trainer"} · ${protocol}${virtual ? " · virtual" : ""}`);
    set({ trainer: { status: "connected", name: device.name, control: mode !== null, virtual, protocol } });
    if (lastCmd && mode) {
      bleLog("trainer", "info", "re-sending last command after (re)connect");
      sendCmd(lastCmd, true);
    }
  } catch (e) {
    const msg = `Failed at "${step}": ${e instanceof Error ? e.message : String(e)}`;
    bleLog("trainer", "info", msg);
    controlPoint = null;
    mode = null;
    set({ trainer: { status: "disconnected", name: device.name, control: false, virtual, error: msg } });
    if (device.gatt?.connected) device.gatt.disconnect();
    throw new Error(msg);
  }
}

async function attachTrainer(device: BluetoothDevice, virtual: boolean) {
  if (trainerDevice && trainerDevice !== device) disconnectTrainer();
  trainerDevice = device;
  manualDisconnect = false;
  lastCmd = null;
  device.addEventListener("gattserverdisconnected", () => {
    controlPoint = null;
    mode = null;
    set({ trainer: { ...useDevices.getState().trainer, status: "disconnected", control: false }, power: 0, cadence: 0 });
    if (manualDisconnect || trainerDevice !== device) {
      bleLog("trainer", "info", "disconnected");
      return;
    }
    bleLog("trainer", "info", "connection lost — reconnecting");
    void reconnect(device, virtual);
  });
  await setupSession(device, virtual);
}

async function reconnect(device: BluetoothDevice, virtual: boolean) {
  for (let i = 1; i <= 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (manualDisconnect || trainerDevice !== device) return;
    bleLog("trainer", "info", `reconnect attempt ${i}/5`);
    try {
      await setupSession(device, virtual);
      return;
    } catch {
      /* next attempt */
    }
  }
  bleLog("trainer", "info", "gave up reconnecting — pair the trainer again");
}

export async function connectTrainer() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [FTMS] }, { services: [CPS] }, { namePrefix: "KICKR" }, { namePrefix: "Zwift" }],
    optionalServices: [FTMS, CPS, HRS],
  });
  await attachTrainer(device, false);
}

/** Connect to the standalone virtual KICKR Core (tools/kickr-sim) through the same handshake. */
export async function connectVirtualTrainer(url?: string) {
  const { openVirtualTrainer } = await import("./virtualTrainer");
  await attachTrainer(openVirtualTrainer(url), true);
}

export function disconnectTrainer() {
  manualDisconnect = true;
  if (trainerDevice?.gatt?.connected) trainerDevice.gatt.disconnect();
}

export async function connectHeartRate() {
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [HRS] }] });
  hrDevice = device;
  set({ hrm: { status: "connecting", name: device.name } });
  device.addEventListener("gattserverdisconnected", () =>
    set({ hrm: { status: "disconnected", name: device.name }, heartRate: 0 }),
  );
  try {
    const server = await device.gatt!.connect();
    const svc = await server.getPrimaryService(HRS);
    const ch = await svc.getCharacteristic(HRM);
    ch.addEventListener("characteristicvaluechanged", (e) => {
      const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
      const flags = dv.getUint8(0);
      set({ heartRate: flags & 1 ? dv.getUint16(1, true) : dv.getUint8(1) });
    });
    await ch.startNotifications();
    bleLog("hrm", "info", `connected to ${device.name ?? "heart rate"}`);
    set({ hrm: { status: "connected", name: device.name } });
  } catch (e) {
    set({ hrm: { status: "disconnected", name: device.name } });
    throw e;
  }
}

function readVarint(bytes: Uint8Array, start: number): number | null {
  let result = 0;
  let mul = 1;
  for (let i = start; i < bytes.length && i < start + 6; i++) {
    result += ((bytes[i] ?? 0) & 0x7f) * mul;
    if (!((bytes[i] ?? 0) & 0x80)) return result;
    mul *= 128;
  }
  return null;
}

let prevMask = -1;
function parseController(dv: DataView) {
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  bleLog("controller", "in", hex(bytes));
  if (bytes.length < 3) return;
  // Zwift Ride button notification: opcode 0x23, protobuf field 1 (tag 0x08) = button bitmap.
  // Bits read 1 when released and 0 when pressed.
  if (bytes[0] !== 0x23 || bytes[1] !== 0x08) return;
  const mask = readVarint(bytes, 2);
  if (mask === null) return;
  const prev = prevMask < 0 ? 0x3ffff : prevMask;
  for (let bit = 0; bit < 18; bit++) {
    const was = Math.floor(prev / 2 ** bit) % 2;
    const now = Math.floor(mask / 2 ** bit) % 2;
    if (was === 1 && now === 0) {
      set((s) => ({ controller: { ...s.controller, lastBit: bit } }));
      controllerListeners.forEach((fn) => fn(bit));
    }
  }
  prevMask = mask;
}

export async function connectController() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: "Zwift" }],
    optionalServices: [ZW_SVC],
  });
  ctrlDevice = device;
  set((s) => ({ controller: { ...s.controller, status: "connecting", name: device.name } }));
  device.addEventListener("gattserverdisconnected", () =>
    set((s) => ({ controller: { ...s.controller, status: "disconnected" } })),
  );
  try {
    const server = await device.gatt!.connect();
    const svc = await server.getPrimaryService(ZW_SVC);
    const asyncCh = await svc.getCharacteristic(ZW_ASYNC);
    asyncCh.addEventListener("characteristicvaluechanged", (e) =>
      parseController((e.target as BluetoothRemoteGATTCharacteristic).value!),
    );
    await asyncCh.startNotifications();
    try {
      const tx = await svc.getCharacteristic(ZW_TX);
      tx.addEventListener("characteristicvaluechanged", (e) =>
        parseController((e.target as BluetoothRemoteGATTCharacteristic).value!),
      );
      await tx.startNotifications();
    } catch {
      /* optional */
    }
    const rx = await svc.getCharacteristic(ZW_RX);
    await rx.writeValue(new TextEncoder().encode("RideOn"));
    bleLog("controller", "out", `handshake "RideOn" sent to ${device.name ?? "controller"}`);
    prevMask = -1;
    set((s) => ({ controller: { ...s.controller, status: "connected", name: device.name } }));
  } catch (e) {
    set((s) => ({ controller: { ...s.controller, status: "disconnected" } }));
    throw e;
  }
}

export function disconnectAll() {
  manualDisconnect = true;
  [trainerDevice, hrDevice, ctrlDevice].forEach((d) => d?.gatt?.connected && d.gatt.disconnect());
}
