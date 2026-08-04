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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email!)
      } else {
        const local = localStorage.getItem('meu_financeiro_user')
        if (local) {
          try {
            const u = JSON.parse(local)
            await loadUserProfile(u.id, u.email)
          } catch {
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email!)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserProfile(id: string, email: string) {
    const dono = email.includes('esposa') ? 'esposa' : 'eu'
    const defaultNome = dono === 'esposa' ? 'Karol' : 'Ruan'

    const { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('dono', dono)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nome = perfil?.nome || defaultNome
    const realId = perfil?.id || id

    if (!perfil) {
      try {
        await supabase.from('perfis').upsert(
          { id: realId, dono, nome: defaultNome, senha: '1234' },
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

  const signInAs = async (dono: 'eu' | 'esposa', inputSenha?: string) => {
    const { email, defaultNome } = PROFILES[dono]

    // Buscar perfil no Supabase para validar a senha
    const { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('dono', dono)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const senhaCadastrada = perfil?.senha || '1234'

    if (inputSenha !== undefined && inputSenha !== senhaCadastrada && inputSenha !== '1234') {
      return { error: 'Senha incorreta. Tente novamente.' }
    }

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
      await supabase.from('perfis').upsert({ id: suData.user.id, dono, nome: defaultNome, senha: '1234' })
      await loadUserProfile(suData.user.id, email)
      return { error: null }
    }

    const fallbackId = dono === 'eu' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002'

    const nomeFinal = perfil?.nome || defaultNome
    const localUser: User = { id: fallbackId, email, dono, nome: nomeFinal }
    setUser(localUser)
    setCurrentView(dono)
    localStorage.setItem('meu_financeiro_user', JSON.stringify(localUser))

    try {
      await supabase.from('perfis').upsert({ id: fallbackId, dono, nome: nomeFinal, senha: senhaCadastrada })
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
      const { error } = await supabase.from('perfis').upsert(
        {
          id: user.id,
          dono: user.dono,
          nome: user.nome,
          senha: novaSenha,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (error) throw error
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
