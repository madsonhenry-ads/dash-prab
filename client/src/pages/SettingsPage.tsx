import React, { useState } from 'react';
import { useMcpStatus } from '../hooks/useMcpStatus';
import { useSyncStatus, useSync } from '../hooks/useSync';
import { api } from '../services/api';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { data: mcpStatus, refetch: refetchMcp } = useMcpStatus();
  const [roasGoal, setRoasGoal] = useState(2.5);
  const [monthlyGoal, setMonthlyGoal] = useState(200000);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [timezone, setTimezone] = useState(localStorage.getItem('trafficboard_timezone') || 'UTC');

  const handleSave = () => {
    localStorage.setItem('trafficboard_roas_goal', String(roasGoal));
    localStorage.setItem('trafficboard_monthly_goal', String(monthlyGoal));
    localStorage.setItem('trafficboard_refresh_interval', String(refreshInterval));
    localStorage.setItem('trafficboard_timezone', timezone);
    toast.success('Settings saved!');
  };

  const handleClearCache = async () => {
    await api.cache.invalidate();
    toast.success('Cache cleared successfully!');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold text-white">Settings</h2>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Goals</h3>

        <div>
          <label className="block text-xs text-dark-400 mb-1">ROAS Goal</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={roasGoal}
            onChange={e => setRoasGoal(parseFloat(e.target.value) || 1)}
            className="input max-w-[200px]"
          />
          <p className="text-xs text-dark-500 mt-1">Sets the threshold for visual alerts (🔥 above, ⚠️ below)</p>
        </div>

        <div>
          <label className="block text-xs text-dark-400 mb-1">Monthly Revenue Goal</label>
          <input
            type="number"
            step="1000"
            value={monthlyGoal}
            onChange={e => setMonthlyGoal(parseFloat(e.target.value) || 0)}
            className="input max-w-[200px]"
          />
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Refresh</h3>

        <div>
          <label className="block text-xs text-dark-400 mb-1">Auto-Refresh Interval</label>
          <select
            value={refreshInterval}
            onChange={e => setRefreshInterval(parseInt(e.target.value))}
            className="input max-w-[200px]"
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Data Timezone</h3>
        <p className="text-xs text-dark-400">Configure o fuso horário para exibição dos dados de vendas e períodos.</p>

        <div>
          <label className="block text-xs text-dark-400 mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="input max-w-[200px]"
          >
            <option value="Europe/London">London (BST/GMT+1)</option>
            <option value="UTC">UTC</option>
            <option value="America/Sao_Paulo">São Paulo (BRT -03:00)</option>
          </select>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">MCP Connection</h3>

        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${mcpStatus?.data?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            {mcpStatus?.data?.connected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-xs text-dark-400">
            ({mcpStatus?.data?.mode === 'mock' ? 'Mock Mode' : 'EasyTracker Live'})
          </span>
        </div>

        {mcpStatus?.data && (
          <div className="text-xs text-dark-400">
            <p>{mcpStatus.data.toolCount} tools available</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {mcpStatus.data.tools.map(t => (
                <span key={t} className="badge-gray text-[10px]">{t}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={handleClearCache} className="btn-secondary text-xs">
            Clear Cache
          </button>
          <button onClick={() => refetchMcp()} className="btn-secondary text-xs">
            Check Status
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">PostgreSQL Sync</h3>
        <p className="text-xs text-dark-400">
          Sincroniza dados do EasyTracker com o PostgreSQL para consulta offline.
          Os dados ficam disponíveis mesmo quando o EasyTracker API estiver fora do ar.
        </p>

        <SyncSection />
      </div>

      <button onClick={handleSave} className="btn-primary">
        Save Settings
      </button>
    </div>
  );
}

function SyncSection() {
  const { data: syncStatus, isLoading: statusLoading } = useSyncStatus();
  const syncMutation = useSync();

  const handleSync = () => {
    syncMutation.mutate();
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${syncStatus?.data?.postgresConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm">
          {syncStatus?.data?.postgresConnected ? 'PostgreSQL Connected' : 'PostgreSQL Disconnected'}
        </span>
      </div>

      {syncStatus?.data?.lastSync && (
        <div className="text-xs text-dark-400 space-y-1">
          <p>Last sync: {formatDate(syncStatus.data.lastSync.finished_at)}</p>
          <p>Status: {syncStatus.data.lastSync.status}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncMutation.isPending || !syncStatus?.data?.postgresConnected}
          className="btn-primary text-xs"
        >
          {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
        </button>
        {syncMutation.isPending && (
          <span className="text-xs text-dark-400 animate-pulse">Fetching data from EasyTracker...</span>
        )}
      </div>

      {syncMutation.data?.data && (
        <div className="text-xs text-dark-400 space-y-0.5">
          <p className="text-brand-green">Sync completed in {(syncMutation.data.data.duration / 1000).toFixed(1)}s</p>
          <p>{syncMutation.data.data.creatives} creatives synced</p>
          <p>{syncMutation.data.data.campaigns} campaigns synced</p>
          {syncMutation.data.data.errors.length > 0 && (
            <p className="text-brand-red">{syncMutation.data.data.errors.length} errors</p>
          )}
        </div>
      )}
    </div>
  );
}