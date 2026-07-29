'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useMonth } from '@/contexts/MonthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, CheckCircle,
  Clock, Sparkles, Plus, DollarSign, Edit3, Save, X,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Lightbulb,
  PartyPopper, BarChart3, Layers
} from 'lucide-react'
import type { Lancamento, Categoria } from '@/lib/database.types'

const COLORS = ['#820AD1','#A855F7','#EC4899','#EF4444','#F97316','#F59E0B','#10B981','#06B6D4','#3B82F6','#6366F1','#8B5CF6','#14B8A6']

const MESES_NOMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

type CategoryComparison = {
  id: string
  name: string
  icone: string
  valAtual: number
  valAnterior: number
  diff: number
  pctChange: number
}

export default function DashboardPage() {
  const { user, loading, currentView } = useAuth()
  const { mes, ano } = useMonth()
  const { mask } = useHideValues()
  const router = useRouter()
  
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [prevLancamentos, setPrevLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [renda, setRenda] = useState(0)
  const [prevRenda, setPrevRenda] = useState(0)
  const [rendaInput, setRendaInput] = useState('')
  const [editingRenda, setEditingRenda] = useState(false)
  const [last6, setLast6] = useState<{ mes: string; total: number }[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const prevMes = mes === 1 ? 12 : mes - 1
  const prevAno = mes === 1 ? ano - 1 : ano

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [mes, ano, currentView, user])

  async function loadData() {
    setLoadingData(true)
    await Promise.all([
      loadLancamentos(),
      loadPrevLancamentos(),
      loadCategorias(),
      loadRenda(),
      loadLast6()
    ])
    setLoadingData(false)
  }

  async function loadLancamentos() {
    let query = supabase.from('lancamentos').select('*').eq('mes', mes).eq('ano', ano)
    if (currentView !== 'conjunto') {
      query = query.or(`dono.eq.${currentView},dono.eq.conjunto`)
    }
    const { data } = await query.order('created_at', { ascending: false })
    setLancamentos(data || [])
  }

  async function loadPrevLancamentos() {
    let query = supabase.from('lancamentos').select('*').eq('mes', prevMes).eq('ano', prevAno)
    if (currentView !== 'conjunto') {
      query = query.or(`dono.eq.${currentView},dono.eq.conjunto`)
    }
    const { data } = await query
    setPrevLancamentos(data || [])
  }

  async function loadCategorias() {
    const { data } = await supabase.from('categorias').select('*').order('nome')
    setCategorias(data || [])
  }

  async function loadRenda() {
    if (currentView === 'conjunto') {
      const { data: dEu } = await supabase.from('rendas').select('valor').eq('dono', 'eu').eq('mes', mes).eq('ano', ano).maybeSingle()
      const { data: dEsposa } = await supabase.from('rendas').select('valor').eq('dono', 'esposa').eq('mes', mes).eq('ano', ano).maybeSingle()
      const totalRenda = (dEu?.valor || 0) + (dEsposa?.valor || 0)
      setRenda(totalRenda)
      setRendaInput(totalRenda.toString())

      const { data: pEu } = await supabase.from('rendas').select('valor').eq('dono', 'eu').eq('mes', prevMes).eq('ano', prevAno).maybeSingle()
      const { data: pEsposa } = await supabase.from('rendas').select('valor').eq('dono', 'esposa').eq('mes', prevMes).eq('ano', prevAno).maybeSingle()
      setPrevRenda((pEu?.valor || 0) + (pEsposa?.valor || 0))
    } else {
      const { data } = await supabase.from('rendas').select('valor').eq('dono', currentView).eq('mes', mes).eq('ano', ano).maybeSingle()
      setRenda(data?.valor || 0)
      setRendaInput(data?.valor?.toString() || '')

      const { data: pData } = await supabase.from('rendas').select('valor').eq('dono', currentView).eq('mes', prevMes).eq('ano', prevAno).maybeSingle()
      setPrevRenda(pData?.valor || 0)
    }
  }

  async function loadLast6() {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ mes: d.getMonth() + 1, ano: d.getFullYear() })
    }

    const results = await Promise.all(months.map(async ({ mes: m, ano: a }) => {
      let query = supabase.from('lancamentos').select('valor').eq('mes', m).eq('ano', a)
      if (currentView !== 'conjunto') {
        query = query.or(`dono.eq.${currentView},dono.eq.conjunto`)
      }
      const { data } = await query
      const total = (data || []).reduce((s, l) => s + Number(l.valor), 0)
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      return { mes: meses[m - 1], total }
    }))
    setLast6(results)
  }

  async function saveRenda() {
    const valor = parseFloat(rendaInput.replace(',', '.'))
    if (isNaN(valor)) return
    const dono = currentView === 'conjunto' ? 'eu' : currentView
    await supabase.from('rendas').upsert({
      user_id: user?.id || '00000000-0000-0000-0000-000000000001',
      dono,
      mes,
      ano,
      valor,
    }, { onConflict: 'dono,mes,ano' })
    setRenda(valor)
    setEditingRenda(false)
  }

  // Métricas do Mês Atual
  const totalAtual = lancamentos.reduce((s, l) => s + Number(l.valor), 0)
  const totalPagoAtual = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const totalAguardandoAtual = lancamentos.filter(l => l.status !== 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const sobraAtual = renda - totalAtual

  // Métricas do Mês Anterior
  const totalAnterior = prevLancamentos.reduce((s, l) => s + Number(l.valor), 0)
  const totalPagoAnterior = prevLancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)

  // Comparações de Mês a Mês (MoM)
  const diffTotal = totalAtual - totalAnterior
  const pctDiffTotal = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0
  const economizou = diffTotal < 0

  // Comparação por Categoria
  const catComparisonList: CategoryComparison[] = []
  const catSet = new Set<string>()
  lancamentos.forEach(l => l.categoria_id && catSet.add(l.categoria_id))
  prevLancamentos.forEach(l => l.categoria_id && catSet.add(l.categoria_id))

  catSet.forEach(catId => {
    const cat = categorias.find(c => c.id === catId)
    const name = cat?.nome || 'Sem categoria'
    const icone = cat?.icone || '📦'
    const valAtual = lancamentos.filter(l => l.categoria_id === catId).reduce((s, l) => s + Number(l.valor), 0)
    const valAnterior = prevLancamentos.filter(l => l.categoria_id === catId).reduce((s, l) => s + Number(l.valor), 0)
    const diff = valAtual - valAnterior
    const pctChange = valAnterior > 0 ? ((valAtual - valAnterior) / valAnterior) * 100 : valAtual > 0 ? 100 : 0

    catComparisonList.push({ id: catId, name, icone, valAtual, valAnterior, diff, pctChange })
  })

  // Ordenar categorias por maior valor atual
  catComparisonList.sort((a, b) => b.valAtual - a.valAtual)

  // Encontrar maior aumento e maior economia por categoria
  const catMaiorAumento = [...catComparisonList].filter(c => c.diff > 0).sort((a, b) => b.diff - a.diff)[0]
  const catMaiorEconomia = [...catComparisonList].filter(c => c.diff < 0).sort((a, b) => a.diff - b.diff)[0]

  // Dados para Pie Chart
  const catMap: Record<string, number> = {}
  lancamentos.forEach(l => {
    const cat = categorias.find(c => c.id === l.categoria_id)
    const nome = cat ? `${cat.icone} ${cat.nome}` : '📦 Outros'
    catMap[nome] = (catMap[nome] || 0) + Number(l.valor)
  })
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }))

  const pctGasto = renda > 0 ? Math.min((totalAtual / renda) * 100, 100) : 0

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Financeiro</h1>
          <p className="page-subtitle">
            Visão Geral e Comparativo — {MESES_NOMES[mes]} / {ano} ({currentView === 'eu' ? user?.nome || 'Eu' : currentView === 'esposa' ? 'Esposa' : 'Conjunto (Casal)'})
          </p>
        </div>
        <button
          id="btn-novo-lancamento-dash"
          className="btn btn-primary"
          onClick={() => router.push('/contas')}
        >
          <Plus size={16} />
          Nova Conta
        </button>
      </div>

      {/* Caixa de Insights e Avisos Inteligentes (Caixinha Pedida pelo Usuário) */}
      <div
        className="card card-p"
        style={{
          marginBottom: '1.5rem',
          background: economizou
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03))'
            : diffTotal > 0
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.03))'
            : 'linear-gradient(135deg, var(--color-primary-muted), var(--color-bg-card))',
          border: `1.5px solid ${economizou ? 'rgba(16, 185, 129, 0.3)' : diffTotal > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-primary-muted)'}`,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
          borderRadius: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: economizou ? '#10B981' : diffTotal > 0 ? '#EF4444' : 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)'
            }}
          >
            {economizou ? <PartyPopper size={26} /> : diffTotal > 0 ? <AlertTriangle size={26} /> : <Lightbulb size={26} />}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                {economizou
                  ? `🎉 Ótima notícia! Você diminuiu suas contas em ${mask(formatCurrency(Math.abs(diffTotal)))}!`
                  : diffTotal > 0
                  ? `⚠️ Atenção! Seus gastos aumentaram em ${mask(formatCurrency(diffTotal))} neste mês.`
                  : `⚖️ Seus gastos estão idênticos ao mês anterior (${MESES_NOMES[prevMes]}).`}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 12,
                  background: economizou ? 'rgba(16, 185, 129, 0.2)' : diffTotal > 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--color-primary-muted)',
                  color: economizou ? '#10B981' : diffTotal > 0 ? '#EF4444' : 'var(--color-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                {economizou ? <ArrowDownRight size={14} /> : diffTotal > 0 ? <ArrowUpRight size={14} /> : <Minus size={14} />}
                {totalAnterior > 0 ? `${Math.abs(pctDiffTotal).toFixed(1)}%` : 'Novo mês'} vs {MESES_NOMES[prevMes]}
              </span>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {economizou ? (
                <>
                  Você gastou <strong>{mask(formatCurrency(totalAtual))}</strong> em {MESES_NOMES[mes]}, contra <strong>{mask(formatCurrency(totalAnterior))}</strong> em {MESES_NOMES[prevMes]}.
                  {catMaiorEconomia && <> A categoria onde você mais economizou foi <strong>{catMaiorEconomia.icone} {catMaiorEconomia.name}</strong> (-{mask(formatCurrency(Math.abs(catMaiorEconomia.diff)))}).</>}
                </>
              ) : diffTotal > 0 ? (
                <>
                  Seu total de contas em {MESES_NOMES[mes]} é de <strong>{mask(formatCurrency(totalAtual))}</strong> (em {MESES_NOMES[prevMes]} foi {mask(formatCurrency(totalAnterior))}).
                  {catMaiorAumento && <> O maior aumento ocorreu em <strong>{catMaiorAumento.icone} {catMaiorAumento.name}</strong> (+{mask(formatCurrency(catMaiorAumento.diff))}).</>}
                </>
              ) : (
                <>Suas despesas permaneceram estáveis. Mantenha o controle do seu orçamento!</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Renda e Sobra */}
      <div className="card card-p" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg, var(--color-bg-card), var(--color-primary-muted))', border: '1.5px solid var(--color-primary-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Salário / Renda Mensal — {MESES_NOMES[mes]}
              </div>
              {!editingRenda ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {renda > 0 ? mask(formatCurrency(renda)) : 'Não definido'}
                  </span>
                  <button
                    id="btn-editar-salario"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setEditingRenda(true)}
                    title="Definir Salário"
                  >
                    <Edit3 size={14} color="var(--color-primary)" />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    id="input-salario-dash"
                    type="number"
                    step="0.01"
                    className="form-input"
                    style={{ width: 140, padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                    placeholder="0,00"
                    value={rendaInput}
                    onChange={e => setRendaInput(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={saveRenda}>
                    <Save size={14} /> Salvar
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingRenda(false)}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {sobraAtual >= 0 ? '💰 Sobra Estimada' : '🚨 Orçamento Excedido'}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: sobraAtual >= 0 ? 'var(--color-status-pago)' : 'var(--color-status-aguardando)' }}>
              {renda > 0 ? mask(formatCurrency(sobraAtual)) : '—'}
            </div>
          </div>
        </div>

        {renda > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              <span>Comprometido: {pctGasto.toFixed(1)}% do salário</span>
              <span>Gasto: {mask(formatCurrency(totalAtual))} de {mask(formatCurrency(renda))}</span>
            </div>
            <div className="progress-bar" style={{ height: 10 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${pctGasto}%`,
                  background: pctGasto > 90 ? 'var(--color-status-aguardando)' : 'var(--color-primary)'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cards de Métricas e Comparativo Direto Mês a Mês */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card card-p card-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Gastos {MESES_NOMES[mes]}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                {mask(formatCurrency(totalAtual))}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} color="var(--color-primary)" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', marginTop: '0.5rem', color: economizou ? 'var(--color-status-pago)' : diffTotal > 0 ? 'var(--color-status-aguardando)' : 'var(--color-text-muted)' }}>
            {economizou ? <ArrowDownRight size={14} /> : diffTotal > 0 ? <ArrowUpRight size={14} /> : <Minus size={14} />}
            <span>{totalAnterior > 0 ? `${diffTotal > 0 ? '+' : ''}${mask(formatCurrency(diffTotal))}` : 'Sem dados do mês anterior'}</span>
          </div>
        </div>

        <div className="card card-p card-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Já Quitado</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-status-pago)', marginTop: '0.25rem' }}>
                {mask(formatCurrency(totalPagoAtual))}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-status-pago-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={18} color="var(--color-status-pago)" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            {totalAtual > 0 ? `${((totalPagoAtual / totalAtual) * 100).toFixed(0)}% das contas pagas` : '—'}
          </div>
        </div>

        <div className="card card-p card-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>A Pagar (Pendente)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-status-aguardando)', marginTop: '0.25rem' }}>
                {mask(formatCurrency(totalAguardandoAtual))}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-status-aguardando-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="var(--color-status-aguardando)" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Falta pagar este mês</div>
        </div>

        <div className="card card-p card-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Mês Anterior ({MESES_NOMES[prevMes]})</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                {mask(formatCurrency(totalAnterior))}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={18} color="var(--color-text-secondary)" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>{prevLancamentos.length} conta(s) registradas</div>
        </div>
      </div>

      {/* Gráficos em Linha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Gráfico 1: Categorias */}
        <div className="card card-p">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Distribuição por Categoria em {MESES_NOMES[mes]}</h3>
          </div>
          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Sem lançamentos em {MESES_NOMES[mes]}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => mask(formatCurrency(Number(v || 0)))}
                  contentStyle={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    color: 'var(--color-text)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico 2: Evolução dos 6 Meses */}
        <div className="card card-p">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Histórico dos Últimos 6 Meses</h3>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={last6}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="mes" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => mask(formatCurrency(Number(v || 0)))}
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  color: 'var(--color-text)',
                }}
              />
              <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} name="Total Gasto" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de Comparação Detalhada Categoria por Categoria (Mês Atual vs Mês Anterior) */}
      <div className="card card-p" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
              Comparativo Detalhado de Categorias: {MESES_NOMES[prevMes]} vs {MESES_NOMES[mes]}
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Variação positiva = Economia 🟢 | Variação negativa = Aumento 🔴
          </span>
        </div>

        {catComparisonList.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-title">Nenhum dado comparativo disponível para estes meses</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th style={{ textAlign: 'right' }}>{MESES_NOMES[prevMes]}</th>
                  <th style={{ textAlign: 'right' }}>{MESES_NOMES[mes]}</th>
                  <th style={{ textAlign: 'right' }}>Diferença (R$)</th>
                  <th style={{ textAlign: 'right' }}>Variação (%)</th>
                </tr>
              </thead>
              <tbody>
                {catComparisonList.map(cat => {
                  const catEconomizou = cat.diff < 0
                  const catAumentou = cat.diff > 0
                  return (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {cat.icone} {cat.name}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        {mask(formatCurrency(cat.valAnterior))}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}>
                        {mask(formatCurrency(cat.valAtual))}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: catEconomizou ? 'var(--color-status-pago)' : catAumentou ? 'var(--color-status-aguardando)' : 'var(--color-text-muted)',
                        }}
                      >
                        {cat.diff === 0 ? '—' : `${catAumentou ? '+' : ''}${mask(formatCurrency(cat.diff))}`}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 10,
                            background: catEconomizou ? 'rgba(16, 185, 129, 0.15)' : catAumentou ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-border)',
                            color: catEconomizou ? '#10B981' : catAumentou ? '#EF4444' : 'var(--color-text-muted)',
                          }}
                        >
                          {catEconomizou ? <ArrowDownRight size={12} /> : catAumentou ? <ArrowUpRight size={12} /> : null}
                          {cat.valAnterior === 0 && cat.valAtual > 0 ? 'Novo' : `${cat.diff > 0 ? '+' : ''}${cat.pctChange.toFixed(0)}%`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
