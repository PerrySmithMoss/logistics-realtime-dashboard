export const FleetStatsSkeleton = () => {
  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 animate-pulse">
      {/* Header Stat Cards Skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-slate-200 rounded-2xl border border-slate-100 shadow-sm"
          />
        ))}
      </section>

      {/* Map Area Skeleton */}
      <section className="flex-1 relative w-full bg-slate-200 rounded-2xl border-2 border-slate-100 shadow-inner overflow-hidden">
        {/* Mock Map Controls */}
        <div className="absolute top-4 right-4 space-y-2">
          <div className="w-10 h-10 bg-slate-300 rounded-md" />
          <div className="w-10 h-10 bg-slate-300 rounded-md" />
        </div>

        {/* Central Loading Message */}
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-400 font-medium">Initialising Map Engine...</p>
        </div>
      </section>
    </div>
  );
};
