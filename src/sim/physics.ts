// Pure, deterministic rider physics. No React, three.js, DOM or Bluetooth imports —
// this module must stay portable so it can run on a future multiplayer server.

export const TICK_HZ = 30;
export const TICK = 1 / TICK_HZ;

export const PHYS = {
  G: 9.81,
  CRR: 0.004,
  CDA: 0.32,
  RHO: 1.225,
  MAX_DRIVE_N: 600,
} as const;

export type RiderKinematics = {
  s: number; // metres along course
  v: number; // m/s
  dist: number; // total metres ridden
  crank: number; // rad
  wheel: number; // rad
};

export type StepInputs = {
  power: number; // W
  cadence: number; // rpm
  grade: number; // fraction at current position
  mass: number; // rider + bike kg
};

export function stepRider(st: RiderKinematics, inp: StepInputs, dt: number): RiderKinematics {
  const { G, CRR, CDA, RHO, MAX_DRIVE_N } = PHYS;
  const theta = Math.atan(inp.grade);
  const drive = Math.min(inp.power / Math.max(st.v, 0.5), MAX_DRIVE_N);
  const resist =
    inp.mass * G * Math.sin(theta) + CRR * inp.mass * G * Math.cos(theta) + 0.5 * RHO * CDA * st.v * st.v;
  const v = Math.max(0, st.v + ((drive - resist) / inp.mass) * dt);
  const ds = v * dt;
  return {
    s: st.s + ds,
    v,
    dist: st.dist + ds,
    crank: st.crank + (inp.cadence / 60) * Math.PI * 2 * dt,
    wheel: st.wheel + (v / 0.34) * dt,
  };
}

/** Grade (percent) sent to the trainer in SIM mode, from road grade, hill feel and virtual gear. */
export function trainerGrade(roadGrade: number, difficulty: number, gear: number) {
  const g = roadGrade * 100 * difficulty + (gear - 12) * 0.6;
  return Math.max(-10, Math.min(20, g));
}
