'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useMonth } from '@/contexts/MonthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { ClipboardPaste, CheckCircle, AlertCircle, Save, Trash2 } from 'lucide-react'
import type { Categoria } from '@/lib/database.types'

type ParsedRow = {
  id: string
  descricao: string
  valor: number
  categoria_id: string
  dono: 'eu' | 'esposa' | 'conjunto'
  status: 'pago' | 'aguardando'
  tipo: 'fixa' | 'parcela_unica' | 'parcelado'
  ok: boolean
}

function parseSheetText(raw: string, categorias: Categoria[], donoPadrao: string): ParsedRow[] {
  const lines = raw.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  const sep = lines[0].includes('\t') ? '\t' : ','
  const rows = lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')))

  const firstRow = rows[0]
  const headerKeywords = ['nome','descrição','descricao','conta','categoria','valor','r$','status','pago','tipo']
  const isHeader = firstRow.some(c => headerKeywords.includes(c.toLowerCase().trim()))

  const dataRows = isHeader ? rows.slice(1) : rows
  const result: ParsedRow[] = []

  dataRows.forEach((cols, i) => {
    if (cols.length < 2) return

    let descricao = ''
    let valorRaw = ''
    let statusRaw = ''
    let catRaw = ''
    let donoRaw = ''

    if (isHeader) {
      const headers = firstRow.map(h => h.toLowerCase().trim())
      headers.forEach((h, idx) => {
        const v = cols[idx] || ''
        if (h.includes('nome') || h.includes('descri') || h.includes('conta') || h === 'item') descricao = v
        if (h.includes('valor') || h.includes('r$') || h === 'total') valorRaw = v
        if (h.includes('status') || h.includes('pago') || h.includes('situação')) statusRaw = v
        if (h.includes('categ')) catRaw = v
        if (h.includes('dono') || h.includes('quem') || h.includes('pessoa')) donoRaw = v
      })
    } else {
      const mesesPT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
      const col0 = (cols[0] || '').toLowerCase().trim()
      const isMesFormat = mesesPT.some(m => col0 === m || col0.startsWith(m.substring(0, 3)))

      if (isMesFormat && cols.length >= 3) {
        descricao = cols[1] || ''
        valorRaw  = cols[2] || ''
        statusRaw = cols[3] || ''
        catRaw    = cols[4] || ''
      } else if (cols.length >= 5 && /\$\s*[\d]/.test(cols[3] || '') && /(aguardando|pago|pendente)/i.test(cols[4] || '')) {
        descricao = cols[0] || ''
        valorRaw  = cols[3] || ''
        statusRaw = cols[4] || ''
        catRaw    = cols[5] || ''
      } else {
        descricao = cols[0] || ''
        valorRaw  = cols[1] || ''
        statusRaw = cols[2] || ''
        catRaw    = cols[3] || ''
      }
    }

    if (!descricao) return

    const valorStr = valorRaw.replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim()
    const valor = Math.abs(parseFloat(valorStr) || 0)

    const sl = statusRaw.toLowerCase()
    const status: 'pago' | 'aguardando' =
      sl.includes('pago') || sl === 'p' || sl === 'sim' || sl === 's' ? 'pago' : 'aguardando'

    const dl = donoRaw.toLowerCase()
    const dono: 'eu' | 'esposa' | 'conjunto' =
      dl.includes('espos') || dl.includes('dela') || dl === 'e' ? 'esposa' :
      dl.includes('conj') || dl === 'c' ? 'conjunto' :
      (donoPadrao as any) || 'eu'

    const matchCat = categorias.find(cat =>
      cat.keywords?.some(k => descricao.toLowerCase().includes(k.toLowerCase())) ||
      (catRaw && cat.nome.toLowerCase() === catRaw.toLowerCase())
    )

    result.push({
      id: `r-${i}`,
      descricao: descricao.trim(),
      valor,
      categoria_id: matchCat?.id || '',
      dono,
      status,
      tipo: 'parcela_unica',
      ok: !!matchCat,
    })
  })

  return result
}

export default function ImportarSheetsPage() {
  const { user, loading, currentView } = useAuth()
  const { mes, ano } = useMonth()
  const { mask } = useHideValues()
  const router = useRouter()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
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

  function handleParse() {
    if (!rawText.trim()) return
    const r = parseSheetText(rawText, categorias, currentView === 'conjunto' ? 'conjunto' : currentView)
    setRows(r)
    setParsed(true)
  }

  async function handleSave() {
    const toSave = rows.filter(r => r.valor > 0)
    if (!toSave.length) return
    setSaving(true)
    const inserts = toSave.map(r => ({
      user_id: user!.id,
      dono: r.dono,
      mes,
      ano,
      categoria_id: r.categoria_id || null,
      descricao: r.descricao,
      valor: r.valor,
      tipo: r.tipo,
      status: r.status,
      data_vencimento: null,
      parcela_atual: null,
      parcelas_total: null,
    }))
    const { error } = await supabase.from('lancamentos').insert(inserts)
    setSaving(false)
    if (!error) {
      setSaved(true)
      showToast(`${toSave.length} contas importadas! 🎉`, 'success')
    } else {
      showToast('Erro ao importar. Tente novamente.', 'error')
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
          <h1 className="page-title">Importar do Google Sheets / Planilha</h1>
          <p className="page-subtitle">Cole a tabela das suas contas da planilha</p>
        </div>
      </div>

      {!parsed ? (
        <div>
          <div className="card card-p" style={{ marginBottom: '1.25rem', background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-muted)' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📋 Como importar suas contas da planilha
            </div>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              <li>No Google Sheets ou Excel, selecione as contas (Nome, Valor, Status).</li>
              <li>Copie com <strong>Ctrl+C / Cmd+C</strong>.</li>
              <li>Cole no campo abaixo com <strong>Ctrl+V / Cmd+V</strong>.</li>
              <li>Clique em <strong>"Ler Planilha"</strong>.</li>
            </ol>
          </div>

          <div className="card card-p" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ marginBottom: '0.75rem' }}>
              <ClipboardPaste size={14} style={{ display: 'inline', marginRight: '0.375rem', color: 'var(--color-primary)' }} />
              Cole o conteúdo copiado da sua planilha aqui
            </label>
            <textarea
              id="textarea-sheets-paste"
              className="form-input"
              style={{ minHeight: 220, fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
              placeholder={`Exemplo de dados colados:\n\nNome\tValor\tStatus\tCategoria\nAluguel\tR$ 2.500,00\tPago\tMoradia\nSupermercado\t850,00\tAguardando\tAlimentação`}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              id="btn-ler-contas"
              className="btn btn-primary"
              onClick={handleParse}
              disabled={!rawText.trim()}
            >
              <ClipboardPaste size={16} />
              Ler Planilha
            </button>
            <button className="btn btn-secondary" onClick={() => setRawText('')}>
              <Trash2 size={15} />
              Limpar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Contas Lidas</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>{rows.length}</div>
            </div>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Categorizadas</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-status-pago)' }}>{rows.length - pendentes}</div>
            </div>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Sem categoria</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: pendentes > 0 ? 'var(--color-status-aguardando)' : 'var(--color-status-pago)' }}>{pendentes}</div>
            </div>
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                {mask(formatCurrency(rows.reduce((s, r) => s + r.valor, 0)))}
              </div>
            </div>
          </div>

          <div className="table-container" style={{ marginBottom: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Dono</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} style={{ background: !row.categoria_id ? 'var(--color-status-aguardando-bg)' : undefined }}>
                    <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{row.descricao}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', minWidth: 140 }}
                        value={row.categoria_id}
                        onChange={e => setRows(prev => prev.map((r, ri) =>
                          ri === i ? { ...r, categoria_id: e.target.value, ok: !!e.target.value } : r
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
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 130 }}
                        value={row.status}
                        onChange={e => setRows(prev => prev.map((r, ri) =>
                          ri === i ? { ...r, status: e.target.value as any } : r
                        ))}
                      >
                        <option value="aguardando">Aguardando</option>
                        <option value="pago">Pago</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 110 }}
                        value={row.dono}
                        onChange={e => setRows(prev => prev.map((r, ri) =>
                          ri === i ? { ...r, dono: e.target.value as any } : r
                        ))}
                      >
                        <option value="eu">Eu</option>
                        <option value="esposa">Esposa</option>
                        <option value="conjunto">Conjunto</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {mask(formatCurrency(row.valor))}
                    </td>
                    <td>
                      <button
                        className="btn btn-icon btn-danger btn-sm"
                        style={{ width: 28, height: 28 }}
                        onClick={() => setRows(prev => prev.filter((_, ri) => ri !== i))}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => { setParsed(false); setSaved(false); setRows([]) }}>
              ← Colar novamente
            </button>
            {!saved ? (
              <button
                id="btn-importar-sheets"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || rows.length === 0}
              >
                <Save size={16} />
                {saving ? 'Salvando...' : `Importar ${rows.length} contas para ${mes}/${ano}`}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-status-pago)', fontWeight: 600, fontSize: '0.875rem' }}>
                <CheckCircle size={18} />
                Importado com sucesso! <a href="/contas" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Ver contas →</a>
              </div>
            )}
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
