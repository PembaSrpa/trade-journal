"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { useAccountContext } from "@/lib/AccountContext";
import { clearCache, clearCacheByPrefix } from "@/lib/dataCache";
import { TradeForm } from "@/components/TradeForm";
import { TradeFormSkeleton } from "@/components/skeletons/TradeFormSkeleton";
import type { Trade } from "@/lib/types";

export default function EditTradePage() {
  return (
    <Suspense fallback={<TradeFormSkeleton />}>
      <EditTradeInner />
    </Suspense>
  );
}

function EditTradeInner() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { triggerSync } = useAccountContext();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiGet<Trade>(`/trades/${id}`)
      .then(setTrade)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(payload: Record<string, unknown>) {
    if (!id) return;
    await apiPatch<Trade>(`/trades/${id}`, payload);
    // Invalidate any cached journal lists/stats/detail view so the change
    // shows up immediately instead of waiting for the next manual sync.
    await clearCacheByPrefix("trades:");
    await clearCacheByPrefix("stats:");
    await clearCache(`trade:${id}`);
    triggerSync();
    router.push(`/journal/trade?id=${id}`);
  }

  if (!trade && !loading) return <p className="text-text-secondary text-sm">Trade not found.</p>;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href={loading ? "/journal" : `/journal/trade?id=${trade!.id}`}>
          <button className="w-9 h-9 p-0 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
        </Link>
        <p className="text-xl font-medium tracking-tight">Edit trade</p>
      </div>
      {loading || !trade ? (
        <TradeFormSkeleton />
      ) : (
        <TradeForm
          accountId={trade.account_id}
          initial={trade}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
        />
      )}
    </div>
  );
}
