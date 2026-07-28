'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Categoria } from '@/lib/database.types'

const ICONES = ['📦','📈','🏠','🛒','🍔','🚗','💊','📺','📱','💡','📚','🎭','👗','🏡','🐾','✈️','🎮','💰','🏋️','🎁','💄','💳']
const CORES = ['#820AD1','#10B981','#EF4444','#F59E0B','#3B82F6','#EC4899','#06B6D4','#8B5CF6','#F97316','#6366F1','#14B8A6','#84CC16','#F43F5E','#A855F7','#FB923C']

export default function CategoriasPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', icone: '📦', cor: '#820AD1', keywords: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadCategorias()
  }, [user])

  async function loadCategorias() {
    const { data } = await supabase.from('categorias').select('*').order('nome')
    setCategorias(data || [])
  }

  function openNew() {
    setForm({ nome: '', icone: '📦', cor: '#820AD1', keywords: '' })
    setEditingId(null)
    setShowModal(true)
  }

  function openEdit(c: Categoria) {
    setForm({ nome: c.nome, icone: c.icone || '📦', cor: c.cor || '#820AD1', keywords: (c.keywords || []).join(', ') })
    setEditingId(c.id)
    setShowModal(true)
  }

  async function saveForm() {
    if (!form.nome.trim()) return
    setSaving(true)
    const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean)
    const data = { nome: form.nome.trim(), icone: form.icone, cor: form.cor, keywords, created_by: user!.id }
    let error
    if (editingId) {
      ({ error } = await supabase.from('categorias').update(data as any).eq('id', editingId))
    } else {
      ({ error } = await supabase.from('categorias').insert(data as any))
    }
    setSaving(false)
    if (!error) {
      showToast(editingId ? 'Categoria atualizada!' : 'Categoria criada!', 'success')
      setShowModal(false)
      loadCategorias()
    } else {
      showToast('Erro ao salvar.', 'error')
    }
  }

  async function deleteCategoria(id: string) {
    if (!confirm('Remover esta categoria? Lançamentos vinculados perderão a categoria.')) return
    await supabase.from('categorias').delete().eq('id', id)
    showToast('Categoria removida.', 'success')
    loadCategorias()
  }

  function showToast(msg: string, type: string) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorias</h1>
          <p className="page-subtitle">{categorias.length} categorias cadastradas</p>
        </div>
        <button id="btn-nova-categoria" className="btn btn-primary" onClick={openNew}>
          <Plus size={16} />
          Nova Categoria
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {categorias.map(c => (
          <div key={c.id} className="card card-p" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: `${c.cor}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
            }}>
              {c.icone}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{c.nome}</div>
              {c.keywords && c.keywords.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.keywords.slice(0, 3).join(', ')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
              <button className="btn btn-icon btn-ghost btn-sm" style={{ width: 28, height: 28 }} title="Editar" onClick={() => openEdit(c)}>
                <Pencil size={12} />
              </button>
              <button className="btn btn-icon btn-danger btn-sm" style={{ width: 28, height: 28 }} title="Remover" onClick={() => deleteCategoria(c.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-input" placeholder="Ex: Streaming, Mercado..." value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus />
              </div>

              <div className="form-group">
                <label className="form-label">Ícone</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {ICONES.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      style={{
                        width: 40, height: 40, fontSize: '1.25rem',
                        border: `2px solid ${form.icone === ic ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 8, background: form.icone === ic ? 'var(--color-primary-muted)' : 'var(--color-bg)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onClick={() => setForm(f => ({ ...f, icone: ic }))}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cor</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  {CORES.map(cor => (
                    <button
                      key={cor}
                      type="button"
                      style={{
                        width: 28, height: 28, borderRadius: '50%', background: cor,
                        border: form.cor === cor ? '3px solid var(--color-text)' : '2px solid transparent',
                        outline: form.cor === cor ? '2px solid var(--color-primary)' : 'none',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onClick={() => setForm(f => ({ ...f, cor }))}
                    />
                  ))}
                  <input type="color" className="form-input" value={form.cor} style={{ width: 40, height: 28, padding: 2, cursor: 'pointer' }} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Palavras-chave (para auto-categorização)</label>
                <input className="form-input" placeholder="netflix, spotify, disney (separe por vírgula)" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Usadas na importação de extrato para identificar esta categoria automaticamente.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button id="btn-salvar-categoria" className="btn btn-primary" onClick={saveForm} disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
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
