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
import { VehicleMarker } from "./vehicle-marker.component";

interface FleetMapProps {
  data: GeoJSON.FeatureCollection;
}

interface TrackedFleetMapPopup extends maplibregl.Popup {
  _vehicleId?: string;
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

      const popup = new maplibregl.Popup({
        closeButton: false,
        offset: 15,
        className: "custom-fleet-popup",
      })
        .setLngLat([vehicle.lng, vehicle.lat])
        .setHTML(buildPopupHtml(vehicle))
        .addTo(map.current) as TrackedFleetMapPopup;

      // add vehicleId to popup obj so we can track/move it
      popup._vehicleId = vehicle.id;
      activePopup.current = popup;
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
      const mapInstance = map.current;
      if (!mapInstance || !isMapReady.current) return;

      const source = mapInstance.getSource(
        "vehicles",
      ) as maplibregl.GeoJSONSource;
      if (!source) return;

      source.setData(data);

      // update popup position to make sure it follows the vehicle as it moves.
      const currentPopup = activePopup.current;

      if (
        currentPopup &&
        currentPopup.isOpen() &&
        (currentPopup as TrackedFleetMapPopup)._vehicleId
      ) {
        const vehicleId = (currentPopup as TrackedFleetMapPopup)._vehicleId;

        const updatedFeature = data.features.find(
          (f) => f.properties?.id === vehicleId,
        );

        if (updatedFeature && updatedFeature.geometry.type === "Point") {
          const [lng, lat] = updatedFeature.geometry.coordinates;

          currentPopup.setLngLat([lng, lat]);

          currentPopup.setHTML(
            buildPopupHtml(updatedFeature.properties as FleetVehicle),
          );
        }
      }
    }, [data]);

    return (
      <>
        <div
          ref={mapContainer}
          className="h-full w-full rounded-xl overflow-hidden shadow-inner"
        />
        <ul aria-label="Vehicle markers" className="sr-only">
          {data.features.map((feature) => {
            const properties = feature.properties as
              | Pick<FleetVehicle, "id" | "status">
              | undefined;

            if (!properties?.id || !properties.status) return null;

            return (
              <li key={properties.id}>
                <VehicleMarker
                  vehicleId={properties.id}
                  status={properties.status}
                />
              </li>
            );
          })}
        </ul>
        <ul aria-label="Vehicle telemetry" className="sr-only">
          {data.features.map((feature) => {
            const properties = feature.properties as
              | Pick<FleetVehicle, "id" | "status">
              | undefined;

            if (
              !properties?.id ||
              feature.geometry.type !== "Point" ||
              feature.geometry.coordinates.length < 2
            ) {
              return null;
            }

            const [lng, lat] = feature.geometry.coordinates;

            return (
              <li key={`${properties.id}-telemetry`}>
                {properties.id}: {lat.toFixed(4)}, {lng.toFixed(4)}
              </li>
            );
          })}
        </ul>
      </>
    );
  },
);

FleetMap.displayName = "FleetMap";
