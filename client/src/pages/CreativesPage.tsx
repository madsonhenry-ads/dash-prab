import React, { useState } from 'react';
import { useCreatives } from '../hooks/useCreatives';
import { api } from '../services/api';
import { PeriodSelector } from '../components/shared/PeriodSelector';
import { TableSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { formatCurrency, formatNumber, downloadCsv } from '../utils/format';
import type { Period, AdCreative } from '../types';

// Columns exactly matching EasyTracker Ads Manager — ordered as defined in the UI
const COLUMNS = [
  { key: 'status', label: 'STATUS' },
  { key: 'name', label: 'AD' },
  { key: 'creative', label: 'CREATIVE' },
  { key: 'spend', label: 'SPENT' },
  { key: 'impressions', label: 'IMPRESSIONS' },
  { key: 'clicks', label: 'CLICKS' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
  { key: 'conversions', label: 'CONVERSIONS' },
  { key: 'cpa', label: 'CPA' },
  { key: 'checkouts', label: 'INIT. CHECKOUT' },
  { key: 'cost_per_checkout', label: 'COST/CHECKOUT' },
  { key: 'profit', label: 'PROFIT' },
  { key: 'revenue', label: 'REVENUE' },
  { key: 'landing_views', label: 'LANDING PAGE VIEWS' },
  { key: 'cic', label: 'COST/LANDING VIEW' },
  { key: 'ctr', label: 'CTR' },
  { key: 'play_rate', label: 'PLAY RATE' },
  { key: 'hook_rate', label: 'HOOK RATE' },
  { key: 'body_rate', label: 'BODY RATE' },
  { key: 'completion_rate', label: 'COMPLETION RATE' },
  { key: 'video_plays', label: 'VIDEO PLAYS' },
  { key: 'video_25', label: 'VIDEO 25%' },
  { key: 'video_50', label: 'VIDEO 50%' },
  { key: 'video_75', label: 'VIDEO 75%' },
  { key: 'video_100', label: 'VIDEO 100%' },
  { key: 'pixel_purchase', label: 'PIXEL PURCHASES' },
  { key: 'roas', label: 'ROAS' },
  { key: 'avg_watch_time', label: 'AVG WATCH TIME' },
  { key: 'landing_rate', label: 'LANDING RATE' },
  { key: 'checkout_rate', label: 'CHECKOUT RATE' },
  { key: 'quality_ranking', label: 'QUALITY RANKING' },
  { key: 'creative_conversion_rate', label: 'CREATIVE CONV. RATE' },
  { key: 'last_updated', label: 'UPDATED AT' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'no_data', label: 'No Data' },
];

const PERCENT_COLS = ['ctr', 'play_rate', 'hook_rate', 'body_rate', 'completion_rate', 'checkout_rate', 'landing_rate', 'creative_conversion_rate'];
const CURRENCY_COLS = ['spend', 'cpa', 'cpc', 'cpm', 'cic', 'cost_per_checkout', 'revenue', 'profit'];
const INT_COLS = ['impressions', 'clicks', 'conversions', 'checkouts', 'pixel_purchase', 'landing_views', 'video_plays', 'video_25', 'video_50', 'video_75', 'video_100'];

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
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('creative_status_overrides') || '{}'); } catch { return {}; }
  });

  const dateParams = period === 'custom' ? { beginDate, endDate } : undefined;
  const { data, isLoading, error, refetch } = useCreatives({ period, page, pageSize: 50, status, search, sortBy, sortOrder, ...dateParams });

  const saveOverride = (id: string, newStatus: string) => {
    const next = { ...statusOverrides, [id]: newStatus };
    setStatusOverrides(next);
    localStorage.setItem('creative_status_overrides', JSON.stringify(next));
    setEditingStatusId(null);
  };

  const effectiveStatus = (row: any) => statusOverrides[row.id] || row.status;

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    else { setSortBy(column); setSortOrder('desc'); }
  };

  const handleExport = async () => {
    try {
      const blob = await api.creatives.export({ period, ...(period === 'custom' ? { beginDate, endDate } : {}) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creatives-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Erro ao exportar: ' + e.message);
    }
  };

  const StatusBadge = ({ value, rowId }: { value: string; rowId: string }) => {
    const statusColor: Record<string, string> = {
      active: 'bg-green-900/40 text-green-400',
      paused: 'bg-yellow-900/40 text-yellow-400',
      rejected: 'bg-red-900/40 text-red-400',
      under_review: 'bg-blue-900/40 text-blue-400',
      no_data: 'bg-dark-700 text-dark-300',
    };
    const color = statusColor[(value || '').toLowerCase()] || statusColor.no_data;

    if (editingStatusId === rowId) {
      return (
        <select
          autoFocus
          value={value}
          onChange={e => saveOverride(rowId, e.target.value)}
          onBlur={() => setEditingStatusId(null)}
          className="bg-dark-800 text-white text-xs rounded border border-dark-600 px-1 py-0.5"
        >
          {STATUS_FILTERS.filter(s => s.value).map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      );
    }

    return (
      <span
        onClick={() => setEditingStatusId(rowId)}
        className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${color}`}
        title="Click to change status"
      >
        {(value || '—').toUpperCase()}
      </span>
    );
  };

  const renderCell = (row: any, key: string) => {
    const val = row[key];

    if (key === 'status') {
      return <StatusBadge value={effectiveStatus(row)} rowId={row.id} />;
    }

    if (key === 'name' || key === 'creative') return <span className="text-gray-200">{val || '—'}</span>;

    if (PERCENT_COLS.includes(key)) return <span>{(val || 0).toFixed(2)}%</span>;

    if (CURRENCY_COLS.includes(key)) return <span>{formatCurrency(val || 0)}</span>;

    if (INT_COLS.includes(key)) return <span>{formatNumber(val || 0)}</span>;

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
                <td className="px-3 py-3 font-medium text-white" colSpan={3}>Totals / Averages</td>
                <td className="px-3 py-3 font-medium text-white">{formatCurrency(data.footer.spend)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.impressions)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.clicks)}</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.conversions)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatCurrency(data.footer.cpa)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.checkouts)}</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 font-medium text-white">{formatCurrency(data.footer.profit)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatCurrency(data.footer.revenue)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.landing_views)}</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 font-medium text-white">{(data.footer.ctr || 0).toFixed(2)}%</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.video_plays)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.video_25)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.video_50)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.video_75)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.video_100)}</td>
                <td className="px-3 py-3 font-medium text-white">{formatNumber(data.footer.pixel_purchase)}</td>
                <td className="px-3 py-3 font-medium text-white">{(data.footer.roas || 0).toFixed(2)}</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
                <td className="px-3 py-3 text-dark-400">—</td>
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
