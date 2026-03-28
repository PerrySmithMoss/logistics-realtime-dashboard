# Logistics Real-Time Dashboard (Backend Core)

## 🏗 Architectural Decisions

1. Modular Monolith & Vertical Slices
   Unlike traditional layered architectures that group all "Controllers" together, this project uses Vertical Slices. Everything related to the Vehicle domain (Logic, Persistence, API) lives in one folder.

Benefit: High cohesion. If we need to move the Vehicle logic to a Microservice later, we can extract the entire folder with minimal friction.

2. CQRS (Command Query Responsibility Segregation)
   I implemented a custom Command Bus and Query Bus to separate state-changing operations from data-retrieval operations.

Commands: Explicitly handle intent (e.g., UpdateLocation). They return void and trigger side effects via an Event Broker.

Queries: Pure data retrieval (e.g., GetFleetStats). They return DTOs directly from the persistence layer, bypassing complex domain logic for maximum performance.

3. Dependency Inversion & Composition Root
   The project follows the Dependency Inversion Principle. High-level modules (Core) do not depend on low-level modules (Infrastructure); both depend on abstractions (Interfaces).

Composition Root (app/container.ts): All dependencies are instantiated and injected here. This makes the system 100% unit-testable by allowing us to swap the InMemoryDatabase for a mock without touching the business logic. While currently using an InMemoryDatabase for rapid prototyping and zero-config setup, the repository pattern ensures that swapping to PostgreSQL or MongoDB requires zero changes to the core domain logic.

4. Type-Safe Module Augmentation
   To solve the "any" problem in generic buses, I utilized TypeScript Module Augmentation. This allows each module to "register" its commands and queries into a global registry, providing full IDE autocompletion and compile-time safety when dispatching messages. When a module is added, it registers its types globally:

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

## Performance & Scalability Considerations

Preventing UI "Jitter". In high-frequency update scenarios (e.g., coordinates every 100ms), I've architected the backend to support:

- Throttling at the Edge: The Event Broker can be extended to buffer updates before broadcasting.
- Snapshotting: Entities provide a toSnapshot() method, ensuring the UI receives flat, stable JSON rather than complex class instances that might trigger unnecessary re-renders.

- Zero-Library Philosophy
  This implementation uses zero external frameworks (aside from Express and zod). Every architectural component—from the Command Bus to the Dependency Injection container—is written in pure TypeScript to demonstrate a deep understanding of design patterns over library-specific "magic".

### System Flow

Request -> Express Router -> Command Bus -> Command Handler -> Domain Entity -> Repository -> Event Broker -> UI

## Constraints & Trade-offs

In-Memory Persistence: Chosen to demonstrate the Repository Pattern's ability to abstract data-access. The system is designed to be "DB-Agnostic."

Custom Bus over Libraries: Implemented to prove deep knowledge of Generic Types and Module Augmentation. While NestJS or MediatR provide these out of the box, this implementation ensures zero "magic" and full transparency.

Synchronous Event Broker: Currently executes events in-process for simplicity. The interface is designed to be swapped for actual message broker (RabbitMQ, Kafka, Redis Pub/Sub etc.) without changing the Core Domain.
