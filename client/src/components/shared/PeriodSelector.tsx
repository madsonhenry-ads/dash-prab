import React from 'react';
import type { Period } from '../../types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

const periods: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1 border border-dark-700">
      {periods.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === p.value
              ? 'bg-brand-blue text-white'
              : 'text-dark-300 hover:text-gray-100'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}