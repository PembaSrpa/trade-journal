"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { TradeForm } from "@/components/TradeForm";
import { TradeFormSkeleton } from "@/components/skeletons/TradeFormSkeleton";
import type { Trade } from "@/lib/types";

export default function EditTradePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Trade>(`/trades/${params.id}`)
      .then(setTrade)
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleSubmit(payload: Record<string, unknown>) {
    await apiPatch<Trade>(`/trades/${params.id}`, payload);
    router.push(`/journal/${params.id}`);
  }

  if (!trade && !loading) return <p className="text-text-secondary text-sm">Trade not found.</p>;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href={loading ? "/journal" : `/journal/${trade!.id}`}>
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
