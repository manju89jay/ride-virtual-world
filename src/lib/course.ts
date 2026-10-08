// Procedural closed-loop countryside course. 1 world unit = 1 metre.
const N = 2000;
const TAU = Math.PI * 2;

function wrapA(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
function planar(t: number): [number, number] {
  const r = 900 + 170 * Math.sin(2 * t + 0.5) + 80 * Math.sin(5 * t + 1.3);
  return [r * Math.cos(t), r * 0.78 * Math.sin(t)];
}
function elev(t: number) {
  return (
    20 +
    14 * Math.sin(3 * t) +
    4 * Math.sin(8 * t + 1) +
    55 * Math.exp(-((wrapA(t - 2.4) / 0.6) ** 2))
  );
}

export type Course = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  dist: Float32Array;
  length: number;
  coarse: { x: number; z: number; h: number }[];
  minH: number;
  maxH: number;
};

let cache: Course | null = null;

export function getCourse(): Course {
  if (cache) return cache;
  const x = new Float32Array(N + 1);
  const y = new Float32Array(N + 1);
  const z = new Float32Array(N + 1);
  const dist = new Float32Array(N + 1);
  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i <= N; i++) {
    const t = ((i % N) / N) * TAU;
    const [px, pz] = planar(t);
    x[i] = px;
    z[i] = pz;
    y[i] = elev(t);
    minH = Math.min(minH, y[i]);
    maxH = Math.max(maxH, y[i]);
    if (i > 0) {
      const dx = x[i] - x[i - 1];
      const dy = y[i] - y[i - 1];
      const dz = z[i] - z[i - 1];
      dist[i] = dist[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  const coarse: Course["coarse"] = [];
  for (let i = 0; i < N; i += 2) coarse.push({ x: x[i], z: z[i], h: y[i] });
  cache = { n: N, x, y, z, dist, length: dist[N], coarse, minH, maxH };
  return cache;
}

export type Sample = {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  grade: number; // fraction, 0.05 = 5%
};

export function sampleAt(sIn: number): Sample {
  const c = getCourse();
  const s = ((sIn % c.length) + c.length) % c.length;
  let lo = 0;
  let hi = c.n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c.dist[mid] <= s) lo = mid;
    else hi = mid;
  }
  const i = lo;
  const j = i + 1;
  const seg = c.dist[j] - c.dist[i] || 1;
  const f = (s - c.dist[i]) / seg;
  const dx = c.x[j] - c.x[i];
  const dz = c.z[j] - c.z[i];
  const hl = Math.sqrt(dx * dx + dz * dz) || 1;
  return {
    x: c.x[i] + dx * f,
    y: c.y[i] + (c.y[j] - c.y[i]) * f,
    z: c.z[i] + dz * f,
    tx: dx / hl,
    tz: dz / hl,
    grade: (c.y[j] - c.y[i]) / hl,
  };
}

function smoothstep(a: number, b: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function terrainHeight(x: number, z: number) {
  const c = getCourse();
  let best = Infinity;
  let rh = 0;
  for (const p of c.coarse) {
    const dx = p.x - x;
    const dz = p.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) {
      best = d2;
      rh = p.h;
    }
  }
  const d = Math.sqrt(best);
  const noise =
    5 * Math.sin(x * 0.011 + 1) * Math.cos(z * 0.013) +
    2.5 * Math.sin(x * 0.033 + z * 0.029) +
    1.2 * Math.sin(x * 0.07 - z * 0.05);
  const far = Math.max(0, d - 50) * 0.07 * (0.6 + 0.4 * Math.sin(x * 0.003 + z * 0.002));
  const b = smoothstep(9, 45, d);
  return { h: rh - 0.6 + b * (noise + far + 0.6), d };
}

export function elevationProfile(points = 240) {
  const c = getCourse();
  const out: { s: number; h: number }[] = [];
  for (let k = 0; k <= points; k++) {
    const s = (k / points) * c.length;
    out.push({ s, h: sampleAt(s).y });
  }
  return out;
}
