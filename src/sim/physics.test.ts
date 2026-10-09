import { describe, expect, it } from "vitest";
import { stepRider, trainerGrade, TICK, type RiderKinematics } from "./physics";

function steady(power: number, grade: number, mass = 84, seconds = 600) {
  let st: RiderKinematics = { s: 0, v: 0, dist: 0, crank: 0, wheel: 0 };
  for (let i = 0; i < seconds / TICK; i++) st = stepRider(st, { power, cadence: 90, grade, mass }, TICK);
  return st.v * 3.6;
}

describe("rider physics", () => {
  it("200 W on the flat settles around 30-36 km/h", () => {
    const kmh = steady(200, 0);
    expect(kmh).toBeGreaterThan(30);
    expect(kmh).toBeLessThan(36);
  });
  it("300 W at 7% settles around 15-18 km/h", () => {
    const kmh = steady(300, 0.07);
    expect(kmh).toBeGreaterThan(15);
    expect(kmh).toBeLessThan(18);
  });
  it("coasting with 0 W on the flat comes to a stop", () => {
    let st: RiderKinematics = { s: 0, v: 10, dist: 0, crank: 0, wheel: 0 };
    for (let i = 0; i < 3000 / TICK; i++) st = stepRider(st, { power: 0, cadence: 0, grade: 0, mass: 84 }, TICK);
    expect(st.v).toBeLessThan(0.5);
  });
  it("is deterministic", () => {
    expect(steady(250, 0.03)).toBe(steady(250, 0.03));
  });
  it("trainer grade respects gear and clamps", () => {
    expect(trainerGrade(0, 0.5, 12)).toBe(0);
    expect(trainerGrade(0.05, 0.5, 12)).toBeCloseTo(2.5);
    expect(trainerGrade(0.3, 1, 24)).toBe(20);
    expect(trainerGrade(-0.2, 1, 1)).toBe(-10);
  });
});
