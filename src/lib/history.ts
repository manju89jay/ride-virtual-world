export type RideRecord = {
  id: string;
  date: string;
  name: string;
  durationSec: number;
  distanceM: number;
  elevGainM: number;
  avgPower: number;
  np: number;
  maxPower: number;
  avgHr: number;
  maxHr: number;
  avgCadence: number;
  samples: { p: number[]; h: number[]; c: number[]; v: number[]; e: number[] };
};

const KEY = "vc-rides";

export function loadRides(): RideRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function getRide(id: string) {
  return loadRides().find((r) => r.id === id) ?? null;
}
export function saveRide(r: RideRecord) {
  localStorage.setItem(KEY, JSON.stringify([r, ...loadRides()]));
}
export function deleteRide(id: string) {
  localStorage.setItem(KEY, JSON.stringify(loadRides().filter((r) => r.id !== id)));
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function normalizedPower(p: number[]) {
  if (p.length < 30) return avg(p);
  const rolled: number[] = [];
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    sum += p[i];
    if (i >= 30) sum -= p[i - 30];
    if (i >= 29) rolled.push((sum / 30) ** 4);
  }
  return avg(rolled) ** 0.25;
}

export function summarize(
  samples: RideRecord["samples"],
  distanceM: number,
  elevGainM: number,
  name: string,
): RideRecord {
  const hrs = samples.h.filter((h) => h > 0);
  const cads = samples.c.filter((c) => c > 0);
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    name,
    durationSec: samples.p.length,
    distanceM,
    elevGainM,
    avgPower: Math.round(avg(samples.p)),
    np: Math.round(normalizedPower(samples.p)),
    maxPower: Math.max(0, ...samples.p),
    avgHr: Math.round(avg(hrs)),
    maxHr: Math.max(0, ...hrs),
    avgCadence: Math.round(avg(cads)),
    samples,
  };
}

export function fmtTime(sec: number) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
