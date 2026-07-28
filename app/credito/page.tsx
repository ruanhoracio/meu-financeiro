'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useMonth } from '@/contexts/MonthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Check, Trash2, Pencil } from 'lucide-react'
import type { Lancamento, Categoria } from '@/lib/database.types'

const DONOS = ['eu', 'esposa'] as const
const DONO_LABELS = { eu: 'Ruan', esposa: 'Karol' }

export default function CreditoPage() {
  const { user, loading } = useAuth()
  const { mes, ano } = useMonth()
  const { mask } = useHideValues()
  const router = useRouter()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) { loadData() }
  }, [mes, ano, user])

  async function loadData() {
    const [l, c] = await Promise.all([
      supabase
        .from('lancamentos')
        .select('*')
        .eq('mes', mes)
        .eq('ano', ano)
        .eq('origem', 'cartao')
        .order('created_at', { ascending: false }),
      supabase.from('categorias').select('*').order('nome'),
    ])
    setLancamentos(l.data || [])
    setCategorias(c.data || [])
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

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const porDono = (dono: 'eu' | 'esposa') =>
    lancamentos.filter(l => l.dono === dono)

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cartão de Crédito</h1>
          <p className="page-subtitle">Fatura do mês — importada do Nubank</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {DONOS.map(dono => {
          const items = porDono(dono)
          const total = items.reduce((s, l) => s + Number(l.valor), 0)
          return (
            <div key={dono} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '1rem 1.25rem',
                background: dono === 'eu' ? 'var(--color-primary)' : '#EC4899',
                color: 'white',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  💳 {DONO_LABELS[dono]}
                </h2>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{mask(formatCurrency(total))}</span>
              </div>

              {items.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Nenhuma compra no cartão este mês.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ margin: 0, border: 'none' }}>
                    <thead>
                      <tr>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(l => {
                        const cat = categorias.find(c => c.id === l.categoria_id)
                        return (
                          <tr key={l.id} style={{
                            background: l.status === 'pago' ? 'var(--color-status-pago-bg)' : undefined,
                            opacity: l.status === 'pago' ? 0.6 : 1,
                          }}>
                            <td style={{ fontWeight: 600, fontSize: '0.875rem', maxWidth: 200 }}>
                              <span className="truncate" style={{ display: 'block' }}>{l.descricao || '—'}</span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              {cat ? `${cat.icone} ${cat.nome}` : '📦 Sem categoria'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {mask(formatCurrency(Number(l.valor)))}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                {l.status !== 'pago' && (
                                  <button
                                    className="btn btn-icon btn-sm"
                                    title="Marcar como pago"
                                    onClick={() => markAsPaid(l.id)}
                                    style={{ background: 'var(--color-status-pago-bg)', color: 'var(--color-status-pago)', width: 28, height: 28 }}
                                  >
                                    <Check size={12} />
                                  </button>
                                )}
                                <button
                                  className="btn btn-icon btn-sm btn-danger"
                                  title="Remover"
                                  onClick={() => deleteLancamento(l.id)}
                                  style={{ width: 28, height: 28 }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="table-footer">
                      <tr>
                        <td style={{ fontWeight: 700 }}>{items.length} compras</td>
                        <td />
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem' }}>
                          {mask(formatCurrency(total))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

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
