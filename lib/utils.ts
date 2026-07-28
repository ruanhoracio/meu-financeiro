export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatMonth(mes: number, ano: number): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  return `${meses[mes - 1]}/${ano}`
}

export function getCurrentMonth(): { mes: number; ano: number } {
  const now = new Date()
  return { mes: now.getMonth() + 1, ano: now.getFullYear() }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pago: 'Pago',
    aguardando: 'Aguardando',
    proximo_mes: 'Próximo mês',
  }
  return labels[status] || status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pago: 'var(--color-status-pago)',
    aguardando: 'var(--color-status-aguardando)',
    proximo_mes: 'var(--color-status-proximo)',
  }
  return colors[status] || 'var(--color-text-muted)'
}

export function getStatusBg(status: string): string {
  const colors: Record<string, string> = {
    pago: 'var(--color-status-pago-bg)',
    aguardando: 'var(--color-status-aguardando-bg)',
    proximo_mes: 'var(--color-status-proximo-bg)',
  }
  return colors[status] || 'transparent'
}

export function getDonoLabel(dono: string): string {
  const labels: Record<string, string> = {
    eu: 'Eu',
    esposa: 'Esposa',
    conjunto: 'Conjunto',
  }
  return labels[dono] || dono
}

export function getLast6Months(): Array<{ mes: number; ano: number; label: string }> {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: formatMonth(d.getMonth() + 1, d.getFullYear()).split('/')[0].substring(0, 3),
    })
  }
  return result
}

export function calcPercentChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

export function getTipoLabel(tipo: string, parcelaAtual?: number | null, parcelasTotal?: number | null): string {
  if (tipo === 'fixa') return '🔄 Fixa'
  if (tipo === 'parcela_unica') return '🔹 Única'
  if (tipo === 'parcelado' && parcelasTotal) {
    return `${parcelaAtual || 1}/${parcelasTotal}`
  }
  return ''
}

export function getTipoShortLabel(tipo: string, parcelaAtual?: number | null, parcelasTotal?: number | null): string {
  if (tipo === 'fixa') return 'Fixa'
  if (tipo === 'parcela_unica') return 'Única'
  if (tipo === 'parcelado' && parcelasTotal) {
    return `${parcelaAtual || 1}/${parcelasTotal}`
  }
  return ''
}
