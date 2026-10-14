// Bluetooth byte-level protocol of a Wahoo KICKR Core: FTMS, Cycling Power and Wahoo's control channel.
// Pure functions — no I/O. Shared by the simulator and the unit tests.
import { setErg, setGrade, setLevel } from "./trainer.mjs";

export const uuid16 = (n) => `0000${n.toString(16).padStart(4, "0")}-0000-1000-8000-00805f9b34fb`;

export const UUID = {
  FTMS: uuid16(0x1826),
  IBD: uuid16(0x2ad2),
  FTMS_CP: uuid16(0x2ad9),
  FTMS_FEATURE: uuid16(0x2acc),
  CPS: uuid16(0x1818),
  CPM: uuid16(0x2a63),
  WAHOO_CP: "a026e005-0a7d-4ab3-97fa-f1500f9feb8b",
};

export const SERVICES = {
  [UUID.FTMS]: [UUID.IBD, UUID.FTMS_CP, UUID.FTMS_FEATURE],
  [UUID.CPS]: [UUID.CPM, UUID.WAHOO_CP],
};

export const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");

/** FTMS Indoor Bike Data: flags 0x0044 = instantaneous speed + cadence + power present. */
export function encodeIBD({ speedKmh, cadence, power }) {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint16(0, 0x0044, true);
  dv.setUint16(2, Math.max(0, Math.round(speedKmh * 100)), true);
  dv.setUint16(4, Math.max(0, Math.round(cadence * 2)), true);
  dv.setInt16(6, Math.round(power), true);
  return b;
}

/** Cycling Power Measurement with crank revolution data (flag 0x20). */
export function encodeCPM({ power, crankRevs, crankTime }) {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint16(0, 0x0020, true);
  dv.setInt16(2, Math.round(power), true);
  dv.setUint16(4, crankRevs & 0xffff, true);
  dv.setUint16(6, crankTime & 0xffff, true);
  return b;
}

// Wahoo sim grade: uint16 where 0 = -100 %, 65535 = +100 %.
export const wahooGradeToU16 = (pct) => Math.round((pct / 100 + 1) * 32767.5);
export const wahooU16ToGrade = (u) => (u / 32767.5 - 1) * 100;

const RES = { OK: 1, NOT_SUPPORTED: 2, INVALID: 3, FAILED: 4, NOT_PERMITTED: 5 };

/** FTMS control point write → indication bytes [0x80, opcode, result]. */
export function handleFtmsCP(bytes, t) {
  const op = bytes[0];
  const dv = new DataView(Uint8Array.from(bytes).buffer);
  const R = (code) => [0x80, op, code];
  if (op === 0x00) {
    t.hasControl = true;
    return R(RES.OK);
  }
  if (!t.hasControl) return R(RES.NOT_PERMITTED);
  switch (op) {
    case 0x01: // reset
      t.mode = "idle";
      return R(RES.OK);
    case 0x07: // start / resume
    case 0x08: // stop / pause
      return R(RES.OK);
    case 0x04: // target resistance level, 0.1 units
      if (bytes.length < 2) return R(RES.INVALID);
      setLevel(t, bytes[1] / 10);
      return R(RES.OK);
    case 0x05: // target power, W
      if (bytes.length < 3) return R(RES.INVALID);
      setErg(t, dv.getUint16(1, true));
      return R(RES.OK);
    case 0x11: // indoor bike simulation: wind s16, grade s16 (0.01 %), crr u8, cw u8
      if (bytes.length < 5) return R(RES.INVALID);
      setGrade(t, dv.getInt16(3, true) / 100);
      return R(RES.OK);
    default:
      return R(RES.NOT_SUPPORTED);
  }
}

/** Wahoo control channel write → notification [status, opcode] (status 1 = success). */
export function handleWahoo(bytes, t) {
  const op = bytes[0];
  const dv = new DataView(Uint8Array.from(bytes).buffer);
  if (op === 0x20) {
    t.unlocked = bytes[1] === 0xee && bytes[2] === 0xfc;
    return [t.unlocked ? 1 : 0, op];
  }
  if (!t.unlocked) return [0, op];
  switch (op) {
    case 0x41: // standard mode level
      setLevel(t, bytes[1] ?? 0);
      return [1, op];
    case 0x42: // ERG target W
      setErg(t, dv.getUint16(1, true));
      return [1, op];
    case 0x43: // sim mode init: weight kg*100, crr*10000, cw*1000
      t.mass = dv.getUint16(1, true) / 100 || t.mass;
      return [1, op];
    case 0x46: // sim grade
      setGrade(t, wahooU16ToGrade(dv.getUint16(1, true)));
      return [1, op];
    default:
      return [0, op];
  }
}
