'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

type HideValuesContextType = {
  hidden: boolean
  toggleHidden: () => void
  mask: (value: string) => string
}

const HideValuesContext = createContext<HideValuesContextType>({
  hidden: false,
  toggleHidden: () => {},
  mask: (v) => v,
})

export function HideValuesProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false)

  const toggleHidden = () => setHidden(h => !h)

  const mask = (value: string) => hidden ? '• • • • •' : value

  return (
    <HideValuesContext.Provider value={{ hidden, toggleHidden, mask }}>
      {children}
    </HideValuesContext.Provider>
  )
}

export const useHideValues = () => useContext(HideValuesContext)
