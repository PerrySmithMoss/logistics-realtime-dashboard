interface FleetDashboardStatCardProps {
  title: string;
  value: string;
  variant?: "default" | "warning" | "danger";
}

export const FleetDashboardStatCard = ({
  title,
  value,
  variant = "default",
}: FleetDashboardStatCardProps) => {
  const variantStyles = {
    default: "bg-white border-slate-200 text-slate-900",
    warning: "bg-amber-50 border-amber-400 text-amber-700",
    danger: "bg-red-50 border-red-400 text-red-600",
  } as const;

  return (
    <div className={`min-w-0 rounded-lg border p-3 shadow sm:p-4 ${variantStyles[variant]}`}>
      <h3 className="text-xs font-medium text-gray-500 sm:text-sm">{title}</h3>
      <p className="truncate text-xl font-bold sm:text-2xl" suppressHydrationWarning>
        {value}
      </p>
    </div>
  );
};
