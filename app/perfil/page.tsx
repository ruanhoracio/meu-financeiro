'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentMonth, formatCurrency } from '@/lib/utils'
import { Save, User, CheckCircle, DollarSign } from 'lucide-react'

export default function PerfilPage() {
  const { user, loading, updateNome, signOut, currentView, setCurrentView } = useAuth()
  const { mask } = useHideValues()
  const router = useRouter()
  const { mes, ano } = getCurrentMonth()
  const [nome, setNome] = useState('')
  const [salario, setSalario] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (user) {
      setNome(user.nome)
      loadSalario()
    }
  }, [user, loading, router])

  async function loadSalario() {
    const dono = currentView === 'conjunto' ? 'eu' : currentView
    const { data } = await supabase
      .from('rendas')
      .select('valor')
      .eq('dono', dono)
      .eq('mes', mes)
      .eq('ano', ano)
      .single()
    if (data?.valor) {
      setSalario(data.valor.toString())
    }
  }

  async function handleSave() {
    if (!nome.trim()) return
    setSaving(true)
    await updateNome(nome.trim())

    if (salario) {
      const val = parseFloat(salario.replace(',', '.'))
      if (!isNaN(val)) {
        const dono = currentView === 'conjunto' ? 'eu' : currentView
        await supabase.from('rendas').upsert({
          user_id: user!.id,
          dono,
          mes,
          ano,
          valor: val,
        }, { onConflict: 'dono,mes,ano' })
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Meu Perfil & Configurações</h1>
          <p className="page-subtitle">Configure seu nome e seu salário mensal</p>
        </div>
      </div>

      <div style={{ maxWidth: 520 }}>
        {/* Avatar Card */}
        <div className="card card-p" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: '1.5rem',
            flexShrink: 0,
          }}>
            {nome?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)' }}>{nome || user?.nome}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {user?.dono === 'eu' ? '👤 Meu Portal' : '👩 Portal da Esposa'}
            </div>
          </div>
        </div>

        {/* Form Perfil */}
        <div className="card card-p" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)' }}>
            <User size={16} color="var(--color-primary)" />
            Seu Nome no App
          </h3>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Nome de exibição</label>
            <input
              id="input-nome-perfil"
              className="form-input"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: João, Eu, Marido..."
            />
          </div>

          <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)' }}>
            <DollarSign size={16} color="var(--color-primary)" />
            Salário / Renda Mensal (R$)
          </h3>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Qual é o seu salário mensal neste mês?</label>
            <input
              id="input-salario-perfil"
              type="number"
              step="0.01"
              className="form-input"
              value={salario}
              onChange={e => setSalario(e.target.value)}
              placeholder="Ex: 5000,00"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
              Este valor é usado no Dashboard para calcular quanto sobrou do mês.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {saved ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-status-pago)', fontWeight: 600, fontSize: '0.875rem' }}>
                <CheckCircle size={18} />
                Dados salvos com sucesso!
              </div>
            ) : (
              <button
                id="btn-salvar-perfil"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !nome.trim()}
              >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar Perfil & Salário'}
              </button>
            )}
          </div>
        </div>

        {/* Sessão */}
        <div className="card card-p" style={{ borderColor: '#FECACA' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>🔐 Sessão</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Para alternar de conta (Eu ↔ Esposa), saia para a tela inicial.
          </p>
          <button
            id="btn-sair-perfil"
            className="btn btn-danger btn-sm"
            onClick={signOut}
          >
            Sair do App
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
