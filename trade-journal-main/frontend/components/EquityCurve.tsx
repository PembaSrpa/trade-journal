"use client";

import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";

export function EquityCurve({ data }: { data: { time: string; equity: number }[] }) {
  return (
    <div className="h-full min-h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis
            hide
            domain={["dataMin - 100", "dataMax + 100"]}
          />
          <Tooltip
            contentStyle={{
              background: "#262626",
              border: "1px solid #404040",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Equity"]}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="#378ADD"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
