import React, { useState } from 'react';
import { api } from '../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TableSkeleton } from '../components/shared/LoadingSkeleton';
import { ErrorState } from '../components/shared/ErrorState';
import { formatDate } from '../utils/format';
import toast from 'react-hot-toast';
import type { ToolExpense, ToolsSummary, ApiResponse } from '../types';

type PeriodFilter = 'all' | 'daily' | 'weekly' | 'monthly';
type ExpenseType = 'occasional' | 'recurring';

const PERIOD_TABS: { key: PeriodFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

interface FormState {
  name: string;
  value: number;
  date: string;
  type: ExpenseType;
  recurringDay: number;
  notes: string;
}

const DEFAULT_FORM: FormState = { name: '', value: 0, date: new Date().toISOString().split('T')[0], type: 'occasional', recurringDay: 1, notes: '' };

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ToolsPage() {
  const queryClient = useQueryClient();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const { data, isLoading, error, refetch } = useQuery<ApiResponse<ToolsSummary>>({
    queryKey: ['tools', periodFilter],
    queryFn: () => {
      const params = periodFilter !== 'all' ? `?period=${periodFilter}` : '';
      return api.request<ToolsSummary>(`/tools${params}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.request(`/tools/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tools'] }); toast.success('Expense deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.request('/tools', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tools'] }); setShowForm(false); setForm(DEFAULT_FORM); toast.success('Expense added'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!form.name.trim() || form.value <= 0) return;
    createMutation.mutate({
      name: form.name,
      value: form.value,
      date: form.date,
      type: form.type,
      recurringDay: form.type === 'recurring' ? form.recurringDay : undefined,
      notes: form.notes || undefined,
    });
  };

  const summary = data?.data;

  if (isLoading) return <TableSkeleton rows={4} />;
  if (error) return <ErrorState message="Error loading expenses." onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white">Tools & Expenses</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Add Expense</button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-dark-400 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrencyBRL(summary.total)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-dark-400 uppercase tracking-wider">Daily</p>
            <p className="text-2xl font-bold text-gray-200 mt-1">{formatCurrencyBRL(summary.daily)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-dark-400 uppercase tracking-wider">Weekly</p>
            <p className="text-2xl font-bold text-gray-200 mt-1">{formatCurrencyBRL(summary.weekly)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-dark-400 uppercase tracking-wider">Monthly</p>
            <p className="text-2xl font-bold text-gray-200 mt-1">{formatCurrencyBRL(summary.monthly)}</p>
          </div>
        </div>
      )}

      {/* Period filter tabs */}
      <div className="flex bg-dark-800 rounded-lg border border-dark-700 p-0.5 w-fit">
        {PERIOD_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setPeriodFilter(tab.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${periodFilter === tab.key ? 'bg-brand-blue text-white' : 'text-dark-300 hover:text-gray-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add expense form */}
      {showForm && (
        <div className="card space-y-4 border-brand-blue/30">
          <h3 className="text-sm font-semibold text-gray-200">New Expense</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-dark-400 mb-1">Name</label>
              <input className="input" placeholder="Tool name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Value (R$)</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={form.value || ''} onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ExpenseType }))}>
                <option value="occasional">Occasional</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
          </div>

          {form.type === 'recurring' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-400 mb-1">Recurring Day (monthly)</label>
                <input className="input max-w-[120px]" type="number" min="1" max="31" value={form.recurringDay} onChange={e => setForm(f => ({ ...f, recurringDay: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-dark-400 mb-1">Notes (optional)</label>
            <input className="input" placeholder="Any notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); }} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={!form.name.trim() || form.value <= 0 || createMutation.isPending} className="btn-primary text-sm">
              {createMutation.isPending ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!summary?.entries || summary.entries.length === 0) && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">🧰</div>
          <p className="text-dark-300 text-lg mb-2">No expenses yet</p>
          <p className="text-dark-500 text-sm mb-6">Track your paid tools and services here.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">Add Expense</button>
        </div>
      )}

      {/* Expenses table */}
      {summary?.entries && summary.entries.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 text-left text-xs text-dark-400 uppercase">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Value</th>
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Notes</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(summary.entries as ToolExpense[]).map(expense => (
                <tr key={expense.id} className="border-b border-dark-700/50 last:border-0">
                  <td className="py-3 pr-4 text-gray-200 font-medium">{expense.name}</td>
                  <td className="py-3 pr-4 text-white font-mono">{formatCurrencyBRL(expense.value)}</td>
                  <td className="py-3 pr-4 text-dark-300">{formatDate(expense.date)}</td>
                  <td className="py-3 pr-4">
                    <span className={expense.type === 'recurring' ? 'badge-blue' : 'badge-gray'}>
                      {expense.type === 'recurring' ? `Monthly (day ${expense.recurringDay})` : 'Occasional'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-dark-400 text-xs max-w-[200px] truncate">{expense.notes || '—'}</td>
                  <td className="py-3">
                    <button
                      onClick={() => deleteMutation.mutate(expense.id)}
                      disabled={deleteMutation.isPending}
                      className="text-dark-400 hover:text-red-400 transition-colors text-xs"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}