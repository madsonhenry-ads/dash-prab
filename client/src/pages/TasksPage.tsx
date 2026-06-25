import React, { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import type { TaskItem, TaskStatus, TaskPriority } from '../types';

const STORAGE_KEY = 'trafficboard_tasks';

function loadLocalFallback(): TaskItem[] {
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

function saveLocalCache(tasks: TaskItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // localStorage might be full
  }
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'border-t-dark-500',
  in_progress: 'border-t-brand-blue',
  review: 'border-t-brand-yellow',
  done: 'border-t-brand-green',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const PRIORITY_COLORS: Record<TaskPriority, string> = { low: 'badge-blue', medium: 'badge-yellow', high: 'badge-red' };

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

type ViewMode = 'board' | 'list';

const DEFAULT_TASK: Omit<TaskItem, 'id' | 'createdAt'> = {
  title: '', description: '', status: 'todo', priority: 'medium', assignee: '', dueDate: '',
};

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('board');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<TaskItem, 'id' | 'createdAt'>>(DEFAULT_TASK);
  const [dragging, setDragging] = useState<string | null>(null);

  // Load from API on mount
  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await api.tasks.list();
      setTasks(res.data);
      saveLocalCache(res.data);
      setError(null);
    } catch (e: any) {
      const fallback = loadLocalFallback();
      if (fallback.length > 0) {
        setTasks(fallback);
        toast.error('Server unavailable — showing local data');
      } else {
        setError(e.message || 'Failed to load tasks');
      }
    }
    setLoaded(true);
  }

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    try {
      const res = await api.tasks.create({
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee,
        dueDate: form.dueDate,
      });
      setTasks(prev => [...prev, res.data]);
      setForm(DEFAULT_TASK);
      setShowForm(false);
      toast.success('Task created!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create task');
    }
  };

  const handleEdit = (task: TaskItem) => {
    setEditingId(task.id);
    setForm({ title: task.title, description: task.description, status: task.status, priority: task.priority, assignee: task.assignee, dueDate: task.dueDate });
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!editingId || !form.title.trim()) return;
    try {
      const res = await api.tasks.update(editingId, {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee,
        dueDate: form.dueDate,
      });
      setTasks(prev => prev.map(t => t.id === editingId ? res.data : t));
      setForm(DEFAULT_TASK);
      setEditingId(null);
      setShowForm(false);
      toast.success('Task updated!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.tasks.delete(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete task');
    }
  };

  const moveTask = useCallback(async (id: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      await api.tasks.update(id, { status: newStatus });
    } catch {
      // Optimistic update — revert would be too disruptive on board
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragging(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveTask(id, status);
    setDragging(null);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const getTasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);
  const isEmpty = loaded && tasks.length === 0;

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
        <button onClick={() => { setError(null); fetchTasks(); }} className="btn-primary">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white">Tasks</h2>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-dark-800 rounded-lg border border-dark-700 p-0.5">
            <button onClick={() => setView('board')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'board' ? 'bg-brand-blue text-white' : 'text-dark-300 hover:text-gray-100'}`}>Board</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'list' ? 'bg-brand-blue text-white' : 'text-dark-300 hover:text-gray-100'}`}>List</button>
          </div>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(DEFAULT_TASK); }} className="btn-primary text-sm">+ New Task</button>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null); }}>
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-200">{editingId ? 'Edit Task' : 'New Task'}</h3>
            <input className="input" placeholder="Task title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
            <textarea className="input min-h-[60px]" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-400 mb-1">Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-400 mb-1">Assignee</label>
                <input className="input" placeholder="Name" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Due Date</label>
                <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary text-sm">Cancel</button>
              <button onClick={editingId ? handleUpdate : handleAdd} disabled={!form.title.trim()} className="btn-primary text-sm">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-dark-300 text-lg mb-2">No tasks yet</p>
          <p className="text-dark-500 text-sm mb-6">Create your first task to start tracking your team's work.</p>
          <button onClick={() => { setShowForm(true); setForm(DEFAULT_TASK); }} className="btn-primary">Create Task</button>
        </div>
      )}

      {/* Board View */}
      {!isEmpty && view === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUSES.map(status => {
            const columnTasks = getTasksByStatus(status);
            return (
              <div
                key={status}
                onDrop={(e) => handleDrop(e, status)}
                onDragOver={handleDragOver}
                className={`bg-dark-900/50 rounded-xl border border-dark-700 p-3 min-h-[300px] ${dragging ? 'border-dashed border-brand-blue/50' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{STATUS_LABELS[status]}</h3>
                  <span className="text-xs text-dark-400 bg-dark-800 px-2 py-0.5 rounded-full">{columnTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className={`bg-dark-800 border border-dark-600 border-t-2 ${STATUS_COLORS[task.status]} rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-dark-500 transition-colors group`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-200 font-medium leading-snug">{task.title}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => handleEdit(task)} className="text-dark-400 hover:text-gray-100 text-xs">✏️</button>
                          <button onClick={() => handleDelete(task.id)} className="text-dark-400 hover:text-red-400 text-xs">🗑️</button>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-xs text-dark-400 mt-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</span>
                        {task.assignee && <span className="text-xs text-dark-400">👤 {task.assignee}</span>}
                        {task.dueDate && <span className="text-xs text-dark-400">📅 {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!isEmpty && view === 'list' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 text-left text-xs text-dark-400 uppercase">
                <th className="pb-3 pr-4 font-medium">Task</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Priority</th>
                <th className="pb-3 pr-4 font-medium">Assignee</th>
                <th className="pb-3 pr-4 font-medium">Due</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} className="border-b border-dark-700/50 last:border-0">
                  <td className="py-3 pr-4">
                    <p className="text-gray-200 font-medium">{task.title}</p>
                    {task.description && <p className="text-xs text-dark-400 mt-0.5">{task.description}</p>}
                  </td>
                  <td className="py-3 pr-4">
                    <select className="bg-dark-800 border border-dark-600 rounded text-xs px-2 py-1 text-gray-300" value={task.status} onChange={e => moveTask(task.id, e.target.value as TaskStatus)}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pr-4"><span className={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</span></td>
                  <td className="py-3 pr-4 text-dark-300">{task.assignee || '—'}</td>
                  <td className="py-3 pr-4 text-dark-300">{task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(task)} className="text-dark-400 hover:text-gray-100 text-xs">✏️</button>
                      <button onClick={() => handleDelete(task.id)} className="text-dark-400 hover:text-red-400 text-xs">🗑️</button>
                    </div>
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