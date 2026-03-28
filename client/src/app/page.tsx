import { FleetDashboard } from "@/modules/fleet/components";
import { FleetStatsSkeleton } from "@/modules/fleet/components/fleet-stats-skeleton.component";
import { Suspense } from "react";

async function getFleetSnapshot() {
  const res = await fetch(`http://localhost:5500/api/v1/fleet/snapshot`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch initial fleet state");
  return res.json();
}

export default function Home() {
  const initialDataPromise = getFleetSnapshot();
  return (
    <main className="h-screen bg-slate-50">
      <Suspense fallback={<FleetStatsSkeleton />}>
        <FleetDashboard initialDataPromise={initialDataPromise} />
      </Suspense>
    </main>
  );
}
