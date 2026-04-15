interface FleetSummaryCardProps {
  title: string;
  count: number;
  total: number;
  variant?: "default" | "warning" | "danger";
}

const variantStyles = {
  default: "bg-white border-slate-200 text-slate-900",
  warning: "bg-amber-50 border-amber-400 text-amber-700",
  danger: "bg-red-50 border-red-400 text-red-600",
} as const;

export const FleetSummaryCard = ({
  title,
  count,
  total,
  variant = "default",
}: FleetSummaryCardProps) => {
  const percentage = total === 0 ? 0 : (count / total) * 100;

  return (
    <div className={`p-4 rounded-lg shadow border ${variantStyles[variant]}`}>
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-2xl font-bold" suppressHydrationWarning>
        {count}
      </p>
      <p className="text-xs font-semibold text-slate-500" suppressHydrationWarning>
        {percentage.toFixed(1)}% of fleet
      </p>
    </div>
  );
};
