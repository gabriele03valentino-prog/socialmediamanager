"use client";

import type { Platform } from "@prisma/client";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PLATFORM_LABEL } from "@/lib/utils";

export interface FollowerSeries {
  platform: Platform;
  data: Array<{ date: string; followers: number | null }>;
}

const COLORS: Record<Platform, string> = {
  INSTAGRAM: "#E1306C",
  FACEBOOK: "#1877F2",
  TIKTOK: "#111111",
  YOUTUBE: "#FF0000",
  SPOTIFY: "#1DB954",
};

export function FollowerChart({ series }: { series: FollowerSeries[] }) {
  // Merge su date, ogni piattaforma è una colonna.
  const allDates = new Set<string>();
  for (const s of series) for (const p of s.data) allDates.add(p.date);
  const dates = [...allDates].sort();

  const rows = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const s of series) {
      const point = s.data.find((d) => d.date === date);
      row[s.platform] = point?.followers ?? null;
    }
    return row;
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        Non c'è ancora storico delle metriche. Attendi il primo sync.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="date" fontSize={11} tick={{ fill: "#888" }} />
          <YAxis fontSize={11} tick={{ fill: "#888" }} width={50} />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.platform}
              type="monotone"
              dataKey={s.platform}
              name={PLATFORM_LABEL[s.platform] ?? s.platform}
              stroke={COLORS[s.platform]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
