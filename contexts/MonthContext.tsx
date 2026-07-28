'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type MonthContextType = {
  mes: number
  ano: number
  setMonth: (mes: number, ano: number) => void
}

const MonthContext = createContext<MonthContextType>({
  mes: new Date().getMonth() + 1,
  ano: new Date().getFullYear(),
  setMonth: () => {},
})

const STORAGE_KEY = 'meu_financeiro_month'

export function MonthProvider({ children }: { children: ReactNode }) {
  const [mes, setMes] = useState(() => {
    if (typeof window === 'undefined') return new Date().getMonth() + 1
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const { mes: m, ano: a } = JSON.parse(saved)
        if (m >= 1 && m <= 12 && a >= 2020) return m
      } catch {}
    }
    return new Date().getMonth() + 1
  })

  const [ano, setAno] = useState(() => {
    if (typeof window === 'undefined') return new Date().getFullYear()
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const { ano: a } = JSON.parse(saved)
        if (a >= 2020) return a
      } catch {}
    }
    return new Date().getFullYear()
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mes, ano }))
  }, [mes, ano])

  const setMonth = (m: number, a: number) => {
    setMes(m)
    setAno(a)
  }

  return (
    <MonthContext.Provider value={{ mes, ano, setMonth }}>
      {children}
    </MonthContext.Provider>
  )
}

export const useMonth = () => useContext(MonthContext)
