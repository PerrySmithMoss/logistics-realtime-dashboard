import { FleetDashboard } from "@/modules/fleet/components";
import { FleetStatsSkeleton } from "@/modules/fleet/components/fleet-stats-skeleton.component";
import { fleetService } from "@/modules/fleet/services/fleet.service";
import { Suspense } from "react";

export default function HomePage() {
  const fleetSnapshotPromise = fleetService.getSnapshot();
  return (
    <main className="h-screen bg-slate-50">
      <Suspense fallback={<FleetStatsSkeleton />}>
        <FleetDashboard initialDataPromise={fleetSnapshotPromise} />
      </Suspense>
    </main>
  );
}
