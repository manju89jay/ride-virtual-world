// Virtual peloton: bot riders, each on its own simulated trainer, riding the app's course.
// Physics matches the app's src/sim/physics.ts so bots and you move the same way.
const NAMES = ["Anna K.", "Bram V.", "Chiara L.", "Dev P.", "Elif S.", "Finn O.", "Greta M.", "Hiro T.", "Ines R.", "Jonas W."];
const COLORS = ["#2b6cb0", "#c53030", "#2f855a", "#b7791f", "#6b46c1", "#0f766e", "#be185d", "#4a5568", "#9c4221", "#1e3a8a"];
const STYLES = ["steady", "surges", "diesel"];

export function createBots(n, seed = 7) {
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, (_, i) => ({
    id: `bot-${i}`,
    name: NAMES[i % NAMES.length],
    color: COLORS[i % COLORS.length],
    ftp: Math.round(180 + rnd() * 140),
    weight: Math.round(62 + rnd() * 23),
    style: STYLES[i % STYLES.length],
    s: i * 12,
    v: 0,
    power: 0,
    t: rnd() * 100,
  }));
}

export function stepBot(b, dt, gradeAt) {
  b.t += dt;
  const base = b.ftp * 0.72;
  const g = gradeAt(b.s);
  let p = base;
  if (b.style === "surges") p = base * (1 + 0.35 * Math.max(0, Math.sin(b.t / 20)));
  else if (b.style === "diesel") p = base * 0.95;
  else p = base * (1 + 0.05 * Math.sin(b.t / 7));
  if (g > 0.03) p *= 1.15; // push harder on climbs, like real riders
  b.power = p;
  const mass = b.weight + 9;
  const th = Math.atan(g);
  const drive = Math.min(p / Math.max(b.v, 0.5), 600);
  const resist = mass * 9.81 * Math.sin(th) + 0.004 * mass * 9.81 * Math.cos(th) + 0.5 * 1.225 * 0.32 * b.v * b.v;
  b.v = Math.max(0, b.v + ((drive - resist) / mass) * dt);
  b.s += b.v * dt;
}

export function courseGradeFn(course) {
  if (!course || !course.grades?.length) return () => 0;
  const { length, step, grades } = course;
  return (s) => grades[Math.floor((((s % length) + length) % length) / step)] ?? 0;
}
