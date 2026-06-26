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
  { key: 'name', label: 'Criativo' },
  { key: 'status', label: 'Status' },
  { key: 'spend', label: 'Spent' },
  { key: 'cpa', label: 'CPA' },
  { key: 'roas', label: 'ROAS' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach', label: 'Reach' },
  { key: 'frequency', label: 'Freq.' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'clicks_all', label: 'Clicks All' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpc_all', label: 'CPC All' },
  { key: 'cpm', label: 'CPM' },
  { key: 'landing_views', label: 'Landing Views' },
  { key: 'cic', label: 'Cost per Landing' },
  { key: 'landing_clicks', label: 'Checkouts' },
  { key: 'cost_per_checkout', label: 'Cost per Checkout' },
  { key: 'checkout_rate', label: 'Checkout Rate' },
  { key: 'pixel_purchase', label: 'Pixel Purchase' },
  { key: 'revenue', label: 'Purchase Value' },
  { key: 'sales', label: 'Conv. Rate' },
  { key: 'play_rate', label: 'Play Rate' },
  { key: 'hookRate', label: 'Hook Rate' },
  { key: 'body_rate', label: 'Body Rate' },
  { key: 'completion_rate', label: 'Completion Rate' },
  { key: 'video_plays', label: 'Video Plays' },
  { key: 'video_25', label: 'Video 25%' },
  { key: 'video_50', label: 'Video 50%' },
  { key: 'video_75', label: 'Video 75%' },
  { key: 'video_100', label: 'Video 100%' },
  { key: 'landing_rate', label: 'Landing Rate' },
  { key: 'avg_watch_time', label: 'Avg Watch Time' },
  { key: 'last_updated', label: 'Last Updated' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paused', label: 'Paused' },
  { value: 'no_data', label: 'No data' },
];

function formatSeconds(sec: number): string {
  if (!sec) return '0s';
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function formatTimestamp(ts: string): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

export function CreativesPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [beginDate, setBeginDate] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const roasGoal = parseFloat(localStorage.getItem('trafficboard_roas_goal') || '2.5');

  const dateParams = period === 'custom' ? { beginDate, endDate } : undefined;
  const { data, isLoading, error, refetch } = useCreatives({ period, page, pageSize: 50, status, search, product: selectedProducts.join(','), sortBy, sortOrder, ...dateParams });
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

    // Percentages
    if (['ctr', 'hookRate', 'holdRate', 'bounce_rate', 'play_rate', 'body_rate', 'completion_rate', 'landing_rate', 'checkout_rate'].includes(key)) {
      return <span>{(row as any)[key]?.toFixed(1) ?? '0.0'}%</span>;
    }

    // Currency
    if (['cpa', 'cpc', 'cic', 'spend', 'revenue', 'avg_ticket', 'cpc_all', 'cpm', 'cost_per_checkout'].includes(key)) {
      return <span>{formatCurrency((row as any)[key] || 0)}</span>;
    }

    // Numbers (integer)
    if (['sales', 'addToCart', 'landing_views', 'landing_clicks', 'impressions', 'reach', 'clicks', 'clicks_all', 'pixel_purchase', 'video_plays', 'video_25', 'video_50', 'video_75', 'video_100'].includes(key)) {
      return <span>{formatNumber((row as any)[key] || 0)}</span>;
    }

    // Frequency (decimal number)
    if (key === 'frequency') return <span>{(row as any).frequency?.toFixed(2) ?? '0.00'}</span>;

    // Avg watch time (seconds -> formatted)
    if (key === 'avg_watch_time') return <span>{formatSeconds((row as any).avg_watch_time || 0)}</span>;

    // Last updated (timestamp)
    if (key === 'last_updated') return <span className="text-dark-400 text-xs">{formatTimestamp((row as any).last_updated || '')}</span>;

    // Start date
    if (key === 'startDate') return <span className="text-dark-400">{new Date(row.startDate + 'T00:00:00').toLocaleDateString('en-US')}</span>;

    // Conversion rate (special: sales / clicks)
    if (key === 'sales') {
      const convRate = row.clicks > 0 ? ((row.sales / row.clicks) * 100) : 0;
      return <span>{convRate.toFixed(2)}%</span>;
    }

    return <span>{(row as any)[key] ?? '—'}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Creative Control</h2>
        <button onClick={handleExport} className="btn-secondary text-xs">Export CSV</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setPage(1); }} beginDate={beginDate} endDate={endDate} onBeginDateChange={setBeginDate} onEndDateChange={setEndDate} />
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
                <th key={col.key} onClick={() => handleSort(col.key)} className="px-3 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 whitespace-nowrap">
                  <div className="flex items-center gap-1">{col.label}{sortBy === col.key && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {data?.data?.map((row) => (
              <tr key={row.id} className="hover:bg-dark-750 transition-colors">
                {COLUMNS.map(col => <td key={col.key} className="px-3 py-3 text-gray-300 whitespace-nowrap">{renderCell(row, col.key)}</td>)}
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-dark-400">No creatives found</td></tr>
            )}
          </tbody>
          {data?.footer && (
            <tfoot className="border-t border-dark-600">
              <tr>
                <td className="px-3 py-3 font-medium text-white" colSpan={2}>Totals / Averages</td>
                <td className="px-3 py-3 font-medium text-white">{formatCurrency(data.footer.spend)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatCurrency(data.footer.cpa)}</td>
                <td className="px-3 py-3 font-medium text-white">{data.footer.roas.toFixed(2)}</td>
                <td className="px-3 py-3 text-dark-400" colSpan={29}>—</td>
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