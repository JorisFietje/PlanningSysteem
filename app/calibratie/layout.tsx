'use client'

import Image from 'next/image'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/common/Navbar'

const sidebarItems = [
  {
    href: '/calibratie/medicatie',
    label: 'Medicatie builder',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 01-2.828 0L13 11.828l-3.6 3.6a2 2 0 01-2.828-2.828l3.6-3.6-3.6-3.6a2 2 0 012.828-2.828l3.6 3.6 3.6-3.6a2 2 0 112.828 2.828l-3.6 3.6 3.6 3.6a2 2 0 010 2.828z" />
      </svg>
    )
  },
  {
    href: '/calibratie/dagco',
    label: 'Dagco & personeel',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4a4 4 0 110 8 4 4 0 010-8zm0 8c-4.418 0-8 2.239-8 5v3h16v-3c0-2.761-3.582-5-8-5z" />
      </svg>
    )
  }
]

export default function CalibratieLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-6 py-4 min-h-[94px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 flex items-center justify-center">
              <Image src="/logo.png" alt="St. Antonius Logo" width={40} height={40} className="object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Dagbehandeling 4B</h1>
              <p className="text-xs text-white/80">Calibratie instellingen</p>
            </div>
          </div>
          <div className="text-xs text-white/80 bg-white/10 px-3 py-2 rounded-lg border border-white/20">
            Alle wijzigingen worden automatisch opgeslagen
          </div>
        </div>
        <Navbar variant="primary" />
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">Calibratie</h2>
            <div className="h-8 w-px bg-slate-300" />
            <div className="text-sm text-slate-600">
              Beheer medicatie, dagco en personeelsinstellingen.
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
            <nav className="flex flex-col p-4 space-y-1 flex-1" aria-label="Calibratie navigatie">
              {sidebarItems.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                    pathname?.startsWith(item.href)
                      ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
          </aside>

          <div className="flex-1 overflow-y-auto p-6" tabIndex={0} role="region" aria-label="Calibratie inhoud">
            <div className="max-w-[1800px] mx-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
