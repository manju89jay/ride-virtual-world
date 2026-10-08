import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { WorkoutChart } from "@/components/WorkoutChart";
import { WORKOUTS, workoutDuration } from "@/lib/workouts";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/workouts")({
  head: () => ({
    meta: [
      { title: "Workouts — Hedgerow" },
      { name: "description", content: "Structured interval workouts in ERG mode, scaled to your FTP." },
      { property: "og:title", content: "Workouts — Hedgerow" },
      { property: "og:description", content: "Structured interval workouts in ERG mode, scaled to your FTP." },
    ],
  }),
  component: Workouts,
});

function Workouts() {
  const ftp = useSettings((s) => s.ftp);
  return (
    <AppShell>
      <h1 className="font-display text-5xl font-bold uppercase">Workouts</h1>
      <p className="mt-1 text-muted-foreground">Targets scale to your FTP ({ftp} W). The trainer holds the watts for you (ERG mode).</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {WORKOUTS.map((w) => (
          <div key={w.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl font-bold uppercase">{w.name}</h2>
              <span className="text-sm font-semibold text-muted-foreground">{Math.round(workoutDuration(w) / 60)} min</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{w.description}</p>
            <WorkoutChart workout={w} className="mt-4 h-20 w-full rounded-md bg-muted" />
            <Link
              to="/ride"
              search={{ workout: w.id }}
              className="mt-4 self-start rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Ride this workout
            </Link>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
