import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LineChart } from "@/components/WorkoutChart";
import { Button } from "@/components/ui/button";
import { deleteRide, fmtTime, getRide, type RideRecord } from "@/lib/history";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "Ride Details — Hedgerow" },
      { name: "description", content: "Power, heart rate and elevation for one ride." },
      { property: "og:title", content: "Ride Details — Hedgerow" },
      { property: "og:description", content: "Power, heart rate and elevation for one ride." },
    ],
  }),
  component: RideDetail,
});

function RideDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<RideRecord | null | undefined>(undefined);
  useEffect(() => setRide(getRide(id)), [id]);

  if (ride === undefined) return <AppShell>{null}</AppShell>;
  if (ride === null)
    return (
      <AppShell>
        <p>Ride not found. <Link to="/history" className="text-primary underline">Back to history</Link></p>
      </AppShell>
    );

  const stats = [
    ["Time", fmtTime(ride.durationSec)],
    ["Distance", `${(ride.distanceM / 1000).toFixed(2)} km`],
    ["Climbing", `${Math.round(ride.elevGainM)} m`],
    ["Avg power", `${ride.avgPower} W`],
    ["Norm. power", `${ride.np} W`],
    ["Max power", `${ride.maxPower} W`],
    ["Avg HR", ride.avgHr ? `${ride.avgHr} bpm` : "--"],
    ["Max HR", ride.maxHr ? `${ride.maxHr} bpm` : "--"],
    ["Avg cadence", ride.avgCadence ? `${ride.avgCadence} rpm` : "--"],
  ];

  return (
    <AppShell>
      <Link to="/history" className="text-sm font-semibold text-muted-foreground hover:text-foreground">← History</Link>
      <h1 className="mt-2 font-display text-5xl font-bold uppercase">{ride.name}</h1>
      <p className="text-muted-foreground">{new Date(ride.date).toLocaleString()}</p>
      <div className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-9">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{l}</div>
            <div className="font-display text-xl font-bold">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex gap-4 text-xs font-bold uppercase tracking-widest">
          <span className="text-primary">Power</span>
          <span className="text-heart">Heart rate</span>
          <span className="text-accent">Elevation</span>
        </div>
        <LineChart
          className="mt-3 h-64 w-full"
          series={[
            { data: ride.samples.e, color: "var(--accent)" },
            { data: ride.samples.p, color: "var(--primary)" },
            { data: ride.samples.h, color: "var(--heart)" },
          ]}
        />
      </div>
      <Button
        variant="outline"
        className="mt-6"
        onClick={() => {
          deleteRide(ride.id);
          navigate({ to: "/history" });
        }}
      >
        Delete ride
      </Button>
    </AppShell>
  );
}
