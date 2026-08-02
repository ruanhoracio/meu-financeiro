'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useMonth } from '@/contexts/MonthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Pencil, CheckCircle2, CircleDashed, Briefcase } from 'lucide-react'
import type { Freela } from '@/lib/database.types'

export default function FreelasPage() {
  const { user, loading } = useAuth()
  const { mes, ano } = useMonth()
  const router = useRouter()
  const [freelas, setFreelas] = useState<Freela[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [nomeServico, setNomeServico] = useState('')
  const [valor, setValor] = useState('')
  const [recebido, setRecebido] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const [formMes, setFormMes] = useState(mes)
  const [formAno, setFormAno] = useState(ano)

  const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadFreelas()
  }, [user, mes, ano])

  async function loadFreelas() {
    const { data } = await supabase
      .from('freelas')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .order('created_at', { ascending: false })
    setFreelas(data || [])
  }

  function resetForm() {
    setEditId(null)
    setNomeServico('')
    setValor('')
    setRecebido(false)
    setFormMes(mes)
    setFormAno(ano)
  }

  function openNew() {
    resetForm()
    setShowModal(true)
  }

  function openEdit(f: Freela) {
    setEditId(f.id)
    setNomeServico(f.nome_servico)
    setValor(String(f.valor))
    setRecebido(f.recebido)
    setFormMes(f.mes)
    setFormAno(f.ano)
    setShowModal(true)
  }

  function showToast(msg: string, type: string) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave() {
    if (!nomeServico || !valor) return
    setSaving(true)

    if (editId) {
      const { error } = await supabase
        .from('freelas')
        .update({
          nome_servico: nomeServico,
          valor: parseFloat(valor),
          recebido,
          mes: formMes,
          ano: formAno,
        })
        .eq('id', editId)
      setSaving(false)
      if (error) { showToast('Erro: ' + error.message, 'error'); return }
      showToast('Freela atualizado!', 'success')
    } else {
      const { error } = await supabase
        .from('freelas')
        .insert({
          dono: user?.dono || 'eu',
          mes: formMes,
          ano: formAno,
          nome_servico: nomeServico,
          valor: parseFloat(valor),
          recebido,
        })
      setSaving(false)
      if (error) { showToast('Erro: ' + error.message, 'error'); return }
      showToast('Freela adicionado!', 'success')
    }

    setShowModal(false)
    resetForm()
    loadFreelas()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este freela?')) return
    const { error } = await supabase.from('freelas').delete().eq('id', id)
    if (error) { showToast('Erro: ' + error.message, 'error'); return }
    showToast('Freela removido!', 'success')
    loadFreelas()
  }

  async function toggleRecebido(f: Freela) {
    const { error } = await supabase
      .from('freelas')
      .update({ recebido: !f.recebido })
      .eq('id', f.id)
    if (!error) loadFreelas()
  }

  const totalFreelas = freelas.reduce((s, f) => s + Number(f.valor), 0)
  const totalRecebido = freelas.filter(f => f.recebido).reduce((s, f) => s + Number(f.valor), 0)
  const totalPendente = totalFreelas - totalRecebido

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Freelas</h1>
          <p className="page-subtitle">Serviços extras do mês</p>
        </div>
        <button id="btn-novo-freela" className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Novo Freela
        </button>
      </div>

      <div className="summary-cards" style={{ marginBottom: '1.5rem' }}>
        <div className="summary-card" style={{ '--card-accent': 'var(--color-primary)' } as React.CSSProperties}>
          <div className="summary-card-label">Total em freelas</div>
          <div className="summary-card-value">{formatCurrency(totalFreelas)}</div>
        </div>
        <div className="summary-card" style={{ '--card-accent': '#16A34A' } as React.CSSProperties}>
          <div className="summary-card-label">Recebido</div>
          <div className="summary-card-value" style={{ color: '#16A34A' }}>{formatCurrency(totalRecebido)}</div>
        </div>
        <div className="summary-card" style={{ '--card-accent': '#F59E0B' } as React.CSSProperties}>
          <div className="summary-card-label">A receber</div>
          <div className="summary-card-value" style={{ color: totalPendente > 0 ? '#F59E0B' : 'var(--color-text)' }}>{formatCurrency(totalPendente)}</div>
        </div>
      </div>

      {freelas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Briefcase size={48} /></div>
          <div className="empty-state-title">Nenhum freela ainda</div>
          <div className="empty-state-text">Adicione serviços extras que você fez neste mês.</div>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Adicionar freela
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {freelas.map(f => (
                <tr key={f.id} className={f.recebido ? 'row-pago' : 'row-aguardando'}>
                  <td style={{ fontWeight: 600 }}>{f.nome_servico}</td>
                  <td>{formatCurrency(f.valor)}</td>
                  <td>
                    <button
                      className={`badge ${f.recebido ? 'badge-pago' : 'badge-aguardando'}`}
                      onClick={() => toggleRecebido(f)}
                      style={{ cursor: 'pointer', border: 'none' }}
                    >
                      {f.recebido ? (
                        <><CheckCircle2 size={12} /> Recebido</>
                      ) : (
                        <><CircleDashed size={12} /> Pendente</>
                      )}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(f)} title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(f.id)} title="Remover" style={{ color: '#EF4444' }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editId ? 'Editar freela' : 'Novo freela'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome do serviço</label>
                <input
                  className="form-input"
                  value={nomeServico}
                  onChange={e => setNomeServico(e.target.value)}
                  placeholder="Ex: Site para cliente, Consultoria..."
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Mês</label>
                  <select className="form-select" value={formMes} onChange={e => setFormMes(Number(e.target.value))}>
                    {MESES_NOMES.map((nome, i) => (
                      <option key={i} value={i + 1}>{nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ano</label>
                  <input
                    className="form-input"
                    type="number"
                    value={formAno}
                    onChange={e => setFormAno(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={recebido}
                    onChange={e => setRecebido(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                  />
                  <span className="form-label" style={{ margin: 0 }}>Já recebi esse valor</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button id="btn-salvar-freela" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </AppLayout>
  )
}
