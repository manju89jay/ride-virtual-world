import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { fmtTime, loadRides, type RideRecord } from "@/lib/history";

export const Route = createFileRoute("/history/")({
  head: () => ({
    meta: [
      { title: "Ride History — Hedgerow" },
      { name: "description", content: "All your indoor rides with power, heart rate and distance." },
      { property: "og:title", content: "Ride History — Hedgerow" },
      { property: "og:description", content: "All your indoor rides with power, heart rate and distance." },
    ],
  }),
  component: HistoryList,
});

function HistoryList() {
  const [rides, setRides] = useState<RideRecord[] | null>(null);
  useEffect(() => setRides(loadRides()), []);
  const totalKm = (rides ?? []).reduce((a, r) => a + r.distanceM, 0) / 1000;
  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <h1 className="font-display text-5xl font-bold uppercase">History</h1>
        {rides && rides.length > 0 && (
          <div className="text-right text-sm text-muted-foreground">
            {rides.length} rides · <span className="font-display text-2xl font-bold text-foreground">{totalKm.toFixed(0)} km</span>
          </div>
        )}
      </div>
      {rides && rides.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No rides yet. Finish a ride and it shows up here.
        </div>
      )}
      <div className="mt-6 grid gap-3">
        {rides?.map((r) => (
          <Link
            key={r.id}
            to="/history/$id"
            params={{ id: r.id }}
            className="grid grid-cols-2 items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary md:grid-cols-6"
          >
            <div className="col-span-2">
              <div className="font-bold">{r.name}</div>
              <div className="text-sm text-muted-foreground">{new Date(r.date).toLocaleString()}</div>
            </div>
            <Cell l="Time" v={fmtTime(r.durationSec)} />
            <Cell l="Distance" v={`${(r.distanceM / 1000).toFixed(1)} km`} />
            <Cell l="Avg power" v={`${r.avgPower} W`} />
            <Cell l="Avg HR" v={r.avgHr ? `${r.avgHr}` : "--"} />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

function Cell({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{l}</div>
      <div className="font-display text-2xl font-bold">{v}</div>
    </div>
  );
}
