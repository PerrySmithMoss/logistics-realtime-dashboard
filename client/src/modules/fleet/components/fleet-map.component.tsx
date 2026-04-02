"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { FLEET_MAP_ICON_COLORS } from "../constants";
import { buildPopupHtml, loadVehicleIcon } from "../lib/fleet-map.utils";
import { FleetMapHandle, FleetVehicle } from "../types";

interface FleetMapProps {
  data: GeoJSON.FeatureCollection;
}

export const FleetMap = forwardRef<FleetMapHandle, FleetMapProps>(
  ({ data }, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const activePopup = useRef<maplibregl.Popup | null>(null);
    const isMapReady = useRef(false);

    const openPopup = useCallback((vehicle: FleetVehicle) => {
      if (!map.current || !isMapReady.current) return;

      activePopup.current?.remove();
      activePopup.current = new maplibregl.Popup({
        closeButton: false,
        offset: 15,
        className: "custom-fleet-popup",
      })
        .setLngLat([vehicle.lng, vehicle.lat])
        .setHTML(buildPopupHtml(vehicle))
        .addTo(map.current);
    }, []);

    useImperativeHandle(
      ref,
      (): FleetMapHandle => ({
        zoomToVehicle: (lng, lat) => {
          if (!map.current?.isStyleLoaded()) return;

          map.current?.flyTo({
            center: [lng, lat],
            zoom: 16,
            speed: 1.2,
            curve: 1.42,
            essential: true,
          });
        },
        openPopup,
      }),
    );

    useEffect(() => {
      if (map.current || !mapContainer.current) return;

      const mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [-0.1278, 51.5074],
        zoom: 12,
      });

      mapInstance.on("load", async () => {
        const [activeImg, delayedImg] = await Promise.all([
          loadVehicleIcon(FLEET_MAP_ICON_COLORS.active),
          loadVehicleIcon(FLEET_MAP_ICON_COLORS.delayed),
        ]);

        mapInstance.addImage("marker-active", activeImg);
        mapInstance.addImage("marker-delayed", delayedImg);

        mapInstance.addSource("vehicles", {
          type: "geojson",
          data: data,
        });

        mapInstance.addLayer({
          id: "vehicle-layer",
          type: "symbol",
          source: "vehicles",
          layout: {
            "icon-image": [
              "match",
              ["get", "status"],
              "delayed",
              "marker-delayed",
              "marker-active",
            ],
            "icon-size": 0.35,
            "icon-allow-overlap": true,
            "icon-anchor": "bottom",
          },
        });

        mapInstance.on("click", "vehicle-layer", (e) => {
          if (!e.features?.length) return;

          const props = e.features[0].properties as FleetVehicle;
          const geometry = e.features[0].geometry as GeoJSON.Point;

          const [lng, lat] = geometry.coordinates;

          openPopup({ ...props, lng, lat });
        });

        mapInstance.on("mouseenter", "vehicle-layer", () => {
          mapInstance.getCanvas().style.cursor = "pointer";
        });
        mapInstance.on("mouseleave", "vehicle-layer", () => {
          mapInstance.getCanvas().style.cursor = "";
        });

        isMapReady.current = true;
        map.current = mapInstance;
      });

      return () => {
        mapInstance.remove();
        map.current = null;
      };

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // live fleet data updates
    useEffect(() => {
      const source = map.current?.getSource("vehicles") as
        | maplibregl.GeoJSONSource
        | undefined;

      if (source && isMapReady.current) {
        source.setData(data);
      }
    }, [data]);

    return (
      <div
        ref={mapContainer}
        className="h-full w-full rounded-xl overflow-hidden shadow-inner"
      />
    );
  },
);

FleetMap.displayName = "FleetMap";
