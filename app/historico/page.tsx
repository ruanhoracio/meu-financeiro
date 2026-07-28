'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useMonth } from '@/contexts/MonthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatMonth, calcPercentChange } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Categoria } from '@/lib/database.types'

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function HistoricoPage() {
  const { user, loading, currentView } = useAuth()
  const { mes, ano } = useMonth()
  const { mask } = useHideValues()
  const router = useRouter()
  const [lancamentosAtual, setLancamentosAtual] = useState<any[]>([])
  const [lancamentosAnterior, setLancamentosAnterior] = useState<any[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadData()
  }, [mes, ano, currentView, user])

  async function loadData() {
    const prevMes = mes === 1 ? 12 : mes - 1
    const prevAno = mes === 1 ? ano - 1 : ano

    let qAtual = supabase.from('lancamentos').select('*').eq('mes', mes).eq('ano', ano)
    let qAnt = supabase.from('lancamentos').select('*').eq('mes', prevMes).eq('ano', prevAno)
    if (currentView !== 'conjunto') {
      qAtual = qAtual.or(`dono.eq.${currentView},dono.eq.conjunto`)
      qAnt = qAnt.or(`dono.eq.${currentView},dono.eq.conjunto`)
    }

    const [atual, anterior, cats] = await Promise.all([
      qAtual,
      qAnt,
      supabase.from('categorias').select('*'),
    ])
    setLancamentosAtual(atual.data || [])
    setLancamentosAnterior(anterior.data || [])
    setCategorias(cats.data || [])
  }

  const totalAtual = lancamentosAtual.reduce((s, l) => s + Number(l.valor), 0)
  const totalAnterior = lancamentosAnterior.reduce((s, l) => s + Number(l.valor), 0)
  const diff = calcPercentChange(totalAtual, totalAnterior)

  const catMap: Record<string, { nome: string; icone: string; cor: string; total: number }> = {}
  lancamentosAtual.forEach(l => {
    const cat = categorias.find(c => c.id === l.categoria_id)
    const nome = cat?.nome || 'Outros'
    if (!catMap[nome]) catMap[nome] = { nome, icone: cat?.icone || '📦', cor: cat?.cor || '#820AD1', total: 0 }
    catMap[nome].total += Number(l.valor)
  })
  const ranking = Object.values(catMap).sort((a, b) => b.total - a.total)

  const prevMes = mes === 1 ? 12 : mes - 1
  const prevAno = mes === 1 ? ano - 1 : ano

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Histórico</h1>
          <p className="page-subtitle">Comparativo e ranking — {formatMonth(mes, ano)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card card-p" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            {formatMonth(prevMes, prevAno)}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>
            {mask(formatCurrency(totalAnterior))}
          </div>
        </div>

        <div className="card card-p" style={{
          textAlign: 'center',
          background: diff > 0 ? '#FEF2F2' : diff < 0 ? '#F0FDF4' : 'var(--color-bg-card)',
          border: `1px solid ${diff > 0 ? '#FECACA' : diff < 0 ? '#BBF7D0' : 'var(--color-border)'}`,
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Variação
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {diff > 0 ? <TrendingUp size={24} color="#EF4444" /> : diff < 0 ? <TrendingDown size={24} color="#22C55E" /> : <Minus size={24} color="#9CA3AF" />}
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: diff > 0 ? '#EF4444' : diff < 0 ? '#22C55E' : 'var(--color-text-muted)' }}>
              {Math.abs(diff).toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            {diff > 0 ? `${Math.abs(diff).toFixed(1)}% a mais que o mês passado` :
             diff < 0 ? `${Math.abs(diff).toFixed(1)}% a menos que o mês passado` :
             'Igual ao mês passado'}
          </div>
        </div>

        <div className="card card-p" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            {formatMonth(mes, ano)}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
            {mask(formatCurrency(totalAtual))}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>🏆 Ranking de Categorias — {formatMonth(mes, ano)}</h3>
        </div>
        {ranking.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">Sem lançamentos neste mês</div>
          </div>
        ) : (
          <div style={{ padding: '1rem' }}>
            {ranking.map((item, i) => {
              const pct = totalAtual > 0 ? (item.total / totalAtual) * 100 : 0
              return (
                <div key={item.nome} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.875rem' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${item.cor}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', flexShrink: 0
                  }}>
                    {item.icone}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        #{i+1} {item.nome}
                      </span>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{pct.toFixed(1)}%</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{mask(formatCurrency(item.total))}</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: item.cor }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
