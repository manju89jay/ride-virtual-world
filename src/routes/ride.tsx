import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { World } from "@/components/world/World";
import { RideHUD } from "@/components/RideHUD";
import { resetSim } from "@/lib/session";
import { getWorkout } from "@/lib/workouts";

export const Route = createFileRoute("/ride")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { workout?: string } =>
    typeof s.workout === "string" ? { workout: s.workout } : {},
  head: () => ({
    meta: [
      { title: "Ride — Hedgerow" },
      { name: "description", content: "Ride the countryside loop with your smart trainer." },
      { property: "og:title", content: "Ride — Hedgerow" },
      { property: "og:description", content: "Ride the countryside loop with your smart trainer." },
    ],
  }),
  component: RidePage,
});

function RidePage() {
  const { workout } = Route.useSearch();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    resetSim(getWorkout(workout));
    setReady(true);
  }, [workout]);
  if (!ready) return null;
  return (
    <div className="fixed inset-0 bg-background">
      <World />
      <RideHUD />
    </div>
  );
}
