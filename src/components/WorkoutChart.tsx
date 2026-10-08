import { type Workout, workoutDuration, zoneOf } from "@/lib/workouts";

export function WorkoutChart({ workout, progress, className }: { workout: Workout; progress?: number; className?: string }) {
  const total = workoutDuration(workout);
  const maxF = Math.max(1.3, ...workout.segs.map((s) => Math.max(s.from, s.to ?? 0)));
  let acc = 0;
  return (
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className={className}>
      {workout.segs.map((s, i) => {
        const x = (acc / total) * 1000;
        const w = (s.dur / total) * 1000;
        acc += s.dur;
        const h1 = (s.from / maxF) * 100;
        const h2 = ((s.to ?? s.from) / maxF) * 100;
        const z = zoneOf((s.from + (s.to ?? s.from)) / 2);
        return (
          <polygon
            key={i}
            points={`${x},100 ${x},${100 - h1} ${x + w},${100 - h2} ${x + w},100`}
            fill={`var(--zone-${z})`}
            stroke="var(--background)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {progress !== undefined && (
        <>
          <rect x={0} y={0} width={(progress / total) * 1000} height={100} fill="var(--foreground)" opacity={0.25} />
          <line x1={(progress / total) * 1000} x2={(progress / total) * 1000} y1={0} y2={100} stroke="var(--hud-foreground)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}

export function LineChart({ series, className }: { series: { data: number[]; color: string }[]; className?: string }) {
  const len = Math.max(...series.map((s) => s.data.length), 2);
  return (
    <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className={className}>
      {series.map((s, k) => {
        const max = Math.max(...s.data, 1) * 1.1;
        const step = Math.max(1, Math.floor(s.data.length / 500));
        const pts: string[] = [];
        for (let i = 0; i < s.data.length; i += step) {
          let sum = 0;
          let n = 0;
          for (let j = i; j < Math.min(i + step, s.data.length); j++) {
            sum += s.data[j] ?? 0;
            n++;
          }
          pts.push(`${(i / (len - 1)) * 1000},${200 - (sum / n / max) * 200}`);
        }
        return <polyline key={k} points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}
