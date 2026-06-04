import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { SalesByDay } from '../../types';
import { formatNumber } from '../../utils/format';

interface Props {
  data: SalesByDay[];
}

export function SalesByDayChart({ data }: Props) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Vendas por Dia da Semana</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="day" tick={{ fill: '#808080', fontSize: 11 }} />
          <YAxis tick={{ fill: '#808080', fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
            labelStyle={{ color: '#e0e0e0' }}
            formatter={(value: number) => [formatNumber(value), 'Vendas']}
          />
          <Bar dataKey="sales" radius={[4, 4, 0, 0]} name="Vendas">
            {data.map((entry, index) => (
              <rect key={index} fill={entry.isBest ? '#22c55e' : '#3b82f6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}