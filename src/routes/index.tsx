import { createFileRoute, Link } from "@tanstack/react-router";
import { Bluetooth, Dumbbell, History, Mountain } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useDevices } from "@/lib/store";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hedgerow — Your Personal Virtual Cycling World" },
      { name: "description", content: "Plug in your smart trainer and ride a sunny 3D countryside loop. Workouts, ERG mode and ride history — no subscription." },
      { property: "og:title", content: "Hedgerow — Your Personal Virtual Cycling World" },
      { property: "og:description", content: "Plug in your smart trainer and ride a sunny 3D countryside loop. No subscription." },
    ],
  }),
  component: Home,
});

function Home() {
  const trainer = useDevices((s) => s.trainer);
  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-3xl">
        <img src={hero} alt="Cyclist on a winding country road at golden hour" width={1600} height={912} className="h-[440px] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/75 via-foreground/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-8 text-background md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">The Hedgerow Loop · 9.6 km</p>
          <h1 className="mt-2 max-w-xl font-display text-6xl font-bold uppercase leading-[0.9] md:text-7xl">Your roads. Your living room.</h1>
          <p className="mt-4 max-w-md text-base opacity-90">Rolling hills, a proper climb and your own trainer. No subscription.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/ride" search={{}} className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90">
              Start free ride
            </Link>
            <Link to="/workouts" className="rounded-full bg-background/90 px-6 py-3 font-bold text-foreground hover:bg-background">
              Pick a workout
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {[
          { to: "/pair", icon: Bluetooth, title: "Devices", text: trainer.status === "connected" ? `Trainer: ${trainer.name}` : "Pair your Zwift Ride & HR strap" },
          { to: "/workouts", icon: Dumbbell, title: "Workouts", text: "Intervals in ERG mode" },
          { to: "/history", icon: History, title: "History", text: "Every ride, saved here" },
          { to: "/settings", icon: Mountain, title: "Settings", text: "FTP, weight, climb feel" },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary">
            <c.icon className="h-6 w-6 text-accent" />
            <div className="mt-3 font-display text-2xl font-bold uppercase">{c.title}</div>
            <div className="text-sm text-muted-foreground">{c.text}</div>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
