import React, { useState } from 'react';
import { useDashboardKpis, useSalesByChannel, useSalesByProduct } from '../hooks/useDashboard';
import { useAdAccounts, useProducts, useTrafficChannels } from '../hooks/useFilters';
import { KpiCard } from '../components/dashboard/KpiCard';
import { SalesByChannelBreakdown } from '../components/dashboard/SalesByChannelBreakdown';
import { SalesByProductBreakdown } from '../components/dashboard/SalesByProductBreakdown';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { PeriodSelector } from '../components/shared/PeriodSelector';
import { MultiSelect } from '../components/shared/MultiSelect';
import { formatCurrency, formatNumber } from '../utils/format';
import type { Period } from '../types';

export function KpisPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [beginDate, setBeginDate] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const accountParam = selectedAccounts.join(',') || 'all';
  const channelParam = selectedChannels.length > 0 ? selectedChannels : undefined;
  const productParam = selectedProducts.length > 0 ? selectedProducts : undefined;
  const dateParams = period === 'custom' ? { beginDate, endDate } : undefined;

  const { data: kpis, isLoading, error, refetch } = useDashboardKpis(period, accountParam, channelParam, productParam, dateParams);
  const { data: salesByChannel } = useSalesByChannel(period, channelParam, dateParams);
  const { data: salesByProduct } = useSalesByProduct(period, channelParam, dateParams);
  const { data: accounts } = useAdAccounts();
  const { data: products } = useProducts();
  const { data: channels } = useTrafficChannels();

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState message="Error loading KPIs. Check MCP connection." onRetry={() => refetch()} />;
  const k = kpis?.data;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={setPeriod} beginDate={beginDate} endDate={endDate} onBeginDateChange={setBeginDate} onEndDateChange={setEndDate} />
        {accounts?.data && <MultiSelect options={accounts.data} selected={selectedAccounts} onChange={setSelectedAccounts} placeholder="Accounts" />}
        {products?.data && <MultiSelect options={products.data} selected={selectedProducts} onChange={setSelectedProducts} placeholder="Products" />}
        {channels?.data && <MultiSelect options={channels.data} selected={selectedChannels} onChange={setSelectedChannels} placeholder="Channels" />}
      </div>

      {/* KPI Cards — Compact grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <KpiCard title="Ad Spend" value={k?.adSpend || 0} icon="💰" />
        <KpiCard title="Net Revenue" value={k?.netRevenue || 0} icon="🏷️" />
        <KpiCard title="Profit" value={k?.profit || 0} isNegative={(k?.profit || 0) < 0} icon="📈" />
        <KpiCard title="ROAS" value={k?.roas || 0} type="ratio" isNegative={(k?.roas || 0) < 1} icon="🎯" />
        <KpiCard title="CPA" value={k?.cpa || 0} icon="💳" />
        <KpiCard title="Margin" value={k?.margin || 0} type="percent" isNegative={(k?.margin || 0) < 0} icon="📊" />
        <KpiCard title="ROI" value={k?.roi || 0} type="percent" isNegative={(k?.roi || 0) < 0} icon="🔄" />
        <KpiCard title="ARPU" value={k?.arpu || 0} icon="👤" />
        <KpiCard title="Sales" value={k?.approvedSales || 0} type="number" icon="✅" />
        <KpiCard title="Gross Rev" value={k?.grossRevenue || 0} icon="💵" />
      </div>

      {/* Summary row */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">KPIs Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-dark-400 text-xs">Profit Margin</p>
            <p className={`text-lg font-bold ${(k?.margin || 0) >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
              {k?.margin !== undefined ? `${k.margin >= 0 ? '+' : ''}${(k.margin * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-dark-400 text-xs">Net / Gross</p>
            <p className="text-lg font-bold text-gray-200">
              {k?.netRevenue !== undefined && k?.grossRevenue !== undefined && k.grossRevenue > 0
                ? `${((k.netRevenue / k.grossRevenue) * 100).toFixed(1)}%`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-dark-400 text-xs">Total Cost (Spend)</p>
            <p className="text-lg font-bold text-brand-red">{formatCurrency(k?.adSpend || 0)}</p>
          </div>
          <div>
            <p className="text-dark-400 text-xs">Avg. Ticket</p>
            <p className="text-lg font-bold text-gray-200">
              {k?.approvedSales && k?.netRevenue ? formatCurrency(k.netRevenue / k.approvedSales) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {salesByChannel?.data && <SalesByChannelBreakdown data={salesByChannel.data} />}
        {salesByProduct?.data && <SalesByProductBreakdown data={salesByProduct.data} />}
      </div>
    </div>
  );
}