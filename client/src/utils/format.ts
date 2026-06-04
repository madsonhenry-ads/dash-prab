export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return formatNumber(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Ativo',
    paused: 'Pausado',
    rejected: 'Rejeitado',
    under_review: 'Em Análise',
    no_data: 'Sem dados',
  };
  return map[status] || status;
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-green',
    paused: 'badge-yellow',
    rejected: 'badge-red',
    under_review: 'badge-blue',
    no_data: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

export function perfIndicator(roas: number, profit: number, status: string, roasGoal: number): { icon: string; label: string; className: string } {
  if (status === 'rejected') return { icon: '❌', label: 'Rejeitado', className: 'text-brand-red' };
  if (profit < 0) return { icon: '⚠️', label: 'Prejuízo', className: 'text-brand-yellow' };
  if (roas >= roasGoal) return { icon: '🔥', label: 'Acima da meta', className: 'text-brand-green' };
  return { icon: '➖', label: 'Abaixo da meta', className: 'text-dark-400' };
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}