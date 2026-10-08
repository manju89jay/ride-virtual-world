import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Hedgerow" },
      { name: "description", content: "Set your FTP, weight and how hard hills feel on the trainer." },
      { property: "og:title", content: "Settings — Hedgerow" },
      { property: "og:description", content: "Set your FTP, weight and how hard hills feel." },
    ],
  }),
  component: SettingsPage,
});

function NumField({ id, label, value, onChange, unit }: { id: string; label: string; value: number; onChange: (n: number) => void; unit: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input id={id} type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function SettingsPage() {
  const s = useSettings();
  return (
    <AppShell>
      <h1 className="font-display text-5xl font-bold uppercase">Settings</h1>
      <div className="mt-6 grid max-w-2xl gap-6 rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField id="ftp" label="FTP" value={s.ftp} unit="W" onChange={(ftp) => s.set({ ftp })} />
          <NumField id="weight" label="Your weight" value={s.weight} unit="kg" onChange={(weight) => s.set({ weight })} />
          <NumField id="bike" label="Bike weight" value={s.bikeWeight} unit="kg" onChange={(bikeWeight) => s.set({ bikeWeight })} />
        </div>
        <div>
          <Label>Hill feel: {Math.round(s.difficulty * 100)}%</Label>
          <p className="text-sm text-muted-foreground">How much of the real gradient the trainer applies. 50% is a common choice.</p>
          <Slider className="mt-3" min={0} max={1} step={0.05} value={[s.difficulty]} onValueChange={([difficulty]) => s.set({ difficulty })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="sim">Simulation mode</Label>
            <p className="text-sm text-muted-foreground">Ride with the keyboard (↑/↓ for watts) — handy for trying the app without the bike.</p>
          </div>
          <Switch id="sim" checked={s.simMode} onCheckedChange={(simMode) => s.set({ simMode })} />
        </div>
      </div>
    </AppShell>
  );
}
