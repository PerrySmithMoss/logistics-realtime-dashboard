# Real-Time Logistics Fleet Dashboard

A high-performance, full-stack monitoring system designed to track vehicle fleets with sub-second latency. This project solves the challenge of visualising high-frequency GPS data without UI jitter or server-side bottlenecks.

![Image](https://github.com/user-attachments/assets/1ebd8e9b-73bf-4948-9cc2-340d3a6cb1ca)

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

## Getting Started

1. Clone the Repo
2. Setup Server: Go to the /server directory, follow the Server `README.md` file to set up your `.env` file and `OPEN_ROUTE_SERVICE_API_KEY` API key.
3. Setup Client: Go to the /client directory, follow the Client `README.md` file to install dependencies.
4. Run: Start the server first, then the client.
