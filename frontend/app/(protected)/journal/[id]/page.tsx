import TradeDetailClient from "./TradeDetailClient";

// `output: "export"` (the Capacitor build) needs every dynamic route to
// declare its params at build time. The real id always comes from the
// client-side router (see TradeDetailClient), so this placeholder just
// gives the static export one shell page to render into ./out; Capacitor
// then does all navigation client-side and reads the actual id at runtime.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function TradeDetailPage() {
  return <TradeDetailClient />;
}
