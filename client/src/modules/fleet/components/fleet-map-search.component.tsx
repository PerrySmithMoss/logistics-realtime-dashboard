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
}

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${FLEET_MAP_SEARCH_STATUS_BADGE_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}
  >
    {status}
  </span>
);

export const FleetMapSearch = ({ onSearch, vehicles }: FleetMapSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 150);

  const suggestions = useMemo(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return vehicles
      .filter((v) => v.id.toLowerCase().includes(trimmed))
      .slice(0, FLEET_MAP_SEARCH_MAX_SUGGESTIONS);
  }, [debouncedQuery, vehicles]);

  const [lastSuggestions, setLastSuggestions] = useState(suggestions);
  if (suggestions !== lastSuggestions) {
    setLastSuggestions(suggestions);
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
          setActiveIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0) {
            handleSelect(suggestions[activeIndex].id);
          } else if (suggestions.length > 0) {
            // default to first vehicle in array
            handleSelect(suggestions[0].id);
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, suggestions, activeIndex, handleSelect],
  );

  return (
    <div className="absolute top-6 left-6 z-20 w-72">
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

        {isOpen && query.trim().length > 0 && (
          <ul
            role="listbox"
            className="absolute mt-2 w-full bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl py-1 overflow-hidden"
          >
            {suggestions.length > 0 ? (
              suggestions.map((v, index) => (
                <li
                  key={v.id}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    onMouseDown={() => handleSelect(v.id)}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${
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
              <li className="px-4 py-3 text-xs text-slate-400 italic">
                No vehicles found.
              </li>
            )}
          </ul>
        )}
      </form>
    </div>
  );
};
