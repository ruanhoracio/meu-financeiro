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
  Clock, Sparkles, Plus, DollarSign, Edit3, Save, X
} from 'lucide-react'
import type { Lancamento, Categoria } from '@/lib/database.types'

const COLORS = ['#820AD1','#A855F7','#EC4899','#EF4444','#F97316','#F59E0B','#10B981','#06B6D4','#3B82F6','#6366F1','#8B5CF6','#14B8A6']

export default function DashboardPage() {
  const { user, loading, currentView } = useAuth()
  const { mes, ano } = useMonth()
  const { mask } = useHideValues()
  const router = useRouter()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [renda, setRenda] = useState(0)
  const [rendaInput, setRendaInput] = useState('')
  const [editingRenda, setEditingRenda] = useState(false)
  const [last6, setLast6] = useState<{ mes: string; total: number }[]>([])
  const [loadingData, setLoadingData] = useState(true)

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
    await Promise.all([loadLancamentos(), loadCategorias(), loadRenda(), loadLast6()])
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

  async function loadCategorias() {
    const { data } = await supabase.from('categorias').select('*').order('nome')
    setCategorias(data || [])
  }

  async function loadRenda() {
    if (currentView === 'conjunto') {
      const { data: dataEu } = await supabase.from('rendas').select('valor').eq('dono', 'eu').eq('mes', mes).eq('ano', ano).single()
      const { data: dataEsposa } = await supabase.from('rendas').select('valor').eq('dono', 'esposa').eq('mes', mes).eq('ano', ano).single()
      const total = (dataEu?.valor || 0) + (dataEsposa?.valor || 0)
      setRenda(total)
      setRendaInput(total.toString())
    } else {
      const { data } = await supabase.from('rendas').select('valor').eq('dono', currentView).eq('mes', mes).eq('ano', ano).single()
      setRenda(data?.valor || 0)
      setRendaInput(data?.valor?.toString() || '')
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
      user_id: user!.id,
      dono,
      mes,
      ano,
      valor,
    }, { onConflict: 'dono,mes,ano' })
    setRenda(valor)
    setEditingRenda(false)
  }

  const total = lancamentos.reduce((s, l) => s + Number(l.valor), 0)
  const totalPago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const totalAguardando = lancamentos.filter(l => l.status !== 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const sobra = renda - total

  const catMap: Record<string, number> = {}
  lancamentos.forEach(l => {
    const cat = categorias.find(c => c.id === l.categoria_id)
    const nome = cat?.nome || 'Outros'
    catMap[nome] = (catMap[nome] || 0) + Number(l.valor)
  })
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }))

  const pctGasto = renda > 0 ? Math.min((total / renda) * 100, 100) : 0

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Visão geral — {currentView === 'eu' ? user?.nome || 'Eu' : currentView === 'esposa' ? 'Esposa' : 'Conjunto (Casal)'}
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

      <div className="card card-p" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg, var(--color-bg-card), var(--color-primary-muted))', border: '1.5px solid var(--color-primary-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Salário / Renda Mensal
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
              {sobra >= 0 ? '💰 Sobra Estimada' : '🚨 Orçamento Excedido'}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: sobra >= 0 ? 'var(--color-status-pago)' : 'var(--color-status-aguardando)' }}>
              {renda > 0 ? mask(formatCurrency(sobra)) : '—'}
            </div>
          </div>
        </div>

        {renda > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              <span>Comprometido: {pctGasto.toFixed(1)}% do salário</span>
              <span>Gasto: {mask(formatCurrency(total))} de {mask(formatCurrency(renda))}</span>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card card-p card-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Gastos</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                {mask(formatCurrency(total))}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} color="var(--color-primary)" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>{lancamentos.length} conta(s) registradas</div>
        </div>

        <div className="card card-p card-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Já Pago</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-status-pago)', marginTop: '0.25rem' }}>
                {mask(formatCurrency(totalPago))}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-status-pago-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={18} color="var(--color-status-pago)" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            {total > 0 ? `${((totalPago / total) * 100).toFixed(0)}% do total quitado` : '—'}
          </div>
        </div>

        <div className="card card-p card-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>A Pagar</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-status-aguardando)', marginTop: '0.25rem' }}>
                {mask(formatCurrency(totalAguardando))}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-status-aguardando-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="var(--color-status-aguardando)" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Pendente para pagar</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="card card-p">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Gastos por Categoria</h3>
          </div>
          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Sem lançamentos</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
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

        <div className="card card-p">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Evolução dos Últimos 6 Meses</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
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
    </AppLayout>
  )
}
