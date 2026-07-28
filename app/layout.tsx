import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { HideValuesProvider } from '@/contexts/HideValuesContext'
import { MonthProvider } from '@/contexts/MonthContext'

export const metadata: Metadata = {
  title: 'Meu Financeiro — Controle Financeiro do Casal',
  description: 'Aplicativo de controle financeiro pessoal e do casal. Gerencie gastos, metas e extratos bancários em um só lugar.',
  keywords: 'finanças pessoais, controle financeiro, orçamento, gastos, metas, casal',
  icons: {
    icon: [
      { url: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💰</text></svg>' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <MonthProvider>
              <HideValuesProvider>
                {children}
              </HideValuesProvider>
            </MonthProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
