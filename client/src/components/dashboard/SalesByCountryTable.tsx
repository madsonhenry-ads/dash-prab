import React from 'react';
import type { SalesByCountry } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/format';

interface Props {
  data: SalesByCountry[];
}

export function SalesByCountryTable({ data }: Props) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Sales by Country</h3>
      <div className="space-y-2">
        {data.map(country => (
          <div key={country.country} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{country.flag}</span>
              <span className="text-gray-300">{country.country}</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <span className="text-dark-400">{formatNumber(country.sales)} sales</span>
              <span className="text-white font-medium">{formatCurrency(country.revenue)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}