import { useState } from "react";

interface MapSearchProps {
  onSearch: (vehicleId: string) => void;
  vehicles: { id: string; status: string }[];
}

// TODO: show suggestions of vehicles on map when they search
export const FleetMapSearch = ({ onSearch, vehicles }: MapSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const suggestions =
    query.length > 0
      ? vehicles
          .filter((v) => v.id.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
      : [];

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className="absolute top-6 left-6 z-20 w-72">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-slate-500"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <input
          type="text"
          className="block w-full pl-8 pr-3 py-2.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 transition-all placeholder:text-slate-400"
          placeholder="Search Vehicle ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        />

        {/* Suggestion Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute mt-2 w-full bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl py-1 overflow-hidden">
            {suggestions.map((v) => (
              <button
                key={v.id}
                type="button"
                onMouseDown={() => {
                  setQuery(v.id);
                  onSearch(v.id);
                  setIsOpen(false);
                }}
                className="w-full cursor-pointer px-4 py-2 text-left text-sm hover:bg-indigo-50 flex items-center justify-between group"
              >
                <span className="font-medium text-slate-700">{v.id}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                    v.status === "delayed"
                      ? "bg-red-100 text-red-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {v.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};
