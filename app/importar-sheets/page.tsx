'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useMonth } from '@/contexts/MonthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { ClipboardPaste, CheckCircle, AlertCircle, Save, Trash2, Calendar } from 'lucide-react'
import type { Categoria } from '@/lib/database.types'

type ParsedRow = {
  id: string
  descricao: string
  valor: number
  mes: number // 1..12
  categoria_id: string
  dono: 'eu' | 'esposa' | 'conjunto'
  status: 'pago' | 'aguardando'
  tipo: 'fixa' | 'parcela_unica' | 'parcelado'
  ok: boolean
}

const MESES_MAP: Record<string, number> = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  março: 3, marco: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
}

const MESES_NOMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function getMonthFromText(text: string): number | null {
  if (!text) return null
  const cleaned = text.trim().toLowerCase()
  if (MESES_MAP[cleaned]) return MESES_MAP[cleaned]

  for (const [key, val] of Object.entries(MESES_MAP)) {
    if (cleaned === key || (key.length >= 3 && cleaned.startsWith(key))) {
      return val
    }
  }

  const m = cleaned.match(/^(\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    const val = parseInt(m[1], 10)
    if (val >= 1 && val <= 12) return val
  }

  return null
}

function parseCurrencyVal(valRaw: string): number {
  if (!valRaw) return 0
  let s = valRaw.replace(/R\$/gi, '').replace(/\u00a0/g, ' ').trim()
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const match = s.match(/-?\d+(?:\.\d+)?/)
  if (!match) return 0
  return Math.abs(parseFloat(match[0]) || 0)
}

function findCategory(descricao: string, catRaw: string, categorias: Categoria[]): string {
  const descLower = descricao.toLowerCase()
  const catRawLower = (catRaw || '').toLowerCase()

  if (catRawLower) {
    const foundByCatName = categorias.find(c => c.nome.toLowerCase() === catRawLower)
    if (foundByCatName) return foundByCatName.id
  }

  for (const cat of categorias) {
    if (cat.keywords && cat.keywords.some(k => k && descLower.includes(k.toLowerCase()))) {
      return cat.id
    }
  }

  const commonMappings: Array<{ keys: string[]; catName: string }> = [
    { keys: ['mercado', 'supermercado', 'marmita', 'ifood', 'padaria', 'açougue', 'alimentacao'], catName: 'Alimentação' },
    { keys: ['luz', 'água', 'agua', 'internet', 'apartamento', 'aluguel', 'condomínio', 'condominio', 'gás', 'gas'], catName: 'Moradia' },
    { keys: ['carro', 'ipva', 'seguro', 'combustível', 'gasolina', 'uber', 'estacionamento'], catName: 'Transporte' },
    { keys: ['netflix', 'spotify', 'max', 'disney', 'youtube', 'premiere', 'site', 'icloud', 'google', 'cinema'], catName: 'Assinaturas' },
    { keys: ['investir', 'investimento', 'bs', 'ações', 'fii', 'cdb', 'poupança'], catName: 'Investimentos' },
    { keys: ['koerich', 'sofá', 'sofa', 'rosso', 'material'], catName: 'Compras' },
    { keys: ['guia', 'pj', 'imposto', 'mei', 'das'], catName: 'Impostos / Taxas' },
    { keys: ['nubank', 'inter', 'crédito', 'credito', 'recovery', 'correa', 'renegociado', 'empréstimo'], catName: 'Cartão / Dívidas' },
  ]

  for (const mapping of commonMappings) {
    if (mapping.keys.some(k => descLower.includes(k))) {
      const match = categorias.find(c =>
        c.nome.toLowerCase().includes(mapping.catName.toLowerCase()) ||
        mapping.catName.toLowerCase().includes(c.nome.toLowerCase())
      )
      if (match) return match.id
    }
  }

  const foundByName = categorias.find(c => descLower.includes(c.nome.toLowerCase()))
  if (foundByName) return foundByName.id

  return ''
}

function parseSheetText(raw: string, categorias: Categoria[], donoPadrao: string, defaultMes: number): ParsedRow[] {
  const lines = raw.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  const result: ParsedRow[] = []

  lines.forEach((line, i) => {
    let cols: string[] = []
    if (line.includes('\t')) {
      cols = line.split('\t')
    } else if (line.includes(';')) {
      cols = line.split(';')
    } else if (line.includes(',') && !/\d+,\d{2}/.test(line)) {
      cols = line.split(',')
    } else {
      cols = line.split(/\s{2,}/)
    }

    cols = cols.map(c => c.trim().replace(/^"|"$/g, '')).filter(Boolean)
    if (cols.length === 0) return

    // Header check
    const c0 = cols[0].toLowerCase()
    const c1 = (cols[1] || '').toLowerCase()
    const isHeader = (
      ['mês', 'mes', 'descrição', 'descricao', 'nome', 'conta', 'item'].includes(c0) ||
      ['valor', 'r$', 'status', 'situação'].includes(c1)
    )
    if (isHeader) return

    let rowMes = defaultMes
    let descricao = ''
    let valor = 0
    let status: 'pago' | 'aguardando' = 'aguardando'
    let catRaw = ''
    let donoRaw = ''

    if (cols.length >= 3) {
      const parsedM0 = getMonthFromText(cols[0])
      if (parsedM0 !== null) {
        rowMes = parsedM0
        descricao = cols[1] || ''
        valor = parseCurrencyVal(cols[2] || '')
        const sl = (cols[3] || '').toLowerCase()
        if (sl.includes('pago') || sl === 'p' || sl === 'sim' || sl === 's' || sl === 'pg' || sl === 'ok') {
          status = 'pago'
        }
        catRaw = cols[4] || ''
        donoRaw = cols[5] || ''
      } else {
        const lastCol = cols[cols.length - 1].toLowerCase()
        const secondLastCol = (cols[cols.length - 2] || '').toLowerCase()

        if (lastCol.includes('pago') || lastCol === 'p' || lastCol === 'sim' || lastCol === 's' || lastCol === 'pg' || lastCol === 'ok') {
          status = 'pago'
          valor = parseCurrencyVal(secondLastCol)
          descricao = cols.slice(0, cols.length - 2).join(' ')
        } else {
          descricao = cols[0] || ''
          valor = parseCurrencyVal(cols[1] || '')
          const sl = (cols[2] || '').toLowerCase()
          if (sl.includes('pago') || sl === 'p' || sl === 'sim' || sl === 's' || sl === 'pg' || sl === 'ok') {
            status = 'pago'
          }
          catRaw = cols[3] || ''
        }
      }
    } else if (cols.length === 2) {
      const parsedM0 = getMonthFromText(cols[0])
      if (parsedM0 !== null) {
        rowMes = parsedM0
        valor = parseCurrencyVal(cols[1])
        descricao = `Lançamento ${MESES_NOMES[rowMes]}`
      } else {
        descricao = cols[0]
        valor = parseCurrencyVal(cols[1])
      }
    } else {
      // 1 single column string fallback parser
      let s = line.trim()
      const mMatch = s.match(/^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i)
      if (mMatch) {
        const mVal = getMonthFromText(mMatch[1])
        if (mVal !== null) rowMes = mVal
        s = s.substring(mMatch[0].length).trim()
      }

      if (/(pago|aguardando|pendente|pg|sim|s)\s*$/i.test(s)) {
        const stMatch = s.match(/(pago|aguardando|pendente|pg|sim|s)\s*$/i)
        if (stMatch) {
          const stStr = stMatch[1].toLowerCase()
          if (stStr.includes('pago') || stStr === 'p' || stStr === 'sim' || stStr === 's' || stStr === 'pg') {
            status = 'pago'
          }
          s = s.substring(0, s.length - stMatch[0].length).trim()
        }
      }

      const valMatch = s.match(/R\$\s*\d+[\.,]?\d*|\b\d+[\.,]\d{2}\b|\b\d+\b/)
      if (valMatch) {
        valor = parseCurrencyVal(valMatch[0])
        descricao = s.replace(valMatch[0], '').trim()
      } else {
        descricao = s
      }
    }

    if (!descricao || valor <= 0) return

    const dl = donoRaw.toLowerCase()
    const dono: 'eu' | 'esposa' | 'conjunto' =
      dl.includes('espos') || dl.includes('dela') || dl === 'e' ? 'esposa' :
      dl.includes('conj') || dl === 'c' ? 'conjunto' :
      (donoPadrao as any) || 'eu'

    const catId = findCategory(descricao, catRaw, categorias)

    result.push({
      id: `r-${i}-${Math.random().toString(36).substring(2, 7)}`,
      descricao: descricao.trim(),
      valor,
      mes: rowMes,
      categoria_id: catId,
      dono,
      status,
      tipo: 'parcela_unica',
      ok: !!catId,
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
    const r = parseSheetText(rawText, categorias, currentView === 'conjunto' ? 'conjunto' : currentView, mes)
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
      mes: r.mes || mes,
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
      showToast(`${toSave.length} contas importadas com sucesso! 🎉`, 'success')
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
          <p className="page-subtitle">Cole suas contas da planilha em qualquer formato (ex: Mês, Nome, Valor, Status)</p>
        </div>
      </div>

      {!parsed ? (
        <div>
          <div className="card card-p" style={{ marginBottom: '1.25rem', background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-muted)' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📋 Como importar suas contas da planilha
            </div>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              <li>No Google Sheets ou Excel, selecione as linhas das suas contas.</li>
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
              style={{ minHeight: 220, fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
              placeholder={`Exemplo de dados que você pode colar:\n\nMAIO\tInvestir\tR$ 300,00\tPAGO\nMAIO\tBS\tR$ 500,00\tPAGO\nMAIO\tApartamento\tR$ 631,00\tPAGO\nMAIO\tCarro\tR$ 800,00\tPAGO\nMAIO\tLuz\tR$ 228,00\tPAGO`}
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
                  <th style={{ width: 110 }}>Mês</th>
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
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.4rem', width: 105 }}
                        value={row.mes}
                        onChange={e => setRows(prev => prev.map((r, ri) =>
                          ri === i ? { ...r, mes: parseInt(e.target.value, 10) } : r
                        ))}
                      >
                        {MESES_NOMES.slice(1).map((mNome, idx) => (
                          <option key={idx + 1} value={idx + 1}>{mNome}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
                        value={row.descricao}
                        onChange={e => setRows(prev => prev.map((r, ri) =>
                          ri === i ? { ...r, descricao: e.target.value } : r
                        ))}
                      />
                    </td>
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
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 120 }}
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
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 105 }}
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
                {saving ? 'Salvando...' : `Importar ${rows.length} contas`}
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
