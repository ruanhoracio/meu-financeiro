'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useMonth } from '@/contexts/MonthContext'
import {
  LayoutDashboard, CreditCard, Tag, Clock,
  PiggyBank, Upload, FileBarChart, LogOut,
  Moon, Sun, Menu, X, ChevronLeft, ChevronRight,
  Eye, EyeOff, UserCog, FileSpreadsheet,
} from 'lucide-react'
import { useState } from 'react'
import { formatMonth } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/contas',          icon: CreditCard,       label: 'Contas & Lançamentos' },
  { href: '/credito',         icon: CreditCard,       label: 'Cartão de Crédito' },
  { href: '/importar',        icon: Upload,           label: 'Importar Extrato Nubank' },
  { href: '/importar-sheets', icon: FileSpreadsheet,  label: 'Importar Google Sheets' },
  { href: '/categorias',      icon: Tag,              label: 'Categorias' },
  { href: '/historico',       icon: Clock,            label: 'Histórico' },
  { href: '/cofrinhos',       icon: PiggyBank,        label: 'Cofrinhos de Metas' },
  { href: '/resumo',          icon: FileBarChart,     label: 'Resumo do Mês' },
  { href: '/perfil',          icon: UserCog,          label: 'Meu Perfil & Salário' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, signOut, currentView, setCurrentView } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { hidden, toggleHidden } = useHideValues()
  const { mes, ano, setMonth } = useMonth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const prevMonth = () => {
    if (mes === 1) setMonth(12, ano - 1)
    else setMonth(mes - 1, ano)
  }

  const nextMonth = () => {
    if (mes === 12) setMonth(1, ano + 1)
    else setMonth(mes + 1, ano)
  }

  const showViewSwitcher = !['/categorias', '/cofrinhos', '/perfil', '/credito'].includes(pathname)

  const viewLabels = {
    eu:       user?.dono === 'eu' ? (user?.nome || 'Eu') : 'Acesso dele',
    esposa:   user?.dono === 'esposa' ? (user?.nome || 'Karol') : 'Acesso Karol',
    conjunto: 'Conjunto',
  }

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, backdropFilter: 'blur(2px)'
          }}
        />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">💰</div>
          <span className="sidebar-logo-text">Meu <span>Financeiro</span></span>
          <button
            className="btn btn-ghost btn-icon sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            style={{ marginLeft: 'auto' }}
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <span className="sidebar-section-label">Menu</span>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} className="nav-icon" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '0.875rem',
              marginBottom: '0.5rem',
              flexShrink: 0,
            }}>
              {user?.nome?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                {user?.nome}
              </div>
              <Link href="/perfil" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
                Editar perfil →
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              id="btn-toggle-theme"
              onClick={toggleTheme}
              className="btn btn-ghost btn-sm flex-1"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Claro' : 'Escuro'}
            </button>
            <button
              id="btn-logout"
              onClick={signOut}
              className="btn btn-ghost btn-icon"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-header">
          <button
            className="btn btn-ghost btn-icon sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="month-selector">
            <button onClick={prevMonth} className="month-btn" aria-label="Mês anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="month-label">{formatMonth(mes, ano)}</span>
            <button onClick={nextMonth} className="month-btn" aria-label="Próximo mês">
              <ChevronRight size={16} />
            </button>
          </div>

          {showViewSwitcher && (
            <div className="view-switcher" role="group" aria-label="Selecionar visão">
              {(['eu', 'esposa', 'conjunto'] as const).map(v => (
                <button
                  key={v}
                  id={`view-tab-${v}`}
                  className={`view-tab ${currentView === v ? 'active' : ''}`}
                  onClick={() => setCurrentView(v)}
                >
                  {viewLabels[v]}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button
            id="btn-toggle-hide-values"
            onClick={toggleHidden}
            className="btn btn-ghost btn-icon"
            title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
            style={{ color: hidden ? 'var(--color-primary)' : undefined }}
          >
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>

          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-icon"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  )
}
