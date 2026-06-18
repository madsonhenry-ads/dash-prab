import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils/format';
import toast from 'react-hot-toast';
import type { ToolExpense } from '../types';

const STORAGE_KEY = 'trafficboard_tools';

type ExpenseType = 'occasional' | 'recurring';
type PeriodFilter = 'all' | 'daily' | 'weekly' | 'monthly';

interface FormState {
  name: string;
  value: number;
  date: string;
  type: ExpenseType;
  recurringDay: number;
  notes: string;
}

const DEFAULT_FORM: FormState = { name: '', value: 0, date: new Date().toISOString().split('T')[0], type: 'occasional', recurringDay: 1, notes: '' };

const PERIOD_TABS: { key: PeriodFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadExpenses(): ToolExpense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveExpenses(expenses: ToolExpense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function formatCurrencyUSD(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function computeSummary(entries: ToolExpense[], filter: PeriodFilter): { total: number; daily: number; weekly: number; monthly: number; entries: ToolExpense[] } {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let total = 0;
  let dailyTotal = 0;
  let weeklyTotal = 0;
  let monthlyTotal = 0;

  // For recurring, project this month's value
  const projectedEntries: ToolExpense[] = [];
  for (const entry of entries) {
    if (entry.type === 'recurring') {
      const monthlyVal = entry.value;
      total += monthlyVal;
      monthlyTotal += monthlyVal;

      if (entry.recurringDay) {
        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const projectedDate = new Date(currentYear, currentMonth, Math.min(entry.recurringDay, lastDay));
        const projectedStr = projectedDate.toISOString().split('T')[0];
        if (projectedStr === todayStr) dailyTotal += entry.value;
        if (projectedStr >= weekAgo && projectedStr <= todayStr) weeklyTotal += entry.value;
      }
    } else {
      total += entry.value;
      if (entry.date === todayStr) dailyTotal += entry.value;
      if (entry.date >= weekAgo && entry.date <= todayStr) weeklyTotal += entry.value;
      if (entry.date >= monthStart && entry.date <= todayStr) monthlyTotal += entry.value;
    }
  }

  // Filter entries based on period
  let filtered: ToolExpense[];
  switch (filter) {
    case 'daily':
      filtered = entries.filter(e => e.date === todayStr);
      // Also include recurring entries projected today
      break;
    case 'weekly':
      filtered = entries.filter(e => e.date >= weekAgo && e.date <= todayStr);
      break;
    case 'monthly':
      filtered = entries.filter(e => e.date >= monthStart && e.date <= todayStr);
      break;
    default:
      filtered = [...entries];
  }

  return {
    total: Math.round(total * 100) / 100,
    daily: Math.round(dailyTotal * 100) / 100,
    weekly: Math.round(weeklyTotal * 100) / 100,
    monthly: Math.round(monthlyTotal * 100) / 100,
    entries: filtered.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
  };
}

export function ToolsPage() {
  const [expenses, setExpenses] = useState<ToolExpense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // Load on mount
  useEffect(() => {
    try {
      const stored = loadExpenses();
      setExpenses(stored);
    } catch (e) {
      setError('Failed to load expenses from storage.');
    }
    setLoaded(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (loaded) saveExpenses(expenses);
  }, [expenses, loaded]);

  const handleAdd = () => {
    if (!form.name.trim() || form.value <= 0) return;
    const expense: ToolExpense = {
      id: generateId(),
      name: form.name,
      value: form.value,
      date: form.date,
      type: form.type,
      recurringDay: form.type === 'recurring' ? form.recurringDay : undefined,
      notes: form.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setExpenses(prev => [...prev, expense]);
    setForm(DEFAULT_FORM);
    setShowForm(false);
    toast.success('Expense added!');
  };

  const handleDelete = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Expense deleted');
  };

  const summary = computeSummary(expenses, periodFilter);

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-dark-700 h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-dark-300 mb-4">{error}</p>
        <button onClick={() => { setError(null); setExpenses(loadExpenses()); }} className="btn-primary">Try again</button>
      </div>
    );
  }

  const isEmpty = expenses.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white">Tools & Expenses</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Add Expense</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-dark-400 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrencyUSD(summary.total)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-dark-400 uppercase tracking-wider">Daily</p>
          <p className="text-2xl font-bold text-gray-200 mt-1">{formatCurrencyUSD(summary.daily)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-dark-400 uppercase tracking-wider">Weekly</p>
          <p className="text-2xl font-bold text-gray-200 mt-1">{formatCurrencyUSD(summary.weekly)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-dark-400 uppercase tracking-wider">Monthly</p>
          <p className="text-2xl font-bold text-gray-200 mt-1">{formatCurrencyUSD(summary.monthly)}</p>
        </div>
      </div>

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
              <label className="block text-xs text-dark-400 mb-1">Value (USD)</label>
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
            <button onClick={handleAdd} disabled={!form.name.trim() || form.value <= 0} className="btn-primary text-sm">
              Add Expense
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">🧰</div>
          <p className="text-dark-300 text-lg mb-2">No expenses yet</p>
          <p className="text-dark-500 text-sm mb-6">Track your paid tools and services here.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">Add Expense</button>
        </div>
      )}

      {/* Expenses table */}
      {!isEmpty && (
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
              {summary.entries.map(expense => (
                <tr key={expense.id} className="border-b border-dark-700/50 last:border-0">
                  <td className="py-3 pr-4 text-gray-200 font-medium">{expense.name}</td>
                  <td className="py-3 pr-4 text-white font-mono">{formatCurrencyUSD(expense.value)}</td>
                  <td className="py-3 pr-4 text-dark-300">{formatDate(expense.date)}</td>
                  <td className="py-3 pr-4">
                    <span className={expense.type === 'recurring' ? 'badge-blue' : 'badge-gray'}>
                      {expense.type === 'recurring' ? `Monthly (day ${expense.recurringDay})` : 'Occasional'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-dark-400 text-xs max-w-[200px] truncate">{expense.notes || '—'}</td>
                  <td className="py-3">
                    <button
                      onClick={() => handleDelete(expense.id)}
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