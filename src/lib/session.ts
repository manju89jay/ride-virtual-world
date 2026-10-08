import type { Workout } from "./workouts";

export const MAX_GEAR = 24;

export const sim = {
  s: 0,
  v: 0,
  dist: 0,
  elapsed: 0,
  elevGain: 0,
  lastH: 0,
  gear: 12,
  paused: false,
  simPower: 150,
  crank: 0,
  wheel: 0,
  powerHist: [] as number[],
  secAcc: 0,
  hudAcc: 0,
  workout: null as Workout | null,
  samples: { p: [] as number[], h: [] as number[], c: [] as number[], v: [] as number[], e: [] as number[] },
};

export function resetSim(workout: Workout | null) {
  Object.assign(sim, {
    s: 0,
    v: 0,
    dist: 0,
    elapsed: 0,
    elevGain: 0,
    lastH: 0,
    gear: 12,
    paused: false,
    simPower: 150,
    crank: 0,
    wheel: 0,
    powerHist: [],
    secAcc: 0,
    hudAcc: 0,
    workout,
    samples: { p: [], h: [], c: [], v: [], e: [] },
  });
}
