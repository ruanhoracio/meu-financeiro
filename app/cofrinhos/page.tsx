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
  const { user, loading } = useAuth()
  const router = useRouter()
  const [cofrinhos, setCofrinhos] = useState<Cofrinho[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showAporteModal, setShowAporteModal] = useState(false)
  const [selectedCofrinho, setSelectedCofrinho] = useState<Cofrinho | null>(null)
  const [aportes, setAportes] = useState<AporteCofrinho[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [valorAlvo, setValorAlvo] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [icone, setIcone] = useState('🏆')
  const [cor, setCor] = useState('#820AD1')
  const [descricao, setDescricao] = useState('')
  const [aporteValor, setAporteValor] = useState('')
  const [aporteObs, setAporteObs] = useState('')
  const [aporteDono, setAporteDono] = useState<'eu' | 'esposa'>('eu')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const ICONES = ['🏆','✈️','🏠','🚗','📱','💻','🎓','💍','🐣','🏖️','🛍️','💰','🎯','🏋️','🎪']
  const CORES = ['#820AD1','#10B981','#EF4444','#F59E0B','#3B82F6','#EC4899','#06B6D4','#F97316']

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadCofrinhos()
  }, [user])

  function resetForm() {
    setEditId(null)
    setNome('')
    setValorAlvo('')
    setDataFim('')
    setIcone('🏆')
    setCor('#820AD1')
    setDescricao('')
  }

  async function loadCofrinhos() {
    const { data } = await supabase.from('cofrinhos').select('*').order('created_at')
    setCofrinhos(data || [])
  }

  async function loadAportes(cofrinhoId: string) {
    const { data } = await supabase.from('aportes_cofrinhos').select('*').eq('cofrinho_id', cofrinhoId).order('data', { ascending: false })
    setAportes(data || [])
  }

  function openNew() {
    resetForm()
    setShowModal(true)
  }

  function openEdit(c: Cofrinho) {
    setEditId(c.id)
    setNome(c.nome)
    setValorAlvo(String(c.valor_alvo))
    setDataFim(c.data_fim || '')
    setIcone(c.icone || '🏆')
    setCor(c.cor || '#820AD1')
    setDescricao(c.descricao || '')
    setShowModal(true)
  }

  async function handleSave() {
    if (!nome || !valorAlvo) return
    setSaving(true)
    const payload = {
      nome,
      icone,
      cor,
      valor_alvo: parseFloat(valorAlvo),
      data_fim: dataFim || null,
      descricao: descricao || null,
    }
    let error = null
    if (editId) {
      const res = await supabase.from('cofrinhos').update(payload).eq('id', editId)
      error = res.error
    } else {
      const res = await supabase.from('cofrinhos').insert({ ...payload, valor_atual: 0 })
      error = res.error
    }
    setSaving(false)
    if (error) {
      console.error('Erro ao salvar cofrinho:', error)
      showToast('Erro ao salvar!', 'error')
      return
    }
    showToast(editId ? 'Cofrinho atualizado! ✏️' : 'Cofrinho criado! 🎉', 'success')
    setShowModal(false)
    resetForm()
    loadCofrinhos()
  }

  async function saveAporte() {
    if (!selectedCofrinho || !aporteValor) return
    setSaving(true)
    const valor = parseFloat(aporteValor)
    const res = await supabase.from('aportes_cofrinhos').insert({
      cofrinho_id: selectedCofrinho.id,
      user_id: user!.id,
      dono: aporteDono,
      valor,
      observacao: aporteObs || null,
      data: new Date().toISOString().split('T')[0],
    })
    if (res.error) {
      console.error('Erro ao salvar aporte:', res.error)
      showToast('Erro ao registrar aporte!', 'error')
      setSaving(false)
      return
    }
    await supabase.from('cofrinhos').update({ valor_atual: selectedCofrinho.valor_atual + valor }).eq('id', selectedCofrinho.id)
    showToast('Aporte registrado! 💰', 'success')
    setShowAporteModal(false)
    setAporteValor('')
    setAporteObs('')
    setAporteDono('eu')
    loadCofrinhos()
    setSaving(false)
  }

  async function deleteCofrinho(id: string) {
    if (!confirm('Remover este cofrinho e todos os aportes?')) return
    await supabase.from('cofrinhos').delete().eq('id', id)
    showToast('Cofrinho removido.', 'success')
    loadCofrinhos()
  }

  function openAporte(c: Cofrinho) {
    setSelectedCofrinho(c)
    loadAportes(c.id)
    setAporteValor('')
    setAporteObs('')
    setAporteDono((user?.dono as 'eu' | 'esposa') || 'eu')
    setShowAporteModal(true)
  }

  function calcMetaMensal(c: Cofrinho): string {
    if (!c.data_fim) return ''
    const hoje = new Date()
    const fim = new Date(c.data_fim)
    if (fim <= hoje) return ''
    const resto = c.valor_alvo - c.valor_atual
    if (resto <= 0) return ''
    const meses = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    if (meses <= 0) return ''
    return `${formatCurrency(resto / meses)}/mês`
  }

  function estimarTempo(c: Cofrinho): string {
    if (aportes.length === 0) return '—'
    const recentes = aportes.slice(0, 6)
    const media = recentes.reduce((s, a) => s + Number(a.valor), 0) / recentes.length
    if (media <= 0) return '—'
    const restante = c.valor_alvo - c.valor_atual
    if (restante <= 0) return 'Meta atingida! 🎉'
    const meses = Math.ceil(restante / media)
    if (meses === 1) return '~1 mês'
    if (meses < 12) return `~${meses} meses`
    return `~${(meses / 12).toFixed(1)} anos`
  }

  function showToast(msg: string, type: string) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cofrinhos</h1>
          <p className="page-subtitle">Metas de economia do casal</p>
        </div>
        <button id="btn-novo-cofrinho" className="btn btn-primary" onClick={openNew}>
          <Plus size={16} />
          Novo Cofrinho
        </button>
      </div>

      {cofrinhos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏺</div>
          <div className="empty-state-title">Nenhum cofrinho ainda</div>
          <div className="empty-state-text">Crie sua primeira meta de economia — viagem, reserva de emergência, reforma...</div>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} />
            Criar cofrinho
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {cofrinhos.map(c => {
            const pct = c.valor_alvo > 0 ? Math.min((c.valor_atual / c.valor_alvo) * 100, 100) : 0
            const concluido = c.valor_atual >= c.valor_alvo
            const metaMensal = calcMetaMensal(c)
            return (
              <div key={c.id} className="cofrinho-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${c.cor || '#820AD1'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.35rem 0.6rem', background: 'var(--color-bg)', borderRadius: 8 }}>
                      <Calendar size={12} />
                      até {new Date(c.data_fim).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.35rem 0.6rem', background: 'var(--color-bg)', borderRadius: 8 }}>
                    <Clock size={12} />
                    Estimativa: {estimarTempo(c)}
                  </div>
                  {metaMensal && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: c.cor || 'var(--color-primary)', padding: '0.35rem 0.6rem', background: 'var(--color-primary-muted)', borderRadius: 8 }}>
                      <Target size={12} />
                      {metaMensal}
                    </div>
                  )}
                </div>

                <button id={`btn-aportar-${c.id}`} className="btn btn-primary w-full btn-sm" onClick={() => openAporte(c)}>
                  <TrendingUp size={14} />
                  Fazer Aporte
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetForm() } }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editId ? 'Editar Cofrinho' : 'Novo Cofrinho'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); resetForm() }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome da Meta *</label>
                <input className="form-input" placeholder="Ex: Viagem..." value={nome} onChange={e => setNome(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Alvo (R$) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={valorAlvo} onChange={e => setValorAlvo(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data Final</label>
                <input className="form-input" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>Com a data final, calculamos quanto guardar por mês</span>
              </div>
              <div className="form-group">
                <label className="form-label">Ícone</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {ICONES.map(ic => (
                    <button key={ic} type="button" style={{ width: 40, height: 40, fontSize: '1.25rem', border: `2px solid ${icone === ic ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: icone === ic ? 'var(--color-primary-muted)' : 'transparent', cursor: 'pointer' }} onClick={() => setIcone(ic)}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cor</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {CORES.map(co => (
                    <button key={co} type="button" style={{ width: 28, height: 28, borderRadius: '50%', background: co, border: cor === co ? '3px solid var(--color-text)' : '2px solid transparent', outline: cor === co ? '2px solid var(--color-primary)' : 'none', cursor: 'pointer' }} onClick={() => setCor(co)} />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição (opcional)</label>
                <input className="form-input" placeholder="Detalhes da meta..." value={descricao} onChange={e => setDescricao(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>Cancelar</button>
              <button id="btn-salvar-cofrinho" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar Cofrinho'}
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
              <div style={{ background: 'var(--color-primary-muted)', borderRadius: 12, padding: '1rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
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
                const hoje = new Date()
                const fim = new Date(selectedCofrinho.data_fim)
                if (fim > hoje) {
                  const resto = selectedCofrinho.valor_alvo - selectedCofrinho.valor_atual
                  if (resto > 0) {
                    const meses = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
                    if (meses > 0) {
                      return (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={12} />
                          Meta até {new Date(selectedCofrinho.data_fim).toLocaleDateString('pt-BR')}
                          <span style={{ fontWeight: 700, color: selectedCofrinho.cor || 'var(--color-primary)' }}>· {formatCurrency(resto / meses)}/mês</span>
                        </div>
                      )
                    }
                  }
                }
                return null
              })()}

              <div className="form-group">
                <label className="form-label">Quem está aportando?</label>
                <select className="form-select" value={aporteDono} onChange={e => setAporteDono(e.target.value as any)}>
                  <option value="eu">{user?.nome || 'Eu'}</option>
                  <option value="esposa">Esposa</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={aporteValor} onChange={e => setAporteValor(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input className="form-input" placeholder="Ex: Economia de julho..." value={aporteObs} onChange={e => setAporteObs(e.target.value)} />
              </div>

              {aportes.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Últimos aportes</div>
                  {aportes.slice(0, 4).map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{a.dono === 'eu' ? user?.nome || 'Eu' : 'Esposa'} · {new Date(a.data).toLocaleDateString('pt-BR')}</span>
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
