"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface GoalChartProps {
  series: Array<{ date: string; value: number }>;
  target: number;
  label: string;
  startValue: number;
}

export function GoalProgressChart({
  series,
  target,
  label,
  startValue,
}: GoalChartProps) {
  if (series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 dark:border-neutral-700">
        Non ci sono ancora dati storici. Attendi il prossimo sync.
      </div>
    );
  }

  const data = [
    { date: series[0]!.date, value: startValue, real: startValue },
    ...series.map((p) => ({ date: p.date, value: p.value, real: p.value })),
  ];

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="date" fontSize={10} tick={{ fill: "#888" }} />
          <YAxis fontSize={10} tick={{ fill: "#888" }} width={48} />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={target}
            stroke="#10b981"
            strokeDasharray="4 4"
            label={{ value: `target ${target.toLocaleString("it-IT")}`, fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="#7c3aed"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
