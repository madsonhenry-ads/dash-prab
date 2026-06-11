import React, { useState } from 'react';
import { useCreatives } from '../hooks/useCreatives';
import { useAdAccounts, useProducts, useTrafficChannels } from '../hooks/useFilters';
import { PeriodSelector } from '../components/shared/PeriodSelector';
import { MultiSelect } from '../components/shared/MultiSelect';
import { TableSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { formatCurrency, formatNumber, statusLabel, statusBadgeClass, perfIndicator, downloadCsv } from '../utils/format';
import type { Period, AdCreative } from '../types';

const COLUMNS = [
  { key: 'name', label: 'Creative Name' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'status', label: 'Status' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'spend', label: 'Spend' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit / Loss' },
  { key: 'roas', label: 'ROAS' },
  { key: 'cpa', label: 'CPA' },
  { key: 'cpc', label: 'CPC' },
  { key: 'ctr', label: 'CTR' },
  { key: 'hookRate', label: 'Hook Rate' },
  { key: 'holdRate', label: 'Hold Rate' },
  { key: 'sales', label: 'Sales' },
  { key: 'landing_clicks', label: 'Landing Clicks (IC)' },
  { key: 'cic', label: 'CIC (Cost / IC)' },
  { key: 'bounce_rate', label: 'Bounce Rate' },
  { key: 'landing_views', label: 'Landing Views' },
  { key: 'avg_ticket', label: 'Avg Ticket' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paused', label: 'Paused' },
  { value: 'no_data', label: 'No data' },
];

export function CreativesPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const roasGoal = parseFloat(localStorage.getItem('trafficboard_roas_goal') || '2.5');

  const { data, isLoading, error, refetch } = useCreatives({ period, page, pageSize: 50, status, search, product: selectedProducts.join(','), sortBy, sortOrder });
  const { data: accounts } = useAdAccounts();
  const { data: products } = useProducts();
  const { data: channels } = useTrafficChannels();

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    else { setSortBy(column); setSortOrder('desc'); }
  };

  const handleExport = () => {
    const headers = COLUMNS.map(c => c.label);
    const rows = (data?.data || []).map((row: any) => COLUMNS.map(c => row[c.key] ?? ''));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCsv(`creatives-${period}.csv`, csv);
  };

  const renderCell = (row: AdCreative, key: string) => {
    if (key === 'status') return <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>;
    if (key === 'name') {
      const perf = perfIndicator(row.roas, row.profit, row.status, roasGoal);
      return <div className="flex items-center gap-2"><span title={perf.label} className={perf.className}>{perf.icon}</span><span>{row.name}</span></div>;
    }
    if (key === 'profit') return <span className={row.profit < 0 ? 'text-brand-red' : 'text-brand-green'}>{formatCurrency(row.profit)}</span>;
    if (key === 'roas') return <span className={row.roas < roasGoal ? 'text-brand-yellow' : ''}>{row.roas.toFixed(2)}</span>;
    if (['ctr', 'hookRate', 'holdRate', 'bounce_rate'].includes(key)) return <span>{(row as any)[key]}%</span>;
    if (['cpa', 'cpc', 'cic', 'spend', 'revenue', 'avg_ticket'].includes(key)) return <span>{formatCurrency((row as any)[key])}</span>;
    if (['sales', 'addToCart', 'landing_views', 'landing_clicks'].includes(key)) return <span>{formatNumber((row as any)[key])}</span>;
    if (key === 'startDate') return <span className="text-dark-400">{new Date(row.startDate + 'T00:00:00').toLocaleDateString('en-US')}</span>;
    return <span>{(row as any)[key] ?? '—'}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Creative Control</h2>
        <button onClick={handleExport} className="btn-secondary text-xs">Export CSV</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />
        <input type="text" placeholder="Search creative..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="input max-w-xs" />
        <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1 border border-dark-700">
          {STATUS_FILTERS.map(sf => (
            <button key={sf.value} onClick={() => { setStatus(sf.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${status === sf.value ? 'bg-brand-blue text-white' : 'text-dark-300 hover:text-gray-100'}`}>
              {sf.label}
            </button>
          ))}
        </div>
        {products?.data && <MultiSelect options={products.data} selected={selectedProducts} onChange={setSelectedProducts} placeholder="Produtos" />}
        {accounts?.data && <MultiSelect options={accounts.data} selected={selectedAccounts} onChange={setSelectedAccounts} placeholder="Contas" />}
        {channels?.data && <MultiSelect options={channels.data} selected={selectedChannels} onChange={setSelectedChannels} placeholder="Canais" />}
      </div>

      {isLoading ? <TableSkeleton rows={10} /> :
       error ? <ErrorState message="Error loading creatives" onRetry={() => refetch()} /> :
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-700">
              {COLUMNS.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 whitespace-nowrap">
                  <div className="flex items-center gap-1">{col.label}{sortBy === col.key && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {data?.data?.map((row) => (
              <tr key={row.id} className="hover:bg-dark-750 transition-colors">
                {COLUMNS.map(col => <td key={col.key} className="px-4 py-3 text-gray-300 whitespace-nowrap">{renderCell(row, col.key)}</td>)}
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-dark-400">No creatives found</td></tr>
            )}
          </tbody>
          {data?.footer && (
            <tfoot className="border-t border-dark-600">
              <tr>
                <td className="px-4 py-3 font-medium text-white" colSpan={2}>Totals / Averages</td>
                <td className="px-4 py-3 text-dark-400">—</td>
                <td className="px-4 py-3 text-dark-400">—</td>
                <td className="px-4 py-3 font-medium text-white">{formatCurrency(data.footer.spend)}</td>
                <td className="px-4 py-3 font-medium text-white">{formatCurrency(data.footer.revenue)}</td>
                <td className="px-4 py-3 font-medium text-white">{formatCurrency(data.footer.profit)}</td>
                <td className="px-4 py-3 font-medium text-white">{data.footer.roas.toFixed(2)}</td>
                <td className="px-4 py-3 font-medium text-white">{formatCurrency(data.footer.cpa)}</td>
                <td className="px-4 py-3 text-dark-400">—</td>
                <td className="px-4 py-3 text-dark-400">—</td>
                <td className="px-4 py-3 font-medium text-white">{data.footer.hookRate?.toFixed(1)}%</td>
                <td className="px-4 py-3 font-medium text-white">{data.footer.holdRate?.toFixed(1)}%</td>
                <td className="px-4 py-3 font-medium text-white">{formatNumber(data.footer.sales)}</td>
                <td className="px-4 py-3 font-medium text-white">{formatNumber(data.footer.landing_clicks || 0)}</td>
                <td className="px-4 py-3 font-medium text-white">{formatCurrency(data.footer.cic || 0)}</td>
                <td className="px-4 py-3 font-medium text-white">{data.footer.bounce_rate?.toFixed(1)}%</td>
                <td className="px-4 py-3 font-medium text-white">{formatNumber(data.footer.landing_views || 0)}</td>
                <td className="px-4 py-3 font-medium text-white">{formatCurrency(data.footer.avg_ticket || 0)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700">
            <span className="text-xs text-dark-400">Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, data.meta.total)} of {data.meta.total}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs">Previous</button>
              <span className="text-xs text-dark-400">Page {page} of {data.meta.totalPages}</span>
              <button disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs">Next</button>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}