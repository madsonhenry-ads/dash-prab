import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { SalesByHour } from '../../types';
import { formatCurrency } from '../../utils/format';

const LABELS: Record<string, string> = { revenue: 'Revenue', investment: 'Investment', profit: 'Profit' };
const COLORS: Record<string, string> = { revenue: '#22c55e', investment: '#ef4444', profit: '#3b82f6' };

interface Props {
  data: SalesByHour[];
}

export function SalesByHourChart({ data }: Props) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Revenue × Investment × Profit <span className="text-dark-400 font-normal">(acumulado por hora)</span>
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="hour" tick={{ fill: '#808080', fontSize: 11 }} tickFormatter={(h: number) => `${h}h`} />
          <YAxis tick={{ fill: '#808080', fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
            labelStyle={{ color: '#e0e0e0' }}
            labelFormatter={(h: number) => `${h}:00`}
            formatter={(value: number, name: string) => [formatCurrency(value), LABELS[name] || name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#e0e0e0', paddingTop: 8 }}
            formatter={(value: string) => LABELS[value] || value}
          />
          {(['revenue', 'investment', 'profit'] as const).map(key => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS[key]}
              fill={COLORS[key]}
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}