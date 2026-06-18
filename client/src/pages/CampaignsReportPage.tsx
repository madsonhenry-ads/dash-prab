import React, { useState } from 'react';
import { useCampaigns, useAdSets, useAds } from '../hooks/useCampaignsReport';
import { useAdAccounts, useProducts, useTrafficChannels } from '../hooks/useFilters';
import { PeriodSelector } from '../components/shared/PeriodSelector';
import { MultiSelect } from '../components/shared/MultiSelect';
import { TableSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { formatCurrency, formatNumber, statusLabel, statusBadgeClass, downloadCsv } from '../utils/format';
import type { Period, Campaign, AdSet, AdCreative } from '../types';

type TabType = 'campaigns' | 'adsets' | 'ads';

const TABS: { key: TabType; label: string }[] = [
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'adsets', label: 'Ad Sets' },
  { key: 'ads', label: 'Ads' },
];

const CAMPAIGN_COLUMNS = [
  { key: 'name', label: 'Campaign' },
  { key: 'status', label: 'Status' },
  { key: 'spend', label: 'Spend' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit' },
  { key: 'roas', label: 'ROAS' },
  { key: 'cpa', label: 'CPA' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'sales', label: 'Sales' },
];

const ADSET_COLUMNS = [
  { key: 'name', label: 'Set' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'status', label: 'Status' },
  { key: 'spend', label: 'Spend' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit' },
  { key: 'roas', label: 'ROAS' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'sales', label: 'Sales' },
];

const AD_COLUMNS = [
  { key: 'name', label: 'Ad' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'status', label: 'Status' },
  { key: 'spend', label: 'Spend' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit' },
  { key: 'roas', label: 'ROAS' },
  { key: 'cpa', label: 'CPA' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'hookRate', label: 'Hook Rate' },
  { key: 'holdRate', label: 'Hold Rate' },
  { key: 'sales', label: 'Sales' },
];

const ALL_COLUMNS = [...AD_COLUMNS,
  { key: 'roi', label: 'ROI' },
  { key: 'cpm', label: 'CPM' },
  { key: 'cpc', label: 'CPC' },
  { key: 'addToCart', label: 'Add to Cart' },
  { key: 'margin', label: 'Margin' },
  { key: 'arpu', label: 'ARPU' },
  { key: 'grossRevenue', label: 'Gross Revenue' },
];

const OPTIONAL_COLUMNS = ['roi', 'cpm', 'cpc', 'addToCart', 'margin', 'arpu', 'grossRevenue', 'hookRate', 'holdRate'];

export function CampaignsReportPage() {
  const [tab, setTab] = useState<TabType>('campaigns');
  const [period, setPeriod] = useState<Period>('today');
  const [beginDate, setBeginDate] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [campaignFilter, setCampaignFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['cpc', 'hookRate', 'holdRate']));
  const [showColumns, setShowColumns] = useState(false);
  const { data: accounts } = useAdAccounts();
  const { data: products } = useProducts();
  const { data: channels } = useTrafficChannels();

  const dateParams = period === 'custom' ? { beginDate, endDate } : undefined;
  const common = { period, page, pageSize: 50, search, status: statusFilter, campaignId: campaignFilter, sortBy, sortOrder, channels: selectedChannels.join(','), ...dateParams };
  const { data: campaignsData, isLoading: loadingCamps, error: errCamps, refetch: refetchCamps } = useCampaigns(common);
  const { data: adsetsData, isLoading: loadingAdsets, error: errAdsets, refetch: refetchAdsets } = useAdSets(common);
  const { data: adsData, isLoading: loadingAds, error: errAds, refetch: refetchAds } = useAds(common);

  const handleSort = (col: string) => {
    if (sortBy === col) { setSortOrder(o => o === 'desc' ? 'asc' : 'desc'); }
    else { setSortBy(col); setSortOrder('desc'); }
  };

  const toggleColumn = (col: string) => {
    const next = new Set(visibleColumns);
    next.has(col) ? next.delete(col) : next.add(col);
    setVisibleColumns(next);
  };

  const renderCell = (row: any, key: string) => {
    if (key === 'status') return <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>;
    if (key === 'profit') return <span className={row.profit < 0 ? 'text-brand-red' : 'text-brand-green'}>{formatCurrency(row.profit)}</span>;
    if (key === 'roas') return <span className={row.roas < 2.5 ? 'text-brand-yellow' : ''}>{row.roas.toFixed(2)}</span>;
    if (['ctr', 'hookRate', 'holdRate', 'margin'].includes(key)) return <span>{row[key]}%</span>;
    if (['cpa', 'cpc', 'cpm', 'spend', 'revenue', 'grossRevenue', 'arpu'].includes(key)) return <span>{formatCurrency(row[key] || 0)}</span>;
    if (['sales', 'addToCart', 'impressions', 'clicks'].includes(key)) return <span>{formatNumber(row[key] || 0)}</span>;
    if (key === 'roi') return <span>{row[key]?.toFixed(1)}%</span>;
    return <span>{row[key] ?? '—'}</span>;
  };

  const getColumns = () => {
    let base = tab === 'campaigns' ? CAMPAIGN_COLUMNS : tab === 'adsets' ? ADSET_COLUMNS : [...AD_COLUMNS, ...OPTIONAL_COLUMNS.filter(c => visibleColumns.has(c)).map(k => ALL_COLUMNS.find(c => c.key === k)!)];
    return base;
  };

  const renderTable = (data: any, loading: boolean, error: any, refetch: () => void, columns: any[], footer: any) => {
    if (loading) return <TableSkeleton rows={10} />;
    if (error) return <ErrorState message={`Error loading data`} onRetry={refetch} />;

    return (
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-700">
              {columns.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 whitespace-nowrap">
                  <div className="flex items-center gap-1">{col.label}{sortBy === col.key && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {(data?.data || []).map((row: any, i: number) => (
              <tr key={row.id || i} className="hover:bg-dark-750 transition-colors">
                {columns.map(col => <td key={col.key} className="px-4 py-3 text-gray-300 whitespace-nowrap">{renderCell(row, col.key)}</td>)}
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-dark-400">No results found</td></tr>
            )}
          </tbody>
          {footer && (
            <tfoot className="border-t border-dark-600">
              <tr>
                <td className="px-4 py-3 font-medium text-white" colSpan={tab === 'ads' ? 2 : 1}>Totals / Averages</td>
                {columns.slice(tab === 'ads' ? 2 : 1).map(col => (
                  <td key={col.key} className="px-4 py-3 font-medium text-white">{renderCell(footer, col.key)}</td>
                ))}
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
      </div>
    );
  };

  const currentColumns = tab === 'campaigns' ? CAMPAIGN_COLUMNS : tab === 'adsets' ? ADSET_COLUMNS : [...AD_COLUMNS, ...OPTIONAL_COLUMNS.filter(c => visibleColumns.has(c)).map(k => ALL_COLUMNS.find(c => c.key === k)!)];
  const currentData = tab === 'campaigns' ? campaignsData : tab === 'adsets' ? adsetsData : adsData;
  const currentLoading = tab === 'campaigns' ? loadingCamps : tab === 'adsets' ? loadingAdsets : loadingAds;
  const currentError = tab === 'campaigns' ? errCamps : tab === 'adsets' ? errAdsets : errAds;
  const currentRefetch = tab === 'campaigns' ? refetchCamps : tab === 'adsets' ? refetchAdsets : refetchAds;
  const currentFooter = currentData?.footer;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Campaigns & Ads Report</h2>
        {tab === 'ads' && (
          <button onClick={() => setShowColumns(true)} className="btn-secondary text-xs">Columns ({currentColumns.length})</button>
        )}
      </div>

      {/* Tabs internas */}
      <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1 border border-dark-700 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-blue text-white' : 'text-dark-300 hover:text-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setPage(1); }} beginDate={beginDate} endDate={endDate} onBeginDateChange={setBeginDate} onEndDateChange={setEndDate} />
        <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="input max-w-xs" />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input max-w-[140px]">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
        </select>
        {accounts?.data && <MultiSelect options={accounts.data} selected={selectedAccounts} onChange={setSelectedAccounts} placeholder="Accounts" />}
        {products?.data && <MultiSelect options={products.data} selected={selectedProducts} onChange={setSelectedProducts} placeholder="Products" />}
        {channels?.data && <MultiSelect options={channels.data} selected={selectedChannels} onChange={setSelectedChannels} placeholder="Channels" />}
      </div>

      {/* Table */}
      {renderTable(currentData, currentLoading, currentError, currentRefetch, currentColumns, currentFooter)}

      {/* Column Selector Modal */}
      {showColumns && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowColumns(false)}>
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">Additional Columns</h3>
            <div className="space-y-2">
              {OPTIONAL_COLUMNS.map(col => (
                <label key={col} className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-200">
                  <input type="checkbox" checked={visibleColumns.has(col)} onChange={() => toggleColumn(col)} className="rounded border-dark-500 bg-dark-700 text-brand-blue" />
                  {ALL_COLUMNS.find(c => c.key === col)?.label || col}
                </label>
              ))}
            </div>
            <button onClick={() => setShowColumns(false)} className="btn-primary w-full mt-4 text-sm">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}