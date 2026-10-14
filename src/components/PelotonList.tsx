import { useEffect, useState } from "react";
import { getCourse } from "@/lib/course";
import { sim } from "@/lib/session";
import { useRiders } from "@/lib/riders";
import { useDevices } from "@/lib/store";

/** Riders around you with their gap, plus a badge when the trainer is the simulator. */
export function PelotonList() {
  const list = useRiders((s) => s.list);
  const trainer = useDevices((s) => s.trainer);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  const L = getCourse().length;
  const rows = list
    .map((r) => {
      let gap = (r.s - sim.s) % L;
      if (gap > L / 2) gap -= L;
      if (gap < -L / 2) gap += L;
      return { ...r, gap };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8);

  if (!rows.length && !trainer.virtual) return null;
  return (
    <div className="pointer-events-none fixed left-4 top-1/2 z-20 w-56 -translate-y-1/2 space-y-2">
      {trainer.virtual && trainer.status === "connected" && (
        <div className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-foreground">
          Virtual trainer
        </div>
      )}
      {rows.length > 0 && (
        <div className="rounded-xl bg-background/80 p-3 backdrop-blur">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Riders near you</div>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
              <span className="flex items-center gap-2 truncate">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                {r.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.gap >= 0 ? "+" : "−"}
                {Math.abs(r.gap) < 1000 ? `${Math.round(Math.abs(r.gap))} m` : `${(Math.abs(r.gap) / 1000).toFixed(1)} km`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
