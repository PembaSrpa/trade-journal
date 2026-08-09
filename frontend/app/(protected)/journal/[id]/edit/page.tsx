import EditTradeClient from "./EditTradeClient";

// See app/(protected)/journal/[id]/page.tsx for why this placeholder exists.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function EditTradePage() {
  return <EditTradeClient />;
}
