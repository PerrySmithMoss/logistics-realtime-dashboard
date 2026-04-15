# Logistics Real-Time Dashboard (Frontend Core)

## Architectural Decisions

### Domain-Driven Modular Directory

Following the backend's "Vertical Slice" strategy, the frontend is organised into **Domain Modules** (e.g., `modules/fleet`).

- **The Rationale**: Components, hooks, and services that change together, stay together. This avoids the "folder jumping" typical in many React projects.
- **Scalability**: By keeping the shared infrastructure (loggers, SSE clients) strictly separated from the fleet business logic, we can scale the UI by adding new modules without bloating the core bundle.

### Handling the SSE connection

Instead of expensive WebSockets or lazy polling, I went with a custom SSE wrapper. I built it specifically to be VPS-friendly. It handles its own reconnections with exponential backoff and most importantly, it’s strict about cleanup. When you close the tab or unmount the dashboard, the listeners are nuked immediately to prevent memory leaks on my 2GB server."

- **Auto-Reconnection**: Leverages the browser's native exponential backoff while maintaining a Map of active listeners to prevent duplicate event attachment.
- **Resource Cleanup**: A strict lifecycle management system ensures that when a component unmounts, the SSE stream and associated listeners are destroyed, preventing memory leaks on long-running dashboard sessions.

### Decoupled State & Identity (ref-hook strategy)

Real-time updates can be a nightmare for React’s rendering lifecycle. If you put your SSE logic directly in a standard `useEffect`, every time a parent component re-renders, the effect re-runs, and your connection drops and reconnects, creating a reconnection storm.

I solved this using a Ref-Logic Pattern:

- **Persistent Connection**: The SSE socket is initialised once. I store the data handling logic in a `useRef`. This means the stream stays stable and never drops, even if the UI components around it are shifting or re-rendering.

- **Throttled Heartbeat**: Backend systems can be chatty. To prevent the UI from trying to render 50 times a second (which just kills the main thread), I tucked a `throttle` utility into the hook. It buffers incoming pings and only updates the React state every **500ms**. It's fast enough to feel live to a human, but slow enough to keep the map animations smooth.

---

## Performance & Resilience

**Error Isolation**

The map engine is the most resource-intensive and fragile part of the UI.

- `FleetMapErrorBoundary`: I implemented a specialised Error Boundary that wraps only the map engine. If WebGL crashes or a JS chunk fails to load, the dashboard stats and search components remain fully interactive.

- **Chunk Recovery**: The boundary detects loading chunk errors (common during new deployments) and triggers a `window.location.reload()` to silently fetch the latest assets for the user.

### Perceptual Performance & Search

- **Debounced Interaction**: The `MapSearch` component uses a `150ms` debounce, targeting a sweet spot between fast updates and human perception. This avoids triggering heavy GeoJSON filtering on every single keystroke.

- **State Adjustment during Render**: To keep the keyboard navigation snappy, the `activeIndex` is synchronised during the render phase rather than in a `useEffect`, eliminating cascading renders and visual flicker.

---

## System Flow

**Data Ingest**: `SSE Stream -> useFleetSSE Hook (Throttle) -> State Update -> useMemo (GeoJSON Transform)`

**Interaction**: `Search Input -> Debounce -> Suggestions List -> onSearch Callback -> Map Imperative Handle (Zoom/Popup)`

**Resilience**: `Map Crash -> Error Boundary -> Localised Fallback UI -> User Reset`

---

## Infrastructure & DX

**Isomorphic Logging System**

To match the backend's observability, I built a dual-channel logging system:

- **Development**: Rich, colorful console output with metadata expansion.

- **Production**: High-priority errors only (Critical/Error), ensuring we catch map crashes in the wild without polluting the user's console or wasting memory.

---

## Trade-offs & Strategic Minimalism

- **Global State vs. Local Props**: I opted against Redux or Zustand. For this vertical slice, React's `useState` combined with a `Promise` (via the `use` hook) provides sufficient state management with zero library overhead.

- **Imperative Map Bridge**: While React is declarative, Map engines are imperative. I used `useImperativeHandle` to create a clean, type-safe bridge that allows the Dashboard to control the Map without exposing the underlying Map instance to the whole app.
