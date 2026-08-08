import { Preferences } from "@capacitor/preferences";
import { Network } from "@capacitor/network";
import { apiPost } from "@/lib/api";
import type { Trade } from "@/lib/types";

const QUEUE_KEY = "pending_trade_writes";

interface QueuedTrade {
  localId: string;
  payload: Record<string, unknown>;
  queuedAt: string;
}

async function readQueue(): Promise<QueuedTrade[]> {
  const result = await Preferences.get({ key: QUEUE_KEY });
  return result.value ? JSON.parse(result.value) : [];
}

async function writeQueue(queue: QueuedTrade[]): Promise<void> {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
}

export async function queueTradeWrite(payload: Record<string, unknown>): Promise<string> {
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const queue = await readQueue();
  queue.push({ localId, payload, queuedAt: new Date().toISOString() });
  await writeQueue(queue);
  return localId;
}

export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function flushQueue(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const remaining: QueuedTrade[] = [];

  for (const item of queue) {
    try {
      await apiPost<Trade>("/trades", item.payload);
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
}

export function startSyncListener(): () => void {
  const listener = Network.addListener("networkStatusChange", (status) => {
    if (status.connected) {
      flushQueue();
    }
  });

  flushQueue();

  return () => {
    listener.then((l) => l.remove());
  };
}

export async function submitTradeWithOfflineFallback(
  payload: Record<string, unknown>
): Promise<{ synced: boolean }> {
  const status = await Network.getStatus();

  if (!status.connected) {
    await queueTradeWrite(payload);
    return { synced: false };
  }

  try {
    await apiPost<Trade>("/trades", payload);
    return { synced: true };
  } catch {
    await queueTradeWrite(payload);
    return { synced: false };
  }
}
