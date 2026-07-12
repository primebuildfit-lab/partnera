import { type TenantId } from "./tenant";

/**
 * The event backbone. Engines are decoupled — they react to domain events
 * rather than calling each other directly (e.g. the Commission Engine listens
 * for `conversion.recorded`). This interface is deliberately transport-agnostic;
 * the build phase picks the concrete bus (in-process, queue, log).
 */
export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  readonly id: string;
  readonly name: TName;
  readonly occurredAt: Date;
  readonly tenantId: TenantId | null;
  /** Correlation id linking events produced within one logical operation. */
  readonly correlationId: string;
  readonly payload: TPayload;
}

export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => void | Promise<void>;

export interface EventBus {
  publish<E extends DomainEvent>(event: E): Promise<void>;
  subscribe<E extends DomainEvent>(name: E["name"], handler: EventHandler<E>): Unsubscribe;
}

export type Unsubscribe = () => void;

/**
 * In-process reference bus. Adequate for tests and the earliest build phase;
 * swappable for a durable/queue-backed bus later without touching engine code.
 * Handlers run sequentially; a throwing handler does not prevent the others.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  readonly errors: unknown[] = [];

  async publish<E extends DomainEvent>(event: E): Promise<void> {
    const set = this.handlers.get(event.name);
    if (!set) return;
    for (const handler of set) {
      try {
        await handler(event as DomainEvent);
      } catch (error) {
        this.errors.push(error);
      }
    }
  }

  subscribe<E extends DomainEvent>(name: E["name"], handler: EventHandler<E>): Unsubscribe {
    const set = this.handlers.get(name) ?? new Set<EventHandler>();
    set.add(handler as EventHandler);
    this.handlers.set(name, set);
    return () => set.delete(handler as EventHandler);
  }
}
