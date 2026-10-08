import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/history")({
  component: () => <Outlet />,
});
