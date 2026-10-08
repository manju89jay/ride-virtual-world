import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bike } from "lucide-react";

const nav = [
  { to: "/", label: "Home" },
  { to: "/pair", label: "Devices" },
  { to: "/workouts", label: "Workouts" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
            <Bike className="h-6 w-6 text-primary" /> Hedgerow
          </Link>
          <nav className="ml-auto flex flex-wrap gap-1 text-sm font-semibold">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/ride"
            search={{}}
            className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Ride
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
