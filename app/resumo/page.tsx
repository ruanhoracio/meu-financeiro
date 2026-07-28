'use client'
import { useState, useEffect, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useMonth } from '@/contexts/MonthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatMonth, calcPercentChange } from '@/lib/utils'
import { ChevronRight, Download } from 'lucide-react'
import type { Categoria } from '@/lib/database.types'

const FRASES = [
  'Mês fechado! Vocês estão no caminho certo 🎯',
  'Juntos vocês conseguem qualquer coisa! 💪',
  'Controle financeiro é amor ao futuro! 💜',
  'Cada real guardado é um passo à frente! 🚀',
  'Vocês arrasaram neste mês! 🌟',
]

export default function ResumoPage() {
  const { user, loading, currentView } = useAuth()
  const { mes, ano } = useMonth()
  const { mask } = useHideValues()
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [data, setData] = useState<any>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadData()
  }, [mes, ano, currentView, user])

  async function loadData() {
    const prevMes = mes === 1 ? 12 : mes - 1
    const prevAno = mes === 1 ? ano - 1 : ano

    let qAtual = supabase.from('lancamentos').select('*').eq('mes', mes).eq('ano', ano)
    let qAnt = supabase.from('lancamentos').select('*').eq('mes', prevMes).eq('ano', prevAno)
    if (currentView !== 'conjunto') {
      qAtual = qAtual.or(`dono.eq.${currentView},dono.eq.conjunto`)
      qAnt = qAnt.or(`dono.eq.${currentView},dono.eq.conjunto`)
    }

    const rendaPromise = currentView === 'conjunto'
      ? Promise.all([
          supabase.from('rendas').select('valor').eq('dono', 'eu').eq('mes', mes).eq('ano', ano).single(),
          supabase.from('rendas').select('valor').eq('dono', 'esposa').eq('mes', mes).eq('ano', ano).single(),
        ]).then(([r1, r2]) => ({ data: { valor: (r1.data?.valor || 0) + (r2.data?.valor || 0) } }))
      : supabase.from('rendas').select('valor').eq('dono', currentView).eq('mes', mes).eq('ano', ano).single()

    const [atual, anterior, renda, cats] = await Promise.all([
      qAtual,
      qAnt,
      rendaPromise,
      supabase.from('categorias').select('*'),
    ])

    setCategorias(cats.data || [])

    const lancAtual = atual.data || []
    const lancAnt = anterior.data || []
    const totalAtual = lancAtual.reduce((s: number, l: any) => s + Number(l.valor), 0)
    const totalAnt = lancAnt.reduce((s: number, l: any) => s + Number(l.valor), 0)
    const rendaVal = renda.data?.valor || 0
    const sobra = rendaVal - totalAtual
    const diff = calcPercentChange(totalAtual, totalAnt)

    const catMap: Record<string, number> = {}
    lancAtual.forEach((l: any) => {
      const cat = (cats.data || []).find((c: Categoria) => c.id === l.categoria_id)
      const nome = cat?.nome || 'Outros'
      catMap[nome] = (catMap[nome] || 0) + Number(l.valor)
    })
    const topCat = Object.entries(catMap).sort(([, a], [, b]) => b - a)[0]
    const frase = FRASES[Math.floor(Math.random() * FRASES.length)]

    setData({ totalAtual, totalAnt, rendaVal, sobra, diff, topCat, frase, mes, ano, prevMes, prevAno })
  }

  function goToSlide(next: number) {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setSlide(next)
      setAnimating(false)
    }, 300)
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="page-header">
          <h1 className="page-title">Resumo do Mês</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <div className="animate-pulse" style={{ color: 'var(--color-text-muted)' }}>Carregando resumo...</div>
        </div>
      </AppLayout>
    )
  }

  const slides = [
    <div key={0} style={slideStyle('#820AD1', '#5A0099')}>
      <div style={slideLabel}>💳 Total gasto em {formatMonth(data.mes, data.ano)}</div>
      <div style={slideValue}>{mask(formatCurrency(data.totalAtual))}</div>
      <div style={slideSubtext}>{data.rendaVal > 0 ? `de ${mask(formatCurrency(data.rendaVal))} de renda` : 'renda não informada'}</div>
    </div>,

    <div key={1} style={slideStyle('#4C1D95', '#6D28D9')}>
      <div style={slideLabel}>🏆 Categoria que mais pesou</div>
      <div style={{ fontSize: '3rem', margin: '1rem 0' }}>
        {categorias.find(c => c.nome === data.topCat?.[0])?.icone || '📦'}
      </div>
      <div style={{ ...slideValue, fontSize: '2rem' }}>{data.topCat?.[0] || '—'}</div>
      <div style={slideSubtext}>{data.topCat ? mask(formatCurrency(data.topCat[1])) : ''}</div>
    </div>,

    <div key={2} style={slideStyle('#065F46', '#047857')}>
      <div style={slideLabel}>📊 Comparação com {formatMonth(data.prevMes, data.prevAno)}</div>
      <div style={{ ...slideValue, fontSize: '3rem' }}>
        {data.diff > 0 ? '📈' : data.diff < 0 ? '📉' : '➡️'} {Math.abs(data.diff).toFixed(1)}%
      </div>
      <div style={slideSubtext}>
        {data.diff > 0 ? `Vocês gastaram ${Math.abs(data.diff).toFixed(1)}% a mais` :
         data.diff < 0 ? `Vocês gastaram ${Math.abs(data.diff).toFixed(1)}% a menos` :
         'Igual ao mês passado'}
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
        Mês anterior: {mask(formatCurrency(data.totalAnt))}
      </div>
    </div>,

    <div key={3} style={slideStyle('#1E3A5F', '#1D4ED8')}>
      <div style={slideLabel}>{data.sobra >= 0 ? '💰 Sobrou no mês!' : '🚨 Excedeu a renda'}</div>
      <div style={{ ...slideValue, color: data.sobra >= 0 ? '#4ADE80' : '#F87171' }}>
        {data.rendaVal > 0 ? mask(formatCurrency(Math.abs(data.sobra))) : '—'}
      </div>
      <div style={slideSubtext}>
        {data.rendaVal > 0
          ? data.sobra >= 0
            ? `${((data.sobra / data.rendaVal) * 100).toFixed(1)}% da renda guardada 🎉`
            : `Gastaram ${((-data.sobra / data.rendaVal) * 100).toFixed(1)}% a mais da renda`
          : 'Informe a renda para calcular a sobra'}
      </div>
    </div>,

    <div key={4} style={slideStyle('#3B0764', '#6B21A8')}>
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎊</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', textAlign: 'center', lineHeight: 1.4, maxWidth: 400 }}>
        {data.frase}
      </div>
      <div style={{ marginTop: '2rem', fontSize: '0.875rem', opacity: 0.6, color: 'white' }}>
        Meu Financeiro · {formatMonth(data.mes, data.ano)}
      </div>
    </div>,
  ]

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumo do Mês</h1>
          <p className="page-subtitle">Wrapped financeiro de {formatMonth(mes, ano)}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div
          ref={wrapRef}
          id="wrapped-slide"
          style={{
            width: '100%',
            maxWidth: 480,
            borderRadius: 24,
            overflow: 'hidden',
            opacity: animating ? 0 : 1,
            transform: animating ? 'scale(0.96)' : 'scale(1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {slides[slide]}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              style={{
                width: slide === i ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: slide === i ? 'var(--color-primary)' : 'var(--color-border)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                padding: 0,
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => goToSlide(Math.max(0, slide - 1))}
            disabled={slide === 0}
          >
            ← Anterior
          </button>
          {slide < slides.length - 1 ? (
            <button
              id="btn-proximo-slide"
              className="btn btn-primary"
              onClick={() => goToSlide(slide + 1)}
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              id="btn-compartilhar-resumo"
              className="btn btn-primary"
              onClick={() => {
                const el = wrapRef.current
                if (!el) return
                import('html2canvas').then(({ default: html2canvas }) => {
                  html2canvas(el, { scale: 2 } as any).then(canvas => {
                    const link = document.createElement('a')
                    link.download = `meu-financeiro-${formatMonth(mes, ano).replace('/', '-')}.png`
                    link.href = canvas.toDataURL()
                    link.click()
                  })
                })
              }}
            >
              <Download size={16} />
              Salvar como imagem
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

const slideStyle = (from: string, to: string): React.CSSProperties => ({
  background: `linear-gradient(160deg, ${from}, ${to})`,
  minHeight: 380,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2.5rem',
  textAlign: 'center',
})

const slideLabel: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.7)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '1rem',
}

const slideValue: React.CSSProperties = {
  fontSize: '2.5rem',
  fontWeight: 900,
  color: 'white',
  letterSpacing: '-1px',
  lineHeight: 1.1,
}

const slideSubtext: React.CSSProperties = {
  fontSize: '1rem',
  color: 'rgba(255,255,255,0.75)',
  marginTop: '0.75rem',
  fontWeight: 500,
}
