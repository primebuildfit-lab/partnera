/**
 * @partnera/testing — shared, deterministic test utilities.
 *
 * Everything here is designed to keep tests reproducible: sequential ids, a
 * fixed clock, money constructors, and a generic in-memory repository. Engine
 * packages depend on this only as a devDependency. See TESTING.md.
 */
import { type Brand, Money } from "@partnera/core";

export { FixedClock, InMemoryEventBus } from "@partnera/core";

/** Deterministic, human-readable ids for tests (e.g. "offer_1", "offer_2"). */
export class SequentialIdGenerator {
  private counters = new Map<string, number>();

  next<B extends Brand<string, string>>(prefix = "id"): B {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}_${n}` as unknown as B;
  }
}

export const usd = (major: string): Money => Money.parse(major, "USD");
export const eur = (major: string): Money => Money.parse(major, "EUR");

/** A minimal in-memory repository for wiring engines in tests. */
export class InMemoryRepository<T> {
  private readonly store = new Map<string, T>();

  constructor(private readonly keyOf: (item: T) => string) {}

  put(item: T): void {
    this.store.set(this.keyOf(item), item);
  }

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  all(): T[] {
    return [...this.store.values()];
  }

  clear(): void {
    this.store.clear();
  }
}
