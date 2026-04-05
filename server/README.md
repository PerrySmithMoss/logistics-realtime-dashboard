# Logistics Real-Time Dashboard (Backend)

## Architectural Decisions

Modular monolith over microservices
I opted for a Modular Monolith using Vertical Slices. Instead of grouping by technical role (all controllers in one folder, all models in another), everything for the Vehicle domain—logic, persistence, and API—lives together.

- **The rationale**: at this scale, microservices add unnecessary network latency and "distributed system tax." By keeping high cohesion within the folder, we maintain the ability to "snap off" the Vehicle module into a standalone microservice later with almost zero refactoring, but without the overhead today.

### **CQRS (Command Query Responsibility Segregation)**

I implemented a custom Command Bus and Query Bus to strictly decouple state changes from data retrieval.

- **Commands**: Handle intent (e.g., UpdateLocation). They are fire-and-forget, returning void and triggering side effects via an Event Broker.
- **Queries**: Pure data retrieval. They return DTOs directly from the projection layer, bypassing domain logic to keep the "Read" side as fast as possible.

### Dependency Inversion & Strategic Minimalism

The project follows DIP (Dependency Inversion Principle). High-level business rules don't depend on low-level tools; they both depend on interfaces.

**The 2GB VPS** Constraint: I deliberately avoided heavy external infra like Redis, RabbitMQ, or Postgres. On a low-RAM VPS, every megabyte matters.

- I wrote a custom In-Memory Bus and Repository to keep the RSS footprint under 50MB.
- The architecture is Infrastructure agnostic. Because we use the Repository and Adapter patterns, swapping the In-Memory store for PostgreSQL or moving the Event Broker to Redis Pub/Sub is a one-line change in the AppContainer.

### Type-Safe Module Augmentation

To solve the `any` problem common in generic buses, I used **TypeScript Module Augmentation**. This allows modules to "register" their own commands and queries into a global registry. This gives us full IDE autocompletion and compile-time safety without a massive, bloated central switch statement.

```typescript
declare module "@shared/bus/command-registry" {
  interface CommandRegistry {
    "update-location": {
      command: UpdateVehicleLocationCommand;
      result: void;
    };
  }
}
```

---

## Performance & API Resilience

### Adaptive Geo-Snapping (The "Quota Saver")

Real-time GPS data is noisy and expensive to process. To handle high-frequency updates (100ms+) without melting the CPU or burning through API credits, I implemented:

- **Spatial debouncing**: We only hit the snapping API if the vehicle has moved >10 meters from its last known snapped position. This filters out "GPS jitter" and stationary idling.
- **Buffered Batching**: Instead of an HTTP request per ping, we buffer updates and send a single Batch POST to OpenRouteService every 500ms. This reduces network overhead by nearly 90%.

### Graceful Degradation & Lifecycle

Real-time systems are notorious for memory leaks and hanging processes.

- I implemented a central LifecycleManager to handle SIGTERM.
- It ensures all SSE connections are closed, background timers are cleared, and hydration AbortControllers are triggered. This ensures the 2GB VPS remains stable even after multiple deployments.

### Caching Strategy

To maintain high availability on resource-constrained environments (2G VPS), the system implements a custom **In-Memory Cache** layer. This serves as the high-performance backbone for temporary state management.

**The Strategy: Interface-First Design**

The architecture utilizes a decoupled `ICache` interface, ensuring the business logic remains agnostic of the underlying storage. While the current implementation leverages a native `Map`, it implements a `ICache` interface which can be swapped out for any caching system (e.g. Redis), allowing for a seamless transition to distributed caching if horizontal scaling is required.

**Optimisation: In-Memory vs. Distributed Caching**

For a single-node deployment, an In-Memory strategy was chosen over a distributed store (like Redis) for three critical reasons:

1. **Zero Latency**: Eliminates TCP/Unix socket overhead, providing sub-microsecond lookups by staying within the Node.js memory heap.

2. **RAM Preservation**: Saves ~150MB+ of resident memory by avoiding a separate Redis process—a 7.5% total memory saving on a 2GB VPS.

3. **Type Safety**: Uses TypeScript Generics to enforce strict typing for cached objects, from simple counters to complex ClientState shapes.

#### Why This Approach?

- **Proactive Reclamation**: Prevents Map Bloat via a dual-cleanup strategy: passive expiration (on-access) and a proactive background sweeper that prunes stale keys every 60 seconds.
- **Atomic Primitives**: Provides `increment` and `decrement` methods to handle high-concurrency counters safely, preventing the race conditions common in "get-then-set" patterns.

### Rate Limiting

Stability is enforced through a specialised rate-limiting strategy that protects the server from both API abuse and reconnection storms.

#### Global API Throttling

A standard **fixed window** middleware protects REST endpoints. This prevents brute-force attempts and ensures that background tasks (like Fleet Hydration) are never starved of CPU cycles by rogue API consumers.

#### The SSE Shield (Concurrency Guard)

Server-Sent Events (SSE) keep connections open indefinitely, which can quickly exhaust the Node.js socket pool. The **SSE Shield** implements a strict concurrency policy:

- **IP-Based & Path-Aware Tracking**: Limits the number of active concurrent streams per IP, scoped to specific endpoints (e.g., a user can stream the Map and Alerts simultaneously without hitting a global cap).
- **Connection Draining**: Automatically decrements counters and cleans up state via Node.js `res.on('close')` events, ensuring the cache stays lean even during unexpected client disconnects.
- **Payload Protection**: Prevents a single user from opening excessive dashboard tabs and multiplying the server-side broadcasting/simulation load.

#### Shared State Persistence

Both layers consume the unified `ICache` instance. This shared "Source of Truth" allows the system to identify an IP's behaviour across different protocols (REST vs. SSE), providing a holistic view of client demand and preventing resource exhaustion on the 2GB VPS.

---

## System Flow

**Write Side**: `Request -> Command Bus -> Handler -> Domain Logic -> Batch Buffer -> Snapping Adapter -> Projection`

**Read Side**: `Query Bus -> Projection Snapshot -> Express Response`

**Real-Time Side**: `Event Reactor -> Event Broker -> SSE Stream -> UI`

---

## Developer Tools

### The Fleet Simulator

To demonstrate the real-time reactive capabilities of the dashboard without needing a live GPS hardware integration, I built a custom **Fleet Simulator**.

This isn't just a simple loop, it integrates directly into the application's command bus.

#### How it Works

The simulator follows a **Reactive Activation** pattern. To save CPU cycles and API quota, it remains dormant until the `FleetObserverService` detects an active SSE (Server-Sent Events) connection.

1. **Wake-up:** As soon as you open the browser dashboard, the simulator "wakes up."
2. **Telemetry Generation:** It generates `UpdateVehicleLocationCommand` intents for the seeded fleet.
3. **Chaos Engine:** It randomly fluctuates vehicle statuses (e.g., flipping a vehicle to `delayed`) to verify that the frontend's "Red Highlight" logic and the backend's aggregate statistics update correctly.
4. **Watchdog Shutdown:** If you close the dashboard, a 30-second watchdog timer triggers, automatically shutting down the simulator to prevent "ghost" API calls to OpenRouteService.

#### Customizing the "Fluidity" (Turbo Mode)

If you want to see the dashboard updating at high-frequency (sub-second latency), you can tune the following constants in the source code.

| Component      | File                   | Variable            | Default  | Impact                                           |
| :------------- | :--------------------- | :------------------ | :------- | :----------------------------------------------- |
| **Generator**  | `FleetSimulator.ts`    | `setInterval`       | `5000ms` | How often a vehicle "ticks" and moves.           |
| **Processor**  | `FleetDataService.ts`  | `BATCH_INTERVAL_MS` | `500ms`  | The window for batching geo-snapping API calls.  |
| **Dispatcher** | `FleetEventReactor.ts` | `TICK_RATE`         | `500ms`  | How often the system broadcasts state to the UI. |

> **Note:** For the most "fluid" visual experience in a demo, set the Simulator to `1000ms` and the Batch/Tick rates to `200ms`. This creates a high-density data stream that demonstrates the efficiency of the memoized React components on the frontend.

---

## Trade-offs & Future Scaling

- Synchronous Broker: Currently, events execute in-process. If we needed to scale to multiple backend instances, we would simply replace the internal Broker with a Redis/PubSub implementation so all nodes stay in sync.
- Zero-library philosophy: aside from express and zod, every core component like the Bus, the DI container, in memory db and cache and the snapping logic—is hand-coded. This was a conscious choice to demonstrate a deep understanding of design patterns over relying on framework/library magic, plus it makes it cheaper for my tiny VPS :D.
