import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bluetooth, Gamepad2, Heart, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { bleSupported, connectController, connectHeartRate, connectTrainer, connectVirtualTrainer, controllerListeners } from "@/lib/ble";
import { useDevices, useSettings, type Status } from "@/lib/store";

export const Route = createFileRoute("/pair")({
  head: () => ({
    meta: [
      { title: "Devices — Hedgerow" },
      { name: "description", content: "Pair your smart trainer, Zwift Ride controllers and heart rate strap over Bluetooth." },
      { property: "og:title", content: "Devices — Hedgerow" },
      { property: "og:description", content: "Pair your trainer, controllers and heart rate strap." },
    ],
  }),
  component: Pair,
});

function Dot({ status }: { status: Status }) {
  const cls = status === "connected" ? "bg-accent" : status === "connecting" ? "bg-primary animate-pulse" : "bg-muted-foreground/40";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

async function attempt(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/cancel/i.test(msg)) toast.error(msg);
  }
}

function Pair() {
  const d = useDevices();
  const st = useSettings();
  const [supported, setSupported] = useState(true);
  const [learning, setLearning] = useState<null | "up" | "down">(null);

  useEffect(() => setSupported(bleSupported()), []);
  useEffect(() => {
    if (!learning) return;
    const fn = (bit: number) => {
      if (learning === "up") st.set({ shiftUp: [bit] });
      else st.set({ shiftDown: [bit] });
      toast.success(`Assigned button ${bit} to shift ${learning}`);
      setLearning(null);
    };
    controllerListeners.add(fn);
    return () => {
      controllerListeners.delete(fn);
    };
  }, [learning, st]);

  const card = "rounded-2xl border border-border bg-card p-6";
  return (
    <AppShell>
      <h1 className="font-display text-5xl font-bold uppercase">Devices</h1>
      <p className="mt-1 text-muted-foreground">Pairing works in Chrome or Edge on a computer. Close the Zwift app first — a trainer only talks to one app at a time.</p>
      {!supported && (
        <div className="mt-4 rounded-xl border border-destructive bg-destructive/10 p-4 text-sm">
          This browser can't use Bluetooth. Open this page in Chrome or Edge, or turn on simulation mode in Settings.
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className={card}>
          <div className="flex items-center gap-2 font-display text-2xl font-bold uppercase"><Zap className="h-5 w-5 text-primary" /> Trainer</div>
          <p className="mt-1 text-sm text-muted-foreground">Zwift Ride / Hub, or any smart trainer.</p>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold"><Dot status={d.trainer.status} /> {d.trainer.name ?? d.trainer.status}
            {d.trainer.virtual && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">Virtual</span>}
            {d.trainer.status === "connected" && d.trainer.protocol && <span className="text-xs text-muted-foreground">· {d.trainer.protocol}</span>}
          </div>
          {d.trainer.error && d.trainer.status !== "connected" && <p className="mt-2 text-xs text-destructive">{d.trainer.error}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Read label="Power" v={`${d.power} W`} />
            <Read label="Cadence" v={`${Math.round(d.cadence)}`} />
            <Read label="Speed" v={`${d.trainerSpeed.toFixed(1)}`} />
          </div>
          {d.trainer.status === "connected" && (
            <p className="mt-3 text-xs text-muted-foreground">{d.trainer.control ? "Resistance control active (hills + ERG)." : "Read-only: this trainer doesn't accept resistance control."}</p>
          )}
          <Button className="mt-4 w-full" disabled={!supported} onClick={() => attempt(connectTrainer)}>
            <Bluetooth className="h-4 w-4" /> Pair trainer
          </Button>
          <Button className="mt-2 w-full" variant="outline" onClick={() => attempt(() => connectVirtualTrainer())}>
            Connect virtual trainer
          </Button>
          <p className="mt-1 text-[11px] text-muted-foreground">Virtual KICKR Core for testing without hardware — start it first (see README).</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 font-display text-2xl font-bold uppercase"><Heart className="h-5 w-5 text-heart" /> Heart rate</div>
          <p className="mt-1 text-sm text-muted-foreground">Any Bluetooth chest strap or watch broadcasting HR.</p>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold"><Dot status={d.hrm.status} /> {d.hrm.name ?? d.hrm.status}</div>
          <div className="mt-3"><Read label="Heart rate" v={d.heartRate ? `${d.heartRate} bpm` : "--"} /></div>
          <Button className="mt-4 w-full" variant="secondary" disabled={!supported} onClick={() => attempt(connectHeartRate)}>
            <Bluetooth className="h-4 w-4" /> Pair HR strap
          </Button>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 font-display text-2xl font-bold uppercase"><Gamepad2 className="h-5 w-5 text-accent" /> Controllers</div>
          <p className="mt-1 text-sm text-muted-foreground">Zwift Ride shifters. Experimental — keyboard Q/E always works.</p>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold"><Dot status={d.controller.status} /> {d.controller.name ?? d.controller.status}</div>
          <div className="mt-3"><Read label="Last button" v={d.controller.lastBit === null ? "--" : `#${d.controller.lastBit}`} /></div>
          <Button className="mt-4 w-full" variant="secondary" disabled={!supported} onClick={() => attempt(connectController)}>
            <Bluetooth className="h-4 w-4" /> Pair controllers
          </Button>
          {d.controller.status === "connected" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant={learning === "up" ? "default" : "outline"} onClick={() => setLearning("up")}>
                {learning === "up" ? "Press button…" : `Shift up: #${st.shiftUp[0]}`}
              </Button>
              <Button size="sm" variant={learning === "down" ? "default" : "outline"} onClick={() => setLearning("down")}>
                {learning === "down" ? "Press button…" : `Shift down: #${st.shiftDown[0]}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Read({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold tabular-nums">{v}</div>
    </div>
  );
}
