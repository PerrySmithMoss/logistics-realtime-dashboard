"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface FleetMapProps {
  data: GeoJSON.FeatureCollection;
}

const createPopupMarkup = (vehicle: any) => `
  <div class="p-2 font-sans min-w-35 text-black">
    <div class="flex items-center gap-2 mb-1 border-b border-slate-100 pb-1">
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Vehicle</span>
      <span class="text-sm font-bold text-slate-800">${vehicle.id}</span>
    </div>
    <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
      <span class="text-[9px] text-slate-500 uppercase font-medium">Status</span>
      <span class="text-xs font-bold ${vehicle.status === "delayed" ? "text-red-500" : "text-emerald-500"}">
        ${vehicle.status.toUpperCase()}
      </span>
      <span class="text-[9px] text-slate-500 uppercase font-medium">Driver</span>
      <span class="text-xs text-slate-700 font-medium">${vehicle.driverName || "Unknown"}</span>
    </div>
  </div>
`;

export const FleetMap = forwardRef(({ data }: FleetMapProps, ref) => {
  const map = useRef<maplibregl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const activePopup = useRef<maplibregl.Popup | null>(null);

  useImperativeHandle(ref, () => ({
    zoomToVehicle: (lng: number, lat: number) => {
      map.current?.flyTo({
        center: [lng, lat],
        zoom: 16,
        speed: 1.2,
        curve: 1.42,
        essential: true,
      });
    },
    openPopup: (vehicle: any) => {
      if (!map.current) return;

      activePopup.current?.remove();

      activePopup.current = new maplibregl.Popup({
        closeButton: false,
        offset: 15,
        className: "custom-fleet-popup",
      })
        .setLngLat([vehicle.lng, vehicle.lat])
        .setHTML(createPopupMarkup(vehicle))
        .addTo(map.current);
    },
  }));

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      // style: "https://demotiles.maplibre.org/style.json",
      // style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
      // style: "https://tiles.openfreemap.org/styles/liberty",
      style: "https://tiles.openfreemap.org/styles/positron",
      // TODO: default to user's current location
      center: [-0.1278, 51.5074],
      zoom: 10,
    });

    map.current.on("load", () => {
      if (!map.current) return;

      map.current?.addSource("vehicles", {
        type: "geojson",
        data: data,
      });

      const styleLayers = map.current.getStyle().layers;
      const labelLayer = styleLayers.find((l) => l.id.includes("label"))?.id;

      map.current?.addLayer(
        {
          id: "vehicle-layer",
          type: "circle",
          source: "vehicles",
          paint: {
            "circle-radius": 8,
            "circle-color": [
              "match",
              ["get", "status"],
              "active",
              "#10b981",
              "delayed",
              "#ef4444",
              "#6b7280",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        },
        labelLayer,
      );

      map.current.on("click", "vehicle-layer", (e) => {
        if (!e.features?.length) return;
        const vehicleProps = e.features[0].properties;
        const coordinates = (e.features[0].geometry as any).coordinates;

        // Call our own imperative handle logic
        (ref as any).current.openPopup({
          ...vehicleProps,
          lng: coordinates[0],
          lat: coordinates[1],
        });
      });

      map.current.on("mouseenter", "vehicle-layer", () => {
        map.current!.getCanvas().style.cursor = "pointer";
      });
      map.current.on("mouseleave", "vehicle-layer", () => {
        map.current!.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const source = map.current?.getSource(
      "vehicles",
    ) as maplibregl.GeoJSONSource;
    if (source) source.setData(data);
  }, [data]);

  // useEffect(() => {
  //   if (navigator.geolocation && map.current) {
  //     navigator.geolocation.getCurrentPosition(
  //       (pos) => {
  //         map.current?.flyTo({
  //           center: [pos.coords.longitude, pos.coords.latitude],
  //           zoom: 10,
  //           speed: 1.2,
  //           curve: 1,
  //           essential: true,
  //         });
  //       },
  //       (err) => console.warn("User denied location access", err),
  //     );
  //   }
  // }, []);

  return (
    <div
      ref={mapContainer}
      className="h-full w-full rounded-xl overflow-hidden shadow-inner"
    />
  );
});

FleetMap.displayName = "FleetMap";
