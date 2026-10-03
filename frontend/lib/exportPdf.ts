import { apiGet } from "@/lib/api";
import { saveBase64File } from "@/lib/local/files";
import type { Trade } from "@/lib/types";

/** Builds a trade-list PDF entirely on-device (jsPDF) and saves/shares it. */
export async function exportTradesPdf(accountId: string, range: { from?: string; to?: string }): Promise<void> {
  const params = new URLSearchParams({ account_id: accountId, sort: "asc", page: "1", page_size: "1000000" });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const trades = await apiGet<Trade[]>(`/trades?${params.toString()}`);

  // Loaded lazily so the PDF library isn't part of the initial bundle.
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Trading journal", 14, 14);
  doc.setFontSize(9);
  const closed = trades.filter((t) => t.pnl !== null);
  const net = closed.reduce((a, t) => a + (t.pnl as number), 0);
  doc.text(
    `${trades.length} trades · ${closed.length} closed · net P/L ${net.toFixed(2)} · generated ${new Date().toLocaleDateString()}`,
    14, 20
  );

  autoTable(doc, {
    startY: 25,
    styles: { fontSize: 8 },
    head: [["Date", "Pair", "Dir", "Entry", "Exit", "Lots", "Pips", "P/L", "R", "Session", "Setup"]],
    body: trades.map((t) => [
      new Date(t.entry_time).toLocaleString(),
      t.pair,
      t.direction,
      t.entry_price,
      t.exit_price ?? "",
      t.lot_size,
      t.pips ?? "",
      t.pnl === null ? "" : `${t.pnl.toFixed(2)}${t.pnl_unconverted ? "*" : ""}`,
      t.r_multiple ?? "",
      t.session ?? "",
      t.setup_tag ?? "",
    ]),
  });
  if (trades.some((t) => t.pnl_unconverted)) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFontSize(8);
    doc.text("* P/L is in the pair's quote currency (no conversion rate was entered).", 14, y);
  }

  const base64 = doc.output("datauristring").split(",")[1];
  await saveBase64File("trades.pdf", base64, "application/pdf");
}
