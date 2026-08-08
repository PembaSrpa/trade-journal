"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface NewsArticle {
  headline: string;
  source: string;
  datetime: number;
  url: string;
}

// Finnhub's /news endpoint supports these market-news categories.
const CATEGORIES = ["general", "forex", "crypto", "merger"];
const PAIRS = [
  "",
  // Majors
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "USD/CAD", "AUD/USD", "NZD/USD",
  // EUR crosses
  "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD", "EUR/NZD", "EUR/TRY", "EUR/SEK", "EUR/NOK", "EUR/ZAR",
  // GBP crosses
  "GBP/JPY", "GBP/CHF", "GBP/AUD", "GBP/CAD", "GBP/NZD", "GBP/ZAR",
  // AUD / NZD crosses
  "AUD/JPY", "AUD/CHF", "AUD/CAD", "AUD/NZD",
  "NZD/JPY", "NZD/CHF", "NZD/CAD",
  // Other crosses
  "CAD/JPY", "CAD/CHF", "CHF/JPY",
  // USD exotics
  "USD/ZAR", "USD/TRY", "USD/MXN", "USD/SGD", "USD/SEK", "USD/NOK", "USD/DKK", "USD/HKD", "USD/CNH", "USD/PLN", "USD/THB",
];

export function NewsFeed() {
  const [category, setCategory] = useState("forex");
  const [pair, setPair] = useState("");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ category });
    if (pair) params.set("pair", pair);
    apiGet<NewsArticle[]>(`/news?${params.toString()}`)
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [category, pair]);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full text-sm">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "general" ? "All categories" : c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <select value={pair} onChange={(e) => setPair(e.target.value)} className="w-full text-sm">
          {PAIRS.map((p) => (
            <option key={p} value={p}>
              {p || "All pairs"}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading news...</p>
      ) : articles.length === 0 ? (
        <p className="text-text-secondary text-sm">No articles for this filter.</p>
      ) : (
        articles.slice(0, 6).map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2 border-b border-border last:border-0"
          >
            <p className="text-sm font-medium">{article.headline}</p>
            <p className="text-xs text-text-secondary">
              {article.source} · {timeAgo(article.datetime)}
            </p>
          </a>
        ))
      )}
    </div>
  );
}

function timeAgo(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
