'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  label: string
  href: string
}

type NavSection = {
  label: string
  base: string
  icon: JSX.Element
  items: NavItem[]
}

const navTree: NavSection[] = [
  {
    label: 'Dagplanning',
    base: '/dagplanning',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    items: [
      { label: 'Planning', href: '/dagplanning/planning' },
      { label: 'Behandelingen', href: '/dagplanning/behandelingen' },
      { label: 'Handelingen Overzicht', href: '/dagplanning/medewerkers' },
      { label: 'Dashboard', href: '/dagplanning/analyse' }
    ]
  },
  {
    label: 'Weekplanning',
    base: '/weekplanning',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    items: [
      { label: 'CAP Overzicht', href: '/weekplanning/cap-overzicht' }
    ]
  },
  {
    label: 'Calibratie',
    base: '/calibratie',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    items: [
      { label: 'Medicatie builder', href: '/calibratie/medicatie' },
      { label: 'Dagco & personeel', href: '/calibratie/dagco' }
    ]
  }
]

export default function SidebarTree({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()

  if (collapsed) {
    return (
      <nav className="flex flex-col items-center gap-3 p-3" aria-label="Sitemap navigatie">
        {navTree.map(section => {
          const isSectionActive = pathname?.startsWith(section.base)
          return (
            <Link
              key={section.base}
              href={section.items[0]?.href || section.base}
              title={section.label}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                isSectionActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {section.icon}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex flex-col gap-3 p-3 text-sm" aria-label="Sitemap navigatie">
      {navTree.map(section => {
        const isSectionActive = pathname?.startsWith(section.base)
        return (
          <div key={section.base} className="space-y-1">
            <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
              isSectionActive ? 'text-blue-700' : 'text-slate-500'
            }`}>
              {section.icon}
              <span>{section.label}</span>
            </div>
            <div className="border-l border-slate-200 ml-1 pl-3 space-y-1">
              {section.items.map(item => {
                const isActive = pathname?.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-md px-2 py-1 text-[12px] transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
