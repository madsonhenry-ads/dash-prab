import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CampaignsReportPage } from './pages/CampaignsReportPage';
import { CreativesPage } from './pages/CreativesPage';
import { TasksPage } from './pages/TasksPage';
import { KpisPage } from './pages/KpisPage';
import { ToolsPage } from './pages/ToolsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 } } });

function AppContent() {
  const { isAuthenticated, loading, login, logout } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-dark-950"><div className="animate-spin w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) return <LoginPage onLogin={login} />;
  return (
    <AppLayout onLogout={logout}>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/campaigns" element={<CampaignsReportPage />} />
          <Route path="/creatives" element={<CreativesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/kpis" element={<KpisPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><AppContent /></BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #2a2a2a' } }} />
    </QueryClientProvider>
  );
}