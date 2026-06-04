import React from 'react';
import type { FunnelStep } from '../../types';
import { formatNumber } from '../../utils/format';

interface FunnelProps {
  data: FunnelStep[];
}

export function ConversionFunnel({ data }: FunnelProps) {
  const maxVal = Math.max(...data.map(d => d.value));

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Funil de Conversão</h3>
      <div className="space-y-2">
        {data.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-300">{step.label}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-white">{formatNumber(step.value)}</span>
                {i > 0 && step.percentage && (
                  <span className="text-dark-400 text-xs w-12 text-right">{step.percentage}%</span>
                )}
              </div>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(step.value / maxVal) * 100}%`,
                  background: i === data.length - 1
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : `linear-gradient(90deg, #3b82f6, ${['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#22c55e'][i]})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}