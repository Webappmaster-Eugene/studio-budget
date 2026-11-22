import '@fontsource/golos-text/cyrillic-400.css'
import '@fontsource/golos-text/cyrillic-500.css'
import '@fontsource/golos-text/cyrillic-600.css'
import '@fontsource/golos-text/cyrillic-700.css'
import '@fontsource/golos-text/latin-400.css'
import '@fontsource/golos-text/latin-600.css'
import '@fontsource/golos-text/latin-700.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Бюджет студии',
  description: 'Демо отчёта о бюджете и фактических расходах творческой студии.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
