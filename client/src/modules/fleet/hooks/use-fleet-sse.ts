import { SseClient } from "@/shared/infrastructure";
import { throttle } from "@/shared/utils";
import { useEffect, useRef, useState } from "react";
import { FleetSnapshot } from "../types";

export type SseConnectionStatus = "connecting" | "connected" | "error";

interface UseFleetSseResult {
  status: SseConnectionStatus;
}

const THROTTLE_MS = 500;

export const useFleetSSE = (
  onUpdate: (data: FleetSnapshot) => void,
): UseFleetSseResult => {
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState<SseConnectionStatus>("connecting");

  /*
   * Using the onUpdateRef ref below to keep the SSE stream alive while ensuring
   * we still use the most up-to-date version of the update logic. If we put
   * onUpdate in the effect dependencies, the socket would disconnect then
   * reconnect on every parent re-render causing connection losses.
   */
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const throttledUpdate = throttle((data: FleetSnapshot) => {
      onUpdateRef.current(data);
    }, THROTTLE_MS);

    const client = new SseClient("/api/proxy/fleet/stream", () => {
      setStatus("error");

      // exponential backoff
      const delay = Math.min(1000 * 2 ** retryCount, 30_000);

      // retry
      setTimeout(() => {
        setStatus("connecting");
        setRetryCount((c) => c + 1);
      }, delay);
    });

    client.subscribe<FleetSnapshot>("stats-update", (data) => {
      setStatus((prev) => (prev !== "connected" ? "connected" : prev));
      setRetryCount(0);
      throttledUpdate(data);
    });

    return () => {
      client.disconnect();
      throttledUpdate.cancel();
    };
  }, [retryCount]);

  return { status };
};
