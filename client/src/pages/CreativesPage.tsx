import React, { useState } from 'react';
import { useCreatives } from '../hooks/useCreatives';
import { PeriodSelector } from '../components/shared/PeriodSelector';
import { TableSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { formatCurrency, formatNumber, downloadCsv } from '../utils/format';
import type { Period, AdCreative } from '../types';

// Columns exactly matching EasyTracker's Ads Manager
const COLUMNS = [
  { key: 'status', label: 'ACTIVE' },
  { key: 'name', label: 'AD' },
  { key: 'spend', label: 'SPENT' },
  { key: 'cpa', label: 'CPA' },
  { key: 'roas', label: 'ROAS' },
  { key: 'impressions', label: 'IMPRESSIONS' },
  { key: 'reach', label: 'REACH' },
  { key: 'frequency', label: 'FREQ.' },
  { key: 'clicks', label: 'CLICKS' },
  { key: 'clicks_all', label: 'CLICKS (ALL)' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpc_all', label: 'CPC (ALL)' },
  { key: 'cpm', label: 'CPM' },
  { key: 'landing_views', label: 'LANDING VIEWS' },
  { key: 'cic', label: 'COST PER LANDING' },
  { key: 'landing_clicks', label: 'CHECKOUTS' },
  { key: 'cost_per_checkout', label: 'COST PER CHECKOUT' },
  { key: 'checkout_rate', label: 'CHECKOUT RATE' },
  { key: 'pixel_purchase', label: 'PIXEL PURCHASE' },
  { key: 'revenue', label: 'PURCHASE VALUE' },
  { key: 'sales', label: 'CONV. RATE' },
  { key: 'play_rate', label: 'PLAY RATE' },
  { key: 'hook_rate', label: 'HOOK RATE' },
  { key: 'body_rate', label: 'BODY RATE' },
  { key: 'completion_rate', label: 'COMPLETION RATE' },
  { key: 'video_plays', label: 'VIDEO PLAYS' },
  { key: 'video_25', label: 'VIDEO 25%' },
  { key: 'video_50', label: 'VIDEO 50%' },
  { key: 'video_75', label: 'VIDEO 75%' },
  { key: 'video_100', label: 'VIDEO 100%' },
  { key: 'landing_rate', label: 'LANDING RATE' },
  { key: 'avg_watch_time', label: 'AVG WATCH TIME' },
  { key: 'last_updated', label: 'LAST UPDATED' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'rejected', label: 'Rejected' },
];

const PERCENT_COLS = ['ctr', 'play_rate', 'hook_rate', 'body_rate', 'completion_rate', 'checkout_rate', 'landing_rate', 'sales'];
const CURRENCY_COLS = ['spend', 'cpa', 'cpc', 'cpc_all', 'cpm', 'cic', 'cost_per_checkout', 'revenue'];
const INT_COLS = ['impressions', 'reach', 'clicks', 'clicks_all', 'pixel_purchase', 'landing_views', 'landing_clicks', 'video_plays', 'video_25', 'video_50', 'video_75', 'video_100'];

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
    return new Date(ts).toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
  const [sortBy, setSortBy] = useState('spend');
  const [sortOrder, setSortOrder] = useState('desc');

  const dateParams = period === 'custom' ? { beginDate, endDate } : undefined;
  const { data, isLoading, error, refetch } = useCreatives({ period, page, pageSize: 50, status, search, sortBy, sortOrder, ...dateParams });

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    else { setSortBy(column); setSortOrder('desc'); }
  };

  const handleExport = () => {
    const headers = COLUMNS.map(c => c.label);
    const rows = (data?.data || []).map((row: any) => COLUMNS.map(c => {
      const v = row[c.key];
      if (v === undefined || v === null) return '';
      return typeof v === 'number' ? v.toFixed(2) : v;
    }));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCsv(`creatives-${period}.csv`, csv);
  };

  const renderCell = (row: any, key: string) => {
    const val = row[key];

    if (key === 'status') {
      const isActive = (val || '').toLowerCase() === 'active';
      return <span className={`px-2 py-0.5 rounded text-xs font-medium ${isActive ? 'bg-green-900/40 text-green-400' : 'bg-dark-700 text-dark-300'}`}>{(val || '—').toUpperCase()}</span>;
    }

    if (key === 'name') return <span className="text-gray-200">{val || '—'}</span>;

    if (PERCENT_COLS.includes(key)) return <span>{(val || 0).toFixed(2)}%</span>;

    if (CURRENCY_COLS.includes(key)) return <span>{formatCurrency(val || 0)}</span>;

    if (INT_COLS.includes(key)) return <span>{formatNumber(val || 0)}</span>;

    if (key === 'frequency') return <span>{(val || 0).toFixed(2)}</span>;

    if (key === 'roas') return <span className={(val || 0) < 1 ? 'text-brand-red' : 'text-brand-green'}>{(val || 0).toFixed(2)}</span>;

    if (key === 'avg_watch_time') return <span>{formatSeconds(val || 0)}</span>;

    if (key === 'last_updated') return <span className="text-dark-400 text-xs">{formatTimestamp(val || '')}</span>;

    return <span>{val ?? '—'}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Creative Control</h2>
        <div className="flex items-center gap-2">
          {data?.source && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-900/40 text-blue-400 border border-blue-700/50">
              {data.source === 'proxy' ? 'LIVE' : data.source.toUpperCase()}
            </span>
          )}
          <button onClick={handleExport} className="btn-secondary text-xs">Export CSV</button>
        </div>
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
            {data?.data?.map((row: any) => (
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
                <td className="px-3 py-3 font-medium text-white">{(data.footer.roas || 0).toFixed(2)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.impressions)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.clicks)}</td>
                <td className="px-3 py-3 text-dark-400" colSpan={3}>—</td>
                <td className="px-3 py-3 font-medium text-white">{(data.footer.ctr || 0).toFixed(2)}%</td>
                <td className="px-3 py-3 text-dark-400" colSpan={2}>—</td>
                <td className="px-3 py-3 font-medium text-white">{formatCurrency(data.footer.cpm)}</td>
                <td className="px-3 py-3 text-dark-400" colSpan={COLUMNS.length - 13}>—</td>
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
