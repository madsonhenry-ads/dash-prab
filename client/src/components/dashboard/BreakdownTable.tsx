import React from 'react';

interface BreakdownRow {
  label: string;
  value: number;
  secondary?: number | string;
}

interface BreakdownTableProps {
  title: string;
  data: BreakdownRow[];
  valueLabel?: string;
  formatValue?: (v: number) => string;
}

export function BreakdownTable({ title, data, valueLabel = 'Valor', formatValue = String }: BreakdownTableProps) {
  const total = data.reduce((s, r) => s + r.value, 0);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">{title}</h3>
      <div className="space-y-1">
        {data.map((row, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 text-sm border-b border-dark-700 last:border-0">
            <span className="text-gray-300">{row.label}</span>
            <div className="flex items-center gap-3">
              <div className="w-24 bg-dark-700 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-brand-blue rounded-full" style={{ width: `${(row.value / total) * 100}%` }} />
              </div>
              <span className="text-white font-medium w-20 text-right">{formatValue(row.value)}</span>
              {row.secondary !== undefined && (
                <span className="text-dark-400 text-xs w-16 text-right">{row.secondary}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}