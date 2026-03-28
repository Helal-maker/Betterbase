import { subscriptionTracker } from "./subscription-tracker";

export interface TableChangeEvent {
  table:  string;
  type:   "INSERT" | "UPDATE" | "DELETE";
  id:     string;
}

export interface InvalidationMessage {
  type:          "invalidate";
  functionPath:  string;
  args:          Record<string, unknown>;
  tables:        string[];   // which tables changed (for client-side filtering)
}

type PushFn = (clientId: string, message: InvalidationMessage) => void;

class InvalidationManager {
  private _push:    PushFn | null = null;
  private _pending: Map<string, Set<string>> = new Map();
  // key: `${clientId}:${functionPath}:${argsHash}` → Set<table>
  private _flushTimer: ReturnType<typeof queueMicrotask> | null = null;

  setPushFn(fn: PushFn) { this._push = fn; }

  emitTableChange(event: TableChangeEvent) {
    if (!this._push) return;

    const affected = subscriptionTracker.getAffectedSubscriptions(event.table);
    for (const sub of affected) {
      const key = `${sub.clientId}:${sub.functionPath}:${JSON.stringify(sub.args)}`;
      if (!this._pending.has(key)) {
        this._pending.set(key, new Set());
      }
      this._pending.get(key)!.add(event.table);
    }

    // Flush on next tick — batches all changes from the same mutation
    // Use queueMicrotask instead of setImmediate (Bun compatibility)
    if (!this._flushTimer) {
      this._flushTimer = queueMicrotask(() => this._flush());
    }
  }

  private _flush() {
    this._flushTimer = null;
    if (!this._push) return;

    for (const [key, tables] of this._pending) {
      const [clientId, functionPath, ...rest] = key.split(":");
      // argsJson may contain colons — re-join
      const argsJson = rest.join(":");
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(argsJson); } catch {}

      this._push(clientId, {
        type:         "invalidate",
        functionPath,
        args,
        tables:       [...tables],
      });
    }

    this._pending.clear();
  }

  getStats() {
    // Stats now provided by ws.ts via getWSStats()
    return { clients: 0, channels: [] };
  }
}

export const invalidationManager = new InvalidationManager();
(globalThis as any).__betterbaseRealtimeManager = invalidationManager;