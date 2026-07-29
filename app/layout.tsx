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
    icon: '/logo.png',
    apple: '/icons/icon-180x180.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Meu Financeiro',
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
