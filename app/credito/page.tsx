'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useMonth } from '@/contexts/MonthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Check, Trash2, Pencil, Upload, RotateCcw, CheckCircle2, CreditCard } from 'lucide-react'
import type { Lancamento, Categoria } from '@/lib/database.types'

const DONOS = ['eu', 'esposa'] as const
const DONO_LABELS = { eu: 'Ruan', esposa: 'Karol' }

const MESES_NOMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

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

  async function payAllCartao(dono: 'eu' | 'esposa') {
    const donoNome = DONO_LABELS[dono]
    if (!confirm(`Marcar TODAS as compras do cartão de ${donoNome} como PAGAS em ${MESES_NOMES[mes]}?`)) return

    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'pago' })
      .eq('mes', mes)
      .eq('ano', ano)
      .eq('dono', dono)
      .eq('origem', 'cartao')

    if (!error) {
      showToast(`Fatura do cartão de ${donoNome} marcada como PAGA! 🎉`, 'success')
      loadData()
    } else {
      showToast('Erro ao atualizar status. Tente novamente.', 'error')
    }
  }

  async function zerarCartao(dono?: 'eu' | 'esposa') {
    const targetText = dono ? `do cartão de ${DONO_LABELS[dono]}` : 'de TODOS os cartões'
    if (!confirm(`Tem certeza que deseja zerar/apagar os lançamentos ${targetText} em ${MESES_NOMES[mes]}? Você poderá importar o extrato novamente.`)) return

    let query = supabase
      .from('lancamentos')
      .delete()
      .eq('mes', mes)
      .eq('ano', ano)
      .eq('origem', 'cartao')

    if (dono) {
      query = query.eq('dono', dono)
    }

    const { error } = await query

    if (!error) {
      showToast(`Fatura ${targetText} zerada com sucesso! 🧹`, 'success')
      loadData()
    } else {
      showToast('Erro ao zerar fatura. Tente novamente.', 'error')
    }
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Cartão de Crédito</h1>
          <p className="page-subtitle">Faturas de Ruan & Karol — {MESES_NOMES[mes]} / {ano}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => zerarCartao()}
            title="Zerar todas as faturas deste mês"
          >
            <RotateCcw size={16} />
            Zerar Cartões ({MESES_NOMES[mes]})
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/importar')}
          >
            <Upload size={16} />
            Importar Extrato
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {DONOS.map(dono => {
          const items = porDono(dono)
          const total = items.reduce((s, l) => s + Number(l.valor), 0)
          const pendentesCount = items.filter(i => i.status !== 'pago').length
          const allPaid = items.length > 0 && pendentesCount === 0

          return (
            <div key={dono} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '1rem 1.25rem',
                background: dono === 'eu' ? 'var(--color-primary)' : '#EC4899',
                color: 'white',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CreditCard size={18} /> {DONO_LABELS[dono]}
                </h2>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{mask(formatCurrency(total))}</span>
              </div>

              {items.length > 0 && (
                <div style={{
                  padding: '0.6rem 1.25rem',
                  background: 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: '0.5rem'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {allPaid ? '✅ Fatura Totalmente Paga' : `${pendentesCount} item(ns) a pagar`}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!allPaid && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => payAllCartao(dono)}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        <CheckCircle2 size={13} />
                        Pagar Cartão Completo
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => zerarCartao(dono)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--color-status-aguardando)' }}
                      title="Zerar fatura deste cartão"
                    >
                      <RotateCcw size={13} />
                      Zerar
                    </button>
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Nenhuma compra no cartão este mês.
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => router.push('/importar')}
                    >
                      <Upload size={14} /> Subir Extrato
                    </button>
                  </div>
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
