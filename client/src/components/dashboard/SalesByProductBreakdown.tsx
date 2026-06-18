import React from 'react';
import { formatCurrency, formatNumber } from '../../utils/format';

interface ProductRow {
  id: string;
  name: string;
  price: number;
  sales: number;
  revenue: number;
}

interface Props {
  data: ProductRow[];
}

export function SalesByProductBreakdown({ data }: Props) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Sales by Product</h3>
      <div className="space-y-2">
        <div className="flex items-center text-xs text-dark-400 font-medium px-2 pb-1 border-b border-dark-700">
          <span className="flex-1">Product</span>
          <span className="w-20 text-right">Price</span>
          <span className="w-20 text-right">Sales</span>
          <span className="w-24 text-right">Revenue</span>
        </div>
        {data.map(p => {
          const pct = p.revenue / maxRevenue;
          return (
            <div key={p.id} className="flex items-center px-2 py-2 rounded-lg hover:bg-dark-750 transition-colors">
              <span className="flex-1 text-gray-300 text-sm font-medium">{p.name}</span>
              <span className="w-20 text-right text-dark-400 text-sm">{formatCurrency(p.price)}</span>
              <span className="w-20 text-right text-dark-400 text-sm">{formatNumber(p.sales)}</span>
              <span className="w-24 text-right text-white text-sm font-medium">{formatCurrency(p.revenue)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}