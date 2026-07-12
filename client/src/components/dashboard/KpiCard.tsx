import React from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../../utils/format';

interface KpiCardProps {
  title: string;
  value: number;
  type?: 'currency' | 'percent' | 'number' | 'ratio';
  isNegative?: boolean;
  icon?: string;
}

export function KpiCard({ title, value, type = 'currency', isNegative, icon }: KpiCardProps) {
  const formatted = type === 'currency' ? formatCurrency(value)
    : type === 'percent' ? `${value.toFixed(1)}%`
    : type === 'ratio' ? value.toFixed(2)
    : formatNumber(value);

  const negative = isNegative ?? value < 0;

  return (
    <div className="card hover:border-dark-500 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-dark-400 font-medium uppercase tracking-wider">{title}</span>
        {icon && <span className="text-base md:text-lg">{icon}</span>}
      </div>
      <div className={`text-xl md:text-2xl font-bold ${negative ? 'text-brand-red' : 'text-white'}`}>
        {formatted}
      </div>
    </div>
  );
}