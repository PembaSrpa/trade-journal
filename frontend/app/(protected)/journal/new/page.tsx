"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { submitTradeWithOfflineFallback } from "@/lib/offlineSync";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAccountContext } from "@/lib/AccountContext";
import { isCombinedSelection } from "@/lib/accountSelection";
import { clearCacheByPrefix } from "@/lib/dataCache";
import { TradeForm } from "@/components/TradeForm";

export default function NewTradePage() {
  const router = useRouter();
  const { selectedAccountId, triggerSync } = useAccountContext();
  const confirmDialog = useConfirm();

  if (!selectedAccountId || isCombinedSelection(selectedAccountId)) {
    return (
      <p className="text-text-secondary text-sm">
        Select a specific account before adding a trade.
      </p>
    );
  }

  async function handleSubmit(payload: Record<string, unknown>) {
    const result = await submitTradeWithOfflineFallback(payload);
    if (!result.synced) {
      await confirmDialog({
        title: "Saved offline",
        description: "No connection — this trade will sync automatically once you're back online.",
        confirmLabel: "OK",
        alertOnly: true,
      });
    }
    // Wipe cached journal lists and stats so the next view picks up the new
    // entry right away instead of showing a stale list until a manual sync.
    await clearCacheByPrefix("trades:");
    await clearCacheByPrefix("stats:");
    triggerSync();
    router.push("/journal");
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/journal">
          <button className="w-9 h-9 p-0 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
        </Link>
        <p className="text-xl font-medium tracking-tight">New trade entry</p>
      </div>
      <TradeForm accountId={selectedAccountId} onSubmit={handleSubmit} submitLabel="Save entry" />
    </div>
  );
}
