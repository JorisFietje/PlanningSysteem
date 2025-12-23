'use client'

import Image from 'next/image'
import { ReactNode, useState } from 'react'
import SidebarTree from '@/components/common/SidebarTree'

export default function CalibratieLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <header
        className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg flex-shrink-0"
        style={{ minHeight: '70.5px' }}
      >
        <div className="max-w-[1800px] mx-auto px-6 py-2.5 min-h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 flex items-center justify-center">
              <Image src="/logo.png" alt="St. Antonius Logo" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Dagbehandeling 4B</h1>
              <p className="text-[11px] text-white/80">Calibratie instellingen</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <aside className={`${sidebarCollapsed ? 'w-16' : 'w-56'} bg-white border-r border-slate-200 flex-shrink-0 flex flex-col transition-[width] duration-300 ease-in-out`}>
            <div className="flex items-center justify-end px-2 py-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(prev => !prev)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title={sidebarCollapsed ? 'Sidebar uitklappen' : 'Sidebar inklappen'}
              >
                {sidebarCollapsed ? '»' : '«'}
              </button>
            </div>
            <div className="flex-1">
              <SidebarTree collapsed={sidebarCollapsed} />
            </div>
          </aside>

          <div className="flex-1 overflow-y-auto p-6" tabIndex={0} role="region" aria-label="Calibratie inhoud">
            <div className={sidebarCollapsed ? 'max-w-none mx-0' : 'max-w-[1800px] mx-auto'}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
