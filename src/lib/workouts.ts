export type Seg = { dur: number; from: number; to?: number };
export type Workout = { id: string; name: string; description: string; segs: Seg[] };

const rep = (n: number, segs: Seg[]) => Array.from({ length: n }, () => segs).flat();

export const WORKOUTS: Workout[] = [
  {
    id: "endurance-45",
    name: "Steady Endurance",
    description: "45 minutes of aerobic base in zone 2. Conversational pace.",
    segs: [{ dur: 300, from: 0.45, to: 0.65 }, { dur: 2100, from: 0.68 }, { dur: 300, from: 0.6, to: 0.45 }],
  },
  {
    id: "sweet-spot-3x10",
    name: "Sweet Spot 3×10",
    description: "Three 10-minute blocks at 90% FTP with 5 minutes easy between.",
    segs: [
      { dur: 600, from: 0.45, to: 0.7 },
      ...rep(3, [{ dur: 600, from: 0.9 }, { dur: 300, from: 0.55 }]),
      { dur: 300, from: 0.5, to: 0.4 },
    ],
  },
  {
    id: "vo2-5x3",
    name: "VO2 Max 5×3",
    description: "Five hard 3-minute efforts at 115% FTP. Hurts, works.",
    segs: [
      { dur: 600, from: 0.45, to: 0.75 },
      ...rep(5, [{ dur: 180, from: 1.15 }, { dur: 180, from: 0.5 }]),
      { dur: 420, from: 0.55, to: 0.4 },
    ],
  },
  {
    id: "over-unders",
    name: "Over-Unders",
    description: "Alternate 2 min at 95% and 1 min at 108% to teach threshold tolerance.",
    segs: [
      { dur: 600, from: 0.45, to: 0.75 },
      ...rep(2, [...rep(3, [{ dur: 120, from: 0.95 }, { dur: 60, from: 1.08 }]), { dur: 300, from: 0.55 }]),
      { dur: 300, from: 0.5, to: 0.4 },
    ],
  },
  {
    id: "ramp-test",
    name: "Ramp FTP Test",
    description: "Power rises every minute until you can't hold it. FTP ≈ 75% of best 1-min power.",
    segs: [
      { dur: 300, from: 0.4 },
      ...Array.from({ length: 22 }, (_, i) => ({ dur: 60, from: 0.5 + i * 0.06 })),
      { dur: 300, from: 0.4 },
    ],
  },
  {
    id: "recovery-30",
    name: "Recovery Spin",
    description: "30 easy minutes to flush the legs. Keep it light.",
    segs: [{ dur: 1800, from: 0.5 }],
  },
];

export const getWorkout = (id?: string) => WORKOUTS.find((w) => w.id === id) ?? null;
export const workoutDuration = (w: Workout) => w.segs.reduce((a, s) => a + s.dur, 0);

export function targetAt(w: Workout, t: number) {
  let acc = 0;
  for (let i = 0; i < w.segs.length; i++) {
    const s = w.segs[i];
    if (t < acc + s.dur) {
      const f = (t - acc) / s.dur;
      const frac = s.to === undefined ? s.from : s.from + (s.to - s.from) * f;
      return { frac, segIndex: i, segRemaining: acc + s.dur - t };
    }
    acc += s.dur;
  }
  return null;
}

export function zoneOf(frac: number) {
  if (frac < 0.55) return 1;
  if (frac < 0.76) return 2;
  if (frac < 0.9) return 3;
  if (frac < 1.05) return 4;
  if (frac < 1.2) return 5;
  return 6;
}
