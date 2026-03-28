import { SseClient } from "@/shared/infrastructure/sse-client";
import { throttle } from "@/shared/utils/throttle.util";
import { useEffect, useReducer, useRef } from "react";

export const useFleetSSE = (onUpdate: (data: any) => void) => {
  const [reconnectAttempt, triggerReconnect] = useReducer((s) => s + 1, 0);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const throttledUpdate = throttle((data: any) => {
      onUpdateRef.current?.(data);
    }, 500);

    const client = new SseClient("/api/proxy/fleet/stream", () => {
      console.log("Scheduling reconnect in 3s...");
      setTimeout(() => {
        triggerReconnect(); // Call the reducer dispatch
      }, 3000);
    });

    client.subscribe("stats-update", (data: any) => {
      throttledUpdate(data);
    });

    return () => {
      client.disconnect();
      throttledUpdate.cancel();
    };
  }, [reconnectAttempt]);
};
