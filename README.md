The "Real-Time Dashboard" (State & Performance)
The Task: Build a live-updating dashboard for a logistics company. You are given a WebSocket or a long-polling endpoint that emits vehicle coordinates.

- Frontend: Render a list of vehicles. If a vehicle's status changes to "Delayed," it must highlight in red.
- Backend: Create a Node.js middleware that aggregates these raw coordinates into "Fleet Statistics" (e.g., % of fleet active).
- Senior Focus: How do you prevent the UI from "jittering" or re-rendering unnecessarily with high-frequency updates? (Memoization, useMemo, or throttling).
