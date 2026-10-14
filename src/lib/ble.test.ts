import { describe, expect, it } from "vitest";
import { decodeIBD, encodeCommand } from "./ble";
// The standalone simulator's encoders — the app must decode exactly what the "trainer" sends.
// @ts-expect-error plain JS module outside src
import { encodeIBD, handleFtmsCP, handleWahoo } from "../../tools/kickr-sim/src/protocol.mjs";
// @ts-expect-error plain JS module outside src
import { createTrainer } from "../../tools/kickr-sim/src/trainer.mjs";

describe("trainer protocol (app ↔ simulator)", () => {
  it("decodes the simulator's Indoor Bike Data", () => {
    const b: Uint8Array = encodeIBD({ speedKmh: 32.4, cadence: 91, power: 245 });
    const p = decodeIBD(new DataView(b.buffer));
    expect(p.power).toBe(245);
    expect(p.cadence).toBe(91);
    expect(p.trainerSpeed).toBeCloseTo(32.4);
  });
  it("FTMS grade and ERG commands are understood and clamped", () => {
    const t = createTrainer();
    handleFtmsCP([0x00], t);
    expect(handleFtmsCP(encodeCommand("ftms", { kind: "grade", v: 6.5 }), t)).toEqual([0x80, 0x11, 1]);
    expect(t.gradeTarget).toBeCloseTo(6.5);
    handleFtmsCP(encodeCommand("ftms", { kind: "grade", v: 25 }), t);
    expect(t.gradeTarget).toBe(16);
    handleFtmsCP(encodeCommand("ftms", { kind: "grade", v: -4 }), t);
    expect(t.gradeTarget).toBeCloseTo(-4);
    handleFtmsCP(encodeCommand("ftms", { kind: "erg", v: 3000 }), t);
    expect(t.ergTarget).toBe(1800);
  });
  it("Wahoo channel commands are understood", () => {
    const t = createTrainer();
    handleWahoo([0x20, 0xee, 0xfc], t);
    handleWahoo(encodeCommand("wahoo", { kind: "erg", v: 210 }), t);
    expect(t.ergTarget).toBe(210);
    handleWahoo(encodeCommand("wahoo", { kind: "grade", v: 3 }), t);
    expect(t.gradeTarget).toBeCloseTo(3, 1);
  });
});
