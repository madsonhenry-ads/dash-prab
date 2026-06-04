import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SalesByPayment } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/format';

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#a855f7'];

interface Props {
  data: SalesByPayment[];
}

export function SalesByPaymentChart({ data }: Props) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Vendas por Pagamento</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width="60%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="sales" nameKey="method" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
              formatter={(value: number) => [formatNumber(value), 'Vendas']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.map((item, i) => (
            <div key={item.method} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-dark-300">{item.method}</span>
              <span className="text-white font-medium">{item.percentage.toFixed(1)}%</span>
              <span className="text-dark-400 text-xs">{item.approvalRate.toFixed(0)}% aprovação</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}