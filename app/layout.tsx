import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { HideValuesProvider } from '@/contexts/HideValuesContext'
import { MonthProvider } from '@/contexts/MonthContext'
import SplashWrapper from '@/components/SplashWrapper'

export const metadata: Metadata = {
  title: 'NovaCash',
  description: 'NovaCash — Controle financeiro inteligente. Gerencie gastos, metas e extratos em um só lugar.',
  keywords: 'finanças pessoais, controle financeiro, orçamento, gastos, metas, NovaCash',
  icons: {
    icon: '/logo.svg',
    apple: '/icons/icon-180x180.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NovaCash',
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
        <SplashWrapper>
          <ThemeProvider>
            <AuthProvider>
              <MonthProvider>
                <HideValuesProvider>
                  {children}
                </HideValuesProvider>
              </MonthProvider>
            </AuthProvider>
          </ThemeProvider>
        </SplashWrapper>
      </body>
    </html>
  )
}
