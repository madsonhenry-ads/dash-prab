import React, { useState } from 'react';
import { useSimplifiedDashboard } from '../hooks/useDashboard';
import { KpiCard } from '../components/dashboard/KpiCard';
import { ConversionFunnel } from '../components/dashboard/ConversionFunnel';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { PeriodSelector } from '../components/shared/PeriodSelector';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import type { Period, SimplifiedDashboard, FunnelStep } from '../types';

function getSummaryValue(data: SimplifiedDashboard | undefined, key: string): number {
  if (!data?.summary) return 0;
  const item = data.summary.find(s => s.key === key);
  return item?.value || 0;
}

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [beginDate, setBeginDate] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const dateParams = period === 'custom' ? { beginDate, endDate } : undefined;
  const { data: resp, isLoading, error, refetch } = useSimplifiedDashboard(period, dateParams);

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState message="Error loading dashboard. Check EasyTracker connection." onRetry={() => refetch()} />;

  const d = resp?.data;
  if (!d) return <ErrorState message="No data received from EasyTracker." onRetry={() => refetch()} />;

  // Build funnel steps from simplified-dashboard data
  const funnelSteps: FunnelStep[] = [
    { label: 'Ad Clicks', value: d.funnel?.ad_clicks || 0 },
    { label: 'Page Views', value: d.funnel?.landing_views || 0, percentage: d.funnel?.landing_view_rate || 0 },
    { label: 'Checkouts', value: d.funnel?.checkouts_initiated || 0, percentage: d.funnel?.checkout_rate || 0 },
    { label: 'Purchases', value: d.funnel?.purchases || 0, percentage: d.funnel?.purchase_rate || 0 },
  ];

  const currency = d.meta?.currency || 'USD';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={setPeriod} beginDate={beginDate} endDate={endDate} onBeginDateChange={setBeginDate} onEndDateChange={setEndDate} />
        <span className="text-xs text-dark-400">
          {d.meta?.timezone || 'UTC'} · {currency}
        </span>
      </div>

      {/* KPIs from simplified-dashboard summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title="Spent" value={getSummaryValue(d, 'total_spent')} icon="💰" />
        <KpiCard title="Revenue" value={getSummaryValue(d, 'total_revenue')} icon="💵" />
        <KpiCard title="Profit" value={getSummaryValue(d, 'gross_profit')} isNegative={getSummaryValue(d, 'gross_profit') < 0} icon="📈" />
        <KpiCard title="ROAS" value={getSummaryValue(d, 'roas')} type="ratio" isNegative={getSummaryValue(d, 'roas') < 1} icon="🎯" />
        <KpiCard title="ROI" value={getSummaryValue(d, 'roi')} type="percent" isNegative={getSummaryValue(d, 'roi') < 0} icon="🔄" />
        <KpiCard title="Sales" value={getSummaryValue(d, 'sales_count')} type="number" icon="✅" />
        <KpiCard title="Untracked Sales" value={getSummaryValue(d, 'orphan_sales')} type="number" icon="⚠️" />
        <KpiCard title="Leads" value={getSummaryValue(d, 'leads_count')} type="number" icon="👥" />
        <KpiCard title="CPA" value={getSummaryValue(d, 'cpa')} icon="💳" />
        <KpiCard title="CPL" value={getSummaryValue(d, 'cpl')} icon="📏" />
        <KpiCard title="EPC" value={getSummaryValue(d, 'epc')} icon="📊" />
        <KpiCard title="Avg Ticket" value={getSummaryValue(d, 'avg_ticket')} icon="🎫" />
        <KpiCard title="Lead→Purchase" value={getSummaryValue(d, 'lead_purchase')} type="percent" icon="🔁" />
        <KpiCard title="Untracked Revenue" value={getSummaryValue(d, 'orphan_revenue')} icon="❓" />
      </div>

      {/* Funnel + Daily Series */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionFunnel data={funnelSteps} />

        {/* Daily Series chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Daily Revenue & Purchases</h3>
          {d.dailySeries && d.dailySeries.length > 0 ? (
            <DailySeriesChart data={d.dailySeries} currency={currency} />
          ) : (
            <p className="text-dark-400 text-sm">No daily data for this period.</p>
          )}
        </div>
      </div>

      {/* Spend by Provider + Top Currencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Spend by Provider</h3>
          <div className="space-y-2">
            {(d.spend?.by_provider || []).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                <span className="text-gray-300 text-sm capitalize">{p.provider}</span>
                <span className="text-white font-medium">{formatCurrency(p.total_spent)}</span>
              </div>
            ))}
            {d.spend?.accounts && d.spend.accounts.length > 0 && (
              <details className="mt-2">
                <summary className="text-dark-400 text-xs cursor-pointer hover:text-gray-300">By Account ({d.spend.accounts.length})</summary>
                <div className="mt-2 space-y-1">
                  {d.spend.accounts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{a.name}</span>
                      <span className="text-gray-300">{formatCurrency(a.total_spent)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Sales by Currency</h3>
          <div className="space-y-2">
            {(d.topCurrencies || []).map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                <span className="text-gray-300 text-sm">{c.name}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-dark-400">{c.count} sales</span>
                  <span className="text-white font-medium">{formatCurrency(parseFloat(c.total_revenue))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Top Products</h3>
        <div className="space-y-2">
          {(d.topProducts || []).map((p, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
              <span className="text-gray-300 text-sm">#{i + 1} {p.product_name}</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-dark-400">{p.purchases} sales</span>
                <span className="text-white font-medium">{formatCurrency(parseFloat(p.total_revenue))}</span>
              </div>
            </div>
          ))}
          {(!d.topProducts || d.topProducts.length === 0) && (
            <p className="text-dark-400 text-sm">No products found.</p>
          )}
        </div>
      </div>

      {/* Audience */}
      {d.audience && (d.audience.deviceTypes?.length > 0 || d.audience.browsers?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {d.audience.deviceTypes && d.audience.deviceTypes.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Devices</h3>
              <div className="space-y-2">
                {d.audience.deviceTypes.map((dev, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-dark-700 last:border-0">
                    <span className="text-gray-300 text-sm">{dev.name}</span>
                    <span className="text-white font-medium">{formatNumber(dev.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {d.audience.browsers && d.audience.browsers.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Browsers</h3>
              <div className="space-y-2">
                {d.audience.browsers.slice(0, 8).map((b, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-dark-700 last:border-0">
                    <span className="text-gray-300 text-sm">{b.name}</span>
                    <span className="text-white font-medium">{formatNumber(b.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple inline chart for daily series
function DailySeriesChart({ data, currency }: { data: { date: string; total_revenue: number; purchases: number; leads: number }[]; currency: string }) {
  const maxRev = Math.max(...data.map(d => d.total_revenue), 1);
  const maxLeads = Math.max(...data.map(d => d.leads), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-40">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="w-full bg-brand-blue/30 rounded-t hover:bg-brand-blue/50 transition-colors relative" style={{ height: `${(d.total_revenue / maxRev) * 100}%`, minHeight: '2px' }}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-dark-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                {formatCurrency(d.total_revenue)} · {d.purchases} sales
              </div>
            </div>
            <div className="w-full bg-brand-green/20 rounded-b" style={{ height: `${(d.leads / maxLeads) * 30}%`, minHeight: '1px' }} />
            <span className="text-[10px] text-dark-400">{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-dark-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-blue/40 rounded inline-block" /> Revenue</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-green/30 rounded inline-block" /> Leads</span>
      </div>
    </div>
  );
}
