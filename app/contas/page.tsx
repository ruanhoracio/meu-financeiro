'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useMonth } from '@/contexts/MonthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getStatusLabel, getTipoLabel } from '@/lib/utils'
import { Plus, Check, Trash2, Copy, Pencil, ChevronDown, Filter } from 'lucide-react'
import type { Lancamento, Categoria, ViewType } from '@/lib/database.types'

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function ContasPage() {
  const { user, loading, currentView, setCurrentView } = useAuth()
  const { mes, ano, setMonth } = useMonth()
  const { mask } = useHideValues()
  const router = useRouter()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [form, setForm] = useState({
    dono: 'eu' as 'eu' | 'esposa' | 'conjunto',
    categoria_id: '',
    descricao: '',
    valor: '',
    tipo: 'parcela_unica' as 'fixa' | 'parcela_unica' | 'parcelado',
    status: 'aguardando' as 'pago' | 'aguardando' | 'proximo_mes',
    data_vencimento: '',
    parcela_atual: 1,
    parcelas_total: 2,
  })

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) { loadData() }
  }, [mes, ano, currentView, user])

  async function loadData() {
    let query = supabase.from('lancamentos').select('*').eq('mes', mes).eq('ano', ano).neq('origem', 'cartao')
    if (currentView !== 'conjunto') {
      query = query.or(`dono.eq.${currentView},dono.eq.conjunto`)
    }
    const [l, c] = await Promise.all([
      query.order('created_at', { ascending: false }),
      supabase.from('categorias').select('*').order('nome'),
    ])
    setLancamentos(l.data || [])
    setCategorias(c.data || [])
  }

  function resetForm() {
    setForm({
      dono: currentView === 'conjunto' ? 'conjunto' : currentView as 'eu' | 'esposa',
      categoria_id: '',
      descricao: '',
      valor: '',
      tipo: 'parcela_unica',
      status: 'aguardando',
      data_vencimento: '',
      parcela_atual: 1,
      parcelas_total: 2,
    })
    setEditingId(null)
  }

  function openNew() {
    resetForm()
    setShowModal(true)
  }

  function openEdit(l: Lancamento) {
    setForm({
      dono: l.dono,
      categoria_id: l.categoria_id || '',
      descricao: l.descricao || '',
      valor: l.valor.toString(),
      tipo: l.tipo,
      status: l.status,
      data_vencimento: l.data_vencimento || '',
      parcela_atual: l.parcela_atual || 1,
      parcelas_total: l.parcelas_total || 2,
    })
    setEditingId(l.id)
    setShowModal(true)
  }

  async function saveForm() {
    if (!form.valor || parseFloat(form.valor.replace(',', '.')) <= 0) return
    setSaving(true)

    const baseData = {
      user_id: user!.id,
      dono: form.dono,
      categoria_id: form.categoria_id || null,
      descricao: form.descricao || null,
      valor: parseFloat(form.valor.replace(',', '.')),
      tipo: form.tipo,
      data_vencimento: form.data_vencimento || null,
    }

    let error

    if (editingId) {
      const updateData = {
        ...baseData,
        parcela_atual: form.tipo === 'parcelado' ? form.parcela_atual : null,
        parcelas_total: form.tipo === 'parcelado' ? form.parcelas_total : null,
      }
      ;({ error } = await supabase.from('lancamentos').update(updateData as any).eq('id', editingId))
    } else if (form.tipo === 'parcelado' && form.parcelas_total > 1) {
      const inserts = []
      const startParcela = form.parcela_atual || 1
      for (let i = 0; i < form.parcelas_total; i++) {
        let targetMes = mes + i
        let targetAno = ano
        while (targetMes > 12) { targetMes -= 12; targetAno++ }
        inserts.push({
          ...baseData,
          mes: targetMes,
          ano: targetAno,
          status: 'aguardando',
          origem: 'manual',
          parcela_atual: startParcela + i,
          parcelas_total: form.parcelas_total,
        })
      }
      ({ error } = await supabase.from('lancamentos').insert(inserts as any))
    } else {
      ({ error } = await supabase.from('lancamentos').insert({
        ...baseData,
        mes,
        ano,
        status: form.status,
        origem: 'manual',
        parcela_atual: null,
        parcelas_total: null,
      } as any))
    }

    setSaving(false)
    if (error) {
      console.error('Erro ao salvar lançamento no Supabase:', error)
      showToast(`Erro ao salvar: ${error.message}`, 'error')
    } else {
      showToast(editingId ? 'Atualizado!' : 'Conta adicionada!', 'success')
      setShowModal(false)
      loadData()
    }
  }

  async function markAsPaid(id: string) {
    await supabase.from('lancamentos').update({ status: 'pago' }).eq('id', id)
    showToast('Marcado como pago! ✅', 'success')
    loadData()
  }

  async function deleteLancamento(id: string) {
    if (!confirm('Remover este lançamento?')) return
    await supabase.from('lancamentos').delete().eq('id', id)
    showToast('Removido.', 'success')
    loadData()
  }

  async function duplicateToNextMonth(l: Lancamento) {
    const nextMes = l.mes === 12 ? 1 : l.mes + 1
    const nextAno = l.mes === 12 ? l.ano + 1 : l.ano

    if (l.tipo === 'parcelado' && l.parcelas_total) {
      const nextParcela = (l.parcela_atual || 1) + 1
      if (nextParcela > l.parcelas_total) {
        showToast('Todas as parcelas já foram geradas! ✅', 'error')
        return
      }
      await supabase.from('lancamentos').insert({
        user_id: user!.id,
        dono: l.dono,
        mes: nextMes,
        ano: nextAno,
        categoria_id: l.categoria_id,
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        status: 'aguardando',
        data_vencimento: null,
        origem: l.origem || 'manual',
        parcela_atual: nextParcela,
        parcelas_total: l.parcelas_total,
      })
      showToast(`Duplicado para ${MESES_NOMES[nextMes - 1]} (${nextParcela}/${l.parcelas_total})! 📋`, 'success')
    } else if (l.tipo === 'fixa') {
      await supabase.from('lancamentos').insert({
        user_id: user!.id,
        dono: l.dono,
        mes: nextMes,
        ano: nextAno,
        categoria_id: l.categoria_id,
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        status: 'aguardando',
        data_vencimento: null,
        origem: l.origem || 'manual',
        parcela_atual: null,
        parcelas_total: null,
      })
      showToast(`Duplicado para ${MESES_NOMES[nextMes - 1]}! 📋`, 'success')
    } else {
      await supabase.from('lancamentos').insert({
        user_id: user!.id,
        dono: l.dono,
        mes: nextMes,
        ano: nextAno,
        categoria_id: l.categoria_id,
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        status: 'aguardando',
        data_vencimento: null,
        origem: l.origem || 'manual',
        parcela_atual: null,
        parcelas_total: null,
      })
      showToast(`Duplicado para ${MESES_NOMES[nextMes - 1]}! 📋`, 'success')
    }
  }

  async function duplicateAllToNextMonth() {
    const toDuplicate = lancamentos.filter(l => {
      if (l.tipo === 'parcelado' && l.parcelas_total && (l.parcela_atual || 1) >= l.parcelas_total) return false
      return true
    })
    if (toDuplicate.length === 0) { showToast('Nenhuma conta para duplicar.', 'error'); return }
    const nextMes = mes === 12 ? 1 : mes + 1
    const nextAno = mes === 12 ? ano + 1 : ano
    const inserts = toDuplicate.map(l => ({
      user_id: user!.id,
      dono: l.dono,
      mes: nextMes,
      ano: nextAno,
      categoria_id: l.categoria_id,
      descricao: l.descricao,
      valor: l.valor,
      tipo: l.tipo,
      status: 'aguardando',
      data_vencimento: null,
      origem: l.origem || 'manual',
      parcela_atual: l.tipo === 'parcelado' ? (l.parcela_atual || 1) + 1 : null,
      parcelas_total: l.tipo === 'parcelado' ? l.parcelas_total : null,
    }))
    await supabase.from('lancamentos').insert(inserts)
    showToast(`${inserts.length} contas duplicadas para ${MESES_NOMES[nextMes - 1]}! 🚀`, 'success')
    loadData()
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const filtered = filterStatus === 'todos' ? lancamentos : lancamentos.filter(l => l.status === filterStatus)
  const total = filtered.reduce((s, l) => s + Number(l.valor), 0)
  const totalPago = filtered.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const totalRestante = filtered.filter(l => l.status !== 'pago').reduce((s, l) => s + Number(l.valor), 0)

  const statusBorderColor = (status: string) => ({
    pago: '#22C55E', aguardando: '#EAB308', proximo_mes: '#3B82F6'
  }[status] || '#E5E7EB')

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contas</h1>
          <p className="page-subtitle">{MESES_NOMES[mes - 1]}/{ano}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            id="btn-duplicar-tudo"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              const toDuplicate = lancamentos.filter(l => {
                if (l.tipo === 'parcelado' && l.parcelas_total && (l.parcela_atual || 1) >= l.parcelas_total) return false
                return true
              })
              if (toDuplicate.length === 0) { showToast('Nenhuma conta para duplicar.', 'error'); return }
              await duplicateAllToNextMonth()
            }}
            title="Duplicar todas as contas para o próximo mês"
          >
            <Copy size={14} />
            Duplicar Tudo
          </button>
          <button id="btn-nova-conta" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} />
            Nova Conta
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['todos', 'pago', 'aguardando', 'proximo_mes'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'todos' ? 'Todos' : getStatusLabel(s)}
          </button>
        ))}
      </div>

      <div className="table-container" style={{ marginBottom: '1rem' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-title">Nenhuma conta</div>
            <div className="empty-state-text">Adicione sua primeira conta do mês.</div>
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={16} />
              Adicionar conta
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Dono</th>
                <th>Tipo</th>
                <th>Vencimento</th>
                <th>Parcelas</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const cat = categorias.find(c => c.id === l.categoria_id)
                return (
                  <tr key={l.id} style={{ borderLeft: `3px solid ${statusBorderColor(l.status)}` }}>
                    <td style={{ fontWeight: 700, fontSize: '0.95rem', maxWidth: 220 }}>
                      <span className="truncate" style={{ display: 'block' }}>{l.descricao || '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>{cat?.icone || '📦'}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{cat?.nome || 'Outros'}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--color-primary-muted)',
                        color: 'var(--color-primary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {l.dono === 'eu' ? user?.nome || 'Eu' : l.dono === 'esposa' ? 'Esposa' : 'Conjunto'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {getTipoLabel(l.tipo, l.parcela_atual, l.parcelas_total)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {l.data_vencimento
                        ? new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {l.tipo === 'fixa' ? '🔄 Fixa' :
                       l.tipo === 'parcela_unica' ? '🔹 Única' :
                       l.parcelas_total ? `${l.parcela_atual || 1}/${l.parcelas_total}` : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${l.status === 'proximo_mes' ? 'proximo' : l.status}`}>
                        {l.status === 'pago' ? '✅ Pago' : l.status === 'aguardando' ? '⏳ Aguardando' : '📅 Próximo mês'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                      {mask(formatCurrency(Number(l.valor)))}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {l.status !== 'pago' && (
                          <button
                            className="btn btn-icon btn-sm"
                            title="Marcar como pago"
                            onClick={() => markAsPaid(l.id)}
                            style={{ background: 'var(--color-status-pago-bg)', color: 'var(--color-status-pago)', width: 30, height: 30 }}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          className="btn btn-icon btn-sm btn-ghost"
                          title="Editar"
                          onClick={() => openEdit(l)}
                          style={{ width: 30, height: 30 }}
                        >
                          <Pencil size={13} />
                        </button>
                        {(l.tipo === 'fixa' || l.tipo === 'parcelado' || l.tipo === 'parcela_unica') && (
                          <button
                            className="btn btn-icon btn-sm btn-ghost"
                            title="Duplicar para próximo mês"
                            onClick={() => duplicateToNextMonth(l)}
                            style={{ width: 30, height: 30 }}
                          >
                            <Copy size={13} />
                          </button>
                        )}
                        <button
                          className="btn btn-icon btn-sm btn-danger"
                          title="Remover"
                          onClick={() => deleteLancamento(l.id)}
                          style={{ width: 30, height: 30 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="table-footer">
              <tr>
                <td colSpan={6} style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {filtered.length} lançamentos
                </td>
                <td style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Pago: <strong style={{ color: 'var(--color-status-pago)' }}>{mask(formatCurrency(totalPago))}</strong>
                    {' · '}
                    Restante: <strong style={{ color: 'var(--color-status-aguardando)' }}>{mask(formatCurrency(totalRestante))}</strong>
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontSize: '1rem' }}>{mask(formatCurrency(total))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Editar Conta' : 'Nova Conta'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Dono *</label>
                  <select className="form-select" value={form.dono} onChange={e => setForm(f => ({ ...f, dono: e.target.value as any }))}>
                    <option value="eu">{user?.nome || 'Eu'}</option>
                    <option value="esposa">Esposa</option>
                    <option value="conjunto">Conjunto</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select className="form-select" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                    <option value="">Selecionar...</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input
                  className="form-input"
                  placeholder="Ex: Netflix, Aluguel, Mercado..."
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                />
              </div>

              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Valor (R$) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vencimento</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.data_vencimento}
                    onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Lançamento</label>
                <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}>
                  <option value="fixa">🔄 Fixa (recorrente todo mês)</option>
                  <option value="parcela_unica">🔹 Parcela Única</option>
                  <option value="parcelado">📦 Parcelado</option>
                </select>
              </div>

              {form.tipo === 'parcelado' && (
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Parcela Atual</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max={form.parcelas_total}
                      value={form.parcela_atual}
                      onChange={e => setForm(f => ({ ...f, parcela_atual: Math.max(1, parseInt(e.target.value) || 1) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total de Parcelas</label>
                    <input
                      className="form-input"
                      type="number"
                      min="2"
                      max="120"
                      value={form.parcelas_total}
                      onChange={e => setForm(f => ({ ...f, parcelas_total: Math.max(2, parseInt(e.target.value) || 2) }))}
                    />
                  </div>
                </div>
              )}

              {form.tipo !== 'parcelado' && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                    <option value="aguardando">⏳ Aguardando</option>
                    <option value="pago">✅ Pago</option>
                    <option value="proximo_mes">📅 Próximo mês</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button
                id="btn-salvar-conta"
                className="btn btn-primary"
                onClick={saveForm}
                disabled={saving}
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : form.tipo === 'parcelado' ? `Gerar ${form.parcelas_total} parcelas` : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
