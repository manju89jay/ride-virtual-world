import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Pause, Play, Flag, Minus, Plus, Heart, Gauge } from "lucide-react";
import { useDevices, useRide, useSettings } from "@/lib/store";
import { sim, MAX_GEAR } from "@/lib/session";
import { controllerListeners } from "@/lib/ble";
import { elevationProfile, getCourse } from "@/lib/course";
import { fmtTime, saveRide, summarize } from "@/lib/history";
import { WorkoutChart } from "./WorkoutChart";
import { zoneOf } from "@/lib/workouts";

function Stat({ label, value, unit, big }: { label: string; value: string | number; unit?: string; big?: boolean }) {
  return (
    <div className="leading-none">
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</div>
      <div className={`font-display font-bold tabular-nums ${big ? "text-6xl" : "text-3xl"}`}>
        {value}
        {unit && <span className="ml-1 text-base font-semibold opacity-70">{unit}</span>}
      </div>
    </div>
  );
}

const shift = (d: number) => {
  sim.gear = Math.max(1, Math.min(MAX_GEAR, sim.gear + d));
  useRide.setState({ gear: sim.gear });
};

export function RideHUD() {
  const r = useRide();
  const dev = useDevices();
  const st = useSettings();
  const navigate = useNavigate();
  const usingSim = st.simMode || dev.trainer.status !== "connected";

  const profile = useMemo(() => {
    const p = elevationProfile();
    const c = getCourse();
    const span = c.maxH - c.minH || 1;
    const pts = p.map((q) => `${(q.s / c.length) * 1000},${90 - ((q.h - c.minH) / span) * 80}`);
    return { path: `M0,100 L${pts.join(" L")} L1000,100 Z`, length: c.length };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") sim.simPower = Math.min(1500, sim.simPower + 10);
      else if (e.key === "ArrowDown") sim.simPower = Math.max(0, sim.simPower - 10);
      else if (e.key === "e" || e.key === "]") shift(1);
      else if (e.key === "q" || e.key === "[") shift(-1);
      else if (e.key === " ") {
        sim.paused = !sim.paused;
        e.preventDefault();
      } else return;
    };
    const onBtn = (bit: number) => {
      const s = useSettings.getState();
      if (s.shiftUp.includes(bit)) shift(1);
      else if (s.shiftDown.includes(bit)) shift(-1);
    };
    window.addEventListener("keydown", onKey);
    controllerListeners.add(onBtn);
    return () => {
      window.removeEventListener("keydown", onKey);
      controllerListeners.delete(onBtn);
    };
  }, []);

  const finish = () => {
    sim.paused = true;
    if (sim.samples.p.length < 10) {
      navigate({ to: "/" });
      return;
    }
    const rec = summarize(
      sim.samples,
      sim.dist,
      sim.elevGain,
      sim.workout ? sim.workout.name : `Free ride · ${(sim.dist / 1000).toFixed(1)} km`,
    );
    saveRide(rec);
    navigate({ to: "/history/$id", params: { id: rec.id } });
  };

  const zone = r.target ? zoneOf(r.target / st.ftp) : zoneOf(r.power3s / st.ftp);
  const panel = "rounded-2xl bg-hud text-hud-foreground backdrop-blur-md shadow-lg";

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col p-4">
      <div className="flex items-start justify-between gap-4">
        <div className={`${panel} grid grid-cols-3 gap-6 px-5 py-3`}>
          <Stat label="Speed" value={r.speed.toFixed(1)} unit="km/h" />
          <Stat label="Distance" value={(r.distance / 1000).toFixed(2)} unit="km" />
          <Stat label="Time" value={fmtTime(r.elapsed)} />
        </div>
        <div className={`${panel} px-6 py-3 text-center`} style={{ boxShadow: `inset 0 -5px 0 var(--zone-${zone})` }}>
          <Stat label={usingSim ? "Power · simulated" : "Power"} value={r.power3s} unit="W" big />
          <div className="mt-1 text-xs font-semibold opacity-80">
            {(r.power3s / st.weight).toFixed(1)} W/kg · now {r.power} W
          </div>
        </div>
        <div className={`${panel} grid grid-cols-3 gap-6 px-5 py-3`}>
          <div className="leading-none">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest opacity-70">
              <Heart className="h-3 w-3 text-heart" /> HR
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">{dev.heartRate || "--"}</div>
          </div>
          <Stat label="Cadence" value={usingSim ? (r.power ? 88 : 0) : Math.round(dev.cadence)} unit="rpm" />
          <Stat label="Gear" value={r.gear} unit={`/${MAX_GEAR}`} />
        </div>
      </div>

      {r.target !== null && sim.workout && (
        <div className={`${panel} mx-auto mt-4 w-full max-w-xl px-5 py-3`}>
          <div className="flex items-end justify-between">
            <Stat label="Target · ERG" value={r.target} unit="W" />
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Interval left</div>
              <div className="font-display text-3xl font-bold tabular-nums">{fmtTime(r.segRemaining)}</div>
            </div>
          </div>
          <WorkoutChart workout={sim.workout} progress={r.elapsed} className="mt-2 h-14 w-full" />
        </div>
      )}
      {r.workoutDone && (
        <div className={`${panel} mx-auto mt-4 px-6 py-3 font-display text-2xl font-bold`}>Workout complete — free ride on or finish.</div>
      )}

      <div className="mt-auto flex items-end gap-4">
        <div className={`${panel} pointer-events-auto flex flex-col gap-2 p-3`}>
          <div className="flex gap-2">
            <button className="rounded-xl bg-hud-foreground/15 p-3 hover:bg-hud-foreground/25" onClick={() => shift(-1)} aria-label="Easier gear">
              <Minus className="h-5 w-5" />
            </button>
            <div className="flex items-center px-1 text-xs font-bold uppercase">Gear</div>
            <button className="rounded-xl bg-hud-foreground/15 p-3 hover:bg-hud-foreground/25" onClick={() => shift(1)} aria-label="Harder gear">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {usingSim && (
            <div className="flex gap-2">
              <button className="rounded-xl bg-hud-foreground/15 p-3 hover:bg-hud-foreground/25" onClick={() => (sim.simPower = Math.max(0, sim.simPower - 10))} aria-label="Less power">
                <Minus className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-1 px-1 text-xs font-bold uppercase">
                <Gauge className="h-4 w-4" /> Watts
              </div>
              <button className="rounded-xl bg-hud-foreground/15 p-3 hover:bg-hud-foreground/25" onClick={() => (sim.simPower += 10)} aria-label="More power">
                <Plus className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-hud-foreground/15 px-3 py-2 text-sm font-bold hover:bg-hud-foreground/25" onClick={() => (sim.paused = !sim.paused)}>
              {r.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {r.paused ? "Resume" : "Pause"}
            </button>
            <button className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground" onClick={finish}>
              <Flag className="h-4 w-4" /> Finish
            </button>
          </div>
          <div className="text-[10px] opacity-60">Q/E shift · Space pause{usingSim ? " · ↑/↓ watts" : ""}</div>
        </div>

        <div className={`${panel} flex-1 px-5 py-3`}>
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
            <span>Gradient <span className="font-display text-2xl">{r.grade.toFixed(1)}%</span></span>
            <span>Elev <span className="font-display text-2xl">{Math.round(r.elevation)} m</span> · ↑ {Math.round(r.elevGain)} m</span>
          </div>
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="mt-1 h-16 w-full">
            <path d={profile.path} fill="var(--accent)" opacity={0.85} />
            <line
              x1={((r.s % profile.length) / profile.length) * 1000}
              x2={((r.s % profile.length) / profile.length) * 1000}
              y1={0}
              y2={100}
              stroke="var(--primary)"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
