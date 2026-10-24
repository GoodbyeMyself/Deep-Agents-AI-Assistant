import type { InMemoryAgentStore } from "./store.js";

/** Storage operations may be synchronous in tests or commit asynchronously in PostgreSQL. */
type AwaitableMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R extends AsyncGenerator<unknown> ? R : R | Promise<R>
    : T[K];
};

export type AgentStore = AwaitableMethods<InMemoryAgentStore>;
