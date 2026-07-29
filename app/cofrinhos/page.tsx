'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getCurrentMonth } from '@/lib/utils'
import { Plus, Trash2, Pencil, TrendingUp, Clock, Target, Calendar } from 'lucide-react'
import type { Cofrinho, AporteCofrinho } from '@/lib/database.types'

export default function CofrinhosPage() {
  const { user, loading, currentView, setCurrentView } = useAuth()
  const router = useRouter()
  const { mes, ano } = getCurrentMonth()
  const [cofrinhos, setCofrinhos] = useState<Cofrinho[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showAporteModal, setShowAporteModal] = useState(false)
  const [selectedCofrinho, setSelectedCofrinho] = useState<Cofrinho | null>(null)
  const [aportes, setAportes] = useState<AporteCofrinho[]>([])
  const [form, setForm] = useState({ nome: '', icone: '🏆', cor: '#820AD1', valor_alvo: '', data_fim: '', descricao: '' })
  const [aporteForm, setAporteForm] = useState({ valor: '', observacao: '', dono: 'eu' as 'eu' | 'esposa' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [editingCofrinho, setEditingCofrinho] = useState<Cofrinho | null>(null)

  const ICONES_COFRINHO = ['🏆','✈️','🏠','🚗','📱','💻','🎓','💍','🐣','🏖️','🛍️','💰','🎯','🏋️','🎪']
  const CORES = ['#820AD1','#10B981','#EF4444','#F59E0B','#3B82F6','#EC4899','#06B6D4','#F97316']

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadCofrinhos()
  }, [user])

  async function loadCofrinhos() {
    const { data } = await supabase.from('cofrinhos').select('*').order('created_at')
    setCofrinhos(data || [])
  }

  async function loadAportes(cofrinhoId: string) {
    const { data } = await supabase.from('aportes_cofrinhos').select('*').eq('cofrinho_id', cofrinhoId).order('data', { ascending: false })
    setAportes(data || [])
  }

  async function saveCofrinho() {
    if (!form.nome || !form.valor_alvo) return
    setSaving(true)
    const { error } = await supabase.from('cofrinhos').insert({
      nome: form.nome,
      icone: form.icone,
      cor: form.cor,
      valor_alvo: parseFloat(form.valor_alvo),
      valor_atual: 0,
      data_fim: form.data_fim || null,
      descricao: form.descricao || null,
    })
    setSaving(false)
    if (!error) {
      showToast('Cofrinho criado! 🎉', 'success')
      setShowModal(false)
      setEditingCofrinho(null)
      setForm({ nome: '', icone: '🏆', cor: '#820AD1', valor_alvo: '', data_fim: '', descricao: '' })
      loadCofrinhos()
    }
  }

  async function saveAporte() {
    if (!selectedCofrinho || !aporteForm.valor) return
    setSaving(true)
    const valor = parseFloat(aporteForm.valor)
    const { error } = await supabase.from('aportes_cofrinhos').insert({
      cofrinho_id: selectedCofrinho.id,
      user_id: user!.id,
      dono: aporteForm.dono,
      valor,
      observacao: aporteForm.observacao || null,
      data: new Date().toISOString().split('T')[0],
    })
    if (!error) {
      await supabase.from('cofrinhos').update({ valor_atual: selectedCofrinho.valor_atual + valor }).eq('id', selectedCofrinho.id)
      showToast('Aporte registrado! 💰', 'success')
      setShowAporteModal(false)
      setAporteForm({ valor: '', observacao: '', dono: 'eu' })
      loadCofrinhos()
    }
    setSaving(false)
  }

  async function deleteCofrinho(id: string) {
    if (!confirm('Remover este cofrinho e todos os aportes?')) return
    await supabase.from('cofrinhos').delete().eq('id', id)
    showToast('Cofrinho removido.', 'success')
    loadCofrinhos()
  }

  function openEdit(c: Cofrinho) {
    setEditingCofrinho(c)
    setForm({
      nome: c.nome,
      icone: c.icone || '🏆',
      cor: c.cor || '#820AD1',
      valor_alvo: String(c.valor_alvo),
      data_fim: c.data_fim || '',
      descricao: c.descricao || '',
    })
    setShowModal(true)
  }

  async function updateCofrinho() {
    if (!editingCofrinho || !form.nome || !form.valor_alvo) return
    setSaving(true)
    const { error } = await supabase.from('cofrinhos').update({
      nome: form.nome,
      icone: form.icone,
      cor: form.cor,
      valor_alvo: parseFloat(form.valor_alvo),
      data_fim: form.data_fim || null,
      descricao: form.descricao || null,
    }).eq('id', editingCofrinho.id)
    setSaving(false)
    if (!error) {
      showToast('Cofrinho atualizado! ✏️', 'success')
      setShowModal(false)
      setEditingCofrinho(null)
      loadCofrinhos()
    }
  }

  function openAporte(c: Cofrinho) {
    setSelectedCofrinho(c)
    loadAportes(c.id)
    setShowAporteModal(true)
    setAporteForm({ valor: '', observacao: '', dono: user?.dono || 'eu' })
  }

  function calcularMetaMensal(c: Cofrinho): string {
    if (!c.data_fim) return ''
    const hoje = new Date()
    const dataFim = new Date(c.data_fim)
    if (dataFim <= hoje) return ''
    const resto = c.valor_alvo - c.valor_atual
    if (resto <= 0) return ''
    const diffMs = dataFim.getTime() - hoje.getTime()
    const mesesRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44))
    if (mesesRestantes <= 0) return ''
    const mensal = resto / mesesRestantes
    return `${formatCurrency(mensal)}/mês`
  }

  function estimarTempo(c: Cofrinho): string {
    if (aportes.length === 0) return '—'
    const recentes = aportes.slice(0, 6)
    const mediaAporte = recentes.reduce((s, a) => s + Number(a.valor), 0) / recentes.length
    if (mediaAporte <= 0) return '—'
    const restante = c.valor_alvo - c.valor_atual
    if (restante <= 0) return 'Meta atingida! 🎉'
    const meses = Math.ceil(restante / mediaAporte)
    if (meses === 1) return '~1 mês'
    if (meses < 12) return `~${meses} meses`
    return `~${(meses / 12).toFixed(1)} anos`
  }

  function showToast(msg: string, type: string) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function closeModal() {
    setShowModal(false)
    setEditingCofrinho(null)
    setForm({ nome: '', icone: '🏆', cor: '#820AD1', valor_alvo: '', data_fim: '', descricao: '' })
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cofrinhos</h1>
          <p className="page-subtitle">Metas de economia do casal</p>
        </div>
        <button id="btn-novo-cofrinho" className="btn btn-primary" onClick={() => {
          setEditingCofrinho(null)
          setForm({ nome: '', icone: '🏆', cor: '#820AD1', valor_alvo: '', data_fim: '', descricao: '' })
          setShowModal(true)
        }}>
          <Plus size={16} />
          Novo Cofrinho
        </button>
      </div>

      {cofrinhos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏺</div>
          <div className="empty-state-title">Nenhum cofrinho ainda</div>
          <div className="empty-state-text">Crie sua primeira meta de economia — viagem, reserva de emergência, reforma...</div>
          <button className="btn btn-primary" onClick={() => {
            setEditingCofrinho(null)
            setForm({ nome: '', icone: '🏆', cor: '#820AD1', valor_alvo: '', data_fim: '', descricao: '' })
            setShowModal(true)
          }}>
            <Plus size={16} />
            Criar cofrinho
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {cofrinhos.map(c => {
            const pct = c.valor_alvo > 0 ? Math.min((c.valor_atual / c.valor_alvo) * 100, 100) : 0
            const concluido = c.valor_atual >= c.valor_alvo
            
            return (
              <div key={c.id} className="cofrinho-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: `${c.cor || '#820AD1'}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem'
                    }}>
                      {c.icone}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{c.nome}</div>
                      {concluido && <span style={{ fontSize: '0.7rem', background: 'var(--color-status-pago-bg)', color: 'var(--color-status-pago)', padding: '0.15rem 0.4rem', borderRadius: 6, fontWeight: 600 }}>✅ Meta atingida!</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-icon btn-ghost btn-sm" style={{ width: 28, height: 28 }} onClick={() => openEdit(c)}>
                      <Pencil size={12} />
                    </button>
                    <button className="btn btn-icon btn-danger btn-sm" style={{ width: 28, height: 28 }} onClick={() => deleteCofrinho(c.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '0.625rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Progresso</span>
                    <span style={{ fontWeight: 700, color: c.cor || 'var(--color-primary)' }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 10 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.cor || '#820AD1'}, ${c.cor || '#820AD1'}cc)` }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Guardado</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: c.cor || 'var(--color-primary)' }}>{formatCurrency(c.valor_atual)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Meta</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(c.valor_alvo)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
                  {c.data_fim && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.75rem', color: 'var(--color-text-muted)',
                      padding: '0.35rem 0.6rem',
                      background: 'var(--color-bg)', borderRadius: 8
                    }}>
                      <Calendar size={12} />
                      até {new Date(c.data_fim).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    fontSize: '0.75rem', color: 'var(--color-text-muted)',
                    padding: '0.35rem 0.6rem',
                    background: 'var(--color-bg)', borderRadius: 8
                  }}>
                    <Clock size={12} />
                    Estimativa: {estimarTempo(c)}
                  </div>
                  {calcularMetaMensal(c) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.75rem', fontWeight: 700, color: c.cor || 'var(--color-primary)',
                      padding: '0.35rem 0.6rem',
                      background: 'var(--color-primary-muted)', borderRadius: 8
                    }}>
                      <Target size={12} />
                      {calcularMetaMensal(c)}
                    </div>
                  )}
                </div>

                <button
                  id={`btn-aportar-${c.id}`}
                  className="btn btn-primary w-full btn-sm"
                  onClick={() => openAporte(c)}
                >
                  <TrendingUp size={14} />
                  Fazer Aporte
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingCofrinho ? 'Editar Cofrinho' : 'Novo Cofrinho'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome da Meta *</label>
                <input className="form-input" placeholder="Ex: Viagem, Reserva de emergência..." value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Alvo (R$) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor_alvo} onChange={e => setForm(f => ({ ...f, valor_alvo: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Data Final</label>
                <input className="form-input" type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Com a data final, calculamos quanto guardar por mês
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Ícone</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {ICONES_COFRINHO.map(ic => (
                    <button key={ic} type="button" style={{ width: 40, height: 40, fontSize: '1.25rem', border: `2px solid ${form.icone === ic ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: form.icone === ic ? 'var(--color-primary-muted)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => setForm(f => ({ ...f, icone: ic }))}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cor</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {CORES.map(cor => (
                    <button key={cor} type="button" style={{ width: 28, height: 28, borderRadius: '50%', background: cor, border: form.cor === cor ? '3px solid var(--color-text)' : '2px solid transparent', outline: form.cor === cor ? '2px solid var(--color-primary)' : 'none', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, cor }))} />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição (opcional)</label>
                <input className="form-input" placeholder="Detalhes da meta..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button id="btn-salvar-cofrinho" className="btn btn-primary" onClick={editingCofrinho ? updateCofrinho : saveCofrinho} disabled={saving}>
                {saving ? 'Salvando...' : editingCofrinho ? 'Atualizar' : 'Criar Cofrinho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAporteModal && selectedCofrinho && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAporteModal(false) }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{selectedCofrinho.icone} Aportar em {selectedCofrinho.nome}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAporteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: 'var(--color-primary-muted)',
                borderRadius: 12,
                padding: '1rem',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>Guardado até agora</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>{formatCurrency(selectedCofrinho.valor_atual)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Meta total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(selectedCofrinho.valor_alvo)}</div>
                </div>
              </div>

              {selectedCofrinho.data_fim && (() => {
                const restante = selectedCofrinho.valor_alvo - selectedCofrinho.valor_atual
                if (restante > 0) {
                  const hoje = new Date()
                  const dataFim = new Date(selectedCofrinho.data_fim)
                  if (dataFim > hoje) {
                    const diffMs = dataFim.getTime() - hoje.getTime()
                    const mesesRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44))
                    if (mesesRestantes > 0) {
                      const mensal = restante / mesesRestantes
                      return (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={12} />
                          Meta até {new Date(selectedCofrinho.data_fim).toLocaleDateString('pt-BR')}
                          <span style={{ fontWeight: 700, color: selectedCofrinho.cor || 'var(--color-primary)' }}>
                            · {formatCurrency(mensal)}/mês
                          </span>
                        </div>
                      )
                    }
                  }
                }
                return null
              })()}

              <div className="form-group">
                <label className="form-label">Quem está aportando?</label>
                <select className="form-select" value={aporteForm.dono} onChange={e => setAporteForm(f => ({ ...f, dono: e.target.value as any }))}>
                  <option value="eu">{user?.nome || 'Eu'}</option>
                  <option value="esposa">Esposa</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={aporteForm.valor} onChange={e => setAporteForm(f => ({ ...f, valor: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input className="form-input" placeholder="Ex: Economia de julho..." value={aporteForm.observacao} onChange={e => setAporteForm(f => ({ ...f, observacao: e.target.value }))} />
              </div>

              {aportes.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Últimos aportes</div>
                  {aportes.slice(0, 4).map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {a.dono === 'eu' ? user?.nome || 'Eu' : 'Esposa'} · {new Date(a.data).toLocaleDateString('pt-BR')}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>+{formatCurrency(Number(a.valor))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAporteModal(false)}>Cancelar</button>
              <button id="btn-confirmar-aporte" className="btn btn-primary" onClick={saveAporte} disabled={saving}>{saving ? 'Registrando...' : 'Confirmar Aporte'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✅' : '❌'} {toast.msg}</div>
        </div>
      )}
    </AppLayout>
  )
}
