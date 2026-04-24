"use client";

import { SearchIcon } from "@/shared/components";
import { useDebounce } from "@/shared/hooks";
import { useCallback, useMemo, useState } from "react";
import {
  FLEET_MAP_SEARCH_MAX_SUGGESTIONS,
  FLEET_MAP_SEARCH_STATUS_BADGE_STYLES,
} from "../constants/fleet-map-search.constants";
import { FleetVehicle } from "../types";

interface FleetMapSearchProps {
  onSearch: (vehicleId: string) => void;
  vehicles: Pick<FleetVehicle, "id" | "status">[];
  className?: string;
}

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${FLEET_MAP_SEARCH_STATUS_BADGE_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}
  >
    {status}
  </span>
);

export const FleetMapSearch = ({
  onSearch,
  vehicles,
  className = "absolute top-6 left-6 z-20 w-72",
}: FleetMapSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 150);

  const suggestions = useMemo(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();

    if (!trimmed) {
      // If search is empty we would ideally show list of recent searches
      // or vehicles they have interacted with. However, for now, we will
      // just show first 5 vehicles in array.
      return vehicles.slice(0, 5);
    }

    return vehicles
      .filter((v) => v.id.toLowerCase().includes(trimmed))
      .slice(0, FLEET_MAP_SEARCH_MAX_SUGGESTIONS);
  }, [debouncedQuery, vehicles]);

  const [prevSuggestions, setPrevSuggestions] = useState(suggestions);

  if (suggestions !== prevSuggestions) {
    setPrevSuggestions(suggestions);
    setActiveIndex(-1);
  }

  const handleSelect = useCallback(
    (vehicleId: string) => {
      setQuery(vehicleId);
      onSearch(vehicleId);
      setIsOpen(false);
    },
    [onSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();

          const hasTypedQuery = query.trim().length > 0;

          if (activeIndex >= 0) {
            // user highlighted an item with arrows
            handleSelect(suggestions[activeIndex].id);
          } else if (hasTypedQuery) {
            // if user has typed something, we auto pick the top match
            handleSelect(suggestions[0].id);
          }
          // prevent accidental navigation on focus
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, suggestions, activeIndex, handleSelect, query],
  );

  const shouldShowMenu =
    isOpen && (debouncedQuery.length > 0 || (query.length === 0 && vehicles.length > 0));

  return (
    <div className={className}>
      <form onSubmit={(e) => e.preventDefault()} className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-30 text-slate-400">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search Vehicle ID..."
          className="block w-full pl-9 pr-3 py-2.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 transition-all"
        />

        {shouldShowMenu && (
          <ul
            role="listbox"
            className="absolute mt-2 w-full bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl py-1 overflow-hidden"
          >
            {suggestions.length > 0 ? (
              suggestions.map((v, index) => (
                <li key={v.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onMouseDown={() => handleSelect(v.id)}
                    className={`cursor-pointer w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                      index === activeIndex
                        ? "bg-indigo-50 text-indigo-700"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="font-medium">{v.id}</span>
                    <StatusBadge status={v.status} />
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-xs text-slate-400 italic">No vehicles found.</li>
            )}
          </ul>
        )}
      </form>
    </div>
  );
};
