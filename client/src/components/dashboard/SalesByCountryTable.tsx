import React from 'react';
import type { SalesByCountry } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/format';

interface Props {
  data: SalesByCountry[];
}

export function SalesByCountryTable({ data }: Props) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Sales by Country</h3>
      <div className="space-y-2">
        {data.map(country => {
          const intensity = country.revenue / maxRevenue;
          // Heat map gradient: darker bg = more revenue
          const bgOpacity = Math.max(0.05, intensity * 0.15);

          return (
            <div
              key={country.country}
              className="flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors border border-transparent hover:border-dark-600"
              style={{ backgroundColor: `rgba(59, 130, 246, ${bgOpacity})` }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{country.flag}</span>
                <span className="text-gray-300 font-medium">{country.country}</span>
                <div className="w-20 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${intensity * 100}%`,
                      background: intensity > 0.7
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : intensity > 0.3
                        ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
                        : 'linear-gradient(90deg, #eab308, #f59e0b)',
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-dark-400">{formatNumber(country.sales)} sales</span>
                <span className="text-white font-medium min-w-[80px] text-right">{formatCurrency(country.revenue)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}