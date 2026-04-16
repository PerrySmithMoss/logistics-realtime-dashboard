# Real-Time Logistics Fleet Dashboard

A high performance, full stack monitoring system designed to track vehicle fleets with sub second latency. This project solves the challenge of visualising high frequency GPS data without UI jitter or server side bottlenecks.

![Image](https://github.com/user-attachments/assets/cb9e9193-f428-445e-8e59-3493f040968f)

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

[Client (Frontend)](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/tree/main/client): A React-based dashboard using MapLibreGL and custom hooks for SSE state management. See the `/client` [README.md](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/blob/main/client/README.md) for details on the rendering optimization and UI architecture.

[Server (Backend)](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/tree/main/server): A Node.js Modular Monolith using CQRS and Event-Driven architecture. See the `/server` [README.md](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/blob/main/server/README.md) for details on the reactive data pipeline, dependency injection, and test-harness setup.

## Getting Started

1. Clone the repo
2. Setup server: go to the /server directory, follow the `/server` [README.md](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/blob/main/server/README.md) file to set up your `.env` file and `OPEN_ROUTE_SERVICE_API_KEY` API key.
3. Setup client: go to the /client directory, follow the `/client` [README.md](https://github.com/PerrySmithMoss/logistics-realtime-dashboard/blob/main/client/README.md) file to install dependencies.
4. Run: start the server first, then the client.
