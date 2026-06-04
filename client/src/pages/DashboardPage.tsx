import React, { useState } from 'react';
import { useDashboardKpis, useDashboardFunnel, useSalesByHour, useSalesByDay, useSalesByCountry, useSalesByPayment, useTopCampaigns } from '../hooks/useDashboard';
import { useAdAccounts, useProducts, useTrafficChannels } from '../hooks/useFilters';
import { KpiCard } from '../components/dashboard/KpiCard';
import { ConversionFunnel } from '../components/dashboard/ConversionFunnel';
import { SalesByHourChart } from '../components/dashboard/SalesByHourChart';
import { SalesByDayChart } from '../components/dashboard/SalesByDayChart';
import { SalesByPaymentChart } from '../components/dashboard/SalesByPaymentChart';
import { SalesByCountryTable } from '../components/dashboard/SalesByCountryTable';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { PeriodSelector } from '../components/shared/PeriodSelector';
import { MultiSelect } from '../components/shared/MultiSelect';
import { formatCurrency, formatNumber } from '../utils/format';
import type { Period } from '../types';

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const accountParam = selectedAccounts.join(',') || 'all';
  const { data: kpis, isLoading, error, refetch } = useDashboardKpis(period, accountParam);
  const { data: funnel } = useDashboardFunnel(period);
  const { data: salesByHour } = useSalesByHour(period);
  const { data: salesByDay } = useSalesByDay(period);
  const { data: salesByCountry } = useSalesByCountry(period);
  const { data: salesByPayment } = useSalesByPayment(period);
  const { data: topCampaigns } = useTopCampaigns(period);
  const { data: accounts } = useAdAccounts();
  const { data: products } = useProducts();
  const { data: channels } = useTrafficChannels();

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState message="Erro ao carregar KPIs. Verifique a conexão com o MCP." onRetry={() => refetch()} />;
  const k = kpis?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={setPeriod} />
        {accounts?.data && <MultiSelect options={accounts.data} selected={selectedAccounts} onChange={setSelectedAccounts} placeholder="Contas" />}
        {products?.data && <MultiSelect options={products.data} selected={selectedProducts} onChange={setSelectedProducts} placeholder="Produtos" />}
        {channels?.data && <MultiSelect options={channels.data} selected={selectedChannels} onChange={setSelectedChannels} placeholder="Canais" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title="Gastos com Anúncios" value={k?.adSpend || 0} icon="💰" />
        <KpiCard title="Faturamento Líquido" value={k?.netRevenue || 0} icon="🏷️" />
        <KpiCard title="Lucro" value={k?.profit || 0} isNegative={(k?.profit || 0) < 0} icon="📈" />
        <KpiCard title="ROAS" value={k?.roas || 0} type="ratio" isNegative={(k?.roas || 0) < 1} icon="🎯" />
        <KpiCard title="CPA" value={k?.cpa || 0} icon="💳" />
        <KpiCard title="Margem" value={k?.margin || 0} type="percent" isNegative={(k?.margin || 0) < 0} icon="📊" />
        <KpiCard title="ROI" value={k?.roi || 0} type="percent" isNegative={(k?.roi || 0) < 0} icon="🔄" />
        <KpiCard title="ARPU" value={k?.arpu || 0} icon="👤" />
        <KpiCard title="Vendas Aprovadas" value={k?.approvedSales || 0} type="number" icon="✅" />
        <KpiCard title="Faturamento Bruto" value={k?.grossRevenue || 0} icon="💵" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {funnel?.data && <ConversionFunnel data={funnel.data} />}
        {salesByHour?.data && <SalesByHourChart data={salesByHour.data} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {salesByDay?.data && <SalesByDayChart data={salesByDay.data} />}
        {salesByPayment?.data && <SalesByPaymentChart data={salesByPayment.data} />}
        {salesByCountry?.data && <SalesByCountryTable data={salesByCountry.data} />}
      </div>

      {/* Top Campanhas */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Top Campanhas</h3>
        <div className="space-y-2">
          {(topCampaigns?.data || []).map((c, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
              <span className="text-gray-300 text-sm">{c.name}</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-dark-400">{formatCurrency(c.spend)}</span>
                <span className="text-white font-medium">{formatCurrency(c.revenue)}</span>
                <span className={c.roas >= 2.5 ? 'text-brand-green' : 'text-brand-yellow'}>{c.roas.toFixed(2)} ROAS</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}