import React from 'react';
import type { Period } from '../../types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  beginDate?: string;
  endDate?: string;
  onBeginDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
}

const periods: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

export function PeriodSelector({ value, onChange, beginDate, endDate, onBeginDateChange, onEndDateChange }: PeriodSelectorProps) {
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
      {value === 'custom' && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-dark-600">
          <input type="date" value={beginDate || ''} onChange={e => onBeginDateChange?.(e.target.value)} className="input text-sm w-36" />
          <span className="text-dark-400">to</span>
          <input type="date" value={endDate || ''} onChange={e => onEndDateChange?.(e.target.value)} className="input text-sm w-36" />
        </div>
      )}
    </div>
  );
}