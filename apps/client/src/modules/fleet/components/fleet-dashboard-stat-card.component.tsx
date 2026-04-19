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
    <div className={`p-4 rounded-lg shadow border ${variantStyles[variant]}`}>
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-2xl font-bold" suppressHydrationWarning>
        {value}
      </p>
    </div>
  );
};
