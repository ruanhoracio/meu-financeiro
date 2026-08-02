'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { signInAs, user, loading } = useAuth()
  const router = useRouter()
  const [loggingIn, setLoggingIn] = useState<'eu' | 'esposa' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  const handleLogin = async (dono: 'eu' | 'esposa') => {
    setLoggingIn(dono)
    setError('')
    const { error } = await signInAs(dono)
    if (error) {
      setError('Erro ao entrar. Tente novamente.')
      setLoggingIn(null)
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
          <div className="login-feature"><div className="feature-dot" /><span>Controle de gastos do casal</span></div>
          <div className="login-feature"><div className="feature-dot" /><span>Dados sincronizados em qualquer dispositivo</span></div>
          <div className="login-feature"><div className="feature-dot" /><span>Gráficos, cofrinhos e relatórios</span></div>
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
            <p>Escolha o seu perfil para acessar</p>
          </div>

          {error && (
            <div style={{
              background: '#FEE2E2', color: '#DC2626',
              padding: '0.75rem 1rem', borderRadius: 10,
              fontSize: '0.875rem', fontWeight: 500,
              marginBottom: '1rem', textAlign: 'center',
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              id="btn-login-eu"
              onClick={() => handleLogin('eu')}
              disabled={loggingIn !== null}
              className="login-profile-btn"
            >
              <span className="login-profile-avatar" style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)' }}>
                👤
              </span>
              <div className="login-profile-info">
                <span className="login-profile-name">Ruan</span>
                <span className="login-profile-sub">Contas e finanças do Ruan</span>
              </div>
              {loggingIn === 'eu' ? (
                <span className="login-spinner" />
              ) : (
                <span className="login-arrow">→</span>
              )}
            </button>

            <button
              id="btn-login-esposa"
              onClick={() => handleLogin('esposa')}
              disabled={loggingIn !== null}
              className="login-profile-btn"
            >
              <span className="login-profile-avatar" style={{ background: 'linear-gradient(135deg, #EC4899, #F472B6)' }}>
                👩
              </span>
              <div className="login-profile-info">
                <span className="login-profile-name">Karol</span>
                <span className="login-profile-sub">Contas e finanças da Karol</span>
              </div>
              {loggingIn === 'esposa' ? (
                <span className="login-spinner" />
              ) : (
                <span className="login-arrow">→</span>
              )}
            </button>
          </div>

          <p className="login-footer-text">
            💜 Acesso restrito ao casal — sem cadastro aberto
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
        }
        .login-left {
          flex: 1;
          background: linear-gradient(135deg, #92400E 0%, #D97706 40%, #F59E0B 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem;
          position: relative;
          overflow: hidden;
        }
        .login-brand {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 3rem;
        }
        .login-brand-icon {
          font-size: 2.5rem;
          background: rgba(255,255,255,0.2);
          width: 60px;
          height: 60px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }
        .login-brand-name {
          font-size: 2rem;
          font-weight: 800;
          color: rgba(255,255,255,0.7);
          letter-spacing: -1px;
        }
        .login-brand-name span { color: white; }
        .login-taglines {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          z-index: 1;
        }
        .login-feature {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: rgba(255,255,255,0.85);
          font-size: 1rem;
          font-weight: 500;
        }
        .feature-dot {
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          pointer-events: none;
        }
        .orb-1 { width:400px;height:400px;bottom:-100px;right:-100px; }
        .orb-2 { width:250px;height:250px;top:-80px;right:50px;background:rgba(255,255,255,0.05); }
        .orb-3 { width:150px;height:150px;top:40%;left:60%;background:rgba(255,255,255,0.06); }

        .login-right {
          width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: var(--color-bg);
        }
        .login-form-card {
          width: 100%;
          max-width: 380px;
        }
        .login-form-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .login-logo-mini {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }
        .login-form-header h2 {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--color-text);
          margin-bottom: 0.5rem;
        }
        .login-form-header p {
          color: var(--color-text-muted);
          font-size: 0.875rem;
        }
        .login-profile-btn {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 100%;
          padding: 1.1rem 1.25rem;
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .login-profile-btn:hover:not(:disabled) {
          border-color: var(--color-primary);
          background: var(--color-primary-muted);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(217,119,6,0.15);
        }
        .login-profile-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-profile-avatar {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        .login-profile-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .login-profile-name {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text);
        }
        .login-profile-sub {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }
        .login-arrow {
          font-size: 1.25rem;
          color: var(--color-primary);
          font-weight: 700;
          transition: transform 0.2s;
        }
        .login-profile-btn:hover .login-arrow {
          transform: translateX(4px);
        }
        .login-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-footer-text {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.75rem;
          margin-top: 2rem;
        }
        @media (max-width: 768px) {
          .login-page { flex-direction: column; }
          .login-left { padding: 2rem; min-height: 220px; }
          .login-right { width: 100%; flex: 1; }
        }
      `}</style>
    </div>
  )
}
