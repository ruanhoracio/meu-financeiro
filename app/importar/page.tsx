'use client'
import { useState, useCallback, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getCurrentMonth } from '@/lib/utils'
import { Upload, CheckCircle, AlertCircle, Save, FileText } from 'lucide-react'
import Papa from 'papaparse'
import type { Categoria } from '@/lib/database.types'

type ParsedRow = {
  id: string
  descricao: string
  valor: number
  data: string
  categoria_id: string
  dono: 'eu' | 'esposa' | 'conjunto'
  status: 'ok' | 'pendente'
}

function autoCategorize(descricao: string, categorias: Categoria[]): string {
  const d = descricao.toLowerCase()
  for (const cat of categorias) {
    if (cat.keywords && cat.keywords.some(k => d.includes(k.toLowerCase()))) {
      return cat.id
    }
  }
  return ''
}

export default function ImportarExtratoPage() {
  const { user, loading, currentView, setCurrentView } = useAuth()
  const { mask } = useHideValues()
  const router = useRouter()
  const { mes, ano } = getCurrentMonth()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      supabase.from('categorias').select('*').order('nome').then(({ data }) => setCategorias(data || []))
    }
  }, [user])

  function handleFile(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsedRows: ParsedRow[] = []
        result.data.forEach((raw: any, i: number) => {
          // Detectar colunas comuns do Nubank, Inter, Itaú, etc.
          const descricao = raw['Descrição'] || raw['Lançamento'] || raw['Histórico'] || raw['description'] || raw['title'] || Object.values(raw)[1] || 'Sem descrição'
          const valorRaw = raw['Valor'] || raw['value'] || raw['amount'] || raw['Crédito'] || raw['Débito'] || Object.values(raw)[2] || '0'
          const valorStr = String(valorRaw).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
          const valor = Math.abs(parseFloat(valorStr) || 0)
          const data = raw['Data'] || raw['date'] || raw['Data lançamento'] || Object.values(raw)[0] || ''
          const catId = autoCategorize(String(descricao), categorias)

          if (valor > 0) {
            parsedRows.push({
              id: `row-${i}`,
              descricao: String(descricao).trim(),
              valor,
              data: String(data),
              categoria_id: catId,
              dono: currentView === 'conjunto' ? 'conjunto' : currentView as any,
              status: catId ? 'ok' : 'pendente',
            })
          }
        })
        setRows(parsedRows)
        setParsed(true)
      }
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [categorias, currentView])

  async function saveAll() {
    const toSave = rows.filter(r => r.valor > 0)
    if (toSave.length === 0) return
    setSaving(true)
    const inserts = toSave.map(r => ({
      user_id: user!.id,
      dono: r.dono,
      mes,
      ano,
      categoria_id: r.categoria_id || null,
      descricao: r.descricao,
      valor: r.valor,
      tipo: 'parcela_unica' as const,
      status: 'aguardando' as const,
      origem: 'cartao' as const,
      data_vencimento: null,
    }))
    const { error } = await supabase.from('lancamentos').insert(inserts)
    setSaving(false)
    if (!error) {
      setSaved(true)
      showToast(`${toSave.length} compras importadas do extrato! 🎉`, 'success')
    } else {
      showToast('Erro ao importar extrato. Tente novamente.', 'error')
    }
  }

  function showToast(msg: string, type: string) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const pendentes = rows.filter(r => !r.categoria_id).length

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Importar Extrato Nubank / Banco</h1>
          <p className="page-subtitle">Upload de arquivo CSV do extrato da fatura ou conta corrente</p>
        </div>
      </div>

      {!parsed ? (
        <div
          className={`dropzone ${dragging ? 'active' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('file-input-extrato')?.click()}
          id="dropzone-upload-nubank"
          style={{ cursor: 'pointer', padding: '3rem', border: '2px dashed var(--color-primary)', borderRadius: 20, textAlign: 'center', background: 'var(--color-bg-card)' }}
        >
          <input
            id="file-input-extrato"
            type="file"
            accept=".csv,.txt"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <Upload size={48} style={{ margin: '0 auto 1rem', color: 'var(--color-primary)' }} />
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            Arraste a fatura / extrato CSV aqui
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            ou clique para escolher o arquivo baixado do app do Nubank / banco
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: '#D9770620', color: '#D97706', fontWeight: 600 }}>🟠 Nubank CSV</span>
            <span className="badge" style={{ background: '#F9731620', color: '#F97316', fontWeight: 600 }}>🟧 Itaú / Inter</span>
            <span className="badge" style={{ background: '#3B82F620', color: '#3B82F6', fontWeight: 600 }}>🟦 Qualquer Banco (CSV)</span>
          </div>
        </div>
      ) : (
        <div>
          {/* Status bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Compras lidas</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>{rows.length}</div>
            </div>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Categorizadas</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-status-pago)' }}>{rows.length - pendentes}</div>
            </div>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Para categorizar</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: pendentes > 0 ? 'var(--color-status-aguardando)' : 'var(--color-status-pago)' }}>{pendentes}</div>
            </div>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Fatura</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                {mask(formatCurrency(rows.reduce((s, r) => s + r.valor, 0)))}
              </div>
            </div>
          </div>

          {pendentes > 0 && (
            <div style={{
              background: 'var(--color-status-aguardando-bg)',
              border: '1px solid var(--color-status-aguardando)',
              borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
              color: 'var(--color-status-aguardando-text)', fontWeight: 500,
            }}>
              <AlertCircle size={16} />
              {pendentes} compras sem categoria — selecione a categoria abaixo para organizar.
            </div>
          )}

          {/* Tabela de revisão */}
          <div className="table-container" style={{ marginBottom: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Compra / Estabelecimento</th>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Dono</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} style={{ background: !row.categoria_id ? 'var(--color-status-aguardando-bg)' : undefined }}>
                    <td style={{ fontSize: '0.875rem', fontWeight: 600, maxWidth: 220 }}>
                      {row.descricao}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{row.data}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', minWidth: 140 }}
                        value={row.categoria_id}
                        onChange={e => setRows(prev => prev.map((r, ri) =>
                          ri === idx ? { ...r, categoria_id: e.target.value, status: e.target.value ? 'ok' : 'pendente' } : r
                        ))}
                      >
                        <option value="">— Selecionar —</option>
                        {categorias.map(c => (
                          <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 110 }}
                        value={row.dono}
                        onChange={e => setRows(prev => prev.map((r, ri) => ri === idx ? { ...r, dono: e.target.value as any } : r))}
                      >
                        <option value="eu">Eu</option>
                        <option value="esposa">Esposa</option>
                        <option value="conjunto">Conjunto</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {mask(formatCurrency(row.valor))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setRows([]); setParsed(false); setSaved(false) }}>
              Novo arquivo
            </button>
            {!saved ? (
              <button
                id="btn-importar-extrato-confirmar"
                className="btn btn-primary"
                onClick={saveAll}
                disabled={saving}
              >
                <Save size={16} />
                {saving ? 'Importando...' : `Salvar ${rows.length} compras no Meu Financeiro`}
              </button>
            ) : null}
          </div>

          {saved && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📊 Análise do Mês</h2>
                <a href="/contas" style={{ color: 'var(--color-primary)', fontSize: '0.875rem', textDecoration: 'underline' }}>Ver contas →</a>
              </div>

              {/* Cards resumo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="card card-p" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Gasto</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {mask(formatCurrency(rows.reduce((s, r) => s + r.valor, 0)))}
                  </div>
                </div>
                <div className="card card-p" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Compras</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>{rows.length}</div>
                </div>
                <div className="card card-p" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Ticket Médio</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {mask(formatCurrency(rows.reduce((s, r) => s + r.valor, 0) / rows.length || 0))}
                  </div>
                </div>
              </div>

              {/* Gasto por categoria */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Compras</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const total = rows.reduce((s, r) => s + r.valor, 0)
                      const grupos: Record<string, { valor: number; count: number }> = {}
                      rows.forEach(r => {
                        const key = r.categoria_id || 'outros'
                        if (!grupos[key]) grupos[key] = { valor: 0, count: 0 }
                        grupos[key].valor += r.valor
                        grupos[key].count++
                      })
                      return Object.entries(grupos)
                        .sort(([, a], [, b]) => b.valor - a.valor)
                        .map(([catId, g]) => {
                          const cat = categorias.find(c => c.id === catId)
                          const pct = total > 0 ? (g.valor / total) * 100 : 0
                          return (
                            <tr key={catId}>
                              <td style={{ fontWeight: 600 }}>
                                {cat ? `${cat.icone} ${cat.nome}` : '📦 Sem categoria'}
                              </td>
                              <td>{g.count}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{mask(formatCurrency(g.valor))}</td>
                              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{pct.toFixed(1)}%</td>
                            </tr>
                          )
                        })
                    })()}
                  </tbody>
                  <tfoot className="table-footer">
                    <tr>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td>{rows.length}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mask(formatCurrency(rows.reduce((s, r) => s + r.valor, 0)))}</td>
                      <td style={{ textAlign: 'right' }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
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
