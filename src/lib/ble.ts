/// <reference types="web-bluetooth" />
import { useDevices } from "./store";

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

let controlPoint: BluetoothRemoteGATTCharacteristic | null = null;
let queue: Promise<unknown> = Promise.resolve();
let trainerDevice: BluetoothDevice | null = null;
let hrDevice: BluetoothDevice | null = null;
let ctrlDevice: BluetoothDevice | null = null;

export const controllerListeners = new Set<(bit: number) => void>();

export function bleSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

const set = useDevices.setState;

function writeCP(bytes: number[]) {
  const cp = controlPoint;
  if (!cp) return;
  queue = queue
    .then(() => cp.writeValueWithResponse(new Uint8Array(bytes)))
    .catch((e) => console.warn("FTMS write failed", e));
}

/** grade in percent */
export function setSimGrade(gradePct: number) {
  const g = Math.round(Math.max(-10, Math.min(20, gradePct)) * 100);
  writeCP([0x11, 0, 0, g & 0xff, (g >> 8) & 0xff, 40, 51]);
}
export function setTargetPower(watts: number) {
  const w = Math.max(0, Math.min(2000, Math.round(watts)));
  writeCP([0x05, w & 0xff, (w >> 8) & 0xff]);
}
export function trainerHasControl() {
  return !!controlPoint && useDevices.getState().trainer.control;
}

function parseIBD(dv: DataView) {
  const flags = dv.getUint16(0, true);
  let o = 2;
  const patch: Partial<ReturnType<typeof useDevices.getState>> = {};
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
    patch.lastPowerAt = performance.now();
    o += 2;
  }
  if (flags & 0x80) o += 2;
  if (flags & 0x100) o += 5;
  if (flags & 0x200 && o < dv.byteLength) {
    const hr = dv.getUint8(o);
    if (hr > 0 && useDevices.getState().hrm.status !== "connected") patch.heartRate = hr;
  }
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
  const patch: Partial<ReturnType<typeof useDevices.getState>> = {
    power,
    lastPowerAt: performance.now(),
  };
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

export async function connectTrainer() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [FTMS] }, { services: [CPS] }, { namePrefix: "Zwift" }],
    optionalServices: [FTMS, CPS, HRS],
  });
  trainerDevice = device;
  set({ trainer: { status: "connecting", name: device.name, control: false } });
  device.addEventListener("gattserverdisconnected", () => {
    controlPoint = null;
    set({ trainer: { status: "disconnected", name: device.name, control: false }, power: 0, cadence: 0 });
  });
  try {
    const server = await device.gatt!.connect();
    let control = false;
    try {
      const svc = await server.getPrimaryService(FTMS);
      const data = await svc.getCharacteristic(IBD);
      data.addEventListener("characteristicvaluechanged", (e) =>
        parseIBD((e.target as BluetoothRemoteGATTCharacteristic).value!),
      );
      await data.startNotifications();
      const cp = await svc.getCharacteristic(FTMS_CP);
      await cp.startNotifications();
      controlPoint = cp;
      writeCP([0x00]); // request control
      writeCP([0x07]); // start / resume
      await queue;
      control = true;
    } catch (e) {
      console.warn("FTMS unavailable, falling back to Cycling Power", e);
      const svc = await server.getPrimaryService(CPS);
      const ch = await svc.getCharacteristic(CPM);
      ch.addEventListener("characteristicvaluechanged", (e) =>
        parseCPM((e.target as BluetoothRemoteGATTCharacteristic).value!),
      );
      await ch.startNotifications();
    }
    set({ trainer: { status: "connected", name: device.name, control } });
  } catch (e) {
    set({ trainer: { status: "disconnected", name: device.name, control: false } });
    throw e;
  }
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
    result += (bytes[i] & 0x7f) * mul;
    if (!(bytes[i] & 0x80)) return result;
    mul *= 128;
  }
  return null;
}

let prevMask = -1;
function parseController(dv: DataView) {
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
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
    prevMask = -1;
    set((s) => ({ controller: { ...s.controller, status: "connected", name: device.name } }));
  } catch (e) {
    set((s) => ({ controller: { ...s.controller, status: "disconnected" } }));
    throw e;
  }
}

export function disconnectAll() {
  [trainerDevice, hrDevice, ctrlDevice].forEach((d) => d?.gatt?.connected && d.gatt.disconnect());
}
