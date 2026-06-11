import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { SalesByHour } from '../../types';
import { formatCurrency } from '../../utils/format';

interface Props {
  data: SalesByHour[];
}

export function SalesByHourChart({ data }: Props) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Sales by Hour</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="hour" tick={{ fill: '#808080', fontSize: 11 }} tickFormatter={(h: number) => `${h}h`} />
          <YAxis tick={{ fill: '#808080', fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
            labelStyle={{ color: '#e0e0e0' }}
            formatter={(value: number) => [formatCurrency(value), undefined]}
          />
          <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}