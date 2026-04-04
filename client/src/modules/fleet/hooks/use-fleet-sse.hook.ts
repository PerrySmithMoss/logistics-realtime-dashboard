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
   * Using the onUpdateRef ref below to keep host a stable ref for the SSE
   * stream, ensuring we still use the most up-to-date version of the update
   * logic, while ensuring the socket doesn't disconnect then
   * reconnect on every parent re-render causing connection losses.
   */
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    let isMounted = true;

    const throttledUpdate = throttle((data: FleetSnapshot) => {
      onUpdateRef.current(data);
    }, THROTTLE_MS);

    const client = new SseClient("/api/proxy/fleet/stream", () => {
      if (!isMounted) return;

      setStatus((prev) => (prev !== "error" ? "error" : prev));

      // exponential backoff
      const delay = Math.min(1000 * 2 ** retryCount, 30_000);

      // retry
      setTimeout(() => {
        if (!isMounted) return;
        setStatus("connecting");
        setRetryCount((c) => c + 1);
      }, delay);
    });

    client.subscribe<FleetSnapshot>("stats-update", (data) => {
      if (!isMounted) return;
      setStatus((prev) => (prev !== "connected" ? "connected" : prev));
      setRetryCount(0);
      throttledUpdate(data);
    });

    return () => {
      isMounted = false;
      client.disconnect();
      throttledUpdate.cancel();
    };
  }, [retryCount]);

  return { status };
};
