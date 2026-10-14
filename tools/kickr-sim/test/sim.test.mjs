import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeIBD, handleFtmsCP, handleWahoo, wahooGradeToU16, wahooU16ToGrade } from "../src/protocol.mjs";
import { createTrainer, stepTrainer } from "../src/trainer.mjs";

const run = (t, s) => { for (let i = 0; i < s * 10; i++) stepTrainer(t, 0.1); };

test("FTMS refuses commands before request control", () => {
  const t = createTrainer();
  assert.deepEqual(handleFtmsCP([0x05, 200, 0], t), [0x80, 0x05, 5]);
  assert.deepEqual(handleFtmsCP([0x00], t), [0x80, 0x00, 1]);
  assert.deepEqual(handleFtmsCP([0x05, 200, 0], t), [0x80, 0x05, 1]);
  assert.equal(t.ergTarget, 200);
  assert.deepEqual(handleFtmsCP([0x55], t), [0x80, 0x55, 2]);
});

test("FTMS grade is decoded and clamped to the KICKR Core range", () => {
  const t = createTrainer();
  handleFtmsCP([0x00], t);
  handleFtmsCP([0x11, 0, 0, 0xf4, 0x01, 40, 51], t); // 500 → 5.00 %
  assert.equal(t.gradeTarget, 5);
  handleFtmsCP([0x11, 0, 0, 0xd0, 0x07, 40, 51], t); // 20 % → clamp 16
  assert.equal(t.gradeTarget, 16);
});

test("ERG settles within 5 W in 3 s", () => {
  const t = createTrainer();
  handleFtmsCP([0x00], t);
  handleFtmsCP([0x05, 150, 0], t);
  run(t, 10);
  handleFtmsCP([0x05, 250, 0], t);
  run(t, 3);
  assert.ok(Math.abs(t.power - 250) < 5, `power ${t.power}`);
});

test("low cadence in ERG triggers the spiral", () => {
  const t = createTrainer({ cadence: 30 });
  handleFtmsCP([0x00], t);
  handleFtmsCP([0x05, 250, 0], t);
  run(t, 5);
  assert.ok(t.spiral);
  assert.ok(t.power < 220);
});

test("steeper grade means more power at the same cadence", () => {
  const t = createTrainer({ maxWatts: 1000 });
  handleFtmsCP([0x00], t);
  handleFtmsCP([0x11, 0, 0, 0, 0, 40, 51], t);
  run(t, 10);
  const flat = t.power;
  handleFtmsCP([0x11, 0, 0, 0x90, 0x01, 40, 51], t); // 4 %
  run(t, 10);
  assert.ok(t.power > flat * 1.8, `${flat} → ${t.power}`);
});

test("Wahoo channel needs unlock, then accepts ERG and grade", () => {
  const t = createTrainer();
  assert.deepEqual(handleWahoo([0x42, 200, 0], t), [0, 0x42]);
  assert.deepEqual(handleWahoo([0x20, 0xee, 0xfc], t), [1, 0x20]);
  assert.deepEqual(handleWahoo([0x42, 200, 0], t), [1, 0x42]);
  assert.equal(t.ergTarget, 200);
  const u = wahooGradeToU16(6);
  handleWahoo([0x46, u & 0xff, u >> 8], t);
  assert.ok(Math.abs(t.gradeTarget - 6) < 0.01);
  assert.ok(Math.abs(wahooU16ToGrade(wahooGradeToU16(-3.5)) + 3.5) < 0.01);
});

test("Indoor Bike Data layout", () => {
  const b = encodeIBD({ speedKmh: 30.5, cadence: 90, power: 230 });
  const dv = new DataView(b.buffer);
  assert.equal(dv.getUint16(0, true), 0x44);
  assert.equal(dv.getUint16(2, true), 3050);
  assert.equal(dv.getUint16(4, true), 180);
  assert.equal(dv.getInt16(6, true), 230);
});
