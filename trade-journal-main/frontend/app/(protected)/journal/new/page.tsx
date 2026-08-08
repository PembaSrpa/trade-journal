"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { submitTradeWithOfflineFallback } from "@/lib/offlineSync";
import { useAccountContext } from "@/lib/AccountContext";
import { isCombinedSelection } from "@/lib/accountSelection";
import { TradeForm } from "@/components/TradeForm";

export default function NewTradePage() {
  const router = useRouter();
  const { selectedAccountId } = useAccountContext();

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
      alert("No connection — trade saved locally and will sync automatically once you're back online.");
    }
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
