'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Lock, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react'

export default function LoginPage() {
  const { signInAs, user, loading } = useAuth()
  const router = useRouter()
  const [selectedDono, setSelectedDono] = useState<'eu' | 'esposa' | null>(null)
  const [senhaInput, setSenhaInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  const openPasswordModal = (dono: 'eu' | 'esposa') => {
    setSelectedDono(dono)
    setSenhaInput('')
    setError('')
  }

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedDono) return
    if (!senhaInput.trim()) {
      setError('Por favor, digite sua senha de acesso.')
      return
    }

    setLoggingIn(true)
    setError('')
    const { error: err } = await signInAs(selectedDono, senhaInput.trim())
    setLoggingIn(false)

    if (err) {
      setError(err)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-icon">💰</div>
          <h1 className="login-brand-name">Meu <span>Financeiro</span></h1>
        </div>
        <div className="login-taglines">
          <div className="login-feature"><div className="feature-dot" /><span>Controle financeiro seguro do casal</span></div>
          <div className="login-feature"><div className="feature-dot" /><span>Proteção por senha por perfil</span></div>
          <div className="login-feature"><div className="feature-dot" /><span>Sincronizado na nuvem e em tempo real</span></div>
        </div>
        <div className="login-orbs">
          <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-card">
          <div className="login-form-header">
            <div className="login-logo-mini">💰</div>
            <h2>Quem vai entrar?</h2>
            <p>Selecione seu perfil para informar a senha</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              id="btn-login-eu"
              onClick={() => openPasswordModal('eu')}
              className="login-profile-btn"
            >
              <span className="login-profile-avatar" style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)' }}>
                👤
              </span>
              <div className="login-profile-info">
                <span className="login-profile-name">Ruan</span>
                <span className="login-profile-sub">Contas e finanças do Ruan</span>
              </div>
              <span className="login-arrow">→</span>
            </button>

            <button
              id="btn-login-esposa"
              onClick={() => openPasswordModal('esposa')}
              className="login-profile-btn"
            >
              <span className="login-profile-avatar" style={{ background: 'linear-gradient(135deg, #EC4899, #F472B6)' }}>
                👩
              </span>
              <div className="login-profile-info">
                <span className="login-profile-name">Karol</span>
                <span className="login-profile-sub">Contas e finanças da Karol</span>
              </div>
              <span className="login-arrow">→</span>
            </button>
          </div>

          <p className="login-footer-text" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            🔒 Acesso protegido por senha — Finanças do Casal
          </p>
        </div>
      </div>

      {/* Modal de Senha */}
      {selectedDono && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setSelectedDono(null)}
        >
          <div
            className="card"
            style={{
              width: '100%', maxWidth: 400, padding: '1.75rem', borderRadius: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)', background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)', animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 0.75rem auto',
                  background: selectedDono === 'eu' ? 'linear-gradient(135deg, #D97706, #F59E0B)' : 'linear-gradient(135deg, #EC4899, #F472B6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24
                }}
              >
                {selectedDono === 'eu' ? '👤' : '👩'}
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                Digite a senha do {selectedDono === 'eu' ? 'Ruan' : 'Karol'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Proteção de acesso do perfil
              </p>
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2', color: '#DC2626',
                padding: '0.6rem 0.85rem', borderRadius: 12,
                fontSize: '0.8rem', fontWeight: 600,
                marginBottom: '1rem', textAlign: 'center',
              }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{
                    width: '100%', paddingRight: '2.5rem', fontSize: '1rem',
                    textAlign: 'center', letterSpacing: showPassword ? 'normal' : '0.25em',
                    fontWeight: 700
                  }}
                  placeholder="Digite sua senha de acesso"
                  value={senhaInput}
                  onChange={e => setSenhaInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--color-text-muted)',
                    cursor: 'pointer', padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={() => setSelectedDono(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={loggingIn || !senhaInput.trim()}
                >
                  {loggingIn ? 'Validando...' : 'Entrar →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
