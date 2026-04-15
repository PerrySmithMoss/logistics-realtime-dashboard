import http from "node:http";

const PORT = Number(process.env.PORT || 5500);
const encoder = new TextEncoder();

const baseVehicles = [
  {
    id: "VHC-101",
    plateNumber: "VHC-101-PLATE",
    lat: 51.5074,
    lng: -0.1278,
    status: "active",
    lastUpdated: "2026-04-14T08:00:00.000Z",
    isSnapped: true,
  },
  {
    id: "VHC-202",
    plateNumber: "VHC-202-PLATE",
    lat: 51.5081,
    lng: -0.1251,
    status: "delayed",
    lastUpdated: "2026-04-14T08:00:00.000Z",
    isSnapped: true,
  },
  {
    id: "VHC-303",
    plateNumber: "VHC-303-PLATE",
    lat: 51.5094,
    lng: -0.1299,
    status: "active",
    lastUpdated: "2026-04-14T08:00:00.000Z",
    isSnapped: true,
  },
];

let state = {
  vehicles: structuredClone(baseVehicles),
  tickMs: 700,
  interruptFirstStream: false,
  connectionCount: 0,
  unavailableUntil: 0,
};

const clients = new Set();
let tickTimer = null;

const computeSnapshot = () => {
  const delayedCount = state.vehicles.filter(
    (vehicle) => vehicle.status === "delayed",
  ).length;
  const activeCount = state.vehicles.filter(
    (vehicle) => vehicle.status === "active",
  ).length;
  const total = state.vehicles.length;

  return {
    vehicles: state.vehicles,
    summary: {
      total,
      activeCount,
      delayedCount,
      performancePct: total === 0 ? 0 : (activeCount / total) * 100,
    },
  };
};

const writeSseEvent = (res, eventName, payload) => {
  res.write(
    encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`),
  );
};

const closeClient = (client) => {
  if (!clients.has(client)) return;
  clients.delete(client);
  client.res.end();
};

const advanceVehicles = () => {
  state.vehicles = state.vehicles.map((vehicle, index) => ({
    ...vehicle,
    lat: Number((vehicle.lat + 0.0006 + index * 0.0001).toFixed(6)),
    lng: Number((vehicle.lng + 0.0004 + index * 0.0001).toFixed(6)),
    lastUpdated: new Date().toISOString(),
  }));

  const snapshot = computeSnapshot();

  clients.forEach((client) => {
    writeSseEvent(client.res, "stats-update", snapshot);
    client.eventsSent += 1;

    if (
      state.interruptFirstStream &&
      client.connectionIndex === 1 &&
      client.eventsSent >= 2
    ) {
      state.unavailableUntil = Date.now() + 1500;
      closeClient(client);
    }
  });
};

const restartTicker = () => {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(advanceVehicles, state.tickMs);
};

const resetState = () => {
  clients.forEach((client) => closeClient(client));
  state = {
    vehicles: structuredClone(baseVehicles),
    tickMs: 700,
    interruptFirstStream: false,
    connectionCount: 0,
    unavailableUntil: 0,
  };
  restartTicker();
};

const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

restartTicker();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/__admin/reset") {
    resetState();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/__admin/config") {
    const body = await readJsonBody(req);
    state.tickMs = typeof body.tickMs === "number" ? body.tickMs : state.tickMs;
    state.interruptFirstStream = Boolean(body.interruptFirstStream);
    restartTicker();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, state }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/v1/fleet/snapshot") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(computeSnapshot()));
    return;
  }

  if (
    req.method === "GET" &&
    url.pathname.startsWith("/api/v1/fleet/vehicles/")
  ) {
    const vehicleId = url.pathname.split("/").pop();
    const vehicle = state.vehicles.find((item) => item.id === vehicleId);

    if (!vehicle) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Vehicle not found" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(vehicle));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/v1/fleet/stream") {
    if (Date.now() < state.unavailableUntil) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Simulator restarting" }));
      return;
    }

    state.connectionCount += 1;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    res.write(": connected\n\n");

    const client = {
      res,
      eventsSent: 0,
      connectionIndex: state.connectionCount,
    };

    clients.add(client);
    writeSseEvent(res, "stats-update", computeSnapshot());

    req.on("close", () => {
      clients.delete(client);
    });

    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "Not found" }));
});

server.listen(PORT, "127.0.0.1");
