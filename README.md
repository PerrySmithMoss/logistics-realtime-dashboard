# Real-Time Logistics Fleet Dashboard

A high performance, full stack monitoring system designed to track vehicle fleets with sub second latency. This project solves the challenge of visualising high frequency GPS data without UI jitter or server side bottlenecks.

![Image](https://github.com/user-attachments/assets/10007eb6-929f-4b9c-8f95-54ea610d4b81)

## The Challenge

Managing a live fleet requires processing a constant stream of "noisy" GPS coordinates. A naive implementation leads to:

1. Frontend Jitter: Constant re-renders that freeze the UI.
2. API Exhaustion: Sending a request for every single coordinate ping.
3. Data Staleness: Lag between a vehicle moving and the dashboard reflecting its status.

## The Solution

This project implements a Reactive Pipeline that handles raw data at the edge and projects it into a stable UI state.

Key Features

- Smooth Motion: Uses a combination of throttling on the backend and memoized components on the frontend to ensure the map remains fluid.
- Smart Highlighting: Instant visual feedback (Red highlight) for delayed vehicles, driven by a dedicated status-change event stream.
- Fleet Analytics: Real-time aggregation of fleet-wide statistics (e.g., % of fleet active) without querying a database on every update.

## Tech Stack

- Frontend: React (Hooks/Context), MapLibreGL for geospatial rendering.
- Backend: Node.js, Express, Server-Sent Events (SSE) for real-time pushing.
- Architecture: CQRS, Adapter Pattern (for Geo-services), Vertical Slices, Event Broker, Dependency Inversion and Dependency Injection.

## Repository Structure

This is a monorepo-style project divided into two main concerns:

[Client (Frontend)](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/tree/main/apps/client): A React-based dashboard using MapLibreGL and custom hooks for SSE state management. See the `/apps/client` [README.md](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/blob/main/apps/client/README.md) for details on the rendering optimization and UI architecture.

[Server (Backend)](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/tree/main/apps/server): A Node.js Modular Monolith using CQRS and Event-Driven architecture. See the `/apps/server` [README.md](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/blob/main/apps/server/README.md) for details on the reactive data pipeline, dependency injection, and test-harness setup.

## Getting Started

1. Copy `apps/server/.env.example` and `apps/client/.env.example` to `.env.local` in their respective directories.
2. Generate three secrets with `openssl rand -hex 32`. Use one for `INTERNAL_AUTH_SECRET` on the server and `FLEET_API_INTERNAL_KEY` on the client, one for `FLEET_STREAM_SIGNING_SECRET` on both, and one for `SESSION_SIGNING_SECRET` on the client.
3. Set `OPEN_ROUTE_SERVICE_API_KEY` in `apps/server/.env.local` to enable road snapping. With no key, the local simulator uses raw coordinates. [OpenRouteService signup](https://openrouteservice.org/dev/#/signup)
4. Run `docker compose up --build` and open `http://localhost:3000`. For local development with Node.js 26.13.0 and the pnpm version in `package.json`, run `pnpm install --frozen-lockfile` and `pnpm dev` from the repository root.

To publish the local dashboard on another port, set `FLEET_CLIENT_PORT` when running Compose and add the dashboard origin to `CORS_ALLOWED_ORIGINS` in `apps/server/.env.local`.

### VPS API releases

The API workflow deploys an immutable image through its own restricted SSH
account and the `VPS Production` environment. It cannot apply the Docker stack
from this repository. An administrator owns the existing Swarm service
configuration. See the
[portfolio release runbook](https://github.com/PerrySmithMoss/perry-infra/blob/main/deploy/portfolio/README.md)
for installation, production checks and rollback by digest and revision.

The API defaults to trusting one forwarding hop in production, where Traefik
is the only ingress to the service. Direct deployments should set
`TRUST_PROXY_HOPS=0`.
