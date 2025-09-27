import type { Metadata } from 'next'
import "./globals.css";

import { Inter } from "next/font/google";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Portfolio Performance Dashboard',
  description: 'Advanced portfolio analysis and visualization dashboard',
}

interface RootLayoutProps {
  children: React.ReactNode
}

const RootLayout = ({ children }: RootLayoutProps): JSX.Element => {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
          {children}
        </div>
      </body>
    </html>
  )
}

export default RootLayout
