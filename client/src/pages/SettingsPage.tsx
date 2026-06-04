import React, { useState } from 'react';
import { useMcpStatus } from '../hooks/useMcpStatus';
import { api } from '../services/api';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { data: mcpStatus, refetch: refetchMcp } = useMcpStatus();
  const [roasGoal, setRoasGoal] = useState(2.5);
  const [monthlyGoal, setMonthlyGoal] = useState(200000);
  const [refreshInterval, setRefreshInterval] = useState(10);

  const handleSave = () => {
    localStorage.setItem('trafficboard_roas_goal', String(roasGoal));
    localStorage.setItem('trafficboard_monthly_goal', String(monthlyGoal));
    localStorage.setItem('trafficboard_refresh_interval', String(refreshInterval));
    toast.success('Configurações salvas!');
  };

  const handleClearCache = async () => {
    await api.cache.invalidate();
    toast.success('Cache limpo com sucesso!');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold text-white">Configurações</h2>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Metas</h3>

        <div>
          <label className="block text-xs text-dark-400 mb-1">Meta de ROAS</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={roasGoal}
            onChange={e => setRoasGoal(parseFloat(e.target.value) || 1)}
            className="input max-w-[200px]"
          />
          <p className="text-xs text-dark-500 mt-1">Define o limiar para alertas visuais (🔥 acima, ⚠️ abaixo)</p>
        </div>

        <div>
          <label className="block text-xs text-dark-400 mb-1">Meta de Faturamento Mensal</label>
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
        <h3 className="text-sm font-semibold text-gray-200">Atualização</h3>

        <div>
          <label className="block text-xs text-dark-400 mb-1">Intervalo de Auto-Refresh</label>
          <select
            value={refreshInterval}
            onChange={e => setRefreshInterval(parseInt(e.target.value))}
            className="input max-w-[200px]"
          >
            <option value={5}>5 minutos</option>
            <option value={10}>10 minutos</option>
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
          </select>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Conexão MCP</h3>

        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${mcpStatus?.data?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            {mcpStatus?.data?.connected ? 'Conectado' : 'Desconectado'}
          </span>
          <span className="text-xs text-dark-400">
            ({mcpStatus?.data?.mode === 'mock' ? 'Modo Mock' : 'EasyTracker Live'})
          </span>
        </div>

        {mcpStatus?.data && (
          <div className="text-xs text-dark-400">
            <p>{mcpStatus.data.toolCount} tools disponíveis</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {mcpStatus.data.tools.map(t => (
                <span key={t} className="badge-gray text-[10px]">{t}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={handleClearCache} className="btn-secondary text-xs">
            Limpar Cache
          </button>
          <button onClick={() => refetchMcp()} className="btn-secondary text-xs">
            Verificar Status
          </button>
        </div>
      </div>

      <button onClick={handleSave} className="btn-primary">
        Salvar Configurações
      </button>
    </div>
  );
}