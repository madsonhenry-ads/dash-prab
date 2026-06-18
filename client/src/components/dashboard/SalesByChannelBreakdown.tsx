import React from 'react';
import { formatCurrency, formatNumber } from '../../utils/format';

interface ChannelRow {
  id: string;
  name: string;
  spend: number;
  revenue: number;
  profit: number;
  sales: number;
  roas: number;
}

interface Props {
  data: ChannelRow[];
}

export function SalesByChannelBreakdown({ data }: Props) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Sales by Traffic Channel</h3>
      <div className="space-y-2">
        <div className="flex items-center text-xs text-dark-400 font-medium px-2 pb-1 border-b border-dark-700">
          <span className="flex-1">Channel</span>
          <span className="w-20 text-right">Spend</span>
          <span className="w-24 text-right">Revenue</span>
          <span className="w-20 text-right">ROAS</span>
        </div>
        {data.map(ch => {
          const pct = ch.revenue / maxRevenue;
          return (
            <div key={ch.id} className="flex items-center px-2 py-2 rounded-lg hover:bg-dark-750 transition-colors">
              <span className="flex-1 text-gray-300 text-sm font-medium">{ch.name}</span>
              <span className="w-20 text-right text-dark-400 text-sm">{formatCurrency(ch.spend)}</span>
              <span className="w-24 text-right text-white text-sm font-medium">{formatCurrency(ch.revenue)}</span>
              <span className={`w-20 text-right text-sm ${ch.roas >= 2.5 ? 'text-brand-green' : ch.roas >= 1 ? 'text-brand-yellow' : 'text-brand-red'}`}>{ch.roas.toFixed(2)}</span>
            </div>
          );
        })}
        <div className="flex items-center px-2 pt-2 border-t border-dark-700 text-sm font-medium">
          <span className="flex-1 text-gray-300">Totals</span>
          <span className="w-20 text-right text-white">{formatCurrency(data.reduce((s, c) => s + c.spend, 0))}</span>
          <span className="w-24 text-right text-white">{formatCurrency(data.reduce((s, c) => s + c.revenue, 0))}</span>
          <span className="w-20 text-right text-white">—</span>
        </div>
      </div>
    </div>
  );
}