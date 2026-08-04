'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { ViewType } from '@/lib/database.types'

type User = {
  id: string
  email: string
  dono: 'eu' | 'esposa'
  nome: string
}

type AuthContextType = {
  user: User | null
  loading: boolean
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  signInAs: (dono: 'eu' | 'esposa', inputSenha?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateNome: (nome: string) => Promise<void>
  updateSenha: (novaSenha: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  currentView: 'eu',
  setCurrentView: () => {},
  signInAs: async () => ({ error: null }),
  signOut: async () => {},
  updateNome: async () => {},
  updateSenha: async () => ({ error: null }),
})

const PROFILES = {
  eu:     { email: 'eu@meufinanceiro.com',     dono: 'eu'     as const, defaultNome: 'Ruan'  },
  esposa: { email: 'esposa@meufinanceiro.com', dono: 'esposa' as const, defaultNome: 'Karol' },
}

const PASSWORDS = ['MeuFinanceiro2025!', '123456', '12345678', 'password123']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null)
  const [loading, setLoading]         = useState(true)
  const [currentView, setCurrentView] = useState<ViewType>('eu')

  useEffect(() => {
    // Carregar sessão salva apenas se existir no localStorage
    const local = typeof window !== 'undefined' ? localStorage.getItem('meu_financeiro_user') : null
    if (local) {
      try {
        const u = JSON.parse(local)
        loadUserProfile(u.id, u.email)
      } catch {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  async function loadUserProfile(id: string, email: string) {
    const dono = email.includes('esposa') ? 'esposa' : 'eu'
    const defaultNome = dono === 'esposa' ? 'Karol' : 'Ruan'

    // Explicit query without select('*') to prevent schema missing column errors
    const { data: perfil } = await supabase
      .from('perfis')
      .select('id, dono, nome, avatar_url, updated_at')
      .eq('dono', dono)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nome = perfil?.nome || defaultNome
    const realId = perfil?.id || id

    if (!perfil) {
      try {
        await supabase.from('perfis').upsert(
          { id: realId, dono, nome: defaultNome },
          { onConflict: 'dono' }
        )
      } catch {}
    }

    const u: User = { id: realId, email, dono, nome }
    setUser(u)
    setCurrentView(dono as ViewType)
    localStorage.setItem('meu_financeiro_user', JSON.stringify(u))
    setLoading(false)
  }

  const getSavedPin = (dono: 'eu' | 'esposa'): string => {
    if (typeof window === 'undefined') return '1234'
    const saved = localStorage.getItem(`meu_financeiro_pin_${dono}`)
    return saved || '1234'
  }

  const signInAs = async (dono: 'eu' | 'esposa', inputSenha?: string) => {
    const savedPin = getSavedPin(dono)

    if (inputSenha !== undefined && inputSenha !== savedPin) {
      return { error: 'Senha incorreta. Tente novamente.' }
    }

    const { email, defaultNome } = PROFILES[dono]

    for (const pwd of PASSWORDS) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
      if (!error && data.user) {
        await loadUserProfile(data.user.id, email)
        return { error: null }
      }
    }

    const { data: suData, error: suErr } = await supabase.auth.signUp({
      email,
      password: PASSWORDS[0],
    })

    if (!suErr && suData.user) {
      await supabase.from('perfis').upsert({ id: suData.user.id, dono, nome: defaultNome })
      await loadUserProfile(suData.user.id, email)
      return { error: null }
    }

    const fallbackId = dono === 'eu' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002'

    const { data: perfilExistente } = await supabase
      .from('perfis')
      .select('nome')
      .eq('dono', dono)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nomeFinal = perfilExistente?.nome || defaultNome
    const localUser: User = { id: fallbackId, email, dono, nome: nomeFinal }
    setUser(localUser)
    setCurrentView(dono)
    localStorage.setItem('meu_financeiro_user', JSON.stringify(localUser))

    try {
      await supabase.from('perfis').upsert({ id: fallbackId, dono, nome: nomeFinal })
    } catch {}

    return { error: null }
  }

  const signOut = async () => {
    try { await supabase.auth.signOut() } catch {}
    localStorage.removeItem('meu_financeiro_user')
    setUser(null)
  }

  const updateNome = async (nome: string) => {
    if (!user) return
    const updated = { ...user, nome }
    setUser(updated)
    localStorage.setItem('meu_financeiro_user', JSON.stringify(updated))

    try {
      await supabase.from('perfis').upsert(
        {
          id: user.id,
          dono: user.dono,
          nome,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    } catch (e) {
      console.error('Erro ao atualizar nome no Supabase:', e)
    }
  }

  const updateSenha = async (novaSenha: string) => {
    if (!user) return { error: 'Usuário não autenticado' }
    try {
      localStorage.setItem(`meu_financeiro_pin_${user.dono}`, novaSenha)
      return { error: null }
    } catch (e: any) {
      console.error('Erro ao atualizar senha:', e)
      return { error: e.message || 'Erro ao salvar senha' }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, currentView, setCurrentView, signInAs, updateNome, updateSenha, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
