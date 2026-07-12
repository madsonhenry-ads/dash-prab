import React from 'react';
import { useMcpStatus } from '../../hooks/useMcpStatus';
import { api } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: mcpStatus } = useMcpStatus();
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    queryClient.invalidateQueries();
    await api.cache.invalidate();
    toast.success('Cache cleared, data updated!');
  };

  return (
    <header className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-3 md:px-6 shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-gray-300 hover:text-white"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm text-dark-400">Overview</span>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* MCP Status */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${
            mcpStatus?.data?.connected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-dark-400 hidden sm:inline">
            MCP {mcpStatus?.data?.mode === 'mock' ? '(Mock)' : '(Live)'}
          </span>
          {mcpStatus?.data && (
            <span className="text-dark-500 hidden md:inline">
              · {mcpStatus.data.toolCount} tools
            </span>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
