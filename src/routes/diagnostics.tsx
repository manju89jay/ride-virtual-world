import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useDevices } from "@/lib/store";
import { useBleLog, bleLog } from "@/lib/bleLog";
import { connectVirtualTrainer, setSimGrade, setTargetPower, trainerHasControl } from "@/lib/ble";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "Hardware test — Hedgerow" },
      { name: "description", content: "Test your Zwift Ride: live trainer data, resistance commands and controller buttons." },
      { property: "og:title", content: "Hardware test — Hedgerow" },
      { property: "og:description", content: "Check your trainer, heart rate strap and controllers step by step." },
    ],
  }),
  component: Diagnostics,
});

const CHECKS = [
  "Trainer connects (Devices page)",
  "Power and cadence change when you pedal",
  "Grade ramp: pedalling gets harder at each step",
  "ERG test: power holds steady when you change cadence",
  "Controller connects and buttons appear in the log",
  "Shift buttons change gear during a ride",
];

function Diagnostics() {
  const d = useDevices();
  const log = useBleLog((s) => s.entries);
  const [running, setRunning] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKS.map(() => false));
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setRunning(null);
  };
  useEffect(() => stop, []);

  const runSteps = (name: string, steps: number[], send: (v: number) => void, unit: string) => {
    if (!trainerHasControl()) {
      bleLog("app", "info", "trainer not connected with control — connect it on the Devices page first");
      return;
    }
    stop();
    let i = 0;
    setRunning(name);
    const go = () => {
      if (i >= steps.length) {
        bleLog("app", "info", `${name} finished`);
        stop();
        return;
      }
      const v = steps[i]!;
      bleLog("app", "info", `${name}: step ${i + 1}/${steps.length} → ${v}${unit}`);
      send(v);
      i++;
      if (unit.trim() === "W") watchSettle(v);
    };
    go();
    timer.current = window.setInterval(go, 10000);
  };

  // Measure how long the trainer takes to hold a new ERG target within ±5 W.
  const watchSettle = (target: number) => {
    const t0 = performance.now();
    const unsub = useDevices.subscribe((s) => {
      const dt = performance.now() - t0;
      if (Math.abs(s.power - target) <= 5) {
        bleLog("app", "info", `ERG ${target} W settled in ${(dt / 1000).toFixed(1)} s`);
        unsub();
      } else if (dt > 9000) {
        bleLog("app", "info", `ERG ${target} W did not settle within 9 s (at ${s.power} W)`);
        unsub();
      }
    });
  };

  const connectVirtual = async () => {
    try {
      await connectVirtualTrainer();
    } catch (e) {
      bleLog("app", "info", e instanceof Error ? e.message : String(e));
    }
  };

  const download = () => {
    const text = log.map((e) => `${new Date(e.t).toISOString()} ${e.dev} ${e.dir} ${e.msg}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `hedgerow-hardware-log-${Date.now()}.txt`;
    a.click();
  };

  const live = [
    ["Trainer", d.trainer.status + (d.trainer.control ? " · control" : "") + (d.trainer.virtual ? " · virtual" : "")],
    ["Power", `${d.power} W`],
    ["Cadence", `${Math.round(d.cadence)} rpm`],
    ["Speed", `${d.trainerSpeed.toFixed(1)} km/h`],
    ["Heart rate", d.heartRate ? `${d.heartRate} bpm` : "--"],
    ["Controller", d.controller.status + (d.controller.lastBit !== null ? ` · last button ${d.controller.lastBit}` : "")],
  ];

  return (
    <AppShell>
      <h1 className="font-display text-5xl font-bold uppercase">Hardware test</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Pair your devices first, then work through the checklist. If something fails, download the log and send it to me.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Live</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {live.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button disabled={!!running} onClick={() => runSteps("Grade ramp", [0, 2, 4, 6, 8, 10, 0], setSimGrade, "%")}>Grade ramp 0→10%</Button>
            <Button disabled={!!running} variant="secondary" onClick={() => runSteps("ERG test", [100, 150, 200, 250, 100], setTargetPower, " W")}>ERG test 100→250 W</Button>
            {running && <Button variant="outline" onClick={stop}>Stop {running}</Button>}
            {d.trainer.status !== "connected" && <Button variant="outline" onClick={connectVirtual}>Connect virtual trainer</Button>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Each step lasts 10 seconds.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Checklist</h2>
          <ul className="mt-3 space-y-2">
            {CHECKS.map((c, i) => (
              <li key={c}>
                <label className="flex items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-primary" checked={checked[i]} onChange={() => setChecked((p) => p.map((v, j) => (j === i ? !v : v)))} />
                  <span className={checked[i] ? "line-through opacity-60" : ""}>{c}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold uppercase">Log</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => useBleLog.setState({ entries: [] })}>Clear</Button>
            <Button size="sm" onClick={download} disabled={!log.length}>Download log</Button>
          </div>
        </div>
        <div className="mt-3 h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {log.length === 0 && <div className="text-muted-foreground">Nothing yet — connect a device.</div>}
          {[...log].reverse().map((e, i) => (
            <div key={i} className="whitespace-pre-wrap">
              <span className="text-muted-foreground">{new Date(e.t).toLocaleTimeString()}</span>{" "}
              <span className="font-bold">{e.dev}</span> {e.dir === "out" ? "→" : e.dir === "in" ? "←" : "·"} {e.msg}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
