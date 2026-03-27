/**
 * Subscription tracker - manages WebSocket client subscriptions
 */

export interface QuerySubscription {
  clientId:     string;
  functionPath: string;
  args:         Record<string, unknown>;
  tables:       string[];
}

class SubscriptionTrackerImpl {
  private _subs = new Map<string, QuerySubscription>();

  subscribe(
    clientId: string,
    functionPath: string,
    args: Record<string, unknown>,
    tables: string[] = ["*"]
  ): void {
    const key = this._makeKey(clientId, functionPath, args);
    this._subs.set(key, { clientId, functionPath, args, tables });
  }

  unsubscribe(clientId: string, functionPath: string, args: Record<string, unknown>): void {
    const key = this._makeKey(clientId, functionPath, args);
    this._subs.delete(key);
  }

  unsubscribeClient(clientId: string): void {
    for (const [key, sub] of this._subs) {
      if (sub.clientId === clientId) {
        this._subs.delete(key);
      }
    }
  }

  getAffectedSubscriptions(table: string): QuerySubscription[] {
    const affected: QuerySubscription[] = [];
    for (const sub of this._subs.values()) {
      if (sub.tables.includes("*") || sub.tables.includes(table)) {
        affected.push(sub);
      }
    }
    return affected;
  }

  /** Count active subscriptions */
  get size(): number { return this._subs.size; }

  /** List unique function paths being subscribed to */
  getActivePaths(): string[] {
    return [...new Set([...this._subs.values()].map(s => s.functionPath))];
  }

  /** All subscriptions for a given client */
  getClientSubscriptions(clientId: string): QuerySubscription[] {
    return [...this._subs.values()].filter(s => s.clientId === clientId);
  }

  /** Debug dump — returns full subscription map */
  dump(): QuerySubscription[] {
    return [...this._subs.values()];
  }

  private _makeKey(clientId: string, functionPath: string, args: Record<string, unknown>): string {
    return `${clientId}:${functionPath}:${JSON.stringify(args)}`;
  }
}

export const subscriptionTracker = new SubscriptionTrackerImpl();
(globalThis as any).__betterbaseSubscriptionTracker = subscriptionTracker;