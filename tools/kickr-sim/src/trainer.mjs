// Physical model of a Wahoo KICKR Core + the simulated rider pedalling it. Pure, deterministic.
export const G = 9.81;
export const CRR = 0.004;
export const CDA = 0.32;
export const RHO = 1.225;
/** Metres travelled per crank revolution in the fixed virtual gear (≈ 50x17 on a 700c wheel). */
export const GEAR = 2.105 * (50 / 17);
export const LIMITS = { gradeMin: -10, gradeMax: 16, ergMax: 1800 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createTrainer(opts = {}) {
  return {
    mode: "idle", // idle | grade | erg | level
    hasControl: false,
    unlocked: false,
    gradeTarget: 0,
    grade: 0,
    ergTarget: 0,
    level: 0,
    mass: opts.mass ?? 84,
    v: 0,
    power: 0,
    cadence: 0,
    cadenceEst: 0,
    crankRevs: 0,
    crankTime: 0,
    crankAcc: 0,
    time: 0,
    spiral: false,
    rider: { cadence: opts.cadence ?? 85, maxWatts: opts.maxWatts ?? 400 },
  };
}

export const resistForce = (gradePct, v, mass) => {
  const th = Math.atan(gradePct / 100);
  return mass * G * Math.sin(th) + CRR * mass * G * Math.cos(th) + 0.5 * RHO * CDA * v * v;
};

/** Speed at which holding `power` balances resistance on `gradePct`. */
export function solveV(gradePct, power, mass) {
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (resistForce(gradePct, mid, mass) * mid > power) hi = mid;
    else lo = mid;
  }
  return lo;
}

export function setGrade(t, g) {
  t.mode = "grade";
  t.gradeTarget = clamp(g, LIMITS.gradeMin, LIMITS.gradeMax);
}
export function setErg(t, w) {
  t.mode = "erg";
  t.ergTarget = clamp(w, 0, LIMITS.ergMax);
}
export function setLevel(t, l) {
  t.mode = "level";
  t.level = clamp(l, 0, 100);
}

export function stepTrainer(t, dt) {
  // The KICKR ramps resistance in rather than snapping: ~2 %/s.
  const dg = t.gradeTarget - t.grade;
  t.grade += Math.sign(dg) * Math.min(Math.abs(dg), 2 * dt);

  const rc = Math.max(0, t.rider.cadence);
  if (t.mode === "erg") {
    // Below ~40 rpm the brake can't hold the target: the classic ERG "spiral of death".
    t.spiral = rc > 0 && rc < 40 && t.ergTarget > 0;
    const want = rc === 0 ? 0 : t.spiral ? (t.ergTarget * rc) / 40 : t.ergTarget;
    t.power += (want - t.power) * (1 - Math.exp(-dt / 0.9));
    t.v += (solveV(0, t.power, t.mass) - t.v) * (1 - Math.exp(-dt / 0.8));
    t.cadence = rc;
  } else {
    t.spiral = false;
    const grade = t.mode === "grade" ? t.grade : t.mode === "level" ? t.level / 10 : 0;
    // Rider holds cadence in a fixed gear; if that needs more than they have, they slow down.
    let targetV = (rc / 60) * GEAR;
    if (resistForce(grade, targetV, t.mass) * targetV > t.rider.maxWatts) targetV = solveV(grade, t.rider.maxWatts, t.mass);
    t.v += (targetV - t.v) * (1 - Math.exp(-dt / 0.8)); // flywheel inertia
    t.power = Math.max(0, resistForce(grade, t.v, t.mass) * t.v);
    if (rc === 0) t.power = 0;
    t.cadence = (t.v / GEAR) * 60;
  }
  // Cadence is estimated from the flywheel, so it lags.
  t.cadenceEst += (t.cadence - t.cadenceEst) * (1 - Math.exp(-dt / 1.0));

  t.time += dt;
  t.crankAcc += (t.cadence / 60) * dt;
  while (t.crankAcc >= 1) {
    t.crankAcc -= 1;
    t.crankRevs = (t.crankRevs + 1) & 0xffff;
    t.crankTime = Math.round(t.time * 1024) & 0xffff;
  }
}
