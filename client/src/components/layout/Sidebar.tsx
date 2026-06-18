import React from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarProps { onLogout: () => void; }

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/campaigns', label: 'Campaigns & Ads', icon: '📋' },
  { to: '/creatives', label: 'Creative Control', icon: '🎬' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/kpis', label: 'KPIs', icon: '📈' },
  { to: '/tools', label: 'Tools', icon: '🧰' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar({ onLogout }: SidebarProps) {
  return (
    <aside className="w-56 bg-dark-900 border-r border-dark-700 flex flex-col shrink-0">
      <div className="p-5 border-b border-dark-700">
        <h1 className="text-lg font-bold text-white tracking-tight"><span className="text-brand-blue">Traffic</span>Board</h1>
        <p className="text-xs text-dark-400 mt-0.5">EasyTracker MCP</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20' : 'text-dark-300 hover:text-gray-100 hover:bg-dark-800 border border-transparent'}`}>
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-dark-700">
        <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dark-300 hover:text-red-400 hover:bg-dark-800 w-full transition-colors">
          <span>🚪</span>Logout
        </button>
      </div>
    </aside>
  );
}